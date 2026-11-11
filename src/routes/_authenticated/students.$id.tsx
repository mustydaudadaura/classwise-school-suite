import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole } from "@/hooks/useAuth";
import { useSchoolAccess } from "@/hooks/useSchoolAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Camera, Pencil, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { PassportPhotoStudioModal } from "@/components/admissions/PassportPhotoStudioModal";
import { RegistryActions } from "@/components/RegistryActions";
import { requireSavedRecord } from "@/lib/registry-save";
import { canAccessStudentRecord } from "@/lib/hierarchical-rbac";

export const Route = createFileRoute("/_authenticated/students/$id")({
  head: () => ({
    meta: [
      { title: "Student Profile — Alegacy" },
      { name: "description", content: "Complete student profile: biodata, guardians, academics and fees." },
      { property: "og:title", content: "Student Profile — Alegacy" },
      { property: "og:description", content: "Complete student profile: biodata, guardians, academics and fees." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { upload?: boolean; edit?: boolean } => {
    const on = (v: unknown) => v === true || v === "true" || v === 1 || v === "1";
    return { ...(on(search.upload) ? { upload: true } : {}), ...(on(search.edit) ? { edit: true } : {}) };
  },
  component: StudentProfile,
});

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`;
const BIO = [
  ["blood_group", "Blood group"],
  ["genotype", "Genotype"],
  ["allergies", "Allergies"],
  ["medical_notes", "Medical notes"],
  ["state_of_origin", "State of origin"],
  ["lga", "LGA"],
  ["religion", "Religion"],
  ["address", "Address"],
  ["previous_school", "Previous school"],
  ["house", "House"],
  ["emergency_contact_name", "Emergency contact"],
  ["emergency_contact_phone", "Emergency phone"],
] as const;

function StudentProfile() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { roles, schoolId, user } = useAuth();
  const { can } = useSchoolAccess();
  const canManageRegistry = hasRole(roles, "super_admin", "school_admin");
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [pendingEdit, setPendingEdit] = useState(Boolean(editOnArrival));
  const [savingBio, setSavingBio] = useState(false);
  const { upload, edit: editOnArrival } = Route.useSearch();
  const [passportOpen, setPassportOpen] = useState(Boolean(upload));
  const [form, setForm] = useState<Record<string, string>>({});

  // Guardian editing state
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [guardianForm, setGuardianForm] = useState<{
    full_name: string;
    phone: string;
    email: string;
    occupation: string;
    relationship: string;
  }>({ full_name: "", phone: "", email: "", occupation: "", relationship: "guardian" });
  const [addingGuardian, setAddingGuardian] = useState(false);
  const [savingGuardian, setSavingGuardian] = useState(false);

  const { data, isPending, error } = useQuery({
    queryKey: ["student-360", id, user?.id, schoolId],
    queryFn: async () => {
      const [s, links, history, cards, invoices, att] = await Promise.all([
        supabase.from("students").select("*, classes(name), campuses(name)").eq("id", id).maybeSingle(),
        supabase.from("student_parents").select("id, relationship, is_primary, parents(id, full_name, phone, email, occupation, user_id)").eq("student_id", id),
        supabase.from("student_enrollments").select("id, event, session, created_at, classes(name)").eq("student_id", id).order("created_at", { ascending: false }),
        supabase.from("report_cards").select("id, session, term, average, position, published").eq("student_id", id).order("created_at", { ascending: false }),
        supabase.from("fee_invoices").select("id, title, session, term, amount_due, amount_paid, status").eq("student_id", id).order("created_at", { ascending: false }),
        supabase.from("attendance").select("status").eq("student_id", id),
      ]);
      if (s.error) throw s.error;
      const schoolClasses = s.data?.school_id
        ? (
            await supabase
              .from("classes")
              .select("id, name, school_id, teacher_id")
              .eq("school_id", s.data.school_id)
              .eq("active", true)
              .eq("pending_activation", false)
              .order("name")
          ).data ?? []
        : [];
      const allocations =
        s.data?.school_id && user?.id && !hasRole(roles, "super_admin", "school_admin")
          ? (
              await supabase
                .from("teacher_allocations")
                .select("class_id, teacher_id, subject_id, is_class_teacher")
                .eq("school_id", s.data.school_id)
                .eq("teacher_id", user.id)
            ).data ?? []
          : [];
      let formMaster = false;
      if (s.data?.class_id && user?.id) {
        const fm = await supabase.rpc("is_form_master", { _user_id: user.id, _class_id: s.data.class_id } as any);
        formMaster = fm.data === true;
      }
      return {
        formMaster,
        student: s.data,
        classes: schoolClasses,
        allocations,
        links: links.data ?? [],
        history: history.data ?? [],
        cards: cards.data ?? [],
        invoices: invoices.data ?? [],
        att: att.data ?? [],
      };
    },
  });

  if (isPending) return <p className="text-muted-foreground">Loading profile…</p>;
  if (error || !data?.student) return <p className="text-muted-foreground">Student not found or you don't have access.</p>;
  const s: any = data.student;
  // Form master of this student's class may edit biodata, but not class or status.
  const isClassFormMaster =
    Boolean(user?.id && s.class_id) &&
    (data.formMaster ||
      data.classes.some((c: any) => c.id === s.class_id && c.teacher_id === user?.id) ||
      data.allocations.some((a: any) => a.class_id === s.class_id && a.is_class_teacher));
  const canEditFull = can("students.edit");
  const canEditProfile = canEditFull || isClassFormMaster;

  const linkedStudentIds = (data.links ?? [])
    .filter((l: any) => l.parents?.user_id && l.parents.user_id === user?.id)
    .map(() => s.id);
  const authorizedToView = canAccessStudentRecord(
    {
      userId: user?.id,
      roles,
      schoolId,
      studentId: s.user_id && s.user_id === user?.id ? s.id : null,
      linkedStudentIds,
    },
    s,
    data.classes ?? [],
    data.allocations ?? []
  );
  // The database-verified form-master check always grants access to their own class pupils.
  if (!authorizedToView && !data.formMaster) {
    return (
      <div className="space-y-2 p-4">
        <h1 className="text-xl font-semibold text-destructive">Access Denied</h1>
        <p className="text-sm text-muted-foreground">
          You are not authorized to view this student record. Access is restricted to your assigned school and classes.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/students">Back to Students</Link>
        </Button>
      </div>
    );
  }
  const present = data.att.filter((a: any) => a.status === "present" || a.status === "late").length;
  const due = data.invoices.reduce((t: number, i: any) => t + Number(i.amount_due), 0);
  const paid = data.invoices.reduce((t: number, i: any) => t + Number(i.amount_paid), 0);

  const startEditing = () => {
    const initial: Record<string, string> = {
      first_name: s.first_name ?? "",
      middle_name: s.middle_name ?? "",
      last_name: s.last_name ?? "",
      admission_no: s.admission_no ?? "",
      gender: s.gender ?? "",
      dob: s.dob ?? "",
      admission_date: s.admission_date ?? "",
      class_id: s.class_id ?? "",
      status: s.status ?? "active",
    };
    BIO.forEach(([k]) => {
      initial[k] = s[k] ?? "";
    });
    setForm(initial);
    setEditing(true);
  };

  // Opened from the "Edit" shortcut: start in edit mode once permission is known.
  if (pendingEdit && canEditProfile && !editing) {
    setPendingEdit(false);
    startEditing();
  }

  const save = async () => {
    if (!form.first_name?.trim() || !form.last_name?.trim() || !form.admission_no?.trim()) {
      return toast.error("First name, last name, and admission number are required.");
    }
    setSavingBio(true);
    try {
      const patch: Record<string, string | null> = {
        first_name: form.first_name.trim(),
        middle_name: form.middle_name?.trim() || null,
        last_name: form.last_name.trim(),
        admission_no: form.admission_no.trim(),
        gender: form.gender || null,
        dob: form.dob || null,
        admission_date: form.admission_date || null,
      };
      if (canEditFull) {
        patch.class_id = form.class_id || null;
        patch.status = form.status || "active";
      }
      BIO.forEach(([k]) => {
        if (k in form) patch[k] = form[k]?.trim() || null;
      });
      const { data: savedRow, error: saveErr } = await supabase
        .from("students")
        .update(patch as any)
        .eq("id", id)
        .eq("school_id", s.school_id)
        .select("id, school_id, first_name, last_name, admission_no")
        .single();
      if (saveErr) throw saveErr;
      requireSavedRecord(savedRow, s.school_id);
      toast.success("Student profile updated");
      setEditing(false);
      setForm({});
      await qc.invalidateQueries({ queryKey: ["student-360", id] });
      await qc.invalidateQueries({ queryKey: ["students"] });
    } catch (err: any) {
      toast.error(err?.message || "Could not update student profile");
    } finally {
      setSavingBio(false);
    }
  };

  const saveGuardian = async (parentId?: string, linkId?: string) => {
    if (!guardianForm.full_name.trim()) {
      return toast.error("Guardian full name is required");
    }
    setSavingGuardian(true);
    try {
      if (parentId) {
        const { data: savedP, error: pErr } = await supabase
          .from("parents")
          .update({
            full_name: guardianForm.full_name.trim(),
            phone: guardianForm.phone.trim() || null,
            email: guardianForm.email.trim() || null,
            occupation: guardianForm.occupation.trim() || null,
          })
          .eq("id", parentId)
          .select("id")
          .single();
        if (pErr || !savedP) throw new Error(pErr?.message || "Guardian could not be updated");
        if (linkId) {
          await supabase
            .from("student_parents")
            .update({ relationship: guardianForm.relationship || "guardian" })
            .eq("id", linkId);
        }
        toast.success("Guardian details updated");
      } else {
        const { data: createdP, error: cErr } = await supabase
          .from("parents")
          .insert({
            school_id: s.school_id,
            full_name: guardianForm.full_name.trim(),
            phone: guardianForm.phone.trim() || null,
            email: guardianForm.email.trim() || null,
            occupation: guardianForm.occupation.trim() || null,
          })
          .select("id")
          .single();
        if (cErr || !createdP) throw new Error(cErr?.message || "Could not add guardian");
        const { error: lErr } = await supabase.from("student_parents").insert({
          student_id: id,
          parent_id: createdP.id,
          relationship: guardianForm.relationship || "guardian",
          is_primary: data.links.length === 0,
        });
        if (lErr) throw lErr;
        toast.success("Guardian added and linked to student");
      }
      setEditingGuardianId(null);
      setAddingGuardian(false);
      await qc.invalidateQueries({ queryKey: ["student-360", id] });
    } catch (err: any) {
      toast.error(err?.message || "Could not save guardian");
    } finally {
      setSavingGuardian(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/students" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> All students
      </Link>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div className="flex flex-col items-center">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xl font-bold text-primary border-2 border-primary/20">
              {s.photo_url ? (
                <img src={s.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                `${s.first_name?.[0] ?? ""}${s.last_name?.[0] ?? ""}`
              )}
            </div>
            {canEditProfile && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setPassportOpen(true)}
                className="mt-2 text-xs h-7 px-2"
              >
                <Camera className="h-3 w-3 mr-1" />
                Passport Photo
              </Button>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold">
              {s.first_name} {s.middle_name ?? ""} {s.last_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {s.admission_no} · {s.classes?.name ?? "No class"}
              {s.campuses?.name ? ` · ${s.campuses.name}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={s.status === "active" ? "default" : "secondary"} className="capitalize">
              {s.status}
            </Badge>
            {canManageRegistry && (
              <RegistryActions
                table="students"
                id={s.id}
                name={`${s.first_name} ${s.last_name}`}
                active={s.active !== false}
                onDeleted={() => navigate({ to: "/students" })}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <PassportPhotoStudioModal
        open={passportOpen}
        onOpenChange={setPassportOpen}
        personName={`${s.first_name} ${s.last_name}`}
        personIdentifier={s.admission_no}
        currentPhotoUrl={s.photo_url}
        role="student"
        onSavePhoto={async (dataUrl) => {
          const { data: savedPhoto, error } = await supabase
            .from("students")
            .update({ photo_url: dataUrl })
            .eq("id", id)
            .eq("school_id", s.school_id)
            .select("id, school_id")
            .single();
          if (error || !savedPhoto) {
            toast.error(error?.message || "Could not save passport photograph");
          } else {
            toast.success("Student passport photograph updated!");
            qc.invalidateQueries({ queryKey: ["student-360", id] });
            qc.invalidateQueries({ queryKey: ["students"] });
          }
        }}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Attendance", data.att.length ? `${Math.round((present / data.att.length) * 100)}%` : "—"],
          ["Report cards", data.cards.length],
          ["Fees paid", naira(paid)],
          ["Balance", naira(due - paid)],
        ].map(([l, v]) => (
          <Card key={l as string}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className="text-lg font-semibold">{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="bio">
        <TabsList className="flex w-full flex-wrap h-auto">
          <TabsTrigger value="bio">Biodata & Profile</TabsTrigger>
          <TabsTrigger value="family">Guardians</TabsTrigger>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
        </TabsList>
        <TabsContent value="bio">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Personal Information, Biodata & Medical</CardTitle>
              {canEditProfile &&
                (editing ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={savingBio} onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" disabled={savingBio} onClick={save}>
                      {savingBio ? "Saving…" : "Save Changes"}
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={startEditing}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit Profile
                  </Button>
                ))}
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {editing ? (
                <>
                  <div>
                    <Label htmlFor="st-first-name">First name *</Label>
                    <Input
                      id="st-first-name"
                      required
                      value={form.first_name ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="st-middle-name">Middle name</Label>
                    <Input
                      id="st-middle-name"
                      value={form.middle_name ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, middle_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="st-last-name">Last name *</Label>
                    <Input
                      id="st-last-name"
                      required
                      value={form.last_name ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="st-adm-no">Admission number *</Label>
                    <Input
                      id="st-adm-no"
                      required
                      value={form.admission_no ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, admission_no: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="st-class">Class</Label>
                    <Select
                      value={form.class_id || "none"}
                      disabled={!canEditFull}
                      onValueChange={(v) => setForm((f) => ({ ...f, class_id: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger id="st-class">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {data.classes.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="st-gender">Gender</Label>
                    <Select
                      value={form.gender || "none"}
                      onValueChange={(v) => setForm((f) => ({ ...f, gender: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger id="st-gender">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="st-dob">Date of birth</Label>
                    <Input
                      id="st-dob"
                      type="date"
                      value={form.dob ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="st-adm-date">Admission date</Label>
                    <Input
                      id="st-adm-date"
                      type="date"
                      value={form.admission_date ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, admission_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="st-status">Enrollment status</Label>
                    <Select
                      disabled={!canEditFull}
                      value={form.status || "active"}
                      onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                    >
                      <SelectTrigger id="st-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="graduated">Graduated</SelectItem>
                        <SelectItem value="transferred">Transferred</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <Field label="Full name" value={`${s.first_name} ${s.middle_name ?? ""} ${s.last_name}`.replace(/\s+/g, " ")} />
                  <Field label="Admission number" value={s.admission_no} />
                  <Field label="Class" value={s.classes?.name ?? "No class"} />
                  <Field label="Gender" value={s.gender} />
                  <Field label="Date of birth" value={s.dob} />
                  <Field label="Admitted" value={s.admission_date} />
                </>
              )}
              {BIO.map(([k, l]) =>
                editing ? (
                  <div key={k}>
                    <Label>{l}</Label>
                    <Input
                      value={form[k] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                    />
                  </div>
                ) : (
                  <Field key={k} label={l} value={s[k]} />
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="family">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Parents & Guardians</CardTitle>
              {can("students.edit") && !addingGuardian && !editingGuardianId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setGuardianForm({ full_name: "", phone: "", email: "", occupation: "", relationship: "guardian" });
                    setAddingGuardian(true);
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Guardian
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {addingGuardian && (
                <div className="rounded-lg border border-primary/30 bg-muted/20 p-4 space-y-3">
                  <p className="text-sm font-semibold">Add Guardian / Parent</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Full name *</Label>
                      <Input
                        required
                        value={guardianForm.full_name}
                        onChange={(e) => setGuardianForm((g) => ({ ...g, full_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Relationship</Label>
                      <Input
                        placeholder="e.g. Father, Mother, Guardian"
                        value={guardianForm.relationship}
                        onChange={(e) => setGuardianForm((g) => ({ ...g, relationship: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input
                        type="tel"
                        value={guardianForm.phone}
                        onChange={(e) => setGuardianForm((g) => ({ ...g, phone: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={guardianForm.email}
                        onChange={(e) => setGuardianForm((g) => ({ ...g, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Occupation</Label>
                      <Input
                        value={guardianForm.occupation}
                        onChange={(e) => setGuardianForm((g) => ({ ...g, occupation: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" disabled={savingGuardian} onClick={() => setAddingGuardian(false)}>
                      <X className="mr-1 h-3.5 w-3.5" /> Cancel
                    </Button>
                    <Button size="sm" disabled={savingGuardian} onClick={() => saveGuardian()}>
                      <Check className="mr-1 h-3.5 w-3.5" /> {savingGuardian ? "Saving…" : "Save Guardian"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {data.links.length ? (
                  data.links.map((l: any) => {
                    const p = l.parents;
                    const isEditingThis = editingGuardianId === p?.id;
                    return (
                      <div key={p?.id ?? l.id} className="rounded-md border border-border p-3 space-y-2">
                        {isEditingThis ? (
                          <div className="space-y-2">
                            <div>
                              <Label className="text-xs">Full name *</Label>
                              <Input
                                value={guardianForm.full_name}
                                onChange={(e) => setGuardianForm((g) => ({ ...g, full_name: e.target.value }))}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Relationship</Label>
                                <Input
                                  value={guardianForm.relationship}
                                  onChange={(e) => setGuardianForm((g) => ({ ...g, relationship: e.target.value }))}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Phone</Label>
                                <Input
                                  value={guardianForm.phone}
                                  onChange={(e) => setGuardianForm((g) => ({ ...g, phone: e.target.value }))}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Email</Label>
                                <Input
                                  value={guardianForm.email}
                                  onChange={(e) => setGuardianForm((g) => ({ ...g, email: e.target.value }))}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Occupation</Label>
                                <Input
                                  value={guardianForm.occupation}
                                  onChange={(e) => setGuardianForm((g) => ({ ...g, occupation: e.target.value }))}
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={savingGuardian}
                                onClick={() => setEditingGuardianId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                disabled={savingGuardian}
                                onClick={() => saveGuardian(p.id, l.id)}
                              >
                                {savingGuardian ? "Saving…" : "Save"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">
                                {p?.full_name}{" "}
                                {l.is_primary && (
                                  <Badge variant="secondary" className="ml-1">
                                    Primary
                                  </Badge>
                                )}
                              </p>
                              <p className="text-sm capitalize text-muted-foreground">
                                {l.relationship ?? "Guardian"}
                                {p?.occupation ? ` · ${p.occupation}` : ""}
                              </p>
                              <p className="text-sm">{p?.phone ?? "—"}</p>
                              <p className="text-sm text-muted-foreground">{p?.email}</p>
                            </div>
                            {can("students.edit") && p?.id && (
                              <Button
                                size="icon"
                                variant="ghost"
                                title={`Edit ${p.full_name}`}
                                aria-label={`Edit ${p.full_name}`}
                                onClick={() => {
                                  setEditingGuardianId(p.id);
                                  setGuardianForm({
                                    full_name: p.full_name ?? "",
                                    phone: p.phone ?? "",
                                    email: p.email ?? "",
                                    occupation: p.occupation ?? "",
                                    relationship: l.relationship ?? "guardian",
                                  });
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-muted-foreground">No guardians linked.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="academic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Report cards</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.cards.length ? (
                data.cards.map((c: any) => (
                  <Link
                    key={c.id}
                    to="/report-card/$id"
                    params={{ id: c.id }}
                    className="flex justify-between rounded-md border border-border p-3 text-sm hover:bg-muted/50"
                  >
                    <span>
                      {c.session} · <span className="capitalize">{c.term}</span> term
                    </span>
                    <span>
                      Avg {c.average ?? "—"} · Pos {c.position ?? "—"}{" "}
                      {!c.published && <Badge variant="outline">Draft</Badge>}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-muted-foreground">No report cards yet.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Enrollment history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.history.map((h: any) => (
                <div key={h.id} className="flex justify-between text-sm">
                  <span className="capitalize">
                    {h.event.replace("_", " ")} — {h.classes?.name ?? "—"}
                  </span>
                  <span className="text-muted-foreground">
                    {h.session ?? ""} · {new Date(h.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="fees">
          <Card>
            <CardContent className="space-y-2 p-4">
              {data.invoices.length ? (
                data.invoices.map((i: any) => (
                  <div
                    key={i.id}
                    className="flex flex-wrap justify-between gap-2 rounded-md border border-border p-3 text-sm"
                  >
                    <span>
                      {i.title} <span className="text-muted-foreground">({i.session}, {i.term})</span>
                    </span>
                    <span>
                      {naira(i.amount_paid)} / {naira(i.amount_due)}{" "}
                      <Badge variant="outline" className="capitalize">
                        {i.status}
                      </Badge>
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No invoices.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="capitalize-first text-sm">{value || "—"}</p>
    </div>
  );
}
