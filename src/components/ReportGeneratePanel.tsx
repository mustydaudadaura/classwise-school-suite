import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileCheck2, Loader2, MessageCircle, Mail, Globe, Trophy, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { publishReportCards } from "@/lib/api/results.functions";
import { classDisplayName } from "@/lib/class-label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PositionRankingSettings } from "@/components/PositionRankingSettings";
import { RANKING_METHODS, ordinal, resolveRanking } from "@/lib/position-ranking";

type Term = "first" | "second" | "third";

/** Generate report cards straight from saved scores — no approval or separate publish step. */
export function ReportGeneratePanel({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const generate = useServerFn(publishReportCards);
  const [classId, setClassId] = useState("");
  const [session, setSession] = useState("");
  const [term, setTerm] = useState<Term>("first");
  const [studentId, setStudentId] = useState("all");
  const [post, setPost] = useState(true);
  const [done, setDone] = useState<{ count: number; posted: boolean } | null>(null);
  const [rankingOpen, setRankingOpen] = useState(false);

  // The saved position method is what the server applies when generating.
  const { data: school } = useQuery({
    queryKey: ["generate-ranking", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("id, report_template, current_session, current_term").eq("id", schoolId).single();
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const ranking = resolveRanking(school?.report_template);
  const rankingLabel = RANKING_METHODS.find((m) => m.id === ranking.method)?.label ?? "";

  const { data: classes = [] } = useQuery({
    queryKey: ["generate-classes", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name, arm").eq("school_id", schoolId).eq("active", true);
      if (error) throw new Error(error.message);
      return (data ?? []).sort((a, b) => classDisplayName(a).localeCompare(classDisplayName(b), undefined, { numeric: true }));
    },
  });

  const { data: periods = [] } = useQuery({
    queryKey: ["generate-periods", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase.from("assessments").select("session, term").eq("class_id", classId).limit(1000);
      if (error) throw new Error(error.message);
      const seen = new Map<string, number>();
      (data ?? []).forEach((a) => seen.set(`${a.session}|${a.term}`, (seen.get(`${a.session}|${a.term}`) ?? 0) + 1));
      return Array.from(seen.entries()).map(([k, n]) => ({ session: k.split("|")[0], term: k.split("|")[1] as Term, n })).sort((a, b) => b.session.localeCompare(a.session));
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["generate-students", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, first_name, last_name, admission_no").eq("class_id", classId);
      if (error) throw new Error(error.message);
      return (data ?? []).sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
    },
  });

  const sessions = useMemo(() => Array.from(new Set(periods.map((p) => p.session))), [periods]);
  const activeSession = session || sessions[0] || "";
  const scoreCount = periods.find((p) => p.session === activeSession && p.term === term)?.n ?? 0;

  const run = useMutation({
    mutationFn: async (postNow: boolean) => generate({
      data: { class_id: classId, session: activeSession, term, post_to_portal: postNow, student_ids: studentId === "all" ? undefined : [studentId] },
    }),
    onSuccess: (r, postNow) => {
      setDone({ count: r.published, posted: postNow });
      toast.success(`${r.published} report card(s) generated for ${r.class_name}${postNow ? " and posted to the parent portal" : ""}${r.skipped_no_scores ? ` — ${r.skipped_no_scores} pupil(s) with no saved scores skipped` : ""}`);
      void qc.invalidateQueries({ queryKey: ["report-cards-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><FileCheck2 className="h-4 w-4 text-primary" />Generate report cards</CardTitle>
        <p className="text-xs text-muted-foreground">Uses every score teachers have saved — even if only some subjects are entered. No approval needed. Run it again any time scores change.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label>Class</Label>
            <Select value={classId} onValueChange={(v) => { setClassId(v); setSession(""); setStudentId("all"); setDone(null); }}>
              <SelectTrigger aria-label="Class to generate"><SelectValue placeholder="Choose class" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{classDisplayName(c)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Session</Label>
            <Select value={activeSession} onValueChange={(v) => { setSession(v); setDone(null); }} disabled={!sessions.length}>
              <SelectTrigger aria-label="Session to generate"><SelectValue placeholder={classId ? "No saved scores" : "Choose class first"} /></SelectTrigger>
              <SelectContent>{sessions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Term</Label>
            <Select value={term} onValueChange={(v) => { setTerm(v as Term); setDone(null); }}>
              <SelectTrigger aria-label="Term to generate"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="first">First Term</SelectItem>
                <SelectItem value="second">Second Term</SelectItem>
                <SelectItem value="third">Third Term</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Students</Label>
            <Select value={studentId} onValueChange={(v) => { setStudentId(v); setDone(null); }} disabled={!classId}>
              <SelectTrigger aria-label="Students to generate"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Whole class ({students.length})</SelectItem>
                {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name} · {s.admission_no}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {classId && (
          <p className="text-xs text-muted-foreground">
            {scoreCount > 0 ? `${scoreCount} saved score(s) found for this class and term.` : "No saved scores for this class and term yet. Scores still on a teacher's phone must be saved first in Results Entry."}
          </p>
        )}

        <div className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-muted/30 p-3 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-medium"><Trophy className="h-4 w-4 text-primary" />Positions: {rankingLabel}</div>
            {ranking.method === "ranges" && (
              <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                {[...ranking.ranges].sort((a, b) => b.min - a.min).map((r) => (
                  <span key={`${r.min}-${r.position}`} className="rounded border bg-background px-1.5 py-0.5">{r.min}–{r.max} → {ordinal(r.position)}</span>
                ))}
              </div>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => setRankingOpen(true)} disabled={!school}><SlidersHorizontal className="mr-1 h-3.5 w-3.5" />Customise positions</Button>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={post} onCheckedChange={(v) => setPost(v === true)} />
          Post to the parent portal now
        </label>

        <Button disabled={!classId || !activeSession || scoreCount === 0 || run.isPending} onClick={() => run.mutate(post)}>
          {run.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
          Generate {studentId === "all" ? "for whole class" : "for this student"}
        </Button>

        {done && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <span className="font-medium">{done.count} report card(s) ready{done.posted ? " · posted to parent portal" : " · saved (cards already posted stay posted)"}.</span>
            <Button asChild size="sm" variant="outline"><Link to="/report-distribution"><MessageCircle className="mr-1 h-3.5 w-3.5" />Send by WhatsApp / PDF</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/report-distribution"><Mail className="mr-1 h-3.5 w-3.5" />Send by email</Link></Button>
            {!done.posted && <Button size="sm" variant="secondary" disabled={run.isPending} onClick={() => { setPost(true); run.mutate(true); }}><Globe className="mr-1 h-3.5 w-3.5" />Post to parent portal</Button>}
          </div>
        )}
      </CardContent>
      <Dialog open={rankingOpen} onOpenChange={(open) => { setRankingOpen(open); if (!open) void qc.invalidateQueries({ queryKey: ["generate-ranking", schoolId] }); }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Customise how positions are given</DialogTitle></DialogHeader>
          {school && <PositionRankingSettings key={JSON.stringify(school.report_template ?? null)} school={school} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
