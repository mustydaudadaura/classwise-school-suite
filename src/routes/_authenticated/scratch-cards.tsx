import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, KeyRound, Save, Ban, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { generateScratchCards } from "@/lib/api/scratch-cards.functions";
import { DEFAULT_SCRATCH_SETTINGS, cardState, formatPin, scratchStats, type ScratchSettings } from "@/lib/scratch-cards";
import { downloadBlob } from "@/lib/report-pdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/scratch-cards")({
  head: () => ({
    meta: [
      { title: "Result Scratch Cards — Alegacy" },
      { name: "description", content: "Choose free or scratch-card access to report cards, generate cards and track sales." },
      { property: "og:title", content: "Result Scratch Cards — Alegacy" },
      { property: "og:description", content: "Generate result scratch cards and track sales and usage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScratchCardsPage,
});

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

function ScratchCardsPage() {
  const { schoolId } = useAuth();
  if (!schoolId) return <p className="text-muted-foreground">Select a school first.</p>;
  return <ScratchCardsAdmin key={schoolId} schoolId={schoolId} />;
}

function ScratchCardsAdmin({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const generate = useServerFn(generateScratchCards);
  const settingsQ = useQuery({
    queryKey: ["scratch-settings", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("scratch_card_settings").select("*").eq("school_id", schoolId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const cardsQ = useQuery({
    queryKey: ["scratch-cards", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("scratch_cards").select("id, serial_no, status, price, max_views, views_used, valid_until, sold_at, sold_note, first_used_at, created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const historyQ = useQuery({
    queryKey: ["scratch-history", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("school_audit_logs").select("id, actor_id, old_value, new_value, created_at").eq("school_id", schoolId).eq("entity", "scratch_card_settings").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((d) => d.actor_id).filter(Boolean))) as string[];
      const { data: people } = ids.length ? await supabase.from("profiles").select("user_id, full_name").in("user_id", ids) : { data: [] };
      const names = new Map((people ?? []).map((p) => [p.user_id, p.full_name]));
      return (data ?? []).map((d) => ({ ...d, actor: (d.actor_id && names.get(d.actor_id)) || "Administrator" }));
    },
  });

  const [form, setForm] = useState<ScratchSettings>(DEFAULT_SCRATCH_SETTINGS);
  useEffect(() => {
    if (settingsQ.data) setForm({ access_mode: settingsQ.data.access_mode as "free" | "scratch", price: Number(settingsQ.data.price), max_views: settingsQ.data.max_views, validity_days: settingsQ.data.validity_days });
  }, [settingsQ.data]);
  const [count, setCount] = useState(50);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const cards = cardsQ.data ?? [];
  const stats = useMemo(() => scratchStats(cards.map((c) => ({ ...c, price: Number(c.price) }))), [cards]);
  const shown = cards.filter((c) => filter === "all" || (filter === "sold" ? c.status === "sold" : filter === "unsold" ? c.status === "unsold" : cardState({ ...c, price: Number(c.price) }) === filter));

  async function saveSettings() {
    if (!(form.price >= 0) || !(form.max_views >= 1) || !(form.validity_days >= 1)) return toast.error("Enter a price, at least 1 view and at least 1 day.");
    setBusy(true);
    try {
      const { data, error } = await supabase.from("scratch_card_settings").upsert({ school_id: schoolId, ...form }, { onConflict: "school_id" }).select("access_mode").single();
      if (error || data?.access_mode !== form.access_mode) throw new Error(error?.message ?? "Settings were not saved");
      await qc.invalidateQueries({ queryKey: ["scratch-settings", schoolId] });
      await qc.invalidateQueries({ queryKey: ["scratch-history", schoolId] });
      toast.success("Saved. Cards already made keep the price, views and expiry they were made with.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); } finally { setBusy(false); }
  }

  async function makeCards() {
    if (!settingsQ.data) return toast.error("Save the settings first.");
    setBusy(true);
    try {
      const res = await generate({ data: { school_id: schoolId, count } });
      const csv = ["Serial number,PIN,Price,Views,Valid until", ...res.cards.map((c) => `${c.serial_no},${formatPin(c.pin)},${res.price},${res.max_views},${res.valid_until.slice(0, 10)}`)].join("\n");
      downloadBlob(new Blob([csv], { type: "text/csv" }), `scratch_cards_${res.batch_id.slice(0, 8)}.csv`);
      await qc.invalidateQueries({ queryKey: ["scratch-cards", schoolId] });
      toast.success(`${res.cards.length} cards made. The PIN list has downloaded — keep it safe; PINs cannot be shown again.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not generate cards"); } finally { setBusy(false); }
  }

  async function mark(status: "sold" | "void") {
    const ids = Array.from(picked);
    if (!ids.length) return;
    if (status === "void" && !confirm(`Cancel ${ids.length} card(s)? Cancelled cards can never be used again.`)) return;
    const { data, error } = await supabase.from("scratch_cards").update(status === "sold" ? { status, sold_at: new Date().toISOString() } : { status }).in("id", ids).neq("status", "void").select("id");
    if (error) return toast.error(error.message);
    toast.success(`${data?.length ?? 0} card(s) marked ${status === "sold" ? "sold" : "cancelled"}`);
    setPicked(new Set());
    await qc.invalidateQueries({ queryKey: ["scratch-cards", schoolId] });
  }

  function exportList() {
    const csv = ["Serial number,Status,Price,Views used,Max views,Valid until,Sold at", ...shown.map((c) => [c.serial_no, cardState({ ...c, price: Number(c.price) }), c.price, c.views_used, c.max_views, c.valid_until.slice(0, 10), c.sold_at?.slice(0, 10) ?? ""].join(","))].join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv" }), "scratch_card_register.csv");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Result Scratch Cards</h1>
        <p className="text-sm text-muted-foreground">Decide whether parents see report cards free or with a scratch card PIN.</p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[["Generated", stats.generated], ["Sold", stats.sold], ["Revenue", naira(stats.revenue)], ["Unused", stats.unused], ["Used", stats.used], ["Expired", stats.expired], ["Cancelled", stats.voided], ["Views left", stats.remainingViews]].map(([l, v]) => (
          <Card key={l as string}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="text-xl font-bold">{v}</div></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Access rules</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {(["free", "scratch"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setForm((f) => ({ ...f, access_mode: m }))} className={`rounded-lg border p-3 text-left ${form.access_mode === m ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}>
                <div className="font-semibold text-sm">{m === "free" ? "Free access" : "Scratch card access"}</div>
                <div className="text-xs text-muted-foreground">{m === "free" ? "Parents see published report cards without a PIN." : "Parents must enter a valid PIN to open a report card."}</div>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Price per card (₦)</Label><Input type="number" min={0} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))} /></div>
            <div><Label>Views per card</Label><Input type="number" min={1} value={form.max_views} onChange={(e) => setForm((f) => ({ ...f, max_views: Number(e.target.value) }))} /></div>
            <div><Label>Valid for (days)</Label><Input type="number" min={1} value={form.validity_days} onChange={(e) => setForm((f) => ({ ...f, validity_days: Number(e.target.value) }))} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Views and validity are separate: a card stops working when its views run out or its date passes, whichever comes first. One card works for one child and only published results. Changing these rules affects new cards only.</p>
          <Button onClick={saveSettings} disabled={busy}><Save className="mr-2 h-4 w-4" />Save rules</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Generate cards</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div><Label>How many</Label><Input className="w-32" type="number" min={1} max={1000} value={count} onChange={(e) => setCount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} /></div>
          <Button onClick={makeCards} disabled={busy || !settingsQ.data}><KeyRound className="mr-2 h-4 w-4" />{busy ? "Working…" : `Generate ${count} card(s)`}</Button>
          <p className="w-full text-xs text-muted-foreground">The PIN list downloads once as a spreadsheet for printing. For security PINs are stored scrambled and cannot be shown again.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">Card register</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-40" aria-label="Filter cards"><SelectValue /></SelectTrigger>
              <SelectContent>{[["all", "All"], ["unsold", "Not sold"], ["sold", "Sold"], ["unused", "Unused"], ["used", "In use"], ["exhausted", "No views left"], ["expired", "Expired"], ["void", "Cancelled"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
            <Button variant="outline" size="sm" onClick={exportList}><Download className="mr-1 h-4 w-4" />Export</Button>
            <Button size="sm" disabled={!picked.size} onClick={() => mark("sold")}><BadgeCheck className="mr-1 h-4 w-4" />Mark sold ({picked.size})</Button>
            <Button size="sm" variant="destructive" disabled={!picked.size} onClick={() => mark("void")}><Ban className="mr-1 h-4 w-4" />Cancel</Button>
          </div>
        </CardHeader>
        <CardContent>
          {cardsQ.error ? <p className="text-sm text-destructive">{(cardsQ.error as Error).message}</p> : !shown.length ? <p className="text-sm text-muted-foreground">No cards.</p> : (
            <div className="max-h-[480px] divide-y overflow-y-auto rounded border">
              <label className="flex items-center gap-3 bg-muted/40 px-3 py-2 text-xs font-medium">
                <Checkbox checked={picked.size > 0 && shown.every((c) => picked.has(c.id))} onCheckedChange={(v) => setPicked(v ? new Set(shown.map((c) => c.id)) : new Set())} />Select all shown ({shown.length})
              </label>
              {shown.map((c) => {
                const st = cardState({ ...c, price: Number(c.price) });
                return (
                  <label key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    <Checkbox checked={picked.has(c.id)} onCheckedChange={() => setPicked((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })} />
                    <span className="font-mono text-xs flex-1 min-w-40">{c.serial_no}</span>
                    <Badge variant={c.status === "sold" ? "default" : "outline"}>{c.status === "sold" ? "Sold" : c.status === "void" ? "Cancelled" : "Not sold"}</Badge>
                    <Badge variant={st === "expired" || st === "exhausted" || st === "void" ? "destructive" : "secondary"}>{{ unused: "Unused", used: "In use", exhausted: "No views left", expired: "Expired", void: "Cancelled" }[st]}</Badge>
                    <span className="text-xs text-muted-foreground">{c.views_used}/{c.max_views} views · {naira(Number(c.price))} · until {new Date(c.valid_until).toLocaleDateString("en-NG")}</span>
                  </label>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Rule change history</CardTitle></CardHeader>
        <CardContent>
          {!historyQ.data?.length ? <p className="text-sm text-muted-foreground">No changes yet.</p> : (
            <ul className="space-y-2 text-sm">
              {historyQ.data.map((h) => {
                const o = (h.old_value ?? {}) as any, n = (h.new_value ?? {}) as any;
                const parts = [
                  o.access_mode !== n.access_mode && `access ${o.access_mode ?? "—"} → ${n.access_mode}`,
                  o.price !== n.price && `price ${o.price != null ? naira(Number(o.price)) : "—"} → ${naira(Number(n.price))}`,
                  o.max_views !== n.max_views && `views ${o.max_views ?? "—"} → ${n.max_views}`,
                  o.validity_days !== n.validity_days && `validity ${o.validity_days ?? "—"} → ${n.validity_days} days`,
                ].filter(Boolean);
                return <li key={h.id} className="border-b pb-2"><span className="font-medium">{h.actor}</span> · {new Date(h.created_at).toLocaleString("en-NG")}<div className="text-xs text-muted-foreground">{parts.join("; ") || "Saved with no change"}</div></li>;
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
