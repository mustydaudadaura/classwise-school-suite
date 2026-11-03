import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { markAttendance } from "@/lib/api/attendance.functions";
import {
  getWeeklyAttendanceReport,
  sendWeeklyAttendanceReport,
} from "@/lib/api/attendance-report.functions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance — Alegacy" }, { name: "description", content: "Attendance for authorized school accounts and families in Alegacy." }, { property: "og:title", content: "Attendance — Alegacy" }, { property: "og:description", content: "Attendance for authorized school accounts and families in Alegacy." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

const STATUSES = ["present", "absent", "late", "excused"] as const;

function weekRange(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const monday = new Date(d); monday.setDate(d.getDate() - ((day + 6) % 7));
  const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { from: iso(monday), to: iso(friday) };
}

function Page() {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("super_admin") || roles.includes("school_admin");
  const [classId, setClassId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<Record<string, (typeof STATUSES)[number]>>({});
  const [saving, setSaving] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ["att-classes", isAdmin, user?.id],
    queryFn: async () => {
      let q = supabase.from("classes").select("id, name, teacher_id").eq("active", true).order("name");
      if (!isAdmin && user?.id) q = q.eq("teacher_id", user.id);
      return (await q).data ?? [];
    },
  });
  const { data: students } = useQuery({
    queryKey: ["att-students", classId],
    queryFn: async () => (await supabase.from("students").select("id, first_name, last_name, admission_no").eq("class_id", classId).eq("active", true).order("first_name")).data ?? [],
    enabled: !!classId,
  });
  const { data: existing } = useQuery({
    queryKey: ["att-existing", classId, date],
    queryFn: async () => (await supabase.from("attendance").select("student_id, status").eq("class_id", classId).eq("date", date)).data ?? [],
    enabled: !!classId,
  });

  const week = weekRange(date);
  const { data: weekRows, refetch: refetchWeek } = useQuery({
    queryKey: ["att-week", classId, week.from],
    queryFn: async () => (await supabase.from("attendance").select("student_id, status, date").eq("class_id", classId).gte("date", week.from).lte("date", week.to)).data ?? [],
    enabled: !!classId,
  });
  const weekDays = new Set((weekRows ?? []).map((r: any) => r.date)).size;
  const weekly = (students ?? []).map((s: any) => {
    const rows = (weekRows ?? []).filter((r: any) => r.student_id === s.id);
    const attended = rows.filter((r: any) => r.status === "present" || r.status === "late").length;
    return { s, attended, marked: rows.length, pct: rows.length ? Math.round((attended / rows.length) * 100) : null };
  });
  const classPct = (() => { const m = weekly.reduce((a, w) => a + w.marked, 0); return m ? Math.round((weekly.reduce((a, w) => a + w.attended, 0) / m) * 100) : null; })();
  const isFriday = new Date(date + "T12:00:00").getDay() === 5;

  const getStatus = (sid: string): (typeof STATUSES)[number] => entries[sid] ?? (existing?.find((e: any) => e.student_id === sid)?.status as any) ?? "present";

  const save = async () => {
    if (!classId || !students?.length) return;
    setSaving(true);
    try {
      const payload = students.map((s: any) => ({ student_id: s.id, status: getStatus(s.id) }));
      const res = await markAttendance({ data: { class_id: classId, date, entries: payload } });
      toast.success(`Saved ${res.count} entries`);
      refetchWeek();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-sm text-muted-foreground">Form masters take the daily register for their class; weekly percentages are calculated for each Friday.</p>
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="att-class">Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger id="att-class"><SelectValue placeholder="Choose class" /></SelectTrigger>
              <SelectContent>{(classes ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="att-date">Date</Label>
            <Input id="att-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button className="w-full" disabled={!classId || !students?.length || saving} onClick={save}>{saving ? "Saving…" : "Save attendance"}</Button>
          </div>
        </CardContent>
      </Card>

      {classId && (
        <Card>
          <CardHeader><CardTitle className="text-base">Roster</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(students ?? []).length === 0 && <p className="text-sm text-muted-foreground">No students in this class.</p>}
            {(students ?? []).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between gap-2 border-b py-2 last:border-0">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.first_name} {s.last_name}</div>
                  <div className="text-xs text-muted-foreground">{s.admission_no}</div>
                </div>
                <Select value={getStatus(s.id)} onValueChange={(v: any) => setEntries((p) => ({ ...p, [s.id]: v }))}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((st) => <SelectItem key={st} value={st} className="capitalize">{st}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {classId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weekly register — {week.from} to {week.to} (Friday)</CardTitle>
            <p className="text-sm text-muted-foreground">
              {isFriday ? "Today is Friday: this week's percentages are final once today's register is saved." : "Percentages update each day and close on Friday."}
              {" "}School days marked: {weekDays} of 5 · Class attendance: {classPct === null ? "—" : `${classPct}%`}
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Student</TableHead><TableHead className="text-right">Present (incl. late)</TableHead><TableHead className="text-right">Days marked</TableHead><TableHead className="text-right">Percentage</TableHead></TableRow></TableHeader>
              <TableBody>
                {weekly.map(({ s, attended, marked, pct }) => (
                  <TableRow key={s.id}><TableCell>{s.first_name} {s.last_name}</TableCell><TableCell className="text-right">{attended}</TableCell><TableCell className="text-right">{marked}</TableCell><TableCell className={`text-right font-semibold ${pct !== null && pct < 75 ? "text-destructive" : ""}`}>{pct === null ? "—" : `${pct}%`}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <WeeklyReport classes={(classes ?? []) as { id: string; name: string }[]} />
    </div>
  );
}

function WeeklyReport({ classes }: { classes: { id: string; name: string }[] }) {
  const { schoolId } = useAuth();
  const [classId, setClassId] = useState("all");
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [channel, setChannel] = useState<"generic" | "whatsapp">("generic");
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [report, setReport] = useState<Awaited<ReturnType<typeof getWeeklyAttendanceReport>> | null>(null);

  if (!schoolId) return null;
  const scope = {
    school_id: schoolId,
    class_id: classId === "all" ? undefined : classId,
    week_start: day,
    channel,
  };

  const preview = async () => {
    setBusy("preview");
    try {
      setReport(await getWeeklyAttendanceReport({ data: scope }));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    setBusy("send");
    try {
      const res = await sendWeeklyAttendanceReport({ data: scope });
      toast.success(
        `Attendance report sent to ${res.sent} adult(s)` +
          (res.failed ? `; ${res.failed} failed` : "") +
          (res.missing_phone ? `; ${res.missing_phone} had no usable number` : ""),
      );
      if (res.error) toast.error(res.error);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base">Weekly report to parents</CardTitle>
          <p className="text-xs text-muted-foreground">Quick weekly punctuality dispatch to family phones.</p>
        </div>
        <a href="/announcements" className="text-xs font-semibold text-primary hover:underline">
          AI Performance Digest →
        </a>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="wr-class">Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger id="wr-class"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wr-day">Any day in the week</Label>
            <Input
              id="wr-day"
              type="date"
              value={day}
              onChange={(e) => { setDay(e.target.value); setReport(null); }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wr-channel">Send by</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as "generic" | "whatsapp")}>
              <SelectTrigger id="wr-channel"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="generic">SMS</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={preview} disabled={!!busy || !day}>
              {busy === "preview" ? "Checking…" : "Preview"}
            </Button>
          </div>
        </div>

        {report && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm">
              Week {report.week_start} to {report.week_end}: {report.parents_reachable} adult(s) reachable
              {report.parents_missing_phone > 0 && `, ${report.parents_missing_phone} without a usable number`}.{" "}
              {report.marked
                ? "Attendance has been recorded for this week."
                : "No attendance has been recorded for this week yet — preview again after marking."}
            </p>
            <div className="max-h-60 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pupil</TableHead>
                    <TableHead className="text-right">Present</TableHead>
                    <TableHead className="text-right">Absent</TableHead>
                    <TableHead className="text-right">Late</TableHead>
                    <TableHead className="text-right">Excused</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.students.map((s) => (
                    <TableRow key={s.student_id}>
                      <TableCell className="max-w-40 truncate">{s.name}</TableCell>
                      <TableCell className="text-right">{s.present}</TableCell>
                      <TableCell className={`text-right ${s.absent ? "font-semibold text-destructive" : ""}`}>{s.absent}</TableCell>
                      <TableCell className={`text-right ${s.late ? "font-semibold text-destructive" : ""}`}>{s.late}</TableCell>
                      <TableCell className="text-right">{s.excused}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {report.sample && (
              <div className="rounded-md border bg-background p-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Example message</p>
                <p className="text-sm whitespace-pre-wrap">{report.sample}</p>
              </div>
            )}
            <Button onClick={send} disabled={!!busy || report.parents_reachable === 0}>
              {busy === "send" ? "Sending…" : `Send to ${report.parents_reachable} adult(s)`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
