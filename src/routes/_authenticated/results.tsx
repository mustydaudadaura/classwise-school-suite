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
import { scoreEntryClasses, scoreEntrySubjects, isClassFormMaster } from "@/lib/form-master";
import { buildClassSubmissionSummary } from "@/lib/hierarchical-rbac";
import { GeneralSubjectEntry } from "@/components/GeneralSubjectEntry";
import { classSubjects } from '@/lib/broadsheet';
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
  const isAdminOrSuper = hasRole(roles, "super_admin", "school_admin");

  const [filters, setFilters] = useState({
    class_id: "", subject_id: "", session: "2025/2026", term: "first" as "first"|"second"|"third",
  });
  const [scores, setScores] = useState<Record<string, { ca1: number; ca2: number; exam: number }>>({});
  const [entryMode, setEntryMode] = useState('individual');
  const [saving, setSaving] = useState(false);
  const [rowSaving, setRowSaving] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [autoSave, setAutoSave] = useState(true);

  const canApprove = access.can("results.publish");
  const [remarks, setRemarks] = useState<Record<string, string>>({});

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

  const { data: userAllocations } = useQuery({
    queryKey: ["res-user-allocations", schoolId, user?.id],
    enabled: Boolean(schoolId && user && !access.loading),
    queryFn: async () => {
      if (!schoolId || !user) return [];
      const { data, error } = await supabase
        .from("teacher_allocations")
        .select("class_id, teacher_id, subject_id, is_class_teacher")
        .eq("school_id", schoolId)
        .eq("teacher_id", user.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: classes, error: classAccessError } = useQuery({
    queryKey: ["res-classes", schoolId, user?.id, roles],
    enabled: Boolean(schoolId && user && !access.loading),
    queryFn: async () => {
      if (!schoolId || !user) return [];
      const { data, error } = await supabase.from("classes").select("id, name, level, section, arm, teacher_id").eq("school_id", schoolId).eq("active", true).eq("pending_activation", false).order("name");
      if (error) throw error;
      const { data: administrator, error: adminError } = await supabase.rpc('can_manage_school', { _user_id: user.id, _school_id: schoolId });
      if (adminError) throw adminError;
      const { data: allocations, error: allocationError } = await supabase.from('teacher_allocations').select('class_id, teacher_id, subject_id, is_class_teacher').eq('school_id', schoolId).eq('teacher_id', user.id);
      if (allocationError) throw allocationError;
      return scoreEntryClasses(data ?? [], user.id, Boolean(administrator), allocations ?? []);
    },
  });

  useEffect(() => {
    if (!classes) return;
    setFilters(previous => classes.some(c => c.id === previous.class_id) ? previous : { ...previous, class_id: classes[0]?.id ?? '', subject_id: '' });
    setScores({}); setDirty({});
  }, [classes]);

  const selectedClass = classes?.find((c: any) => c.id === filters.class_id);
  const scaleType = selectedClass
    ? getScaleForSection(selectedClass.level || selectedClass.section || selectedClass.name)
    : academicConfig.secondaryScale;

  // True for Super Admin, School Admin, and the assigned Class Form Master of the selected class
  const canMonitorSelectedClass = Boolean(
    filters.class_id &&
    user &&
    isClassFormMaster(
      classes ?? [],
      filters.class_id,
      user.id,
      isAdminOrSuper || canApprove,
      userAllocations ?? []
    )
  );
  const canReviewSelectedClass = canApprove || canMonitorSelectedClass;

  const review = async (ids: string[], status: "approved" | "draft", remark?: string) => {
    if (!ids.length) return toast.info("Nothing to review");
    if (status === "approved" && !canApprove) {
      return toast.error("Only School Administrators or Super Admins can grant final approval.");
    }
    if (!canReviewSelectedClass) {
      return toast.error("You are not authorized to review submissions for this class.");
    }
    if (status === "draft" && !remark?.trim()) return toast.error("Write a remark before returning");
    const { error } = await supabase.from("assessments").update({ status, review_remark: remark?.trim() || null }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? `Approved ${ids.length} result(s)` : "Returned to teacher for correction");
    qc.invalidateQueries({ queryKey: ["assessments"] });
    qc.invalidateQueries({ queryKey: ["class-monitor-assessments"] });
  };

  // All subjects registered in the selected class (used by Form Masters & Admins for monitoring, and filtered for Subject Teachers)
  const { data: allClassSubjects, error: subjectsError, isPending: subjectsLoading } = useQuery({
    queryKey: ["res-subjects", filters.class_id, schoolId],
    enabled: Boolean(schoolId && filters.class_id),
    queryFn: async () => {
      if (!schoolId) return [];
      let q = supabase.from("subjects").select("id, name, class_id, school_id").eq("active", true).eq("pending_activation", false);
      if (schoolId) {
        q = q.eq("school_id", schoolId);
      }
      if (filters.class_id) {
        q = q.eq('class_id', filters.class_id);
      }
      const { data, error } = await q.order("name");
      if (error) throw error;
      return classSubjects(data ?? [], filters.class_id);
    },
  });

  // Subjects the current user is authorized to enter/edit scores for:
  // - Super Admin, School Admin, and Class Form Master of this class: all subjects in the class (via role inheritance)
  // - Class Subject Teacher: strictly their allocated subjects in this class
  const subjects = allClassSubjects
    ? scoreEntrySubjects(
        allClassSubjects,
        classes ?? [],
        filters.class_id,
        user?.id ?? "",
        isAdminOrSuper || canApprove,
        userAllocations ?? []
      )
    : undefined;

  useEffect(() => {
    if (subjects?.length && !subjects.some(s => s.id === filters.subject_id)) {
      setFilters(previous => ({ ...previous, subject_id: subjects[0]?.id ?? '' }));
      setScores({}); setDirty({});
    } else if (subjects && subjects.length === 0 && filters.subject_id) {
      setFilters(previous => ({ ...previous, subject_id: '' }));
      setScores({}); setDirty({});
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

  // Class-wide submission monitoring data for Form Masters, School Admins, and Super Admins
  const { data: classMonitorData } = useQuery({
    queryKey: ["class-monitor-assessments", schoolId, filters.class_id, filters.session, filters.term],
    enabled: Boolean(schoolId && filters.class_id && canMonitorSelectedClass),
    queryFn: async () => {
      if (!schoolId || !filters.class_id) return { assessments: [], allocations: [], teachers: [] };
      const [assessRes, allocRes] = await Promise.all([
        supabase
          .from("assessments")
          .select("id, student_id, subject_id, status, total, grade, review_remark")
          .eq("school_id", schoolId)
          .eq("class_id", filters.class_id)
          .eq("session", filters.session)
          .eq("term", filters.term),
        supabase
          .from("teacher_allocations")
          .select("teacher_id, class_id, subject_id, is_class_teacher")
          .eq("school_id", schoolId)
          .eq("class_id", filters.class_id),
      ]);
      const teacherIds = Array.from(new Set((allocRes.data ?? []).map((a: any) => a.teacher_id).filter(Boolean)));
      const profRes = teacherIds.length
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", teacherIds)
        : { data: [] };
      const teachers = (profRes.data ?? []).map((p: any) => ({ id: p.user_id, name: p.full_name || "Subject Teacher" }));
      return {
        assessments: assessRes.data ?? [],
        allocations: allocRes.data ?? [],
        teachers,
      };
    },
  });

  const submissionSummary = canMonitorSelectedClass
    ? buildClassSubmissionSummary({
        classId: filters.class_id,
        students: students ?? [],
        subjects: allClassSubjects ?? [],
        assessments: classMonitorData?.assessments ?? [],
        allocations: classMonitorData?.allocations ?? [],
        teachers: classMonitorData?.teachers ?? [],
      })
    : [];

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

  const saveScore = async (studentId: string, quiet = false): Promise<boolean> => {
    if (rowSaving[studentId]) return false;
    const fail = (m: string) => { toast.error(m); return false; };
    if (!schoolId) return fail("No school");
    if (!classes?.some(c => c.id === filters.class_id)) return fail("Choose your assigned class");
    if (!subjects?.some(s => s.id === filters.subject_id)) {
      return fail("Access Denied: You can only enter or modify scores for your assigned subjects.");
    }
    const ex = existing?.[studentId];
    const s = scores[studentId] ?? { ca1: ex?.ca1 ?? 0, ca2: ex?.ca2 ?? 0, exam: ex?.exam ?? 0 };

    const validation = validateScores(s.ca1, s.ca2, s.exam, academicConfig.caRatio);
    if (!validation.isValid) {
      return fail(validation.error || "Invalid score values entered");
    }

    const gradeDef = calculateGrade(validation.total, scaleType);

    setRowSaving((p) => ({ ...p, [studentId]: true }));
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
    setRowSaving((p) => ({ ...p, [studentId]: false }));
    if (error) return fail(error.message);
    if (!saved || saved.student_id !== studentId || saved.subject_id !== filters.subject_id || Number(saved.ca1) !== s.ca1 || Number(saved.exam) !== s.exam) return fail('Saved scores could not be confirmed');
    setDirty((p) => ({ ...p, [studentId]: false }));
    if (!quiet) toast.success(`Score saved (${gradeDef.grade} — ${gradeDef.remark})`);
    qc.invalidateQueries({ queryKey: ["assessments"] });
    qc.invalidateQueries({ queryKey: ["class-monitor-assessments"] });
    return true;
  };

  const saveAll = async () => {
    const ids = Object.keys(dirty).filter((id) => dirty[id]);
    if (!ids.length) return toast.info("No changed scores to save");
    setSaving(true);
    let ok = 0;
    for (const id of ids) if (await saveScore(id, true)) ok++;
    setSaving(false);
    toast.success(`${ok} of ${ids.length} students' scores saved`);
  };

  const autoSaveRow = (studentId: string) => {
    if (autoSave && dirty[studentId]) void saveScore(studentId, true);
  };

  // Student/parent view: strictly restricted to their own / their registered children's approved & published results
  const { data: myResults } = useQuery({
    queryKey: ["my-results", filters.session, filters.term, user?.id],
    enabled: !isStaff && Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return [];
      let allowedStudentIds: string[] = [];
      if (hasRole(roles, "student")) {
        const { data: st } = await supabase.from("students").select("id").eq("user_id", user.id).eq("active", true).maybeSingle();
        if (st?.id) allowedStudentIds.push(st.id);
      }
      if (hasRole(roles, "parent")) {
        const { data: pRow } = await supabase.from("parents").select("id").eq("user_id", user.id).maybeSingle();
        if (pRow?.id) {
          const { data: links } = await supabase.from("student_parents").select("student_id").eq("parent_id", pRow.id);
          allowedStudentIds.push(...(links ?? []).map((l: any) => l.student_id));
        }
      }
      if (!allowedStudentIds.length) return [];
      const { data } = await supabase.from("assessments")
        .select("*, subjects(name), students(first_name, last_name, admission_no)")
        .in("student_id", allowedStudentIds)
        .eq("session", filters.session)
        .eq("term", filters.term)
        .eq("status", "approved")
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={entryMode} onValueChange={setEntryMode}>
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="individual">Individual subject entry</TabsTrigger>
            <TabsTrigger value="general">General subject entry</TabsTrigger>
            {canMonitorSelectedClass && (
              <TabsTrigger value="monitor">Class submissions & review</TabsTrigger>
            )}
          </TabsList>
        </Tabs>
        <Badge variant="outline" className="text-xs">
          {hasRole(roles, "super_admin")
            ? "Super Admin · Full Cross-School Inheritance"
            : hasRole(roles, "school_admin")
            ? "School Admin · Full School Inheritance"
            : canMonitorSelectedClass
            ? "Class Form Master · Assigned Class & Subject Inheritance"
            : "Class Subject Teacher · Assigned Subjects Only"}
        </Badge>
      </div>

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
                setScores({}); setDirty({});
              }}
            >
              <SelectTrigger aria-label="Result class"><SelectValue placeholder="Choose Class" /></SelectTrigger>
              <SelectContent>
                {classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {entryMode === 'individual' && <div>
            <Label>Subject</Label>
            <Select
              value={filters.subject_id}
              onValueChange={(v) => { setFilters({ ...filters, subject_id: v }); setScores({}); setDirty({}); }}
            >
              <SelectTrigger aria-label="Result subject"><SelectValue placeholder={subjects?.length ? "Choose Subject" : "No subjects available"} /></SelectTrigger>
              <SelectContent>
                {subjects?.length ? (
                  subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                ) : (
                  <SelectItem value="__none" disabled>No assigned subjects in this class</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>}
          <div><Label>Session</Label><Input value={filters.session} onChange={(e) => { setFilters({ ...filters, session: e.target.value }); setScores({}); setDirty({}); }} /></div>
          <div>
            <Label>Term</Label>
            <Select value={filters.term} onValueChange={(v: any) => { setFilters({ ...filters, term: v }); setScores({}); setDirty({}); }}>
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
      {filters.class_id && !subjectsLoading && !subjectsError && subjects?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {canMonitorSelectedClass
            ? "No active subjects registered in this class."
            : "You have no assigned subjects in this class. Contact your School Admin or Form Master."}
        </p>
      )}
      {filters.class_id && studentsLoading && <p>Loading students…</p>}

      {entryMode === "monitor" && canMonitorSelectedClass && filters.class_id && (
        <Card>
          <CardHeader>
            <CardTitle>Class Score Submissions & Subject Teachers ({selectedClass?.name})</CardTitle>
            <p className="text-xs text-muted-foreground">
              Form Master & Administrative overview of all subjects, assigned subject teachers, and pending score submissions in this class.
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Assigned Subject Teacher(s)</TableHead>
                  <TableHead>Entered / Students</TableHead>
                  <TableHead>Awaiting Review</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Pending / Missing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissionSummary.length ? (
                  submissionSummary.map((item) => (
                    <TableRow key={item.subjectId}>
                      <TableCell className="font-medium">{item.subjectName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.subjectTeachers.length
                          ? item.subjectTeachers.map((t) => t.name).join(", ")
                          : "Unassigned (Form Master / Admin)"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.enteredCount} / {item.totalStudents}
                      </TableCell>
                      <TableCell>{item.submittedCount}</TableCell>
                      <TableCell>{item.approvedCount}</TableCell>
                      <TableCell className={item.missingCount > 0 || item.draftCount > 0 ? "text-amber-600 font-semibold" : ""}>
                        {item.missingCount + item.draftCount}
                      </TableCell>
                      <TableCell>
                        {item.status === "approved" ? (
                          <Badge>Complete & Approved</Badge>
                        ) : item.status === "pending_review" ? (
                          <Badge variant="secondary">Ready for Review</Badge>
                        ) : item.status === "incomplete" ? (
                          <Badge variant="outline">Pending Submissions</Badge>
                        ) : (
                          <Badge variant="destructive">Not Started</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setFilters((prev) => ({ ...prev, subject_id: item.subjectId }));
                            setEntryMode("individual");
                          }}
                        >
                          Review / Enter Scores
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No subjects registered for this class yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {entryMode === 'general' && schoolId && filters.class_id && !studentsLoading && !subjectsLoading && !studentsError && !subjectsError && <GeneralSubjectEntry key={`${schoolId}:${filters.class_id}:${filters.session}:${filters.term}`} schoolId={schoolId} classId={filters.class_id} session={filters.session} term={filters.term} students={students ?? []} subjects={subjects ?? []} ratio={academicConfig.caRatio} scale={scaleType} canApprove={canApprove} />}

      {entryMode === 'individual' && filters.class_id && filters.subject_id && !existingError && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Scoresheet</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} /> Save automatically</label>
              <Button size="sm" disabled={saving || existingLoading} onClick={saveAll}>{saving ? "Saving…" : `Save all changes${Object.values(dirty).filter(Boolean).length ? ` (${Object.values(dirty).filter(Boolean).length})` : ""}`}</Button>
            </div>
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
                          onChange={(e) => { setScores({ ...scores, [st.id]: { ...cur, ca1: +e.target.value } }); setDirty((p) => ({ ...p, [st.id]: true })); }}
                          onBlur={() => autoSaveRow(st.id)}
                          disabled={ex?.status === "approved" && !canApprove}
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
                            onChange={(e) => { setScores({ ...scores, [st.id]: { ...cur, ca2: +e.target.value } }); setDirty((p) => ({ ...p, [st.id]: true })); }}
                          onBlur={() => autoSaveRow(st.id)}
                          disabled={ex?.status === "approved" && !canApprove}
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
                          onChange={(e) => { setScores({ ...scores, [st.id]: { ...cur, exam: +e.target.value } }); setDirty((p) => ({ ...p, [st.id]: true })); }}
                          onBlur={() => autoSaveRow(st.id)}
                          disabled={ex?.status === "approved" && !canApprove}
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
                        <Button size="sm" disabled={rowSaving[st.id] || existingLoading || (ex?.status === "approved" && !canApprove)} onClick={() => saveScore(st.id)}>{rowSaving[st.id] ? 'Saving…' : dirty[st.id] ? (ex?.status === "draft" ? "Resubmit" : 'Save') : ex ? (ex.status === "draft" ? "Resubmit" : 'Saved ✓') : "Save"}</Button>
                        {canReviewSelectedClass && ex && (
                          <div className="flex flex-col gap-1">
                            {canApprove && ex.status !== "approved" && <Button size="sm" variant="outline" onClick={() => review([ex.id], "approved")}>Approve</Button>}
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
