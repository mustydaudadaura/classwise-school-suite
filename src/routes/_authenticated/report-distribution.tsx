import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileDown, Files, Archive, MessageCircle, Share2, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole } from "@/hooks/useAuth";
import { getReportCardsList, getReportCardDetail, getReportRecipients } from "@/lib/api/results.functions";
import { reportsToPdf, zipFiles, downloadBlob, type ReportDetail } from "@/lib/report-pdf";
import { reportFileName, reportMessage, toWhatsAppNumber, whatsappLink, DELIVERY_LABELS, type DeliveryStatus } from "@/lib/report-whatsapp";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/report-distribution")({
  head: () => ({
    meta: [
      { title: "Report PDFs & WhatsApp — Alegacy" },
      { name: "description", content: "Generate individual, class and bulk report card PDFs and send them to parents on WhatsApp." },
      { property: "og:title", content: "Report PDFs & WhatsApp — Alegacy" },
      { property: "og:description", content: "Generate report card PDFs and send them to parents on WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportDistributionPage,
});

type Card_ = {
  id: string; school_id: string; student_id: string; class_id: string | null; session: string; term: string; published: boolean | null;
  students?: { first_name?: string; last_name?: string; admission_no?: string } | null;
  classes?: { id?: string; name?: string; arm?: string | null } | null;
};
const studentName = (c: Card_) => `${c.students?.first_name ?? ""} ${c.students?.last_name ?? ""}`.trim() || "Student";
const className = (c: Card_) => [c.classes?.name, c.classes?.arm].filter(Boolean).join(" ") || "Class";
const fileFor = (c: Card_) => reportFileName({ studentName: studentName(c), admissionNo: c.students?.admission_no, className: className(c), term: c.term, session: c.session });

function ReportDistributionPage() {
  const { roles } = useAuth();
  const isAdmin = hasRole(roles, "super_admin", "school_admin");
  const loadCards = useServerFn(getReportCardsList);
  const loadDetail = useServerFn(getReportCardDetail);
  const { data: cards = [], isLoading } = useQuery({ queryKey: ["report-cards-list"], queryFn: async () => ((await loadCards()).cards ?? []) as Card_[] });

  const periods = useMemo(() => Array.from(new Set(cards.map((c) => `${c.session}|${c.term}`))).sort().reverse(), [cards]);
  const [period, setPeriod] = useState("");
  const activePeriod = period || periods[0] || "";
  const inPeriod = useMemo(() => cards.filter((c) => `${c.session}|${c.term}` === activePeriod), [cards, activePeriod]);
  const classList = useMemo(() => {
    const m = new Map<string, string>();
    inPeriod.forEach((c) => c.class_id && m.set(c.class_id, className(c)));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [inPeriod]);

  const [progress, setProgress] = useState<string | null>(null);

  async function fetchDetails(list: Card_[]): Promise<ReportDetail[]> {
    const out: ReportDetail[] = [];
    for (let i = 0; i < list.length; i++) {
      setProgress(`Loading results ${i + 1} of ${list.length}…`);
      const d = await loadDetail({ data: { id: list[i].id } });
      if (!d?.rc || d.rc.student_id !== list[i].student_id) throw new Error(`Could not load ${studentName(list[i])}'s report`);
      out.push(d as unknown as ReportDetail);
    }
    return out;
  }
  async function run(task: () => Promise<void>) {
    try { await task(); } catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); } finally { setProgress(null); }
  }
  async function pdfFor(c: Card_) {
    const [d] = await fetchDetails([c]);
    setProgress(`Making PDF for ${studentName(c)}…`);
    return reportsToPdf([d]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Report PDFs &amp; WhatsApp</h1>
        <p className="text-sm text-muted-foreground">Make report card PDFs for one student, a whole class, or many students, and send each one to that student's own parent.</p>
      </div>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <span className="text-sm font-medium">Session &amp; term</span>
          <Select value={activePeriod} onValueChange={setPeriod}>
            <SelectTrigger className="w-60" aria-label="Session and term"><SelectValue placeholder={isLoading ? "Loading…" : "No reports yet"} /></SelectTrigger>
            <SelectContent>{periods.map((p) => { const [s, t] = p.split("|"); return <SelectItem key={p} value={p}>{s} — {t} term</SelectItem>; })}</SelectContent>
          </Select>
          {progress && <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{progress}</span>}
        </CardContent>
      </Card>

      {!isLoading && !cards.length ? (
        <p className="text-sm text-muted-foreground">No report cards yet. Publish results first from the Results page.</p>
      ) : (
        <Tabs defaultValue="individual">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="individual"><FileDown className="mr-2 h-4 w-4" />One student</TabsTrigger>
            <TabsTrigger value="class"><Files className="mr-2 h-4 w-4" />Whole class</TabsTrigger>
            <TabsTrigger value="bulk"><Archive className="mr-2 h-4 w-4" />Bulk (ZIP)</TabsTrigger>
            <TabsTrigger value="whatsapp"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</TabsTrigger>
          </TabsList>
          <TabsContent value="individual"><IndividualTab cards={inPeriod} classList={classList} busy={!!progress} onRun={run} pdfFor={pdfFor} /></TabsContent>
          <TabsContent value="class">
            <ClassTab cards={inPeriod} classList={classList} busy={!!progress} onGenerate={(list, label) => run(async () => {
              const details = await fetchDetails(list);
              const blob = await reportsToPdf(details, (d, t) => setProgress(`Making page ${d} of ${t}…`));
              downloadBlob(blob, `${label.replace(/\s+/g, "_")}_${list[0].term}_${list[0].session.replace("/", "-")}_report_cards.pdf`);
              toast.success(`One PDF with ${list.length} report cards downloaded`);
            })} />
          </TabsContent>
          <TabsContent value="bulk">
            <BulkTab cards={inPeriod} classList={classList} busy={!!progress} onGenerate={(list) => run(async () => {
              const files: { name: string; blob: Blob }[] = [];
              for (let i = 0; i < list.length; i++) {
                const [d] = await fetchDetails([list[i]]);
                setProgress(`Making PDF ${i + 1} of ${list.length}…`);
                files.push({ name: fileFor(list[i]), blob: await reportsToPdf([d]) });
              }
              if (files.length === 1) downloadBlob(files[0].blob, files[0].name);
              else { setProgress("Packing ZIP…"); downloadBlob(await zipFiles(files), `report_cards_${list[0].session.replace("/", "-")}_${list[0].term}.zip`); }
              toast.success(`${files.length} separate PDF file(s) downloaded`);
            })} />
          </TabsContent>
          <TabsContent value="whatsapp"><WhatsAppTab cards={inPeriod} classList={classList} isAdmin={isAdmin} pdfFor={pdfFor} busy={!!progress} onRun={run} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function ClassPicker({ classList, value, onChange }: { classList: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-64" aria-label="Class"><SelectValue placeholder="Choose class" /></SelectTrigger>
      <SelectContent>{classList.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function IndividualTab({ cards, classList, busy, onRun, pdfFor }: { cards: Card_[]; classList: [string, string][]; busy: boolean; onRun: (t: () => Promise<void>) => void; pdfFor: (c: Card_) => Promise<Blob> }) {
  const [classId, setClassId] = useState("");
  const [cardId, setCardId] = useState("");
  const list = cards.filter((c) => c.class_id === classId);
  const card = list.find((c) => c.id === cardId);
  return (
    <Card><CardHeader><CardTitle className="text-base">Individual report PDF</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <ClassPicker classList={classList} value={classId} onChange={(v) => { setClassId(v); setCardId(""); }} />
        <Select value={cardId} onValueChange={setCardId} disabled={!classId}>
          <SelectTrigger className="w-full sm:w-72" aria-label="Student"><SelectValue placeholder="Choose student" /></SelectTrigger>
          <SelectContent>{list.map((c) => <SelectItem key={c.id} value={c.id}>{studentName(c)} ({c.students?.admission_no})</SelectItem>)}</SelectContent>
        </Select>
        <Button disabled={!card || busy} onClick={() => card && onRun(async () => { downloadBlob(await pdfFor(card), fileFor(card)); toast.success("PDF downloaded"); })}>
          <FileDown className="mr-2 h-4 w-4" />Download PDF
        </Button>
      </CardContent>
    </Card>
  );
}

function ClassTab({ cards, classList, busy, onGenerate }: { cards: Card_[]; classList: [string, string][]; busy: boolean; onGenerate: (list: Card_[], label: string) => void }) {
  const [classId, setClassId] = useState("");
  const list = cards.filter((c) => c.class_id === classId).sort((a, b) => studentName(a).localeCompare(studentName(b)));
  return (
    <Card><CardHeader><CardTitle className="text-base">Whole class in one PDF</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <ClassPicker classList={classList} value={classId} onChange={setClassId} />
          <Button disabled={!list.length || busy} onClick={() => onGenerate(list, classList.find(([id]) => id === classId)?.[1] ?? "class")}>
            <Files className="mr-2 h-4 w-4" />Download combined PDF ({list.length})
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Each student's report starts on its own page.</p>
      </CardContent>
    </Card>
  );
}

function BulkTab({ cards, classList, busy, onGenerate }: { cards: Card_[]; classList: [string, string][]; busy: boolean; onGenerate: (list: Card_[]) => void }) {
  const [classIds, setClassIds] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const list = cards.filter((c) => c.class_id && classIds.includes(c.class_id)).sort((a, b) => className(a).localeCompare(className(b)) || studentName(a).localeCompare(studentName(b)));
  const chosen = list.filter((c) => picked.has(c.id));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <Card><CardHeader><CardTitle className="text-base">Separate PDF for each student (ZIP)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {classList.map(([id, name]) => (
            <label key={id} className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
              <Checkbox checked={classIds.includes(id)} onCheckedChange={(v) => {
                setClassIds((s) => (v ? [...s, id] : s.filter((x) => x !== id)));
                const ids = cards.filter((c) => c.class_id === id).map((c) => c.id);
                setPicked((s) => { const n = new Set(s); ids.forEach((x) => (v ? n.add(x) : n.delete(x))); return n; });
              }} />{name}
            </label>
          ))}
        </div>
        {list.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPicked(new Set(list.map((c) => c.id)))}>Select all</Button>
              <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>Clear</Button>
              <Button disabled={!chosen.length || busy} onClick={() => onGenerate(chosen)}><Archive className="mr-2 h-4 w-4" />Download {chosen.length} PDF(s)</Button>
            </div>
            <div className="max-h-96 divide-y overflow-y-auto rounded border">
              {list.map((c) => (
                <label key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <Checkbox checked={picked.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                  <span className="flex-1">{studentName(c)} <span className="text-muted-foreground">· {c.students?.admission_no}</span></span>
                  <span className="text-xs text-muted-foreground">{className(c)}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const STATUS_VARIANT: Record<DeliveryStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline", sent: "secondary", failed: "destructive", invalid_number: "destructive", confirmed: "default",
};

function WhatsAppTab({ cards, classList, isAdmin, pdfFor, busy, onRun }: { cards: Card_[]; classList: [string, string][]; isAdmin: boolean; pdfFor: (c: Card_) => Promise<Blob>; busy: boolean; onRun: (t: () => Promise<void>) => void }) {
  const qc = useQueryClient();
  const loadRecipients = useServerFn(getReportRecipients);
  const [classId, setClassId] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [prepared, setPrepared] = useState<Record<string, Blob>>({});
  const [queue, setQueue] = useState<string[]>([]);
  const list = cards.filter((c) => c.class_id === classId).sort((a, b) => studentName(a).localeCompare(studentName(b)));
  const { data: schoolName = "" } = useQuery({
    queryKey: ["school-name", list[0]?.school_id],
    enabled: !!list[0],
    queryFn: async () => (await supabase.from("schools").select("name").eq("id", list[0].school_id).maybeSingle()).data?.name ?? "",
  });
  const recipientsQuery = useQuery({
    queryKey: ["report-recipients", classId, list.map((c) => c.id).join(",")],
    enabled: list.length > 0,
    queryFn: async () => (await loadRecipients({ data: { report_card_ids: list.map((c) => c.id) } })).recipients,
  });
  const recipients = new Map((recipientsQuery.data ?? []).map((r) => [r.report_card_id, r]));

  async function setStatus(c: Card_, status: DeliveryStatus, note?: string) {
    const r = recipients.get(c.id);
    if (!r || r.student_id !== c.student_id) throw new Error("Parent details do not match this student");
    const { data, error } = await supabase.from("report_deliveries").upsert({
      school_id: c.school_id, report_card_id: c.id, student_id: c.student_id, parent_id: r.parent_id, phone: r.phone, status, note: note ?? null,
    }, { onConflict: "report_card_id" }).select("status").single();
    if (error || data?.status !== status) throw new Error(error?.message ?? "Status was not saved");
    await qc.invalidateQueries({ queryKey: ["report-recipients"] });
  }

  function messageFor(c: Card_) {
    const r = recipients.get(c.id);
    return reportMessage({ parentName: r?.parent_name, studentName: studentName(c), className: className(c), term: c.term, session: c.session, schoolName });
  }

  const prepare = (c: Card_) => onRun(async () => {
    const r = recipients.get(c.id);
    const phone = toWhatsAppNumber(r?.phone);
    if (!phone) { await setStatus(c, "invalid_number", r?.phone ? `Unusable number: ${r.phone}` : "No parent phone registered"); toast.error(`${studentName(c)}: no valid parent WhatsApp number`); return; }
    const blob = await pdfFor(c);
    setPrepared((p) => ({ ...p, [c.id]: blob }));
    downloadBlob(blob, fileFor(c));
    toast.success("PDF ready. Now open WhatsApp or share the PDF.");
  });

  const openWhatsApp = (c: Card_) => {
    const phone = toWhatsAppNumber(recipients.get(c.id)?.phone);
    if (!phone) return;
    window.open(whatsappLink(phone, messageFor(c)), "_blank", "noopener");
    void setStatus(c, "sent").catch((e) => toast.error(e.message));
  };

  const sharePdf = async (c: Card_) => {
    const blob = prepared[c.id];
    if (!blob) return;
    const file = new File([blob], fileFor(c), { type: "application/pdf" });
    try {
      await navigator.share({ files: [file], text: messageFor(c), title: fileFor(c) });
      await setStatus(c, "sent");
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Sharing is not available on this device. Use Open WhatsApp and attach the downloaded PDF.");
    }
  };
  const canShareFiles = typeof navigator !== "undefined" && !!navigator.canShare && (() => { try { return navigator.canShare({ files: [new File([""], "x.pdf", { type: "application/pdf" })] }); } catch { return false; } })();

  const current = queue.length ? list.find((c) => c.id === queue[0]) : undefined;
  const counts = list.reduce((acc, c) => { const s = (recipients.get(c.id)?.status ?? "pending") as DeliveryStatus; acc[s] = (acc[s] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  const rowActions = (c: Card_) => {
    const r = recipients.get(c.id);
    const valid = !!toWhatsAppNumber(r?.phone);
    return (
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => prepare(c)}><FileDown className="mr-1 h-3.5 w-3.5" />1. PDF</Button>
        <Button size="sm" disabled={!valid || !prepared[c.id]} onClick={() => openWhatsApp(c)}><MessageCircle className="mr-1 h-3.5 w-3.5" />2. WhatsApp</Button>
        {canShareFiles && <Button size="sm" variant="secondary" disabled={!prepared[c.id]} onClick={() => sharePdf(c)}><Share2 className="mr-1 h-3.5 w-3.5" />Share PDF</Button>}
        <Button size="sm" variant="ghost" onClick={() => setStatus(c, "failed").catch((e) => toast.error(e.message))}><XCircle className="mr-1 h-3.5 w-3.5" />Failed</Button>
        {isAdmin && <Button size="sm" variant="ghost" onClick={() => setStatus(c, "confirmed").then(() => toast.success("Delivery confirmed")).catch((e) => toast.error(e.message))}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Confirm</Button>}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Send to parents on WhatsApp</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Each report goes only to the parent registered for that student. Step 1 makes the PDF; step 2 opens WhatsApp with the message to that parent — attach the downloaded PDF there
          {canShareFiles ? ", or use Share PDF to send the file straight to WhatsApp" : ""}. WhatsApp links cannot attach files automatically; fully automatic sending needs a WhatsApp Business connection.
        </p>
        <ClassPicker classList={classList} value={classId} onChange={(v) => { setClassId(v); setPicked(new Set()); setQueue([]); }} />
        {recipientsQuery.isLoading && list.length > 0 && <p className="text-sm text-muted-foreground">Loading parent numbers…</p>}
        {recipientsQuery.error && <p className="text-sm text-destructive">{(recipientsQuery.error as Error).message}</p>}
        {list.length > 0 && recipientsQuery.data && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              {(Object.keys(DELIVERY_LABELS) as DeliveryStatus[]).map((s) => <Badge key={s} variant={STATUS_VARIANT[s]}>{DELIVERY_LABELS[s]}: {counts[s] ?? 0}</Badge>)}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setPicked(new Set(list.map((c) => c.id)))}>Select all</Button>
              <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>Clear</Button>
              <Button size="sm" disabled={!picked.size} onClick={() => setQueue(list.filter((c) => picked.has(c.id)).map((c) => c.id))}>Send selected one by one ({picked.size})</Button>
            </div>

            {current && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-2">
                <div className="text-sm font-semibold">Now sending: {studentName(current)} · {className(current)} <span className="font-normal text-muted-foreground">({queue.length} left)</span></div>
                <div className="text-sm">Parent: {recipients.get(current.id)?.parent_name ?? "—"} · {recipients.get(current.id)?.phone ?? "no number"}</div>
                {rowActions(current)}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setQueue((q) => q.slice(1))}>Next parent</Button>
                  <Button size="sm" variant="ghost" onClick={() => setQueue([])}>Stop</Button>
                </div>
              </div>
            )}

            <div className="divide-y rounded border">
              {list.map((c) => {
                const r = recipients.get(c.id);
                const status = (r?.status ?? (toWhatsAppNumber(r?.phone) ? "pending" : "invalid_number")) as DeliveryStatus;
                return (
                  <div key={c.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                    <Checkbox checked={picked.has(c.id)} onCheckedChange={() => setPicked((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })} aria-label={`Select ${studentName(c)}`} />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="font-medium">{studentName(c)} <span className="text-muted-foreground">· {c.students?.admission_no}</span></div>
                      <div className="text-xs text-muted-foreground">{r?.parent_name ?? "No parent linked"} · {r?.phone ?? "no phone"}</div>
                    </div>
                    <Badge variant={STATUS_VARIANT[status]}>{DELIVERY_LABELS[status]}</Badge>
                    {rowActions(c)}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
