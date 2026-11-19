import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { classDisplayName } from "@/lib/class-label";
import { resolveReportTemplate } from "@/lib/report-template";

export const Route = createFileRoute("/_authenticated/term-records")({
  head: () => ({
    meta: [
      { title: "Term Records — Alegacy" },
      { name: "description", content: "Form masters enter days present and psychomotor and affective ratings before report cards are generated." },
      { property: "og:title", content: "Term Records — Alegacy" },
      { property: "og:description", content: "Days present and skill ratings for each pupil, ready for report cards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermRecordsPage,
});

const PSYCHOMOTOR: [string, string][] = [["handwriting", "Handwriting"], ["drawing", "Drawing / Painting"], ["tools", "Handling of Tools"], ["speech", "Speech Fluency"], ["sports", "Sports & Games"], ["music", "Music"]];
const AFFECTIVE: [string, string][] = [["attentiveness", "Attentiveness"], ["honesty", "Honesty"], ["neatness", "Neatness"], ["politeness", "Politeness"], ["punctuality", "Punctuality"], ["self_control", "Self Control"], ["obedience", "Obedience"], ["reliability", "Reliability"], ["relationship", "Relationship with Others"]];
const RATINGS = [5, 4, 3, 2, 1];
const RATING_WORD: Record<number, string> = { 5: "Excellent", 4: "Very good", 3: "Good", 2: "Fair", 1: "Poor" };

type Row = { days_present: string; psychomotor: Record<string, number>; affective: Record<string, number> };

function TermRecordsPage() {
  const { roles, schoolId, user } = useAuth();
  const isAdmin = hasRole(roles, "super_admin", "school_admin");
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [session, setSession] = useState("2025/2026");
  const [term, setTerm] = useState<"first" | "second" | "third">("first");
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const { data: school } = useQuery({
    queryKey: ["term-school", schoolId],
    enabled: !!schoolId,
    queryFn: async () => (await supabase.from("schools").select("id, report_template").eq("id", schoolId!).maybeSingle()).data,
  });
  const daysOpened = resolveReportTemplate(school?.report_template).days_opened;

  const { data: classes = [] } = useQuery({
    queryKey: ["term-classes", schoolId, user?.id, isAdmin],
    enabled: !!schoolId && !!user,
    queryFn: async () => {
      let q = supabase.from("classes").select("id, name, arm, section, teacher_id").eq("school_id", schoolId!).eq("active", true).eq("pending_activation", false).order("name");
      if (!isAdmin) q = q.eq("teacher_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);

  const { data, isPending } = useQuery({
    queryKey: ["term-records", classId, session, term],
    enabled: !!classId,
    queryFn: async () => {
      const [st, rec] = await Promise.all([
        supabase.from("students").select("id, first_name, last_name, admission_no").eq("class_id", classId).eq("active", true).order("first_name"),
        supabase.from("student_term_records").select("student_id, days_present, psychomotor, affective").eq("class_id", classId).eq("session", session).eq("term", term),
      ]);
      if (st.error) throw st.error;
      if (rec.error) throw rec.error;
      return { students: st.data ?? [], records: rec.data ?? [] };
    },
  });
  useEffect(() => {
    if (!data) return;
    const next: Record<string, Row> = {};
    for (const s of data.students) {
      const r = data.records.find((x) => x.student_id === s.id);
      next[s.id] = { days_present: r?.days_present != null ? String(r.days_present) : "", psychomotor: (r?.psychomotor as any) ?? {}, affective: (r?.affective as any) ?? {} };
    }
    setRows(next);
  }, [data]);

  const missing = useMemo(() => (data?.students ?? []).filter((s) => !data?.records.some((r) => r.student_id === s.id && r.days_present != null)), [data]);

  const save = async (studentId: string) => {
    const r = rows[studentId];
    if (!r || !schoolId) return;
    const dp = r.days_present.trim() === "" ? null : Math.round(Number(r.days_present));
    if (dp != null && (!Number.isFinite(dp) || dp < 0)) return toast.error("Days present must be zero or more.");
    if (dp != null && daysOpened != null && dp > daysOpened) return toast.error(`Days present cannot be more than ${daysOpened} (times school opened).`);
    setSaving(studentId);
    const { data: saved, error } = await supabase.from("student_term_records").upsert(
      { school_id: schoolId, class_id: classId, student_id: studentId, session, term, days_present: dp, psychomotor: r.psychomotor, affective: r.affective, updated_by: user?.id ?? null },
      { onConflict: "student_id,session,term" },
    ).select("id").single();
    setSaving(null);
    if (error || !saved) return toast.error(error?.message || "Could not save");
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["term-records", classId, session, term] });
  };

  const setTick = (sid: string, group: "psychomotor" | "affective", key: string, v: number) =>
    setRows((p) => ({ ...p, [sid]: { ...p[sid], [group]: { ...p[sid][group], [key]: v } } }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Term Records</h1>
        <p className="text-sm text-muted-foreground">Enter each pupil's days present and tick psychomotor and affective ratings before report cards are generated.</p>
      </div>
      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-3">
          <div className="space-y-1"><Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}><SelectTrigger><SelectValue placeholder={classes.length ? "Choose class" : "No assigned class"} /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{classDisplayName(c)}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Session</Label><Input value={session} onChange={(e) => setSession(e.target.value)} /></div>
          <div className="space-y-1"><Label>Term</Label>
            <Select value={term} onValueChange={(v) => setTerm(v as typeof term)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="first">First</SelectItem><SelectItem value="second">Second</SelectItem><SelectItem value="third">Third</SelectItem></SelectContent></Select></div>
          <p className="text-xs text-muted-foreground sm:col-span-3">Times school opened this term: <strong>{daysOpened ?? "not set"}</strong>{daysOpened == null && isAdmin ? <> — set it in <Link to="/settings" className="underline">report card settings</Link>.</> : null}</p>
        </CardContent>
      </Card>

      {data && missing.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>{missing.length} pupil{missing.length > 1 ? "s" : ""} still need days present</AlertTitle>
          <AlertDescription>{missing.slice(0, 8).map((s) => `${s.first_name} ${s.last_name}`).join(", ")}{missing.length > 8 ? "…" : ""}. Complete them before generating report cards.</AlertDescription>
        </Alert>
      )}

      {isPending && classId ? <p className="text-sm text-muted-foreground">Loading pupils…</p> : null}
      <div className="space-y-2">
        {(data?.students ?? []).map((s) => {
          const r = rows[s.id];
          if (!r) return null;
          const isOpen = open === s.id;
          return (
            <Card key={s.id}>
              <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0 py-3">
                <CardTitle className="min-w-0 flex-1 text-base">{s.first_name} {s.last_name} <span className="text-xs font-normal text-muted-foreground">{s.admission_no}</span></CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`dp-${s.id}`} className="text-xs">Days present</Label>
                  <Input id={`dp-${s.id}`} className="h-9 w-20" type="number" min={0} inputMode="numeric" value={r.days_present} onChange={(e) => setRows((p) => ({ ...p, [s.id]: { ...p[s.id], days_present: e.target.value } }))} />
                </div>
                <Button variant="outline" size="sm" onClick={() => setOpen(isOpen ? null : s.id)}>{isOpen ? "Hide skills" : "Tick skills"}</Button>
                <Button size="sm" disabled={saving === s.id} onClick={() => save(s.id)}>{saving === s.id ? "Saving…" : "Save"}</Button>
              </CardHeader>
              {isOpen && (
                <CardContent className="grid gap-4 md:grid-cols-2">
                  {([["psychomotor", "Psychomotor skills", PSYCHOMOTOR], ["affective", "Affective domain", AFFECTIVE]] as const).map(([group, title, items]) => (
                    <div key={group}>
                      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
                      <div className="space-y-1">
                        {items.map(([key, label]) => (
                          <div key={key} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-1">
                            <span className="text-sm">{label}</span>
                            <div className="flex gap-1" role="radiogroup" aria-label={label}>
                              {RATINGS.map((v) => (
                                <button key={v} type="button" role="radio" aria-checked={r[group][key] === v} title={RATING_WORD[v]}
                                  onClick={() => setTick(s.id, group, key, v)}
                                  className={`h-8 w-8 rounded border text-sm font-semibold ${r[group][key] === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}`}>
                                  {r[group][key] === v ? "✓" : v}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground md:col-span-2">5 = Excellent · 4 = Very good · 3 = Good · 2 = Fair · 1 = Poor</p>
                </CardContent>
              )}
            </Card>
          );
        })}
        {data && data.students.length === 0 && <p className="text-sm text-muted-foreground">No active pupils in this class.</p>}
      </div>
    </div>
  );
}
