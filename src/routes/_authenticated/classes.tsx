import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BulkRegistryDelete } from "@/components/BulkRegistryDelete";
import { RegistryActions } from "@/components/RegistryActions";
import { useSchoolAccess } from "@/hooks/useSchoolAccess";
import { classSubmissionState } from "@/lib/registry-permissions";
import { requireSavedRecord } from "@/lib/registry-save";
import { ClassImport } from "@/components/ClassImport";
import { hasRole } from "@/hooks/useAuth";
import { useRegistrationSubmission } from "@/hooks/useRegistrationSubmission";
import { PendingClassActivations } from "@/components/PendingClassActivations";
import { RegistrationReview } from "@/components/RegistrationReview";
import { FormMasterAssignment } from "@/components/FormMasterAssignment";
import { validateClassCreation, validateSubjectCreation } from "@/lib/academic-registration";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({ meta: [{ title: "Classes & Subjects — Alegacy" }, { name: "description", content: "Classes & Subjects for authorized school accounts and families in Alegacy." }, { property: "og:title", content: "Classes & Subjects — Alegacy" }, { property: "og:description", content: "Classes & Subjects for authorized school accounts and families in Alegacy." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ClassesPage,
});

function ClassesPage() {
  const { schoolId, user, roles } = useAuth();
  const access = useSchoolAccess();
  const canManage = access.schoolId === schoolId && access.can("academics.edit");
  const submission = useRegistrationSubmission(user?.id, schoolId);
  const subjectSubmission = useRegistrationSubmission(user?.id, schoolId, 'subject');
  const isAdministrator = canManage && hasRole(roles, "super_admin", "school_admin");
  const canAddClass = isAdministrator || submission.allowed;
  const canAddSubject = isAdministrator || subjectSubmission.allowed;
  const qc = useQueryClient();
  const [cls, setCls] = useState<{ name: string; level: string; arm: string; section: "nursery" | "primary" | "secondary" | "" }>({ name: "", level: "", arm: "", section: "" });
  const [saving, setSaving] = useState(false);
  const [sub, setSub] = useState({ name: "", code: "", class_id: "" });
  const [subjectClass, setSubjectClass] = useState('');

  const { data: classes, error: classesError, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", schoolId],
    enabled: Boolean(schoolId),
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").eq("school_id", schoolId ?? "").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: subjects, error: subjectsError, isLoading: subjectsLoading } = useQuery({
    queryKey: ["subjects", schoolId],
    enabled: Boolean(schoolId),
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*, classes(name)").eq("school_id", schoolId ?? "").order("name");
      if (error) throw error;
      return data;
    },
  });

  const availableClasses = (classes ?? []).filter(c => c.active && !c.pending_activation);
  useEffect(() => {
    setSub({ name: "", code: "", class_id: "" });
    setSubjectClass("");
  }, [schoolId]);
  useEffect(() => {
    if (classes?.length && !classes.some(c => c.id === subjectClass) && subjectClass !== 'unassigned') {
      setSubjectClass(classes.find(c => c.active && !c.pending_activation)?.id ?? classes[0]?.id ?? 'unassigned');
    }
  }, [classes, subjectClass]);

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return toast.error("Select a school first");
    if (saving) return;
    let fields;
    try { fields = validateClassCreation(cls); }
    catch (error) { return toast.error(error instanceof Error ? error.message : "Complete every class field"); }
    if (classes?.some(c => c.name.trim().toLowerCase() === fields.name.toLowerCase())) return toast.error("A class with this name already exists in this school");
    setSaving(true);
    try {
      if (!user) throw new Error("Sign in before registering a class");
      const state = classSubmissionState(isAdministrator, submission.allowed, user.id);
      const { data, error } = await supabase.from("classes").insert({
        ...fields, school_id: schoolId, ...state,
      }).select("id, school_id, active, pending_activation").single();
      if (error) throw error;
      requireSavedRecord(data, schoolId);
      if (data.active !== state.active || data.pending_activation !== state.pending_activation) throw new Error("Class approval status could not be confirmed");
      await qc.invalidateQueries({ queryKey: ["classes"] });
      await qc.invalidateQueries({ queryKey: ["classes-for-students"] });
      toast.success(isAdministrator ? "Class created" : "Class submitted — awaiting administrator approval");
      setCls({ name: "", level: "", arm: "", section: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (error as { message?: string }).message ?? "Class could not be saved");
    } finally { setSaving(false); }
  };

  const addSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return toast.error("Select a school first");
    if (saving) return;
    let fields;
    try { fields = validateSubjectCreation(sub, schoolId, classes ?? []); }
    catch (error) { return toast.error(error instanceof Error ? error.message : "Complete every subject field"); }
    if (subjects?.some(s => s.class_id === fields.class_id && s.name.trim().toLowerCase() === fields.name.toLowerCase())) return toast.error("This subject already exists in the selected class");
    setSaving(true);
    try {
      if (!user) throw new Error("Sign in before registering a subject");
      const state = classSubmissionState(isAdministrator, subjectSubmission.allowed, user.id);
      const { data, error } = await supabase.from("subjects").insert({
        school_id: schoolId, ...fields, ...state,
      }).select("id, school_id, active, pending_activation").single();
      if (error) throw error;
      requireSavedRecord(data, schoolId);
      if (data.active !== state.active || data.pending_activation !== state.pending_activation) throw new Error("Subject approval status could not be confirmed");
      await qc.invalidateQueries({ queryKey: ["subjects"] });
      toast.success(isAdministrator ? "Subject added" : "Subject submitted — awaiting administrator approval");
      setSubjectClass(fields.class_id);
      setSub({ name: "", code: "", class_id: fields.class_id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (error as { message?: string }).message ?? "Subject could not be saved");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Classes & Subjects</h1>
      </div>

      {!schoolId && <p role="alert" className="text-destructive">Select a school from the school switcher before adding records.</p>}
      {submission.error && <p role="alert" className="text-destructive">Registration access could not be checked: {submission.error.message}</p>}
      <Tabs defaultValue="classes">
        <TabsList>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="space-y-4">
          {isAdministrator && schoolId && !classesLoading && !classesError && <ClassImport kind="classes" schoolId={schoolId} classes={classes ?? []} subjects={subjects ?? []} />}
          {isAdministrator && <PendingClassActivations classes={(classes ?? []).filter(c => c.pending_activation)} />}
          {canAddClass && <Card>
            <CardHeader><CardTitle>Add class</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={addClass} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                <div><Label htmlFor="class-name">Name *</Label><Input id="class-name" required placeholder="JSS 1A" value={cls.name} onChange={(e) => setCls({ ...cls, name: e.target.value })} /></div>
                <div><Label htmlFor="class-level">Level *</Label><Input id="class-level" required placeholder="JSS 1" value={cls.level} onChange={(e) => setCls({ ...cls, level: e.target.value })} /></div>
                <div><Label htmlFor="class-arm">Arm *</Label><Input id="class-arm" required placeholder="A" value={cls.arm} onChange={(e) => setCls({ ...cls, arm: e.target.value })} /></div>
                <div>
                  <Label htmlFor="class-section">Section *</Label>
                  <Select required value={cls.section} onValueChange={(v) => setCls({ ...cls, section: v as "nursery" | "primary" | "secondary" })}>
                    <SelectTrigger id="class-section"><SelectValue placeholder="Select section" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nursery">Nursery</SelectItem>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="secondary">Secondary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end"><Button type="submit" disabled={saving || !schoolId || classesLoading || Boolean(classesError)} className="w-full">{saving ? "Saving…" : isAdministrator ? "Add" : "Submit class"}</Button></div>
              </form>
            </CardContent>
          </Card>}
          <Card>
            <CardContent className="pt-6">
              {isAdministrator && <div className="mb-3 flex justify-end"><BulkRegistryDelete table="classes" label="classes" items={(classes ?? []).map((c: any) => ({ id: c.id, name: c.name }))} /></div>}
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Level</TableHead><TableHead>Arm</TableHead><TableHead>Section</TableHead><TableHead>Form master</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {classesError ? <TableRow><TableCell colSpan={6} role="alert" className="text-destructive">Classes could not be loaded: {classesError.message}</TableCell></TableRow> : classesLoading ? <TableRow><TableCell colSpan={6}>Loading classes…</TableCell></TableRow> : classes?.length ? classes.map((c: any) => (
                    <TableRow key={c.id}><TableCell className="font-medium">{c.name}</TableCell><TableCell>{c.level ?? "—"}</TableCell><TableCell>{c.arm ?? "—"}</TableCell><TableCell className="capitalize">{c.section ?? "—"}</TableCell><TableCell>{isAdministrator && schoolId && c.active && !c.pending_activation ? <FormMasterAssignment schoolId={schoolId} classId={c.id} className={c.name} teacherId={c.teacher_id} /> : c.teacher_id === user?.id ? "My class" : "—"}</TableCell><TableCell>{c.rejected_at ? <div className="flex items-center gap-2"><span className="text-sm text-destructive">Rejected: {c.rejection_reason}</span>{isAdministrator && <RegistrationReview kind="classes" id={c.id} name={c.name} editOnly />}</div> : c.pending_activation ? <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Awaiting approval</span>{isAdministrator && <RegistrationReview kind="classes" id={c.id} name={c.name} />}</div> : isAdministrator ? <RegistryActions table="classes" id={c.id} name={c.name} active={c.active} /> : <span className="text-sm text-muted-foreground">{c.active ? "Active" : "Inactive"}</span>}</TableCell></TableRow>
                  )) : <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No classes yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <div className="max-w-sm"><Label htmlFor="subject-list-class">Subjects for class</Label><Select value={subjectClass} onValueChange={setSubjectClass}><SelectTrigger id="subject-list-class" aria-label="Subjects for class"><SelectValue placeholder="Choose class" /></SelectTrigger><SelectContent>{classes?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}<SelectItem value="unassigned">Unassigned subjects (needs class assignment)</SelectItem></SelectContent></Select></div>
          {isAdministrator && schoolId && !classesLoading && !subjectsLoading && !classesError && !subjectsError && <ClassImport kind="subjects" schoolId={schoolId} classes={classes ?? []} subjects={subjects ?? []} />}
          {isAdministrator && <PendingClassActivations kind="subjects" classes={(subjects ?? []).filter(s => s.pending_activation && (subjectClass === "unassigned" ? !s.class_id : s.class_id === subjectClass))} />}
          {canAddSubject && <Card>
            <CardHeader><CardTitle>Add subject</CardTitle></CardHeader>
            <CardContent>
              {!classesLoading && !classesError && !availableClasses.length && <p role="status" className="mb-3 text-sm text-muted-foreground">No approved classes available. Create a class first; administrator activation is required before adding subjects.</p>}
              <form onSubmit={addSubject} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div><Label htmlFor="subject-name">Name *</Label><Input id="subject-name" required placeholder="Mathematics" value={sub.name} onChange={(e) => setSub({ ...sub, name: e.target.value })} /></div>
                <div><Label htmlFor="subject-code">Code *</Label><Input id="subject-code" required placeholder="MTH" value={sub.code} onChange={(e) => setSub({ ...sub, code: e.target.value })} /></div>
                <div>
                  <Label htmlFor="subject-class">Class *</Label>
                  <Select required disabled={!availableClasses.length || classesLoading || Boolean(classesError)} value={sub.class_id} onValueChange={(v) => { setSub({ ...sub, class_id: v }); setSubjectClass(v); }}>
                    <SelectTrigger id="subject-class"><SelectValue placeholder="Choose class" /></SelectTrigger>
                    <SelectContent>
                      {availableClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end"><Button type="submit" disabled={saving || !schoolId || !availableClasses.length || classesLoading || subjectsLoading || Boolean(classesError || subjectsError)} className="w-full">{saving ? "Saving…" : isAdministrator ? "Add" : "Submit subject"}</Button></div>
              </form>
            </CardContent>
          </Card>}
          <Card>
            <CardContent className="pt-6">
              {isAdministrator && <div className="mb-3 flex justify-end"><BulkRegistryDelete table="subjects" label="subjects" items={(subjects ?? []).map((s: any) => ({ id: s.id, name: `${s.name}${s.classes?.name ? ` (${s.classes.name})` : ""}` }))} /></div>}
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Class</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {subjectsError ? <TableRow><TableCell colSpan={4} role="alert" className="text-destructive">Subjects could not be loaded: {subjectsError.message}</TableCell></TableRow> : subjectsLoading ? <TableRow><TableCell colSpan={4}>Loading subjects…</TableCell></TableRow> : subjects?.filter(s => subjectClass === 'unassigned' ? !s.class_id : s.class_id === subjectClass).length ? subjects.filter(s => subjectClass === 'unassigned' ? !s.class_id : s.class_id === subjectClass).map((s: any) => (
                    <TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.code ?? "—"}</TableCell><TableCell>{s.classes?.name ?? "Unassigned"}</TableCell><TableCell>{s.rejected_at ? <div className="flex items-center gap-2"><span className="text-sm text-destructive">Rejected: {s.rejection_reason}</span>{isAdministrator && <RegistrationReview kind="subjects" id={s.id} name={s.name} editOnly />}</div> : s.pending_activation ? <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Awaiting approval</span>{isAdministrator && <RegistrationReview kind="subjects" id={s.id} name={s.name} />}</div> : isAdministrator ? <RegistryActions table="subjects" id={s.id} name={s.name} active={s.active} /> : <span className="text-sm text-muted-foreground">{s.active ? "Active" : "Inactive"}</span>}</TableCell></TableRow>
                  )) : <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No subjects yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
