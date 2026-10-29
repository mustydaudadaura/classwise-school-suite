import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolAccess } from "@/hooks/useSchoolAccess";
import { correctAttendance, generatePayroll, recordPenalties, reviewLeave, setPayrollStatus, setStaffPin, waivePenalty } from "@/lib/api/staff-attendance.functions";
import { STATUS_LABEL, fmtHours, fmtTime, summarise, type AttSettings, type DayResult } from "@/lib/staff-attendance";
import { downloadCsv } from "@/lib/geo-client";
import { getLocation } from "@/lib/geo-client";
import { naira, shiftDate, todayStr, useRange, useSettings, useStaffList, type StaffMember } from "@/components/staffatt/useStaffData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";

const TABS = ["dashboard", "records", "leave", "penalties", "payroll", "reports", "staff", "settings"] as const;
export const Route = createFileRoute("/_authenticated/staff-attendance")({
  validateSearch: z.object({ tab: z.enum(TABS).optional() }),
  head: () => ({ meta: [
    { title: "Staff Attendance Portal — Alegacy" },
    { name: "description", content: "Staff attendance portal with strict school geolocation, kiosk PIN punch, automated deduction penalties and payroll." },
    { property: "og:title", content: "Staff Attendance Portal — Alegacy" },
    { property: "og:description", content: "Smart staff attendance portal with GPS geofencing, kiosk, penalties and payroll." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

function Page() {
  const { schoolId, user } = useAuth();
  const { can, loading } = useSchoolAccess();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  if (!schoolId || !user) return <p className="text-muted-foreground">Select a school at the top of the page.</p>;
  if (loading) return <p>Loading…</p>;
  if (!can("staffatt.view") && !can("payroll.view")) return <p className="text-muted-foreground">You do not have access to this page.</p>;
  const edit = can("staffatt.edit"), view = can("staffatt.view");
  const p = { schoolId, me: user.id, edit, payView: can("payroll.view"), payEdit: can("payroll.edit"), payApprove: can("payroll.approve") };
  const current = tab ?? (view ? "dashboard" : "payroll");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Staff Attendance Portal</h1>
          <p className="text-xs text-muted-foreground">
            Strict school geolocation geofencing, PIN attendance kiosk, automated late/absence deduction penalties, and monthly payroll.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/kiosk">Open Attendance Kiosk</a>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <a href="/my-attendance">My Check-in / Out</a>
          </Button>
        </div>
      </div>
      <Tabs value={current} onValueChange={(v) => navigate({ search: { tab: v as never } })}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          {view && <TabsTrigger value="dashboard">Dashboard</TabsTrigger>}
          {view && <TabsTrigger value="records">History</TabsTrigger>}
          {view && <TabsTrigger value="leave">Leave & Exemptions</TabsTrigger>}
          {view && <TabsTrigger value="penalties">Deduction Penalties</TabsTrigger>}
          {p.payView && <TabsTrigger value="payroll">Payroll</TabsTrigger>}
          {view && <TabsTrigger value="reports">Reports</TabsTrigger>}
          {edit && <TabsTrigger value="staff">Staff & PINs</TabsTrigger>}
          {edit && <TabsTrigger value="settings">Settings</TabsTrigger>}
        </TabsList>
        {view && <TabsContent value="dashboard"><Dashboard {...p} /></TabsContent>}
        {view && <TabsContent value="records"><Records {...p} /></TabsContent>}
        {view && <TabsContent value="leave"><Leave {...p} /></TabsContent>}
        {view && <TabsContent value="penalties"><Penalties {...p} /></TabsContent>}
        {p.payView && <TabsContent value="payroll"><Payroll {...p} /></TabsContent>}
        {view && <TabsContent value="reports"><Reports {...p} /></TabsContent>}
        {edit && <TabsContent value="staff"><StaffSetup {...p} /></TabsContent>}
        {edit && <TabsContent value="settings"><Settings {...p} /></TabsContent>}
      </Tabs>
    </div>
  );
}
type P = { schoolId: string; me: string; edit: boolean; payView: boolean; payEdit: boolean; payApprove: boolean };

function Filters({ staff, f, setF, showStatus = true }: { staff: StaffMember[]; f: Flt; setF: (f: Flt) => void; showStatus?: boolean }) {
  const depts = [...new Set(staff.map((s) => s.department).filter(Boolean))] as string[];
  const cats = [...new Set(staff.map((s) => s.category))];
  const sel = (id: string, label: string, val: string, opts: [string, string][], on: (v: string) => void) => (
    <div><Label htmlFor={id}>{label}</Label><Select value={val} onValueChange={on}><SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="all">All</SelectItem>{opts.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
  );
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
      <div><Label htmlFor="ff">From</Label><Input id="ff" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
      <div><Label htmlFor="ft">To</Label><Input id="ft" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
      {sel("fd", "Department", f.dept, depts.map((d) => [d, d]), (v) => setF({ ...f, dept: v }))}
      {sel("fc", "Category", f.cat, cats.map((c) => [c, c]), (v) => setF({ ...f, cat: v }))}
      {sel("fs", "Staff", f.staff, staff.map((s) => [s.user_id, s.name]), (v) => setF({ ...f, staff: v }))}
      {showStatus && sel("fx", "Status", f.status, Object.entries(STATUS_LABEL).filter(([k]) => k !== "not_yet").concat([["missing", "Missing check-out"], ["early", "Early departure"]]), (v) => setF({ ...f, status: v }))}
    </div>
  );
}
type Flt = { from: string; to: string; dept: string; cat: string; staff: string; status: string };
const initFlt = (days = 0): Flt => ({ from: shiftDate(todayStr(), -days), to: todayStr(), dept: "all", cat: "all", staff: "all", status: "all" });

function useFiltered(schoolId: string, f: Flt) {
  const staff = useStaffList(schoolId); const settings = useSettings(schoolId);
  const range = useRange(schoolId, f.from, f.to, staff.data, settings.data?.settings);
  const smap = useMemo(() => new Map((staff.data ?? []).map((s) => [s.user_id, s])), [staff.data]);
  const rows = useMemo(() => (range.data?.rows ?? []).filter((r) => {
    const s = smap.get(r.user_id); if (!s) return false;
    if (f.dept !== "all" && s.department !== f.dept) return false;
    if (f.cat !== "all" && s.category !== f.cat) return false;
    if (f.staff !== "all" && r.user_id !== f.staff) return false;
    if (f.status === "missing") return r.missingCheckout;
    if (f.status === "early") return r.early;
    if (f.status !== "all" && r.status !== f.status) return false;
    return r.status !== "not_yet" || r.date === todayStr();
  }), [range.data, smap, f]);
  return { staff, settings, range, rows, smap };
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "bad" | "good" }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className={`text-2xl font-bold ${tone === "bad" ? "text-destructive" : tone === "good" ? "text-primary" : ""}`}>{value}</div></CardContent></Card>;
}

function Dashboard({ schoolId }: P) {
  const [f, setF] = useState(initFlt(29));
  const { staff, rows, range } = useFiltered(schoolId, { ...f, status: "all" });
  const today = todayStr();
  const t = rows.filter((r) => r.date === today);
  const recToday = (range.data?.records ?? []).filter((r) => r.date === today);
  const byDay = useMemo(() => {
    const m = new Map<string, { date: string; present: number; late: number; absent: number }>();
    for (const r of rows) { if (!r.counts) continue; const e = m.get(r.date) ?? { date: r.date.slice(5), present: 0, late: 0, absent: 0 }; if (r.status === "present" || r.status === "late") e.present++; if (r.late) e.late++; if (r.status === "absent") e.absent++; m.set(r.date, e); }
    return [...m.entries()].sort().map(([, v]) => v);
  }, [rows]);
  const byWeek = useMemo(() => {
    const m = new Map<string, { week: string; present: number; late: number; absent: number }>();
    for (const r of rows) { if (!r.counts) continue; const d = new Date(`${r.date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); const k = d.toISOString().slice(5, 10); const e = m.get(k) ?? { week: k, present: 0, late: 0, absent: 0 }; if (r.status === "present" || r.status === "late") e.present++; if (r.late) e.late++; if (r.status === "absent") e.absent++; m.set(k, e); }
    return [...m.values()];
  }, [rows]);
  const byMonth = useMemo(() => {
    const m = new Map<string, { month: string; present: number; late: number; absent: number }>();
    for (const r of rows) { if (!r.counts) continue; const k = r.date.slice(0, 7); const e = m.get(k) ?? { month: k, present: 0, late: 0, absent: 0 }; if (r.status === "present" || r.status === "late") e.present++; if (r.late) e.late++; if (r.status === "absent") e.absent++; m.set(k, e); }
    return [...m.values()];
  }, [rows]);
  if (staff.isPending || range.isPending) return <p>Loading…</p>;
  return (
    <div className="space-y-4">
      <Filters staff={staff.data ?? []} f={f} setF={setF} showStatus={false} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total staff" value={(staff.data ?? []).filter((s) => s.active).length} />
        <Stat label="Present today" value={t.filter((r) => r.status === "present" || r.status === "late").length} tone="good" />
        <Stat label="Absent today" value={t.filter((r) => r.status === "absent").length} tone="bad" />
        <Stat label="Late today" value={t.filter((r) => r.late).length} tone="bad" />
        <Stat label="On approved leave" value={t.filter((r) => r.status === "leave").length} />
        <Stat label="Currently checked in" value={recToday.filter((r) => r.check_in_at && !r.check_out_at).length} />
        <Stat label="Checked out" value={recToday.filter((r) => r.check_out_at).length} />
        <Stat label="Missing check-outs (range)" value={rows.filter((r) => r.missingCheckout).length} tone="bad" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Daily attendance"><BarChart data={byDay}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Legend /><Bar dataKey="present" fill="hsl(var(--primary))" /><Bar dataKey="absent" fill="hsl(var(--destructive))" /></BarChart></ChartCard>
        <ChartCard title="Late & absence trends"><LineChart data={byDay}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Legend /><Line dataKey="late" stroke="hsl(var(--chart-4, var(--accent)))" strokeWidth={2} /><Line dataKey="absent" stroke="hsl(var(--destructive))" strokeWidth={2} /></LineChart></ChartCard>
        <ChartCard title="Weekly attendance"><BarChart data={byWeek}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Legend /><Bar dataKey="present" fill="hsl(var(--primary))" /><Bar dataKey="late" fill="hsl(var(--muted-foreground))" /><Bar dataKey="absent" fill="hsl(var(--destructive))" /></BarChart></ChartCard>
        <ChartCard title="Monthly attendance"><BarChart data={byMonth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Legend /><Bar dataKey="present" fill="hsl(var(--primary))" /><Bar dataKey="late" fill="hsl(var(--muted-foreground))" /><Bar dataKey="absent" fill="hsl(var(--destructive))" /></BarChart></ChartCard>
      </div>
    </div>
  );
}
function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="h-64"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></CardContent></Card>;
}

function statusText(r: DayResult) {
  const parts = [r.status === "late" ? `Late ${r.lateMinutes}m` : STATUS_LABEL[r.status]];
  if (r.early) parts.push(`Left ${r.earlyMinutes}m early`);
  if (r.missingCheckout) parts.push("No check-out");
  return parts.join(" · ") + (r.reason ? ` — ${r.reason}` : "");
}

function Records({ schoolId, me, edit }: P) {
  const [f, setF] = useState(initFlt(6));
  const [q, setQ] = useState("");
  const [fix, setFix] = useState<{ user_id: string; name: string; date: string; check_in: string; check_out: string; reason: string } | null>(null);
  const qc = useQueryClient();
  const correct = useServerFn(correctAttendance);
  const { rows, range, smap, staff } = useFiltered(schoolId, f);
  const recMap = new Map((range.data?.records ?? []).map((r) => [`${r.user_id}|${r.date}`, r]));
  const pens = range.data?.penalties ?? [];
  const list = rows.filter((r) => !q || smap.get(r.user_id)?.name.toLowerCase().includes(q.toLowerCase()) || smap.get(r.user_id)?.staff_no?.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date));
  const hhmm = (iso?: string | null) => (iso ? fmtTime(iso).replace(/[^\d:]/g, "").padStart(5, "0") : "");
  const save = async () => {
    if (!fix) return;
    try { await correct({ data: { school_id: schoolId, user_id: fix.user_id, date: fix.date, check_in: fix.check_in || null, check_out: fix.check_out || null, reason: fix.reason } }); toast.success("Attendance corrected and logged"); setFix(null); qc.invalidateQueries({ queryKey: ["sa-range"] }); }
    catch (e) { toast.error((e as Error).message); }
  };
  return (
    <div className="space-y-4">
      <Filters staff={staff.data ?? []} f={f} setF={setF} />
      <Input placeholder="Search staff name or ID" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      {fix && <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-5">
        <div className="sm:col-span-5 font-semibold">Correct {fix.name} — {fix.date}</div>
        <div><Label htmlFor="ci">Check in</Label><Input id="ci" type="time" value={fix.check_in} onChange={(e) => setFix({ ...fix, check_in: e.target.value })} /></div>
        <div><Label htmlFor="co">Check out</Label><Input id="co" type="time" value={fix.check_out} onChange={(e) => setFix({ ...fix, check_out: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label htmlFor="cr">Reason (required)</Label><Input id="cr" value={fix.reason} onChange={(e) => setFix({ ...fix, reason: e.target.value })} /></div>
        <div className="flex items-end gap-2"><Button onClick={save}>Save</Button><Button variant="ghost" onClick={() => setFix(null)}>Cancel</Button></div>
      </CardContent></Card>}
      {range.isPending ? <p>Loading…</p> : <div className="overflow-x-auto rounded-md border"><Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Staff</TableHead><TableHead>In</TableHead><TableHead>Out</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead><TableHead>Penalty</TableHead><TableHead>Location</TableHead>{edit && <TableHead />}</TableRow></TableHeader>
        <TableBody>{list.slice(0, 500).map((r) => {
          const rec = recMap.get(`${r.user_id}|${r.date}`); const s = smap.get(r.user_id)!;
          const pen = pens.filter((p) => p.user_id === r.user_id && p.date === r.date && p.status !== "waived").reduce((a, p) => a + Number(p.amount), 0);
          return <TableRow key={`${r.user_id}${r.date}`}>
            <TableCell className="whitespace-nowrap">{r.date}</TableCell><TableCell>{s.name}{s.staff_no ? <div className="text-xs text-muted-foreground">{s.staff_no}</div> : null}</TableCell>
            <TableCell>{fmtTime(rec?.check_in_at)}</TableCell><TableCell>{fmtTime(rec?.check_out_at)}</TableCell><TableCell>{r.workedMinutes ? fmtHours(r.workedMinutes) : "—"}</TableCell>
            <TableCell><span className={r.status === "absent" || r.late || r.missingCheckout ? "text-destructive" : ""}>{statusText(r)}</span>{rec?.correction_reason ? <div className="text-xs text-muted-foreground">Corrected: {rec.correction_reason}</div> : null}</TableCell>
            <TableCell>{pen ? naira(pen) : "—"}</TableCell>
            <TableCell className="text-xs">{rec ? `${rec.in_method ?? ""} · ${rec.in_verified === true ? `verified${rec.in_distance_m != null ? ` (${Math.round(rec.in_distance_m)} m)` : ""}` : rec.in_verified === false ? "outside" : "not checked"}` : "—"}</TableCell>
            {edit && <TableCell>{r.user_id !== me && ["present", "late", "absent", "not_yet"].includes(r.status) && <Button size="sm" variant="outline" onClick={() => setFix({ user_id: r.user_id, name: s.name, date: r.date, check_in: hhmm(rec?.check_in_at), check_out: hhmm(rec?.check_out_at), reason: "" })}>Correct</Button>}</TableCell>}
          </TableRow>;
        })}{!list.length && <TableRow><TableCell colSpan={9} className="text-muted-foreground">No records match.</TableCell></TableRow>}</TableBody></Table></div>}
    </div>
  );
}

function Leave({ schoolId, me, edit }: P) {
  const qc = useQueryClient();
  const review = useServerFn(reviewLeave);
  const staff = useStaffList(schoolId);
  const names = new Map((staff.data ?? []).map((s) => [s.user_id, s.name]));
  const d = useQuery({ queryKey: ["sa-leave", schoolId], queryFn: async () => {
    const [h, t, r, e] = await Promise.all([
      supabase.from("staff_holidays").select("*").eq("school_id", schoolId).order("start_date", { ascending: false }),
      supabase.from("leave_types").select("*").eq("school_id", schoolId).order("name"),
      supabase.from("leave_requests").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(200),
      supabase.from("attendance_exemptions").select("*").eq("school_id", schoolId).order("start_date", { ascending: false }).limit(200),
    ]);
    return { h: h.data ?? [], t: t.data ?? [], r: r.data ?? [], e: e.data ?? [] };
  } });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["sa-leave", schoolId] }); qc.invalidateQueries({ queryKey: ["sa-range"] }); };
  const [hol, setHol] = useState({ title: "", kind: "school", start_date: "", end_date: "" });
  const [lt, setLt] = useState("");
  const [ex, setEx] = useState({ user_id: "", kind: "official_assignment", start_date: "", end_date: "", reason: "" });
  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => { const { error } = await p; if (error) toast.error(error.message); else { toast.success(ok); refresh(); } };
  const tname = new Map((d.data?.t ?? []).map((t) => [t.id, t.name]));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2"><CardHeader><CardTitle>Leave requests</CardTitle></CardHeader><CardContent className="overflow-x-auto">
        <Table><TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead>{edit && <TableHead />}</TableRow></TableHeader>
          <TableBody>{(d.data?.r ?? []).map((r) => <TableRow key={r.id}><TableCell>{names.get(r.user_id) ?? "Staff"}</TableCell><TableCell>{tname.get(r.leave_type_id ?? "") ?? "—"}</TableCell><TableCell className="whitespace-nowrap">{r.start_date} → {r.end_date}</TableCell><TableCell>{r.reason}</TableCell>
            <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
            {edit && <TableCell className="space-x-1 whitespace-nowrap">{r.status === "pending" && r.user_id !== me && <>
              <Button size="sm" onClick={async () => { try { await review({ data: { id: r.id, approve: true } }); toast.success("Approved"); refresh(); } catch (e) { toast.error((e as Error).message); } }}>Approve</Button>
              <Button size="sm" variant="outline" onClick={async () => { const note = prompt("Reason for rejecting?") ?? ""; try { await review({ data: { id: r.id, approve: false, note } }); toast.success("Rejected"); refresh(); } catch (e) { toast.error((e as Error).message); } }}>Reject</Button></>}
              {r.status === "pending" && r.user_id === me && <span className="text-xs text-muted-foreground">Another admin must review</span>}</TableCell>}
          </TableRow>)}{!d.data?.r.length && <TableRow><TableCell colSpan={6} className="text-muted-foreground">No requests.</TableCell></TableRow>}</TableBody></Table>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Holidays & school events</CardTitle></CardHeader><CardContent className="space-y-3">
        {edit && <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Title e.g. Independence Day" value={hol.title} onChange={(e) => setHol({ ...hol, title: e.target.value })} className="col-span-2" aria-label="Holiday title" />
          <Select value={hol.kind} onValueChange={(v) => setHol({ ...hol, kind: v })}><SelectTrigger aria-label="Holiday kind"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">Public holiday</SelectItem><SelectItem value="school">School holiday</SelectItem><SelectItem value="event">Special event</SelectItem></SelectContent></Select>
          <span />
          <Input type="date" aria-label="Holiday start" value={hol.start_date} onChange={(e) => setHol({ ...hol, start_date: e.target.value })} />
          <Input type="date" aria-label="Holiday end" value={hol.end_date} onChange={(e) => setHol({ ...hol, end_date: e.target.value })} />
          <Button className="col-span-2" onClick={() => { if (!hol.title || !hol.start_date) return toast.error("Add a title and dates"); run(supabase.from("staff_holidays").insert({ ...hol, end_date: hol.end_date || hol.start_date, school_id: schoolId, created_by: me }), "Holiday added").then(() => setHol({ title: "", kind: "school", start_date: "", end_date: "" })); }}>Add holiday</Button>
        </div>}
        {(d.data?.h ?? []).map((h) => <div key={h.id} className="flex items-center justify-between border-b py-1 text-sm"><span>{h.title} <Badge variant="secondary">{h.kind}</Badge><div className="text-xs text-muted-foreground">{h.start_date} → {h.end_date}</div></span>{edit && <Button size="sm" variant="ghost" onClick={() => run(supabase.from("staff_holidays").delete().eq("id", h.id), "Removed")}>Remove</Button>}</div>)}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Individual exemptions</CardTitle></CardHeader><CardContent className="space-y-3">
        {edit && <div className="grid grid-cols-2 gap-2">
          <Select value={ex.user_id} onValueChange={(v) => setEx({ ...ex, user_id: v })}><SelectTrigger aria-label="Staff"><SelectValue placeholder="Staff member" /></SelectTrigger><SelectContent>{(staff.data ?? []).filter((s) => s.user_id !== me).map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.name}</SelectItem>)}</SelectContent></Select>
          <Select value={ex.kind} onValueChange={(v) => setEx({ ...ex, kind: v })}><SelectTrigger aria-label="Exemption kind"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="official_assignment">Official assignment</SelectItem><SelectItem value="permission">Permission</SelectItem><SelectItem value="sick">Sick leave</SelectItem><SelectItem value="event">School event</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
          <Input type="date" aria-label="Exemption start" value={ex.start_date} onChange={(e) => setEx({ ...ex, start_date: e.target.value })} />
          <Input type="date" aria-label="Exemption end" value={ex.end_date} onChange={(e) => setEx({ ...ex, end_date: e.target.value })} />
          <Input className="col-span-2" placeholder="Reason (shown on records)" value={ex.reason} onChange={(e) => setEx({ ...ex, reason: e.target.value })} aria-label="Exemption reason" />
          <Button className="col-span-2" onClick={() => { if (!ex.user_id || !ex.start_date || ex.reason.length < 3) return toast.error("Choose staff, dates and a reason"); run(supabase.from("attendance_exemptions").insert({ ...ex, end_date: ex.end_date || ex.start_date, school_id: schoolId, created_by: me }), "Exemption added").then(() => setEx({ user_id: "", kind: "official_assignment", start_date: "", end_date: "", reason: "" })); }}>Add exemption</Button>
        </div>}
        {(d.data?.e ?? []).map((e) => <div key={e.id} className="flex items-center justify-between border-b py-1 text-sm"><span>{names.get(e.user_id) ?? "Staff"} — {e.reason}<div className="text-xs text-muted-foreground">{e.kind.replace("_", " ")} · {e.start_date} → {e.end_date}</div></span>{edit && e.user_id !== me && <Button size="sm" variant="ghost" onClick={() => run(supabase.from("attendance_exemptions").delete().eq("id", e.id), "Removed")}>Remove</Button>}</div>)}
      </CardContent></Card>

      {edit && <Card><CardHeader><CardTitle>Leave types</CardTitle></CardHeader><CardContent className="space-y-2">
        <div className="flex gap-2"><Input placeholder="e.g. Annual leave, Sick leave, Maternity" value={lt} onChange={(e) => setLt(e.target.value)} aria-label="Leave type name" /><Button onClick={() => lt.trim() && run(supabase.from("leave_types").insert({ school_id: schoolId, name: lt.trim() }), "Added").then(() => setLt(""))}>Add</Button></div>
        {(d.data?.t ?? []).map((t) => <div key={t.id} className="flex items-center justify-between text-sm"><span>{t.name}</span><Switch checked={t.active} aria-label={`${t.name} active`} onCheckedChange={(v) => run(supabase.from("leave_types").update({ active: v }).eq("id", t.id), "Updated")} /></div>)}
      </CardContent></Card>}
    </div>
  );
}

const PEN_LABEL: Record<string, string> = { late: "Late", late_extra: "Very late", absence: "Absence", early: "Early departure", missing_checkout: "Missing check-out" };
function Penalties({ schoolId, me, edit }: P) {
  const [f, setF] = useState(initFlt(30));
  const qc = useQueryClient();
  const rec = useServerFn(recordPenalties); const waive = useServerFn(waivePenalty);
  const { range, smap, staff } = useFiltered(schoolId, f);
  const list = (range.data?.penalties ?? []).filter((p) => f.staff === "all" || p.user_id === f.staff).sort((a, b) => b.date.localeCompare(a.date));
  const total = list.filter((p) => p.status !== "waived").reduce((a, p) => a + Number(p.amount), 0);
  return (
    <div className="space-y-4">
      <Filters staff={staff.data ?? []} f={f} setF={setF} showStatus={false} />
      <div className="flex flex-wrap items-center gap-3">
        {edit && <Button onClick={async () => { try { await rec({ data: { school_id: schoolId, from: f.from, to: f.to } }); toast.success("Penalties recorded for finished days"); qc.invalidateQueries({ queryKey: ["sa-range"] }); } catch (e) { toast.error((e as Error).message); } }}>Record penalties for this range</Button>}
        <span className="text-sm text-muted-foreground">Outstanding: <b>{naira(total)}</b>. Penalties are only deducted in payroll when the payroll rule is switched on in Settings.</span>
      </div>
      <div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Staff</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead>{edit && <TableHead />}</TableRow></TableHeader>
        <TableBody>{list.map((p) => <TableRow key={p.id}><TableCell>{p.date}</TableCell><TableCell>{smap.get(p.user_id)?.name ?? "Staff"}</TableCell><TableCell>{PEN_LABEL[p.kind]}{p.minutes ? ` (${p.minutes}m)` : ""}</TableCell><TableCell>{naira(Number(p.amount))}</TableCell>
          <TableCell><Badge variant={p.status === "waived" ? "secondary" : p.status === "applied" ? "default" : "destructive"}>{p.status}</Badge>{p.waive_reason ? <div className="text-xs text-muted-foreground">{p.waive_reason}</div> : null}</TableCell>
          {edit && <TableCell>{p.status === "pending" && p.user_id !== me && <Button size="sm" variant="outline" onClick={async () => { const reason = prompt("Reason for waiving this penalty?"); if (!reason) return; try { await waive({ data: { id: p.id, reason } }); toast.success("Waived"); qc.invalidateQueries({ queryKey: ["sa-range"] }); } catch (e) { toast.error((e as Error).message); } }}>Waive</Button>}</TableCell>}
        </TableRow>)}{!list.length && <TableRow><TableCell colSpan={6} className="text-muted-foreground">No penalties in this range.</TableCell></TableRow>}</TableBody></Table></div>
    </div>
  );
}

function Payroll({ schoolId, me, payEdit, payApprove }: P) {
  const qc = useQueryClient();
  const gen = useServerFn(generatePayroll); const setStatus = useServerFn(setPayrollStatus);
  const [sel, setSel] = useState<string | null>(null);
  const [np, setNp] = useState({ name: "", kind: "monthly", start_date: "", end_date: "" });
  const periods = useQuery({ queryKey: ["sa-periods", schoolId], queryFn: async () => (await supabase.from("payroll_periods").select("*").eq("school_id", schoolId).order("start_date", { ascending: false })).data ?? [] });
  const recs = useQuery({ queryKey: ["sa-precs", sel], enabled: Boolean(sel), queryFn: async () => (await supabase.from("payroll_records").select("*").eq("period_id", sel!).order("staff_name")).data ?? [] });
  const salaries = useQuery({ queryKey: ["sa-sal", schoolId], enabled: payEdit, queryFn: async () => (await supabase.from("staff_salary_settings").select("*").eq("school_id", schoolId)).data ?? [] });
  const staff = useStaffList(schoolId);
  const period = periods.data?.find((p) => p.id === sel);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["sa-periods", schoolId] }); qc.invalidateQueries({ queryKey: ["sa-precs"] }); };
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); refresh(); } catch (e) { toast.error((e as Error).message); } };
  const totals = (recs.data ?? []).reduce((a, r) => ({ gross: a.gross + Number(r.gross), ded: a.ded + Number(r.total_deductions), net: a.net + Number(r.net) }), { gross: 0, ded: 0, net: 0 });
  const saveSalary = async (user_id: string, patch: Record<string, unknown>) => {
    const ex = salaries.data?.find((s) => s.user_id === user_id);
    const { error } = ex ? await supabase.from("staff_salary_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", ex.id) : await supabase.from("staff_salary_settings").insert({ school_id: schoolId, user_id, basic: 0, allowances: 0, ...patch });
    if (error) toast.error(error.message); else { toast.success("Salary saved"); qc.invalidateQueries({ queryKey: ["sa-sal", schoolId] }); }
  };
  return (
    <div className="space-y-4">
      {payEdit && <Card><CardHeader><CardTitle>New payroll period</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-5">
        <Input placeholder="e.g. October 2026" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} aria-label="Period name" />
        <Select value={np.kind} onValueChange={(v) => setNp({ ...np, kind: v })}><SelectTrigger aria-label="Period type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select>
        <Input type="date" aria-label="Period start" value={np.start_date} onChange={(e) => setNp({ ...np, start_date: e.target.value })} />
        <Input type="date" aria-label="Period end" value={np.end_date} onChange={(e) => setNp({ ...np, end_date: e.target.value })} />
        <Button onClick={async () => { if (!np.name || !np.start_date || !np.end_date) return toast.error("Fill in all fields"); const { error } = await supabase.from("payroll_periods").insert({ ...np, school_id: schoolId, created_by: me }); if (error) toast.error(error.message); else { toast.success("Period created"); setNp({ name: "", kind: "monthly", start_date: "", end_date: "" }); refresh(); } }}>Create</Button>
      </CardContent></Card>}
      <div className="flex flex-wrap gap-2">{(periods.data ?? []).map((p) => <Button key={p.id} variant={sel === p.id ? "default" : "outline"} onClick={() => setSel(p.id)}>{p.name} <Badge variant="secondary" className="ml-2">{p.status}</Badge></Button>)}{!periods.data?.length && <p className="text-sm text-muted-foreground">No payroll periods yet.</p>}</div>
      {period && <Card><CardHeader className="flex-row flex-wrap items-center justify-between gap-2"><CardTitle>{period.name} · {period.start_date} → {period.end_date} · <Badge>{period.status}</Badge>{period.version ? <span className="ml-2 text-xs text-muted-foreground">v{period.version}</span> : null}</CardTitle>
        <div className="flex flex-wrap gap-2 print:hidden">
          {payEdit && (period.status === "draft" || period.status === "reviewed") && <Button variant="outline" onClick={() => act(() => gen({ data: { period_id: period.id } }), "Payroll calculated from attendance")}>{period.generated_at ? "Recalculate" : "Generate preview"}</Button>}
          {payEdit && period.status === "draft" && period.generated_at && <Button onClick={() => act(() => setStatus({ data: { period_id: period.id, status: "reviewed" } }), "Marked reviewed")}>Mark reviewed</Button>}
          {payApprove && period.status === "reviewed" && <Button onClick={() => act(() => setStatus({ data: { period_id: period.id, status: "approved" } }), "Approved")}>Approve</Button>}
          {payApprove && period.status === "approved" && <><Button onClick={() => confirm("Mark this payroll as paid? It will be locked.") && act(() => setStatus({ data: { period_id: period.id, status: "paid" } }), "Marked paid")}>Mark paid</Button><Button variant="ghost" onClick={() => act(() => setStatus({ data: { period_id: period.id, status: "draft" } }), "Returned to draft for correction")}>Reopen for correction</Button></>}
          <Button variant="outline" onClick={() => downloadCsv(`payroll-${period.name}.csv`, [["Staff", "Basic", "Allowances", "Days present", "Days absent", "Excused days", "Late", "Late penalty", "Absence penalty", "Other penalty", "Other deductions", "Gross", "Total deductions", "Net", "Status"], ...(recs.data ?? []).map((r) => [r.staff_name, r.basic, r.allowances, r.days_present, r.days_absent, r.days_exempt, r.late_count, r.late_penalty, r.absence_penalty, r.other_penalty, r.other_deductions, r.gross, r.total_deductions, r.net, period.status])])}><Download className="mr-1 h-4 w-4" />CSV</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />PDF</Button>
        </div></CardHeader>
        <CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Basic</TableHead><TableHead>Allow.</TableHead><TableHead>Present</TableHead><TableHead>Absent</TableHead><TableHead>Late</TableHead><TableHead>Late pen.</TableHead><TableHead>Absence pen.</TableHead><TableHead>Other ded.</TableHead><TableHead>Gross</TableHead><TableHead>Deductions</TableHead><TableHead>Net</TableHead></TableRow></TableHeader>
          <TableBody>{(recs.data ?? []).map((r) => <TableRow key={r.id}><TableCell>{r.staff_name}</TableCell><TableCell>{naira(r.basic)}</TableCell><TableCell>{naira(r.allowances)}</TableCell><TableCell>{r.days_present}</TableCell><TableCell>{r.days_absent}</TableCell><TableCell>{r.late_count}</TableCell><TableCell>{naira(r.late_penalty)}</TableCell><TableCell>{naira(r.absence_penalty)}</TableCell><TableCell>{naira(Number(r.other_deductions) + Number(r.other_penalty))}</TableCell><TableCell>{naira(r.gross)}</TableCell><TableCell>{naira(r.total_deductions)}</TableCell><TableCell className="font-semibold">{naira(r.net)}</TableCell></TableRow>)}
            {recs.data?.length ? <TableRow className="font-bold"><TableCell colSpan={9}>Totals</TableCell><TableCell>{naira(totals.gross)}</TableCell><TableCell>{naira(totals.ded)}</TableCell><TableCell>{naira(totals.net)}</TableCell></TableRow> : <TableRow><TableCell colSpan={12} className="text-muted-foreground">Press "Generate preview" to calculate from attendance. Salary records are not changed.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>}

      {payEdit && <Card className="print:hidden"><CardHeader><CardTitle>Staff salaries</CardTitle></CardHeader><CardContent className="overflow-x-auto">
        <Table><TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Salary type</TableHead><TableHead>Basic</TableHead><TableHead>Allowances</TableHead><TableHead>Other deductions</TableHead><TableHead>Effective from</TableHead></TableRow></TableHeader>
          <TableBody>{(staff.data ?? []).map((s) => { const sv = salaries.data?.find((x) => x.user_id === s.user_id); const self = s.user_id === me;
            return <TableRow key={s.user_id}><TableCell>{s.name}</TableCell>
              <TableCell><Select disabled={self} value={sv?.salary_type ?? "monthly"} onValueChange={(v) => saveSalary(s.user_id, { salary_type: v })}><SelectTrigger className="w-28" aria-label={`${s.name} salary type`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent></Select></TableCell>
              {(["basic", "allowances", "other_deductions"] as const).map((k) => <TableCell key={k}><Input disabled={self} className="w-28" type="number" min={0} aria-label={`${s.name} ${k}`} defaultValue={Number(sv?.[k] ?? 0)} onBlur={(e) => { const v = Number(e.target.value); if (v >= 0 && v !== Number(sv?.[k] ?? 0)) saveSalary(s.user_id, { [k]: v }); }} /></TableCell>)}
              <TableCell><Input disabled={self} type="date" className="w-36" aria-label={`${s.name} effective`} defaultValue={sv?.effective_from ?? ""} onBlur={(e) => e.target.value !== (sv?.effective_from ?? "") && saveSalary(s.user_id, { effective_from: e.target.value || null })} /></TableCell></TableRow>; })}</TableBody></Table>
        <p className="mt-2 text-xs text-muted-foreground">You cannot edit your own salary. Every change is recorded in the audit trail.</p>
      </CardContent></Card>}
    </div>
  );
}

const REPORTS = { daily: "Daily attendance", weekly: "Weekly attendance", monthly: "Monthly attendance", summary: "Staff attendance summary", late: "Late report", absence: "Absence report", leave: "Leave / exemption report", penalty: "Penalty report", individual: "Individual staff report" } as const;
function Reports({ schoolId }: P) {
  const [kind, setKind] = useState<keyof typeof REPORTS>("daily");
  const [f, setF] = useState(initFlt(0));
  const pick = (k: keyof typeof REPORTS) => { setKind(k); const t = todayStr(); setF({ ...f, from: k === "daily" ? t : k === "weekly" ? shiftDate(t, -6) : shiftDate(t, -29), to: t }); };
  const { rows, range, smap, staff } = useFiltered(schoolId, { ...f, status: "all" });
  const recMap = new Map((range.data?.records ?? []).map((r) => [`${r.user_id}|${r.date}`, r]));
  const pens = range.data?.penalties ?? [];
  let head: string[] = [], body: (string | number)[][] = [];
  const name = (id: string) => smap.get(id)?.name ?? "Staff";
  const dayRow = (r: DayResult & { user_id: string }) => { const rec = recMap.get(`${r.user_id}|${r.date}`); return [r.date, name(r.user_id), smap.get(r.user_id)?.staff_no ?? "", fmtTime(rec?.check_in_at), fmtTime(rec?.check_out_at), r.workedMinutes ? fmtHours(r.workedMinutes) : "", statusText(r)]; };
  const dayHead = ["Date", "Staff", "Staff ID", "In", "Out", "Hours", "Status"];
  if (kind === "summary" || kind === "weekly" || kind === "monthly") {
    head = ["Staff", "Staff ID", "Department", "Present", "Late", "Absent", "Leave", "Exempt", "Early", "No check-out", "Hours", "Attendance %"];
    body = [...new Set(rows.map((r) => r.user_id))].map((id) => { const s = summarise(rows.filter((r) => r.user_id === id)); const m = smap.get(id); return [name(id), m?.staff_no ?? "", m?.department ?? "", s.present, s.late, s.absent, s.leave, s.exempt, s.early, s.missingCheckout, fmtHours(s.workedMinutes), `${s.percent}%`]; });
  } else if (kind === "penalty") {
    head = ["Date", "Staff", "Type", "Amount", "Status"]; body = pens.filter((p) => f.staff === "all" || p.user_id === f.staff).map((p) => [p.date, name(p.user_id), PEN_LABEL[p.kind], Number(p.amount), p.status]);
  } else {
    const filt = kind === "late" ? rows.filter((r) => r.late) : kind === "absence" ? rows.filter((r) => r.status === "absent") : kind === "leave" ? rows.filter((r) => ["leave", "exempt", "holiday"].includes(r.status)) : rows.filter((r) => r.status !== "off_day" && r.status !== "not_yet");
    head = dayHead; body = filt.sort((a, b) => a.date.localeCompare(b.date) || name(a.user_id).localeCompare(name(b.user_id))).map(dayRow);
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">{(Object.keys(REPORTS) as (keyof typeof REPORTS)[]).map((k) => <Button key={k} size="sm" variant={kind === k ? "default" : "outline"} onClick={() => pick(k)}>{REPORTS[k]}</Button>)}</div>
      <div className="print:hidden"><Filters staff={staff.data ?? []} f={f} setF={setF} showStatus={false} /></div>
      {kind === "individual" && f.staff === "all" && <p className="text-sm text-muted-foreground">Choose a staff member above.</p>}
      <div className="flex gap-2 print:hidden">
        <Button variant="outline" onClick={() => downloadCsv(`${kind}-${f.from}-${f.to}.csv`, [head, ...body])}><Download className="mr-1 h-4 w-4" />Excel / CSV</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print / PDF</Button>
      </div>
      <Card><CardHeader><CardTitle>{REPORTS[kind]} · {f.from} to {f.to}</CardTitle></CardHeader><CardContent className="overflow-x-auto">
        {range.isPending ? <p>Loading…</p> : <Table><TableHeader><TableRow>{head.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{body.slice(0, 1000).map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{typeof c === "number" && head[j] === "Amount" ? naira(c) : c}</TableCell>)}</TableRow>)}{!body.length && <TableRow><TableCell colSpan={head.length} className="text-muted-foreground">Nothing to show.</TableCell></TableRow>}</TableBody></Table>}
      </CardContent></Card>
    </div>
  );
}

function StaffSetup({ schoolId, me }: P) {
  const qc = useQueryClient();
  const staff = useStaffList(schoolId);
  const pinFn = useServerFn(setStaffPin);
  const save = async (s: StaffMember, patch: Partial<StaffMember>) => {
    const m = { ...s, ...patch };
    const row = { staff_no: m.staff_no, department: m.department, category: m.category, photo_url: m.photo_url, active: m.active, attendance_exempt: m.attendance_exempt };
    const { error } = s.has_profile ? await supabase.from("staff_profiles").update(row).eq("school_id", schoolId).eq("user_id", s.user_id) : await supabase.from("staff_profiles").insert({ ...row, school_id: schoolId, user_id: s.user_id });
    if (error) toast.error(error.message); else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["sa-staff", schoolId] }); }
  };
  return (
    <Card><CardHeader><CardTitle>Staff attendance profiles</CardTitle></CardHeader><CardContent className="overflow-x-auto">
      <p className="mb-3 text-sm text-muted-foreground">Uses your existing staff accounts. Set a staff ID, department and a 4-digit kiosk PIN for each person. PINs are stored scrambled and never shown again.</p>
      <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Staff ID</TableHead><TableHead>Department</TableHead><TableHead>Category</TableHead><TableHead>Active</TableHead><TableHead>Exempt</TableHead><TableHead>Kiosk PIN</TableHead></TableRow></TableHeader>
        <TableBody>{(staff.data ?? []).map((s) => <TableRow key={s.user_id}>
          <TableCell>{s.name}<div className="text-xs text-muted-foreground">{s.role}</div></TableCell>
          <TableCell><Input className="w-24" defaultValue={s.staff_no ?? ""} aria-label={`${s.name} staff ID`} onBlur={(e) => e.target.value !== (s.staff_no ?? "") && save(s, { staff_no: e.target.value || null })} /></TableCell>
          <TableCell><Input className="w-32" defaultValue={s.department ?? ""} aria-label={`${s.name} department`} onBlur={(e) => e.target.value !== (s.department ?? "") && save(s, { department: e.target.value || null })} /></TableCell>
          <TableCell><Select value={s.category} onValueChange={(v) => save(s, { category: v })}><SelectTrigger className="w-32" aria-label={`${s.name} category`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="teaching">Teaching</SelectItem><SelectItem value="non-teaching">Non-teaching</SelectItem><SelectItem value="management">Management</SelectItem><SelectItem value="support">Support</SelectItem></SelectContent></Select></TableCell>
          <TableCell><Switch checked={s.active} aria-label={`${s.name} active`} onCheckedChange={(v) => save(s, { active: v })} /></TableCell>
          <TableCell><Switch checked={s.attendance_exempt} disabled={s.user_id === me} aria-label={`${s.name} exempt`} onCheckedChange={(v) => save(s, { attendance_exempt: v })} /></TableCell>
          <TableCell><Button size="sm" variant="outline" onClick={async () => { const pin = prompt(`New 4-digit kiosk PIN for ${s.name}`); if (!pin) return; try { await pinFn({ data: { school_id: schoolId, user_id: s.user_id, pin } }); toast.success("PIN set"); qc.invalidateQueries({ queryKey: ["sa-staff", schoolId] }); } catch (e) { toast.error((e as Error).message); } }}>Set PIN</Button></TableCell>
        </TableRow>)}</TableBody></Table>
    </CardContent></Card>
  );
}

function Settings({ schoolId }: P) {
  const qc = useQueryClient();
  const q = useSettings(schoolId);
  const [s, setS] = useState<AttSettings | null>(null);
  const v = s ?? q.data?.settings;
  if (!v) return <p>Loading…</p>;
  const up = (patch: Partial<AttSettings>) => setS({ ...v, ...patch });
  const num = (id: string, label: string, val: number, on: (n: number) => void, step = 1) => <div><Label htmlFor={id}>{label}</Label><Input id={id} type="number" min={0} step={step} value={val} onChange={(e) => on(Number(e.target.value))} /></div>;
  const save = async () => {
    const row = { school_id: schoolId, ...v, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("attendance_settings").upsert(row as never, { onConflict: "school_id" });
    if (error) return toast.error(error.message);
    toast.success("Settings saved"); setS(null); qc.invalidateQueries({ queryKey: ["sa-settings", schoolId] }); qc.invalidateQueries({ queryKey: ["sa-range"] });
  };
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Attendance rules</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="rt">Official reporting time</Label><Input id="rt" type="time" value={v.report_time} onChange={(e) => up({ report_time: e.target.value })} /></div>
        <div><Label htmlFor="ct">Closing time</Label><Input id="ct" type="time" value={v.closing_time} onChange={(e) => up({ closing_time: e.target.value })} /></div>
        {num("gm", "Grace period (minutes)", v.grace_minutes, (n) => up({ grace_minutes: n }))}
        {num("mh", "Minimum working hours", v.min_hours, (n) => up({ min_hours: n }), 0.5)}
        {num("lt", "Very-late threshold (minutes)", v.late_threshold_minutes, (n) => up({ late_threshold_minutes: n }))}
        {num("ed", "Early departure allowance (minutes)", v.early_departure_minutes, (n) => up({ early_departure_minutes: n }))}
        <div className="col-span-2"><Label>Working days</Label><div className="mt-1 flex flex-wrap gap-1">{DAYS.map((d, i) => <Button key={d} size="sm" variant={v.working_days.includes(i) ? "default" : "outline"} onClick={() => up({ working_days: v.working_days.includes(i) ? v.working_days.filter((x) => x !== i) : [...v.working_days, i].sort() })}>{d}</Button>)}</div></div>
        <p className="col-span-2 text-xs text-muted-foreground">Example: {v.report_time} + {v.grace_minutes} min grace — arrivals up to then are on time, later is late.</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>GPS rules</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3">
        <p className="col-span-2 text-xs text-muted-foreground">Staff can sign in/out when they are within the radius of any active site below.</p>
        <div className="col-span-2 flex items-center justify-between"><Label htmlFor="gp">Require GPS on phones</Label><Switch id="gp" checked={v.gps_phone} onCheckedChange={(c) => up({ gps_phone: c })} /></div>
        <div className="col-span-2 flex items-center justify-between"><Label htmlFor="gk">Require GPS on kiosk/tablet</Label><Switch id="gk" checked={v.gps_kiosk} onCheckedChange={(c) => up({ gps_kiosk: c })} /></div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Penalties (₦ per occurrence)</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3">
        {num("pl", "Late", v.penalties.late, (n) => up({ penalties: { ...v.penalties, late: n } }))}
        {num("ppm", "Late, per minute", v.penalties.late_per_minute ?? 0, (n) => up({ penalties: { ...v.penalties, late_per_minute: n } }))}
        {num("px", "Extra when very late", v.penalties.late_extra, (n) => up({ penalties: { ...v.penalties, late_extra: n } }))}
        {num("pa", "Absence", v.penalties.absence, (n) => up({ penalties: { ...v.penalties, absence: n } }))}
        {num("pe", "Early departure", v.penalties.early, (n) => up({ penalties: { ...v.penalties, early: n } }))}
        {num("pm", "Missing check-out", v.penalties.missing_checkout, (n) => up({ penalties: { ...v.penalties, missing_checkout: n } }))}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Payroll & leave rules</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2"><Label htmlFor="ap">Deduct attendance penalties in payroll</Label><Switch id="ap" checked={v.apply_penalties_in_payroll} onCheckedChange={(c) => up({ apply_penalties_in_payroll: c })} /></div>
        <div className="flex items-center justify-between gap-2"><Label htmlFor="lr">Leave needs administrator approval</Label><Switch id="lr" checked={v.leave_requires_approval} disabled onCheckedChange={(c) => up({ leave_requires_approval: c })} /></div>
        <p className="text-xs text-muted-foreground">Monthly salaries are paid in full for monthly periods and per working day (÷22) otherwise. Weekly salaries are paid in full for weekly periods and per working day (÷5) otherwise. Allowances and deductions per staff are set in Payroll → Staff salaries. Leave types are managed under Leave & Exemptions.</p>
      </CardContent></Card>
      <div className="lg:col-span-2"><Button onClick={save} size="lg">Save settings</Button></div>
      <div className="lg:col-span-2"><Sites schoolId={schoolId} /></div>
    </div>
  );
}

type SiteRow = { id?: string; name: string; latitude: number; longitude: number; radius_m: number; active: boolean };
function Sites({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["sa-sites", schoolId], queryFn: async () => {
    const { data, error } = await supabase.from("attendance_sites").select("id,name,latitude,longitude,radius_m,active").eq("school_id", schoolId).order("created_at");
    if (error) throw error; return data as SiteRow[];
  } });
  const [draft, setDraft] = useState<Record<string, SiteRow>>({});
  const rows: SiteRow[] = [...(q.data ?? []), ...(draft.new ? [] : [])];
  const get = (r: SiteRow) => draft[r.id ?? "new"] ?? r;
  const set = (key: string, r: SiteRow) => setDraft({ ...draft, [key]: r });
  const refresh = () => qc.invalidateQueries({ queryKey: ["sa-sites", schoolId] });
  const save = async (key: string, r: SiteRow) => {
    if (!r.name.trim()) return toast.error("Site name is required");
    const row = { school_id: schoolId, name: r.name.trim(), latitude: r.latitude, longitude: r.longitude, radius_m: r.radius_m, active: r.active };
    const res = r.id ? await supabase.from("attendance_sites").update(row).eq("id", r.id).select("id") : await supabase.from("attendance_sites").insert(row).select("id");
    if (res.error || !res.data?.length) return toast.error(res.error?.message ?? "Site was not saved");
    toast.success("Site saved"); const d = { ...draft }; delete d[key]; setDraft(d); refresh();
  };
  const remove = async (id: string) => {
    if (!confirm("Remove this site?")) return;
    const { error } = await supabase.from("attendance_sites").delete().eq("id", id);
    if (error) return toast.error(error.message); toast.success("Site removed"); refresh();
  };
  const here = async (key: string, r: SiteRow) => { const g = await getLocation(); if (!g.fix) return toast.error(g.error ?? "No location"); set(key, { ...r, latitude: Number(g.fix.lat.toFixed(6)), longitude: Number(g.fix.lng.toFixed(6)) }); toast.success(`Location captured (±${Math.round(g.fix.accuracy)} m). Press Save.`); };
  const form = (key: string, r: SiteRow) => (
    <div key={key} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Label>Site name</Label><Input value={r.name} onChange={(e) => set(key, { ...r, name: e.target.value })} /></div>
      <div><Label>Latitude</Label><Input type="number" step="0.000001" value={r.latitude} onChange={(e) => set(key, { ...r, latitude: Number(e.target.value) })} /></div>
      <div><Label>Longitude</Label><Input type="number" step="0.000001" value={r.longitude} onChange={(e) => set(key, { ...r, longitude: Number(e.target.value) })} /></div>
      <div><Label>Allowed radius (metres)</Label><Input type="number" min={20} max={50000} value={r.radius_m} onChange={(e) => set(key, { ...r, radius_m: Number(e.target.value) })} /></div>
      <div className="flex items-end justify-between gap-2"><Button variant="outline" onClick={() => here(key, r)}>Use my current location</Button>
        <a className="text-sm underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}>Preview</a>
        <label className="flex items-center gap-2 text-sm"><Switch checked={r.active} onCheckedChange={(c) => set(key, { ...r, active: c })} />Active</label></div>
      <div className="flex justify-between sm:col-span-2">{r.id ? <Button variant="destructive" onClick={() => remove(r.id!)}>Remove</Button> : <Button variant="ghost" onClick={() => { const d = { ...draft }; delete d.new; setDraft(d); }}>Cancel</Button>}<Button onClick={() => save(key, r)}>Save</Button></div>
    </div>
  );
  return (
    <Card><CardHeader><CardTitle>Sites & geofence</CardTitle><p className="text-sm text-muted-foreground">Add every school location. Staff can clock in/out when they are within the radius of <b>any</b> active site.</p></CardHeader>
      <CardContent className="space-y-3">
        {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
        {rows.map((r) => form(r.id!, get(r)))}
        {draft.new ? form("new", draft.new) : <Button variant="outline" onClick={() => set("new", { name: "", latitude: 0, longitude: 0, radius_m: 150, active: true })}>Add site</Button>}
      </CardContent></Card>
  );
}
