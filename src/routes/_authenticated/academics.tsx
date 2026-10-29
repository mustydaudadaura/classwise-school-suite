import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolAccess } from "@/hooks/useSchoolAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LessonNotes } from "@/components/LessonNotes";
import { CurriculumAssistant } from "@/components/CurriculumAssistant";

const meta = "Teacher allocations, class timetables and assignments in Alegacy.";
export const Route = createFileRoute("/_authenticated/academics")({
  head: () => ({ meta: [{ title: "Teaching & Timetable — Alegacy" }, { name: "description", content: meta }, { property: "og:title", content: "Teaching & Timetable — Alegacy" }, { property: "og:description", content: meta }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ALL = "__all";

function useLookups(schoolId: string | null) {
  const classes = useQuery({ queryKey: ["ac-classes", schoolId], enabled: Boolean(schoolId), queryFn: async () => schoolId ? (await supabase.from("classes").select("id,name").eq("school_id", schoolId).eq("active", true).eq("pending_activation", false).order("name")).data ?? [] : [] });
  const subjects = useQuery({ queryKey: ["ac-subjects", schoolId], enabled: Boolean(schoolId), queryFn: async () => schoolId ? (await supabase.from("subjects").select("id,name,class_id").eq("school_id", schoolId).eq("active", true).eq("pending_activation", false).order("name")).data ?? [] : [] });
  const teachers = useQuery({
    queryKey: ["ac-teachers", schoolId], enabled: !!schoolId,
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("school_id", schoolId!).in("role", ["teacher", "school_admin"]);
      const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("user_id,full_name").in("user_id", ids);
      return ids.map((id) => ({ id, name: profs?.find((p) => p.user_id === id)?.full_name ?? "Staff member" }));
    },
  });
  return { classes: classes.data ?? [], subjects: subjects.data ?? [], teachers: teachers.data ?? [] };
}

function Page() {
  const { schoolId } = useAuth();
  const { can } = useSchoolAccess();
  const look = useLookups(schoolId);
  const canEdit = can("academics.edit");
  if (!schoolId) return <p className="text-sm text-muted-foreground">Select a school first.</p>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Teaching & Timetable</h1>
        <p className="text-sm text-muted-foreground">Assign teachers to classes and subjects, build the weekly timetable and post assignments.</p>
      </div>
      <Tabs defaultValue="timetable">
        <TabsList className="flex h-auto w-full flex-wrap sm:w-auto">
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="lessons">Lesson Notes (AI)</TabsTrigger>
          <TabsTrigger value="curriculum">Academic Assistant (AI)</TabsTrigger>
          <TabsTrigger value="allocations">Teachers</TabsTrigger>
        </TabsList>
        <TabsContent value="timetable"><Timetable schoolId={schoolId} canEdit={canEdit} look={look} /></TabsContent>
        <TabsContent value="assignments"><Assignments schoolId={schoolId} look={look} /></TabsContent>
        <TabsContent value="lessons"><LessonNotes schoolId={schoolId} classes={look.classes} subjects={look.subjects} /></TabsContent>
        <TabsContent value="curriculum"><CurriculumAssistant schoolId={schoolId} classes={look.classes} subjects={look.subjects} /></TabsContent>
        <TabsContent value="allocations"><Allocations schoolId={schoolId} canEdit={canEdit} look={look} /></TabsContent>
      </Tabs>
    </div>
  );
}

type Look = ReturnType<typeof useLookups>;
const nameOf = (list: { id: string; name: string }[], id?: string | null) => list.find((x) => x.id === id)?.name ?? "—";

function Pick({ label, value, onChange, items, optional }: { label: string; value: string; onChange: (v: string) => void; items: { id: string; name: string }[]; optional?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value || (optional ? ALL : undefined)} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
        <SelectTrigger><SelectValue placeholder={`Choose ${label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>
          {optional && <SelectItem value={ALL}>None</SelectItem>}
          {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function Allocations({ schoolId, canEdit, look }: { schoolId: string; canEdit: boolean; look: Look }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ teacher: "", cls: "", subject: "", classTeacher: false });
  const { data: rows } = useQuery({ queryKey: ["ac-alloc", schoolId], queryFn: async () => (await supabase.from("teacher_allocations").select("*").eq("school_id", schoolId).order("created_at")).data ?? [] });
  const add = async () => {
    if (!f.teacher || !f.cls) return toast.error("Choose a teacher and class");
    const { error } = await supabase.from("teacher_allocations").insert({ school_id: schoolId, teacher_id: f.teacher, class_id: f.cls, subject_id: f.subject || null, is_class_teacher: f.classTeacher });
    if (error) return toast.error(error.code === "23505" ? "This allocation already exists" : error.message);
    toast.success("Teacher allocated"); qc.invalidateQueries({ queryKey: ["ac-alloc"] });
  };
  const remove = async (id: string) => { const { error } = await supabase.from("teacher_allocations").delete().eq("id", id); if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["ac-alloc"] }); };
  return (
    <div className="space-y-4">
      {canEdit && (
        <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-4">
          <Pick label="Teacher" value={f.teacher} onChange={(v) => setF({ ...f, teacher: v })} items={look.teachers} />
          <Pick label="Class" value={f.cls} onChange={(v) => setF({ ...f, cls: v })} items={look.classes} />
          <Pick label="Subject" optional value={f.subject} onChange={(v) => setF({ ...f, subject: v })} items={look.subjects.filter((s) => !s.class_id || s.class_id === f.cls)} />
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.classTeacher} onChange={(e) => setF({ ...f, classTeacher: e.target.checked })} /> Class teacher</label>
            <Button onClick={add}>Allocate</Button>
          </div>
        </CardContent></Card>
      )}
      <Card><CardContent className="divide-y p-0">
        {!rows?.length && <p className="p-4 text-sm text-muted-foreground">No teachers allocated yet.</p>}
        {rows?.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 p-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{nameOf(look.teachers, r.teacher_id)}</p>
              <p className="truncate text-muted-foreground">{nameOf(look.classes, r.class_id)} · {r.subject_id ? nameOf(look.subjects, r.subject_id) : "All subjects"}{r.is_class_teacher ? " · Class teacher" : ""}</p>
            </div>
            {canEdit && <Button size="icon" variant="ghost" aria-label="Remove allocation" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        ))}
      </CardContent></Card>
    </div>
  );
}

function Timetable({ schoolId, canEdit, look }: { schoolId: string; canEdit: boolean; look: Look }) {
  const qc = useQueryClient();
  const [cls, setCls] = useState("");
  const [f, setF] = useState({ day: "1", start: "08:00", end: "08:40", subject: "", teacher: "", room: "", label: "" });
  const { data: slots } = useQuery({ queryKey: ["ac-tt", cls], enabled: !!cls, queryFn: async () => (await supabase.from("timetable_slots").select("*").eq("class_id", cls).order("day_of_week").order("start_time")).data ?? [] });
  const add = async () => {
    if (f.end <= f.start) return toast.error("End time must be after start time");
    if (f.teacher) {
      const { data: clash } = await supabase.from("timetable_slots").select("id").eq("teacher_id", f.teacher).eq("day_of_week", Number(f.day)).lt("start_time", f.end).gt("end_time", f.start).limit(1);
      if (clash?.length) return toast.error("This teacher already has a lesson at that time");
    }
    const overlap = slots?.some((s) => s.day_of_week === Number(f.day) && s.start_time.slice(0, 5) < f.end && s.end_time.slice(0, 5) > f.start);
    if (overlap) return toast.error("This class already has a lesson at that time");
    const { error } = await supabase.from("timetable_slots").insert({ school_id: schoolId, class_id: cls, day_of_week: Number(f.day), start_time: f.start, end_time: f.end, subject_id: f.subject || null, teacher_id: f.teacher || null, room: f.room || null, label: f.label || null });
    if (error) return toast.error(error.message);
    toast.success("Period added"); qc.invalidateQueries({ queryKey: ["ac-tt"] });
  };
  const remove = async (id: string) => { await supabase.from("timetable_slots").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["ac-tt"] }); };
  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 sm:max-w-xs"><Pick label="Class" value={cls} onChange={setCls} items={look.classes} /></CardContent></Card>
      {cls && canEdit && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Add period</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <Pick label="Day" value={f.day} onChange={(v) => setF({ ...f, day: v })} items={DAYS.slice(1).map((d, i) => ({ id: String(i + 1), name: d }))} />
            <div><Label>Starts</Label><Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></div>
            <div><Label>Ends</Label><Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div>
            <Pick label="Subject" optional value={f.subject} onChange={(v) => setF({ ...f, subject: v })} items={look.subjects.filter((s) => !s.class_id || s.class_id === cls)} />
            <Pick label="Teacher" optional value={f.teacher} onChange={(v) => setF({ ...f, teacher: v })} items={look.teachers} />
            <div><Label>Room</Label><Input value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} /></div>
            <div><Label>Label (e.g. Break, Assembly)</Label><Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></div>
            <div className="flex items-end"><Button className="w-full" onClick={add}>Add period</Button></div>
          </CardContent></Card>
      )}
      {cls && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DAYS.slice(1).map((d, i) => {
            const day = (slots ?? []).filter((s) => s.day_of_week === i + 1);
            if (!day.length && i === 5) return null;
            return (
              <Card key={d}><CardHeader className="pb-2"><CardTitle className="text-base">{d}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {!day.length && <p className="text-sm text-muted-foreground">No periods</p>}
                  {day.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} · {s.label || nameOf(look.subjects, s.subject_id)}</p>
                        <p className="truncate text-muted-foreground">{s.teacher_id ? nameOf(look.teachers, s.teacher_id) : ""}{s.room ? ` · ${s.room}` : ""}</p>
                      </div>
                      {canEdit && <Button size="icon" variant="ghost" aria-label="Remove period" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  ))}
                </CardContent></Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Assignments({ schoolId, look }: { schoolId: string; look: Look }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [f, setF] = useState({ cls: "", subject: "", title: "", instructions: "", due: "" });
  const { data: rows } = useQuery({ queryKey: ["ac-asg", schoolId], queryFn: async () => (await supabase.from("assignments").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100)).data ?? [] });
  const add = async () => {
    if (!f.cls || f.title.trim().length < 2) return toast.error("Choose a class and enter a title");
    const { error } = await supabase.from("assignments").insert({ school_id: schoolId, class_id: f.cls, subject_id: f.subject || null, title: f.title.trim(), instructions: f.instructions || null, due_date: f.due || null, created_by: user!.id });
    if (error) return toast.error(error.message.includes("row-level") ? "You can only post assignments for classes you teach" : error.message);
    toast.success("Assignment posted"); setF({ ...f, title: "", instructions: "", due: "" }); qc.invalidateQueries({ queryKey: ["ac-asg"] });
  };
  const remove = async (id: string) => { const { error } = await supabase.from("assignments").delete().eq("id", id); if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["ac-asg"] }); };
  return (
    <div className="space-y-4">
      <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-3">
        <Pick label="Class" value={f.cls} onChange={(v) => setF({ ...f, cls: v })} items={look.classes} />
        <Pick label="Subject" optional value={f.subject} onChange={(v) => setF({ ...f, subject: v })} items={look.subjects.filter((s) => !s.class_id || s.class_id === f.cls)} />
        <div><Label>Due date</Label><Input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></div>
        <div className="sm:col-span-3"><Label>Title</Label><Input value={f.title} maxLength={200} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="sm:col-span-3"><Label>Instructions</Label><Textarea value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} /></div>
        <div className="sm:col-span-3"><Button onClick={add}>Post assignment</Button></div>
      </CardContent></Card>
      <div className="space-y-2">
        {!rows?.length && <p className="text-sm text-muted-foreground">No assignments yet.</p>}
        {rows?.map((a) => (
          <Card key={a.id}><CardContent className="flex items-start justify-between gap-2 p-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{a.title}</p>
              <p className="text-muted-foreground">{nameOf(look.classes, a.class_id)}{a.subject_id ? ` · ${nameOf(look.subjects, a.subject_id)}` : ""}{a.due_date ? ` · Due ${a.due_date}` : ""}</p>
              {a.instructions && <p className="mt-1 whitespace-pre-wrap">{a.instructions}</p>}
            </div>
            <Button size="icon" variant="ghost" aria-label="Delete assignment" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
