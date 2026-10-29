import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, UserPlus, Search, X, SlidersHorizontal, ArrowUpDown, Download } from "lucide-react";
import { toast } from "sonner";
import { RegistryActions } from "@/components/RegistryActions";
import { hasRole } from "@/hooks/useAuth";
import { requireSavedRecord } from "@/lib/registry-save";
import { BulkImportDialog } from "@/components/BulkImportDialog";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "Students — Alegacy" }, { name: "description", content: "Students for authorized school accounts and families in Alegacy." }, { property: "og:title", content: "Students — Alegacy" }, { property: "og:description", content: "Students for authorized school accounts and families in Alegacy." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: StudentsPage,
});

function StudentsPage() {
  const { schoolId, roles } = useAuth();
  const canManage = hasRole(roles, "super_admin", "school_admin");
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    admission_no: "", first_name: "", last_name: "", middle_name: "",
    gender: "male" as "male" | "female", dob: "", class_id: "",
    parent_name: "", parent_phone: "", parent_email: "",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");

  const { data: students, error: studentsError, isLoading } = useQuery({
    queryKey: ["students", schoolId],
    enabled: Boolean(schoolId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, admission_no, first_name, last_name, middle_name, gender, dob, active, class_id, classes(name)")
        .eq("school_id", schoolId ?? "")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    const q = searchQuery.trim().toLowerCase();

    return students.filter((s: any) => {
      if (classFilter !== "all" && s.class_id !== classFilter) return false;
      if (genderFilter !== "all" && (s.gender || "").toLowerCase() !== genderFilter.toLowerCase()) return false;
      if (!q) return true;

      const fullName = `${s.first_name || ""} ${s.middle_name || ""} ${s.last_name || ""}`.toLowerCase();
      const adm = (s.admission_no || "").toLowerCase();
      const className = (s.classes?.name || "").toLowerCase();

      return fullName.includes(q) || adm.includes(q) || className.includes(q);
    });
  }, [students, searchQuery, classFilter, genderFilter]);

  const hasActiveFilters = searchQuery.trim() !== "" || classFilter !== "all" || genderFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setClassFilter("all");
    setGenderFilter("all");
  };

  const { data: classes, error: classesError } = useQuery({
    queryKey: ["classes-for-students", schoolId],
    enabled: Boolean(schoolId),
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").eq("active", true).eq("school_id", schoolId ?? "").order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return toast.error("Select a school first");
    if (saving) return;
    if (![form.admission_no, form.first_name, form.last_name].every(v => v.trim())) return toast.error("Enter the admission number and student names");
    if (form.class_id && !classes?.some(c => c.id === form.class_id)) return toast.error("Choose a class in this school");
    setSaving(true);
    try {

    // Insert student
    const { data: student, error: sErr } = await supabase.from("students").insert({
      school_id: schoolId,
      admission_no: form.admission_no.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      middle_name: form.middle_name || null,
      gender: form.gender,
      dob: form.dob || null,
      class_id: form.class_id || null,
    }).select().single();
    if (sErr) throw sErr;
    requireSavedRecord(student, schoolId);
    let parentWarning = "";

    // Auto-create + link parent
    if (form.parent_name && student) {
      const { data: parent, error: pErr } = await supabase.from("parents").insert({
        school_id: schoolId,
        full_name: form.parent_name,
        phone: form.parent_phone || null,
        email: form.parent_email || null,
      }).select().single();
      if (pErr || !parent) {
        parentWarning = "Student saved, but the guardian could not be saved. Open the student profile to add the guardian.";
      } else {
        const { error: linkError } = await supabase.from("student_parents").insert({
          student_id: student.id,
          parent_id: parent.id,
          is_primary: true,
        });
        if (linkError) parentWarning = "Student saved, but the guardian could not be linked. Open the student profile to link the guardian.";
      }
    }

    await qc.invalidateQueries({ queryKey: ["students"] });
    clearFilters();
    if (parentWarning) toast.warning(parentWarning);
    else toast.success("Student admitted");
    setOpen(false);
    setForm({ admission_no: "", first_name: "", last_name: "", middle_name: "", gender: "male", dob: "", class_id: "", parent_name: "", parent_phone: "", parent_email: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (error as { message?: string }).message ?? "Student could not be saved");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground">Admit and manage students. Parents are auto-linked.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="text-xs font-semibold gap-1.5 shadow-2xs border-primary/40 hover:bg-primary/10"
            onClick={() => {
              if (!filteredStudents.length) return;
              const headers = ["Admission No", "First Name", "Middle Name", "Last Name", "Gender", "Class", "Date of Birth"];
              const rows = filteredStudents.map((s: any) => [
                `"${s.admission_no || ""}"`,
                `"${s.first_name || ""}"`,
                `"${s.middle_name || ""}"`,
                `"${s.last_name || ""}"`,
                `"${s.gender || ""}"`,
                `"${s.classes?.name || ""}"`,
                `"${s.dob || ""}"`
              ]);
              const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", `registered_students_export_${new Date().toISOString().slice(0,10)}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              toast.success(`Exported ${filteredStudents.length} students to CSV!`);
            }}
          >
            <Download className="h-3.5 w-3.5 text-primary" /> Export Bulk (CSV)
          </Button>
          <Button
            type="button"
            variant="outline"
            className="text-xs font-semibold gap-1.5"
            onClick={() => window.print()}
          >
            Print Roster
          </Button>
          <BulkImportDialog schoolId={schoolId} classes={classes ?? []} onDone={() => qc.invalidateQueries({ queryKey: ["students"] })} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><UserPlus className="mr-2 h-4 w-4" /> Admit student</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New student admission</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Admission No.</Label><Input required value={form.admission_no} onChange={(e) => setForm({ ...form, admission_no: e.target.value })} /></div>
                <div>
                  <Label>Gender</Label>
                  <Select value={form.gender} onValueChange={(v: any) => setForm({ ...form, gender: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>First name</Label><Input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
                <div><Label>Last name</Label><Input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
                <div><Label>Middle name</Label><Input value={form.middle_name} onChange={(e) => setForm({ ...form, middle_name: e.target.value })} /></div>
                <div><Label>Date of birth</Label><Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
                <div className="col-span-2">
                  <Label>Class</Label>
                  <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose class" /></SelectTrigger>
                    <SelectContent>
                      {classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <p className="mb-2 text-sm font-medium">Parent / Guardian</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Full name</Label><Input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} /></div>
                  <div><Label>Email</Label><Input type="email" value={form.parent_email} onChange={(e) => setForm({ ...form, parent_email: e.target.value })} /></div>
                </div>
              </div>
              <Button type="submit" disabled={saving || !schoolId} className="w-full">{saving ? "Saving…" : "Admit student"}</Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {!schoolId && <p role="alert" className="text-destructive">Select a school from the school switcher before adding students.</p>}
      {classesError && <p role="alert" className="text-destructive">Classes could not be loaded: {classesError.message}</p>}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>Student Directory</CardTitle>
              <CardDescription>
                Search and filter student profiles by name, admission ID, or class.
              </CardDescription>
            </div>
            {students && (
              <div className="text-xs text-muted-foreground font-mono tabular-nums">
                Showing {filteredStudents.length} of {students.length} students
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Real-time filtering toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Filter by name or admission number (e.g. Aisha, DMA/001)…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="w-36 text-xs" aria-label="Filter by class">
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classes?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger className="w-32 text-xs" aria-label="Filter by gender">
                  <SelectValue placeholder="All genders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All genders</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-9 px-2 text-muted-foreground hover:text-foreground">
                  <X className="mr-1 h-3.5 w-3.5" /> Clear
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-32">Adm. No.</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead className="w-28">Gender</TableHead>
                  <TableHead className="w-36">Class</TableHead>
                  <TableHead className="w-28 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentsError ? (<TableRow><TableCell colSpan={5} role="alert" className="text-destructive">Students could not be loaded: {studentsError.message}</TableCell></TableRow>) : isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Loading students…
                    </TableCell>
                  </TableRow>
                ) : filteredStudents.length ? (
                  filteredStudents.map((s: any) => {
                    const fullName = [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
                    const initials = `${s.first_name?.charAt(0) || ""}${s.last_name?.charAt(0) || ""}`.toUpperCase();

                    return (
                      <TableRow key={s.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-mono text-sm tabular-nums font-medium text-foreground">
                          {s.admission_no}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                              {initials}
                            </div>
                            <Link
                              to="/students/$id"
                              params={{ id: s.id }}
                              className="font-medium text-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
                            >
                              {fullName}
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground text-sm">
                          {s.gender ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {s.classes?.name ? (
                            <span className="text-foreground">{s.classes.name}</span>
                          ) : (
                            <span className="text-muted-foreground italic">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            to="/students/$id"
                            params={{ id: s.id }}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Profile →
                          </Link>
                          {canManage && <RegistryActions table="students" id={s.id} name={fullName} active={s.active} />}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center">
                      <div className="max-w-sm mx-auto space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          {hasActiveFilters ? "No students match your filter" : "No students admitted yet"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {hasActiveFilters
                            ? "Try adjusting your search terms or clearing the active filters."
                            : "Click 'Admit student' above to register the first student."}
                        </p>
                        {hasActiveFilters && (
                          <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2 text-xs">
                            Reset filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
