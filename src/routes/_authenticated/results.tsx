import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolAccess } from "@/hooks/useSchoolAccess";
import { useAuth, hasRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileDown, Send, Scale } from "lucide-react";
import { publishReportCards } from "@/lib/api/results.functions";
import { scoreEntryClasses } from "@/lib/form-master";
import { GeneralSubjectEntry } from "@/components/GeneralSubjectEntry";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  calculateGrade,
  validateScores,
  CA_RATIOS,
  resolveSchoolAcademicConfig,
  getScaleForSection,
} from "@/lib/grading";

export const Route = createFileRoute("/_authenticated/results")({
  head: () => ({ meta: [{ title: "Results — Alegacy" }, { name: "description", content: "Results for authorized school accounts and families in Alegacy." }, { property: "og:title", content: "Results — Alegacy" }, { property: "og:description", content: "Results for authorized school accounts and families in Alegacy." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ResultsPage,
});

function ResultsPage() {
  const { roles, schoolId, user } = useAuth();
  const qc = useQueryClient();
  const access = useSchoolAccess();
  const isStaff = access.can("results.edit");

  const [filters, setFilters] = useState({
    class_id: "", subject_id: "", session: "2025/2026", term: "first" as "first"|"second"|"third",
  });
  const [scores, setScores] = useState<Record<string, { ca1: number; ca2: number; exam: number }>>({});
  const [entryMode, setEntryMode] = useState('individual');
  const [saving, setSaving] = useState(false);

  const canApprove = access.can("results.publish");
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const review = async (ids: string[], status: "approved" | "draft", remark?: string) => {
    if (!ids.length) return toast.info("Nothing to review");
    if (status === "draft" && !remark?.trim()) return toast.error("Write a remark before returning");
    const { error } = await supabase.from("assessments").update({ status, review_remark: remark?.trim() || null }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? `Approved ${ids.length} result(s)` : "Returned to teacher for correction");
    qc.invalidateQueries({ queryKey: ["assessments"] });
  };

  const { data: activeSchool } = useQuery({
    queryKey: ["active-school-academic", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase.from("schools").select("id, name, report_template").eq("id", schoolId!).maybeSingle();
      return data;
    },
  });

  const academicConfig = resolveSchoolAcademicConfig(activeSchool?.report_template);
  const caRatioConfig = CA_RATIOS[academicConfig.caRatio] || CA_RATIOS["20_20_60"];

  const { data: classes, error: classAccessError } = useQuery({
    queryKey: ["res-classes", schoolId, user?.id, roles],
    enabled: Boolean(schoolId),
    queryFn: async () => {
      if (!schoolId || !user) return [];
      const { data, error } = await supabase.from("classes").select("id, name, level, section, arm, teacher_id").eq("school_id", schoolId).eq("active", true).eq("pending_activation", false).order("name");
      if (error) throw error;
      const { data: administrator, error: adminError } = await supabase.rpc('can_manage_school', { _user_id: user.id, _school_id: schoolId });
      if (adminError) throw adminError;
      const { data: allocations, error: allocationError } = await supabase.from('teacher_allocations').select('class_id, teacher_id').eq('school_id', schoolId).eq('teacher_id', user.id);
      if (allocationError) throw allocationError;
      return scoreEntryClasses(data ?? [], user.id, Boolean(administrator), allocations ?? []);
    },
  });

  useEffect(() => {
    if (!classes) return;
    setFilters(previous => classes.some(c => c.id === previous.class_id) ? previous : { ...previous, class_id: classes[0]?.id ?? '', subject_id: '' });
    setScores({});
  }, [classes]);

  const selectedClass = classes?.find((c: any) => c.id === filters.class_id);
  const scaleType = selectedClass
    ? getScaleForSection(selectedClass.level || selectedClass.section || selectedClass.name)
    : academicConfig.secondaryScale;

  const { data: subjects, error: subjectsError, isPending: subjectsLoading } = useQuery({
    queryKey: ["res-subjects", filters.class_id, schoolId],
    enabled: Boolean(schoolId),
    queryFn: async () => {
      if (!schoolId) return [];
      let q = supabase.from("subjects").select("id, name, class_id, school_id").eq("active", true).eq("pending_activation", false);
      if (schoolId) {
        q = q.eq("school_id", schoolId);
      }
      if (filters.class_id) {
        q = q.or(`class_id.eq.${filters.class_id},class_id.is.null`);
      }
      const { data, error } = await q.order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (subjects?.length && !subjects.some(s => s.id === filters.subject_id)) {
      setFilters(previous => ({ ...previous, subject_id: subjects[0]?.id ?? '' }));
      setScores({});
    }
  }, [subjects, filters.subject_id]);

  const { data: students, error: studentsError, isPending: studentsLoading } = useQuery({
    queryKey: ["res-students", schoolId, filters.class_id],
    enabled: Boolean(schoolId && filters.class_id),
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, admission_no, first_name, last_name").eq('school_id', schoolId ?? '').eq("class_id", filters.class_id).eq("active", true).eq("pending_activation", false).order("last_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: existing, error: existingError, isPending: existingLoading } = useQuery({
    queryKey: ["assessments", schoolId, filters],
    enabled: !!(filters.class_id && filters.subject_id),
    queryFn: async () => {
      const { data, error } = await supabase.from("assessments").select("*").eq('school_id', schoolId ?? '')
        .eq("class_id", filters.class_id).eq("subject_id", filters.subject_id)
        .eq("session", filters.session).eq("term", filters.term);
      if (error) throw error;
      const m: Record<string, any> = {};
      (data ?? []).forEach((a: any) => { m[a.student_id] = a; });
      return m;
    },
  });

  const saveScore = async (studentId: string) => {
    if (saving) return;
    if (!schoolId) return toast.error("No school");
    if (!classes?.some(c => c.id === filters.class_id)) return toast.error("Choose your assigned class");
    const ex = existing?.[studentId];
    const s = scores[studentId] ?? { ca1: ex?.ca1 ?? 0, ca2: ex?.ca2 ?? 0, exam: ex?.exam ?? 0 };

    const validation = validateScores(s.ca1, s.ca2, s.exam, academicConfig.caRatio);
    if (!validation.isValid) {
      return toast.error(validation.error || "Invalid score values entered");
    }

    const gradeDef = calculateGrade(validation.total, scaleType);

    setSaving(true);
    const { data: saved, error } = await supabase.from("assessments").upsert({
      school_id: schoolId,
      student_id: studentId,
      subject_id: filters.subject_id,
      class_id: filters.class_id,
      session: filters.session,
      term: filters.term,
      ca1: s.ca1,
      ca2: caRatioConfig.ca2Max > 0 ? s.ca2 : 0,
      exam: s.exam,
      total: validation.total,
      grade: gradeDef.grade,
      remark: gradeDef.remark,
      status: "submitted",
    }, { onConflict: "student_id,subject_id,session,term" }).select('id,student_id,subject_id,ca1,ca2,exam').single();
    setSaving(false);
    if (error) return toast.error(error.message);
    if (!saved || saved.student_id !== studentId || saved.subject_id !== filters.subject_id || Number(saved.ca1) !== s.ca1 || Number(saved.exam) !== s.exam) return toast.error('Saved scores could not be confirmed');
    toast.success(`Score saved (${gradeDef.grade} — ${gradeDef.remark})`);
    qc.invalidateQueries({ queryKey: ["assessments"] });
  };

  // Student/parent view
  const { data: myResults } = useQuery({
    queryKey: ["my-results", filters.session, filters.term],
    enabled: !isStaff,
    queryFn: async () => {
      const { data } = await supabase.from("assessments")
        .select("*, subjects(name), students(first_name, last_name, admission_no)")
        .eq("session", filters.session).eq("term", filters.term)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const publish = useServerFn(publishReportCards);
  const publishMutation = useMutation({
    mutationFn: () =>
      publish({
        data: {
          class_id: filters.class_id,
          session: filters.session,
          term: filters.term,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Published ${r.published} report card(s) for ${r.class_name}`);
      qc.invalidateQueries({ queryKey: ["report-cards-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (access.loading) return <p>Loading score-entry access…</p>;
  if (!isStaff) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Results</h1>
          <p className="text-sm text-muted-foreground">View your results per session and term.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Filter</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label>Session</Label><Input value={filters.session} onChange={(e) => setFilters({ ...filters, session: e.target.value })} /></div>
            <div>
              <Label>Term</Label>
              <Select value={filters.term} onValueChange={(v: any) => setFilters({ ...filters, term: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">First Term</SelectItem>
                  <SelectItem value="second">Second Term</SelectItem>
                  <SelectItem value="third">Third Term</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>My results</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Student</TableHead><TableHead>Subject</TableHead>
                <TableHead>CA1</TableHead><TableHead>CA2</TableHead><TableHead>Exam</TableHead>
                <TableHead>Total</TableHead><TableHead>Grade</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {myResults?.length ? myResults.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.students?.first_name} {r.students?.last_name}</TableCell>
                    <TableCell>{r.subjects?.name}</TableCell>
                    <TableCell>{r.ca1}</TableCell><TableCell>{r.ca2}</TableCell><TableCell>{r.exam}</TableCell>
                    <TableCell className="font-semibold">{r.total}</TableCell>
                    <TableCell><Badge>{r.grade}</Badge></TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No results published yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }




  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Results Entry</h1>
          <p className="text-sm text-muted-foreground">CA1 (max 20) · CA2 (max 20) · Exam (max 60). Grading is automatic. Results must be approved before report cards can be published.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/report-cards"><FileDown className="mr-2 h-4 w-4" /> Report cards</Link></Button>
          <Button
            disabled={!access.can("results.publish") || !filters.class_id || publishMutation.isPending}
            onClick={() => publishMutation.mutate()}
          >
            <Send className="mr-2 h-4 w-4" /> {publishMutation.isPending ? "Publishing…" : "Publish class report cards"}
          </Button>
        </div>
      </div>

      <Tabs value={entryMode} onValueChange={setEntryMode}><TabsList className="flex h-auto flex-wrap justify-start"><TabsTrigger value="individual">Individual subject entry</TabsTrigger><TabsTrigger value="general">General subject entry</TabsTrigger></TabsList></Tabs>

      <Card>
        <CardHeader><CardTitle>Select</CardTitle></CardHeader>
        {classAccessError && <p role="alert" className="px-6 text-destructive">Class assignments could not be loaded: {classAccessError.message}</p>}
        {!classAccessError && classes?.length === 0 && <p className="px-6 text-muted-foreground">No class assigned yet.</p>}
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <Label>Class</Label>
            <Select
              value={filters.class_id}
              onValueChange={(v) => {
                setFilters({ ...filters, class_id: v, subject_id: '' });
                setScores({});
              }}
            >
              <SelectTrigger><SelectValue placeholder="Choose Class" /></SelectTrigger>
              <SelectContent>
                {classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {entryMode === 'individual' && <div>
            <Label>Subject</Label>
            <Select
              value={filters.subject_id}
              onValueChange={(v) => { setFilters({ ...filters, subject_id: v }); setScores({}); }}
            >
              <SelectTrigger><SelectValue placeholder={subjects?.length ? "Choose Subject" : "No subjects available"} /></SelectTrigger>
              <SelectContent>
                {subjects?.length ? (
                  subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                ) : (
                  <SelectItem value="__none" disabled>No subjects registered</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>}
          <div><Label>Session</Label><Input value={filters.session} onChange={(e) => { setFilters({ ...filters, session: e.target.value }); setScores({}); }} /></div>
          <div>
            <Label>Term</Label>
            <Select value={filters.term} onValueChange={(v: any) => { setFilters({ ...filters, term: v }); setScores({}); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="first">First</SelectItem>
                <SelectItem value="second">Second</SelectItem>
                <SelectItem value="third">Third</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {subjectsError && <p role="alert" className="text-destructive">Subjects could not be loaded: {subjectsError.message}</p>}
      {studentsError && <p role="alert" className="text-destructive">Students could not be loaded: {studentsError.message}</p>}
      {existingError && entryMode === 'individual' && <p role="alert" className="text-destructive">Scores could not be loaded: {existingError.message}</p>}
      {filters.class_id && !subjectsLoading && !subjectsError && subjects?.length === 0 && <p>No active subjects in this class.</p>}
      {filters.class_id && studentsLoading && <p>Loading students…</p>}
      {entryMode === 'general' && schoolId && filters.class_id && !studentsLoading && !subjectsLoading && !studentsError && !subjectsError && <GeneralSubjectEntry key={`${schoolId}:${filters.class_id}:${filters.session}:${filters.term}`} schoolId={schoolId} classId={filters.class_id} session={filters.session} term={filters.term} students={students ?? []} subjects={subjects ?? []} ratio={academicConfig.caRatio} scale={scaleType} canApprove={canApprove} />}

      {entryMode === 'individual' && filters.class_id && filters.subject_id && !existingError && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Scoresheet</CardTitle>
            {canApprove && (
              <Button size="sm" variant="secondary" onClick={() => review(Object.values(existing ?? {}).filter((a: any) => a.status === "submitted").map((a: any) => a.id), "approved")}>
                Approve all submitted
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Adm. No.</TableHead><TableHead>Student</TableHead>
                <TableHead>{caRatioConfig.ca1Label} ({caRatioConfig.ca1Max})</TableHead>
                {caRatioConfig.ca2Max > 0 && <TableHead>{caRatioConfig.ca2Label} ({caRatioConfig.ca2Max})</TableHead>}
                <TableHead>{caRatioConfig.examLabel} ({caRatioConfig.examMax})</TableHead>
                <TableHead>Total (100)</TableHead>
                <TableHead>Grade ({scaleType === "waec_9point" ? "WAEC/NECO" : "Basic"})</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {students?.length ? students.map((st) => {
                  const ex = existing?.[st.id];
                  const cur = scores[st.id] ?? { ca1: ex?.ca1 ?? 0, ca2: ex?.ca2 ?? 0, exam: ex?.exam ?? 0 };
                  const liveTotal = (cur.ca1 || 0) + (caRatioConfig.ca2Max > 0 ? (cur.ca2 || 0) : 0) + (cur.exam || 0);
                  const liveGrade = calculateGrade(liveTotal, scaleType);
                  return (
                    <TableRow key={st.id}>
                      <TableCell className="font-mono text-xs">{st.admission_no}</TableCell>
                      <TableCell className="font-medium">{st.first_name} {st.last_name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={caRatioConfig.ca1Max}
                          className="w-20"
                          value={cur.ca1}
                          onChange={(e) => setScores({ ...scores, [st.id]: { ...cur, ca1: +e.target.value } })}
                        />
                      </TableCell>
                      {caRatioConfig.ca2Max > 0 && (
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={caRatioConfig.ca2Max}
                            className="w-20"
                            value={cur.ca2}
                            onChange={(e) => setScores({ ...scores, [st.id]: { ...cur, ca2: +e.target.value } })}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={caRatioConfig.examMax}
                          className="w-20"
                          value={cur.exam}
                          onChange={(e) => setScores({ ...scores, [st.id]: { ...cur, exam: +e.target.value } })}
                        />
                      </TableCell>
                      <TableCell className="font-bold text-sm">{liveTotal}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-flex items-center w-fit px-2 py-0.5 rounded text-xs font-bold ${
                            liveGrade.isCredit
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              : liveGrade.isPass
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                              : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                          }`}>
                            {ex?.grade || liveGrade.grade}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{ex?.remark || liveGrade.remark}</span>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[140px]">
                        {!ex ? <span className="text-xs text-muted-foreground">Not entered</span>
                          : ex.status === "approved" ? <Badge>Approved</Badge>
                          : ex.status === "submitted" ? <Badge variant="secondary">Awaiting approval</Badge>
                          : <Badge variant="destructive">Returned</Badge>}
                        {ex?.review_remark && <p className="mt-1 text-xs text-muted-foreground">Remark: {ex.review_remark}</p>}
                      </TableCell>
                      <TableCell className="space-y-1 min-w-[160px]">
                        <Button size="sm" disabled={saving || existingLoading || (ex?.status === "approved" && !canApprove)} onClick={() => saveScore(st.id)}>{saving ? 'Saving…' : ex?.status === "draft" ? "Resubmit" : "Save"}</Button>
                        {canApprove && ex && (
                          <div className="flex flex-col gap-1">
                            {ex.status !== "approved" && <Button size="sm" variant="outline" onClick={() => review([ex.id], "approved")}>Approve</Button>}
                            <Input placeholder="Remark" className="h-8 text-xs" value={remarks[ex.id] ?? ""} onChange={(e) => setRemarks({ ...remarks, [ex.id]: e.target.value })} />
                            <Button size="sm" variant="ghost" onClick={() => review([ex.id], "draft", remarks[ex.id])}>Return for correction</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }) : <TableRow><TableCell colSpan={caRatioConfig.ca2Max > 0 ? 9 : 8} className="text-center text-muted-foreground">No students in this class</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
