import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { RegistryActions } from "@/components/RegistryActions";
import { hasRole } from "@/hooks/useAuth";
import { requireSavedRecord } from "@/lib/registry-save";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({ meta: [{ title: "Classes & Subjects — Alegacy" }, { name: "description", content: "Classes & Subjects for authorized school accounts and families in Alegacy." }, { property: "og:title", content: "Classes & Subjects — Alegacy" }, { property: "og:description", content: "Classes & Subjects for authorized school accounts and families in Alegacy." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ClassesPage,
});

function ClassesPage() {
  const { schoolId, roles } = useAuth();
  const canManage = hasRole(roles, "super_admin", "school_admin");
  const qc = useQueryClient();
  const [cls, setCls] = useState<{ name: string; level: string; arm: string; section: "nursery" | "primary" | "secondary" | "" }>({ name: "", level: "", arm: "", section: "" });
  const [saving, setSaving] = useState(false);
  const [sub, setSub] = useState({ name: "", code: "", class_id: "" });

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

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return toast.error("Select a school first");
    if (saving) return;
    if (!cls.name.trim()) return toast.error("Enter a class name");
    setSaving(true);
    try {
      const { data, error } = await supabase.from("classes").insert({
        name: cls.name.trim(), level: cls.level.trim() || null, arm: cls.arm.trim() || null,
        section: cls.section || null, school_id: schoolId,
      }).select("id, school_id").single();
      if (error) throw error;
      requireSavedRecord(data, schoolId);
      await qc.invalidateQueries({ queryKey: ["classes"] });
      await qc.invalidateQueries({ queryKey: ["classes-for-students"] });
      toast.success("Class created");
      setCls({ name: "", level: "", arm: "", section: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (error as { message?: string }).message ?? "Class could not be saved");
    } finally { setSaving(false); }
  };

  const addSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return toast.error("Select a school first");
    if (saving) return;
    if (!sub.name.trim()) return toast.error("Enter a subject name");
    if (sub.class_id && !classes?.some(c => c.id === sub.class_id)) return toast.error("Choose a class in this school");
    setSaving(true);
    try {
      const { data, error } = await supabase.from("subjects").insert({
        school_id: schoolId, name: sub.name.trim(), code: sub.code.trim() || null,
        class_id: sub.class_id || null,
      }).select("id, school_id").single();
      if (error) throw error;
      requireSavedRecord(data, schoolId);
      await qc.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Subject added");
      setSub({ name: "", code: "", class_id: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (error as { message?: string }).message ?? "Subject could not be saved");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Classes & Subjects</h1>
        <p className="text-sm text-muted-foreground">Organize your school structure.</p>
      </div>

      {!schoolId && <p role="alert" className="text-destructive">Select a school from the school switcher before adding records.</p>}
      <Tabs defaultValue="classes">
        <TabsList>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Add class</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={addClass} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                <div><Label>Name</Label><Input required placeholder="JSS 1A" value={cls.name} onChange={(e) => setCls({ ...cls, name: e.target.value })} /></div>
                <div><Label>Level</Label><Input placeholder="JSS" value={cls.level} onChange={(e) => setCls({ ...cls, level: e.target.value })} /></div>
                <div><Label>Arm</Label><Input placeholder="A" value={cls.arm} onChange={(e) => setCls({ ...cls, arm: e.target.value })} /></div>
                <div>
                  <Label>Section</Label>
                  <Select value={cls.section || undefined} onValueChange={(v) => setCls({ ...cls, section: v as any })}>
                    <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nursery">Nursery</SelectItem>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="secondary">Secondary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end"><Button type="submit" disabled={saving || !schoolId} className="w-full">{saving ? "Saving…" : "Add"}</Button></div>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Level</TableHead><TableHead>Arm</TableHead><TableHead>Section</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {classesError ? <TableRow><TableCell colSpan={5} role="alert" className="text-destructive">Classes could not be loaded: {classesError.message}</TableCell></TableRow> : classesLoading ? <TableRow><TableCell colSpan={5}>Loading classes…</TableCell></TableRow> : classes?.length ? classes.map((c: any) => (
                    <TableRow key={c.id}><TableCell className="font-medium">{c.name}</TableCell><TableCell>{c.level ?? "—"}</TableCell><TableCell>{c.arm ?? "—"}</TableCell><TableCell className="capitalize">{c.section ?? "—"}</TableCell><TableCell>{canManage && <RegistryActions table="classes" id={c.id} name={c.name} active={c.active} />}</TableCell></TableRow>
                  )) : <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No classes yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Add subject</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={addSubject} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div><Label>Name</Label><Input required placeholder="Mathematics" value={sub.name} onChange={(e) => setSub({ ...sub, name: e.target.value })} /></div>
                <div><Label>Code</Label><Input placeholder="MTH" value={sub.code} onChange={(e) => setSub({ ...sub, code: e.target.value })} /></div>
                <div>
                  <Label>Class (optional)</Label>
                  <Select value={sub.class_id || "all"} onValueChange={(v) => setSub({ ...sub, class_id: v === "all" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All classes</SelectItem>
                      {classes?.filter(c => c.active).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end"><Button type="submit" disabled={saving || !schoolId} className="w-full">{saving ? "Saving…" : "Add"}</Button></div>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Class</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {subjectsError ? <TableRow><TableCell colSpan={4} role="alert" className="text-destructive">Subjects could not be loaded: {subjectsError.message}</TableCell></TableRow> : subjectsLoading ? <TableRow><TableCell colSpan={4}>Loading subjects…</TableCell></TableRow> : subjects?.length ? subjects.map((s: any) => (
                    <TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.code ?? "—"}</TableCell><TableCell>{s.classes?.name ?? "All"}</TableCell><TableCell>{canManage && <RegistryActions table="subjects" id={s.id} name={s.name} active={s.active} />}</TableCell></TableRow>
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
