import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Download, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { pagesToPdf, downloadBlob } from "@/lib/report-pdf";
import { DEFAULT_STAFF_DESIGN, DEFAULT_STUDENT_DESIGN, chunk, newCardCode, perSheet, resolveDesign, type IdDesign } from "@/lib/id-cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/id-cards")({
  head: () => ({
    meta: [
      { title: "Student & Staff ID Cards — Alegacy" },
      { name: "description", content: "Design and print school-branded student and staff ID cards with QR verification." },
      { property: "og:title", content: "Student & Staff ID Cards — Alegacy" },
      { property: "og:description", content: "Print school-branded ID cards with QR verification." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IdCardsPage,
});

type Holder = { id: string; name: string; number: string; detail: string; extra: string; photo: string | null };
type School = { id: string; name: string; logo_url: string | null; address: string | null; current_session: string | null };

function IdCardsPage() {
  const { schoolId } = useAuth();
  if (!schoolId) return <p className="text-muted-foreground">Select a school first.</p>;
  return <IdCards key={schoolId} schoolId={schoolId} />;
}

function IdCards({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const schoolQ = useQuery({
    queryKey: ["idcard-school", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("id, name, logo_url, address, current_session").eq("id", schoolId).single();
      if (error) throw error;
      return data as School;
    },
  });
  const designQ = useQuery({
    queryKey: ["idcard-design", schoolId],
    queryFn: async () => (await supabase.from("id_card_settings").select("*").eq("school_id", schoolId).maybeSingle()).data,
  });
  const [studentDesign, setStudentDesign] = useState<IdDesign>(DEFAULT_STUDENT_DESIGN);
  const [staffDesign, setStaffDesign] = useState<IdDesign>(DEFAULT_STAFF_DESIGN);
  useEffect(() => {
    setStudentDesign(resolveDesign(designQ.data?.student_design, DEFAULT_STUDENT_DESIGN));
    setStaffDesign(resolveDesign(designQ.data?.staff_design, DEFAULT_STAFF_DESIGN));
  }, [designQ.data]);

  async function saveDesign() {
    const { data, error } = await supabase.from("id_card_settings").upsert({ school_id: schoolId, student_design: studentDesign as any, staff_design: staffDesign as any, updated_at: new Date().toISOString() }, { onConflict: "school_id" }).select("school_id").single();
    if (error || !data) return toast.error(error?.message ?? "Design was not saved");
    await qc.invalidateQueries({ queryKey: ["idcard-design", schoolId] });
    toast.success("ID card design saved");
  }

  const school = schoolQ.data;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Student &amp; Staff ID Cards</h1>
        <p className="text-sm text-muted-foreground">Print branded cards with a QR code anyone can scan to check the card is genuine. Reprint any time details change.</p>
      </div>
      {school && (
        <Tabs defaultValue="students">
          <TabsList><TabsTrigger value="students">Students</TabsTrigger><TabsTrigger value="staff">Staff</TabsTrigger><TabsTrigger value="design">Design</TabsTrigger></TabsList>
          <TabsContent value="students"><StudentCards school={school} design={studentDesign} /></TabsContent>
          <TabsContent value="staff"><StaffCards school={school} design={staffDesign} /></TabsContent>
          <TabsContent value="design">
            <div className="grid gap-6 lg:grid-cols-2">
              <DesignEditor label="Student card" design={studentDesign} onChange={setStudentDesign} school={school} />
              <DesignEditor label="Staff card" design={staffDesign} onChange={setStaffDesign} school={school} />
            </div>
            <Button className="mt-4" onClick={saveDesign}><Save className="mr-2 h-4 w-4" />Save designs</Button>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function DesignEditor({ label, design, onChange, school }: { label: string; design: IdDesign; onChange: (d: IdDesign) => void; school: School }) {
  const set = (k: keyof IdDesign, v: string) => onChange({ ...design, [k]: v } as IdDesign);
  const sample: Holder = { id: "x", name: "Aisha Musa Bello", number: "ATQ/2022/0001", detail: label.startsWith("Staff") ? "Teacher" : "JSS 1 Gold", extra: label.startsWith("Staff") ? "Sciences" : school.current_session ?? "", photo: null };
  return (
    <Card><CardHeader><CardTitle className="text-base">{label}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {(["primary", "accent", "text"] as const).map((k) => (
            <div key={k}><Label className="text-xs capitalize">{k === "primary" ? "Main colour" : k === "accent" ? "Accent" : "Text on main"}</Label><Input type="color" value={design[k]} onChange={(e) => set(k, e.target.value)} className="h-10 p-1" /></div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Card title</Label><Input value={design.title} maxLength={40} onChange={(e) => set("title", e.target.value)} /></div>
          <div><Label className="text-xs">Layout</Label>
            <Select value={design.layout} onValueChange={(v) => set("layout", v)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="horizontal">Landscape (10 per A4)</SelectItem><SelectItem value="vertical">Portrait (9 per A4)</SelectItem></SelectContent></Select>
          </div>
        </div>
        <div className="overflow-x-auto"><IdCardFace school={school} design={design} holder={sample} qr="" labels={label.startsWith("Staff") ? STAFF_LABELS : STUDENT_LABELS} /></div>
      </CardContent>
    </Card>
  );
}

const STUDENT_LABELS = { number: "Adm. No", detail: "Class", extra: "Session" };
const STAFF_LABELS = { number: "Staff No", detail: "Position", extra: "Department" };

function IdCardFace({ school, design, holder, qr, labels }: { school: School; design: IdDesign; holder: Holder; qr: string; labels: typeof STUDENT_LABELS }) {
  const vertical = design.layout === "vertical";
  // ID cards print in the school's chosen brand colours, so they are applied as inline values.
  const frame: CSSProperties = { width: vertical ? 204 : 324, height: vertical ? 324 : 204, borderRadius: 10, overflow: "hidden", border: `2px solid ${design.primary}`, background: "#fff", color: "#111", fontFamily: "inherit", display: "flex", flexDirection: "column", position: "relative" };
  const head: CSSProperties = { background: design.primary, color: design.text, padding: "6px 8px", display: "flex", alignItems: "center", gap: 6, borderBottom: `3px solid ${design.accent}` };
  const photo = <div style={{ width: vertical ? 78 : 70, height: vertical ? 92 : 84, border: `2px solid ${design.accent}`, borderRadius: 4, overflow: "hidden", background: "#f3f4f6", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#6b7280" }}>{holder.photo ? <img src={holder.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" /> : "Photo"}</div>;
  const rows = [[labels.number, holder.number], [labels.detail, holder.detail], [labels.extra, holder.extra]] as const;
  return (
    <div style={frame}>
      {school.logo_url && <img src={school.logo_url} alt="" crossOrigin="anonymous" style={{ position: "absolute", inset: 0, margin: "auto", width: "55%", opacity: 0.06, top: 30 }} />}
      <div style={head}>
        {school.logo_url && <img src={school.logo_url} alt="" crossOrigin="anonymous" style={{ width: 26, height: 26, objectFit: "contain", background: "#fff", borderRadius: 4 }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 10.5, lineHeight: 1.1 }}>{school.name}</div>
          <div style={{ fontSize: 7.5, opacity: 0.9, lineHeight: 1.2 }}>{school.address}</div>
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 8, fontWeight: 700, letterSpacing: 1.5, color: design.primary, padding: "3px 0" }}>{design.title}</div>
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: vertical ? "center" : "flex-start", gap: 8, padding: "0 8px", flex: 1, position: "relative" }}>
        {photo}
        <div style={{ flex: 1, minWidth: 0, fontSize: 9, textAlign: vertical ? "center" : "left" }}>
          <div style={{ fontWeight: 700, fontSize: 11.5, color: design.primary, lineHeight: 1.15, marginBottom: 3 }}>{holder.name}</div>
          {rows.map(([l, v]) => <div key={l} style={{ lineHeight: 1.35 }}><span style={{ color: "#6b7280" }}>{l}: </span><strong>{v || "—"}</strong></div>)}
        </div>
        {qr && <img src={qr} alt="" style={{ width: vertical ? 54 : 58, height: vertical ? 54 : 58, alignSelf: vertical ? "center" : "flex-end", marginBottom: 6 }} />}
      </div>
      <div style={{ background: design.accent, height: 6 }} />
    </div>
  );
}

function Sheet({ children, vertical }: { children: React.ReactNode; vertical: boolean }) {
  return <div style={{ width: 794, height: 1123, padding: vertical ? "40px 38px" : "40px 50px", display: "grid", gridTemplateColumns: vertical ? "repeat(3, 204px)" : "repeat(2, 324px)", gap: vertical ? "22px 40px" : "14px 46px", justifyContent: "center", alignContent: "start", background: "#fff" }}>{children}</div>;
}

function useCodes(schoolId: string, kind: "student" | "staff") {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["id-codes", schoolId, kind],
    queryFn: async () => {
      const { data, error } = await supabase.from("id_cards").select("holder_id, code, issued_at").eq("school_id", schoolId).eq("kind", kind);
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.holder_id, r]));
    },
  });
  async function ensure(holderIds: string[], session: string | null) {
    const existing = q.data ?? new Map();
    const missing = holderIds.filter((id) => !existing.has(id));
    if (missing.length) {
      const rows = missing.map((holder_id) => ({ school_id: schoolId, kind, holder_id, code: newCardCode(), session }));
      const { data, error } = await supabase.from("id_cards").insert(rows).select("holder_id");
      if (error) throw new Error(error.message);
      if ((data ?? []).length !== rows.length) throw new Error("Some ID card numbers were not saved");
    }
    if (holderIds.length - missing.length > 0) {
      await supabase.from("id_cards").update({ issued_at: new Date().toISOString(), session }).eq("school_id", schoolId).eq("kind", kind).in("holder_id", holderIds.filter((id) => existing.has(id)));
    }
    const fresh = await qc.fetchQuery({ queryKey: ["id-codes", schoolId, kind], queryFn: q.refetch as any, staleTime: 0 });
    const { data } = await supabase.from("id_cards").select("holder_id, code").eq("school_id", schoolId).eq("kind", kind).in("holder_id", holderIds);
    void fresh;
    return new Map((data ?? []).map((r) => [r.holder_id, r.code]));
  }
  return { codes: q.data, ensure };
}

function HolderPicker({ holders, picked, setPicked }: { holders: Holder[]; picked: Set<string>; setPicked: (s: Set<string>) => void }) {
  return (
    <div className="max-h-96 divide-y overflow-y-auto rounded border">
      <label className="flex items-center gap-3 bg-muted/40 px-3 py-2 text-xs font-medium"><Checkbox checked={holders.length > 0 && holders.every((h) => picked.has(h.id))} onCheckedChange={(v) => setPicked(v ? new Set(holders.map((h) => h.id)) : new Set())} />Select all ({holders.length})</label>
      {holders.map((h) => (
        <label key={h.id} className="flex items-center gap-3 px-3 py-2 text-sm">
          <Checkbox checked={picked.has(h.id)} onCheckedChange={() => { const n = new Set(picked); n.has(h.id) ? n.delete(h.id) : n.add(h.id); setPicked(n); }} />
          <span className="flex-1">{h.name} <span className="text-muted-foreground">· {h.number || "no number"}</span></span>
          <span className="text-xs text-muted-foreground">{h.detail}</span>
          {!h.photo && <span className="text-xs text-amber-700 dark:text-amber-400">no photo</span>}
        </label>
      ))}
    </div>
  );
}

async function printCards(school: School, design: IdDesign, holders: Holder[], codes: Map<string, string>, labels: typeof STUDENT_LABELS, file: string, onProgress: (s: string | null) => void) {
  const withQr = await Promise.all(holders.map(async (h) => ({ h, qr: await QRCode.toDataURL(`${window.location.origin}/verify-id/${codes.get(h.id)}`, { width: 140, margin: 1 }) })));
  const pages = chunk(withQr, perSheet(design.layout)).map((group, i) => (
    <Sheet key={i} vertical={design.layout === "vertical"}>{group.map(({ h, qr }) => <IdCardFace key={h.id} school={school} design={design} holder={h} qr={qr} labels={labels} />)}</Sheet>
  ));
  const blob = await pagesToPdf(pages, (d, t) => onProgress(`Making sheet ${d} of ${t}…`));
  downloadBlob(blob, file);
}

function StudentCards({ school, design }: { school: School; design: IdDesign }) {
  const [classId, setClassId] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<string | null>(null);
  const { ensure } = useCodes(school.id, "student");
  const classesQ = useQuery({
    queryKey: ["idcard-classes", school.id],
    queryFn: async () => (await supabase.from("classes").select("id, name, arm").eq("school_id", school.id).eq("active", true).order("name")).data ?? [],
  });
  const studentsQ = useQuery({
    queryKey: ["idcard-students", school.id, classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, first_name, middle_name, last_name, admission_no, photo_url, class_id").eq("school_id", school.id).eq("class_id", classId).eq("active", true).order("first_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const klass = (classesQ.data ?? []).find((c) => c.id === classId);
  const holders: Holder[] = useMemo(() => (studentsQ.data ?? []).map((s) => ({
    id: s.id, name: [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" "), number: s.admission_no,
    detail: [klass?.name, klass?.arm].filter(Boolean).join(" "), extra: school.current_session ?? "", photo: s.photo_url,
  })), [studentsQ.data, klass, school.current_session]);
  useEffect(() => setPicked(new Set(holders.map((h) => h.id))), [holders]);
  const chosen = holders.filter((h) => picked.has(h.id));
  return (
    <Card><CardHeader><CardTitle className="text-base">Student ID cards</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={classId} onValueChange={setClassId}><SelectTrigger className="sm:w-64" aria-label="Class"><SelectValue placeholder="Choose class" /></SelectTrigger>
            <SelectContent>{(classesQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{[c.name, c.arm].filter(Boolean).join(" ")}</SelectItem>)}</SelectContent></Select>
          <Button disabled={!chosen.length || !!progress} onClick={async () => {
            try {
              setProgress("Preparing…");
              const codes = await ensure(chosen.map((h) => h.id), school.current_session);
              await printCards(school, design, chosen, codes, STUDENT_LABELS, `student_id_cards_${(klass?.name ?? "class").replace(/\s+/g, "_")}.pdf`, setProgress);
              toast.success(`${chosen.length} ID card(s) ready to print`);
            } catch (e) { toast.error(e instanceof Error ? e.message : "Could not make cards"); } finally { setProgress(null); }
          }}><Download className="mr-2 h-4 w-4" />{progress ?? `Download ${chosen.length} card(s) PDF`}</Button>
        </div>
        {studentsQ.error && <p className="text-sm text-destructive">{(studentsQ.error as Error).message}</p>}
        {classId && <HolderPicker holders={holders} picked={picked} setPicked={setPicked} />}
      </CardContent>
    </Card>
  );
}

const ROLE_NAMES: Record<string, string> = { super_admin: "Super Administrator", school_admin: "School Administrator", teacher: "Teacher", accountant: "Accountant" };

function StaffCards({ school, design }: { school: School; design: IdDesign }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<string | null>(null);
  const { ensure } = useCodes(school.id, "staff");
  const staffQ = useQuery({
    queryKey: ["idcard-staff", school.id],
    queryFn: async () => {
      const { data: sp, error } = await supabase.from("staff_profiles").select("user_id, staff_no, department, category, photo_url").eq("school_id", school.id).eq("active", true);
      if (error) throw error;
      const ids = (sp ?? []).map((s) => s.user_id);
      if (!ids.length) return [] as Holder[];
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", ids),
        supabase.from("user_roles").select("user_id, role").eq("school_id", school.id).eq("active", true).in("user_id", ids),
      ]);
      const pm = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      return (sp ?? []).map((s) => {
        const r = (roles ?? []).filter((x) => x.user_id === s.user_id).map((x) => x.role);
        const designation = r.includes("school_admin") ? ROLE_NAMES.school_admin : r.includes("accountant") ? ROLE_NAMES.accountant : r.includes("teacher") ? ROLE_NAMES.teacher : s.category || "Staff";
        return { id: s.user_id, name: pm.get(s.user_id)?.full_name || "Staff member", number: s.staff_no ?? "", detail: designation, extra: s.department ?? "", photo: s.photo_url || pm.get(s.user_id)?.avatar_url || null };
      }).sort((a, b) => a.name.localeCompare(b.name));
    },
  });
  const holders = staffQ.data ?? [];
  useEffect(() => setPicked(new Set(holders.map((h) => h.id))), [holders]);
  const chosen = holders.filter((h) => picked.has(h.id));
  return (
    <Card><CardHeader><CardTitle className="text-base">Staff ID cards</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Button disabled={!chosen.length || !!progress} onClick={async () => {
          try {
            setProgress("Preparing…");
            const codes = await ensure(chosen.map((h) => h.id), school.current_session);
            await printCards(school, design, chosen, codes, STAFF_LABELS, "staff_id_cards.pdf", setProgress);
            toast.success(`${chosen.length} staff ID card(s) ready to print`);
          } catch (e) { toast.error(e instanceof Error ? e.message : "Could not make cards"); } finally { setProgress(null); }
        }}><Download className="mr-2 h-4 w-4" />{progress ?? `Download ${chosen.length} card(s) PDF`}</Button>
        {staffQ.error ? <p className="text-sm text-destructive">{(staffQ.error as Error).message}</p> : staffQ.isLoading ? <p className="text-sm text-muted-foreground">Loading staff…</p> : !holders.length ? <p className="text-sm text-muted-foreground">No active staff records yet. Add staff in the Staff Attendance Portal.</p> : <HolderPicker holders={holders} picked={picked} setPicked={setPicked} />}
      </CardContent>
    </Card>
  );
}
