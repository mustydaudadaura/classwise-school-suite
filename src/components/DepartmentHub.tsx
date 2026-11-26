import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, UserCheck, CalendarCheck, FileText, ArrowRight, LayoutGrid, CalendarDays, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolAccess } from "@/hooks/useSchoolAccess";
import { useDepartmentHub } from "@/hooks/useDepartmentHub";
import { visibleDepartments } from "@/lib/departments";
import { SCHOOL_TZ } from "@/lib/staff-attendance";
import { DepartmentIcon } from "@/components/DepartmentIcon";

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  submitted: { label: "Under review", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  needs_revision: { label: "Returned", variant: "destructive" },
  rejected: { label: "Returned", variant: "destructive" },
};

function fmtDate(d: string) {
  return new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  if (!now) return null;
  return (
    <div className="rounded-xl bg-sidebar/90 px-3 py-2 text-sidebar-foreground shadow-md">
      <p className="text-xs font-semibold sm:text-sm">{now.toLocaleDateString("en-NG", { timeZone: SCHOOL_TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      <p className="text-[11px] opacity-80">{now.toLocaleTimeString("en-NG", { timeZone: SCHOOL_TZ, hour: "2-digit", minute: "2-digit" })}</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, to, hint }: { icon: typeof Users; label: string; value: string; color: string; to?: "/students" | "/staff" | "/attendance" | "/academics"; hint?: string }) {
  const body = (
    <Card className="h-full overflow-hidden border-0 text-primary-foreground shadow-md transition hover:-translate-y-0.5" style={{ background: color }}>
      <CardContent className="flex items-center gap-3 p-4 sm:p-5">
        <Icon className="h-9 w-9 shrink-0 opacity-90 sm:h-11 sm:w-11" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium opacity-90 sm:text-sm">{label}</p>
          <p className="text-2xl font-bold leading-tight sm:text-3xl">{value}</p>
          {hint && <p className="truncate text-[11px] opacity-80">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

export function DepartmentHub() {
  const { fullName, roles, schoolId } = useAuth();
  const access = useSchoolAccess();
  const isSuper = roles.includes("super_admin");
  const canSeeStaff = isSuper || access.can("users.edit");
  const { data, isLoading, error } = useDepartmentHub(schoolId, canSeeStaff);
  const depts = visibleDepartments({ roles, can: access.can });
  const a = data?.attendance;
  const n = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("en-NG"));
  const pct = (v: number | null | undefined) => (v == null ? "—" : `${v}%`);
  const pie = a ? [
    { name: "Present", value: a.present, fill: "var(--dept-emerald)" },
    { name: "Absent", value: a.absent, fill: "var(--dept-rose)" },
    { name: "Late", value: a.late, fill: "var(--dept-amber)" },
    { name: "Excused", value: a.excused, fill: "var(--dept-blue)" },
  ] : [];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl p-4 text-primary-foreground shadow-md sm:p-6" style={{ background: "var(--gradient-hero)" }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {data?.school?.logo_url && <img src={data.school.logo_url} alt={`${data.school.name} logo`} className="h-12 w-12 shrink-0 rounded-lg bg-card object-contain p-1 sm:h-16 sm:w-16" />}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold opacity-90 sm:text-base">{data?.school?.name ?? "Your school"}</p>
              {data?.school?.motto && <p className="truncate text-xs italic opacity-80">{data.school.motto}</p>}
              <h1 className="mt-1 text-xl font-bold sm:text-3xl">Welcome{fullName ? `, ${fullName.split(" ")[0]}` : ""}</h1>
              <p className="text-xs opacity-85 sm:text-sm">
                {data?.school?.current_session ? `Session ${data.school.current_session}` : "Smart school management"}
                {data?.school?.current_term ? ` · ${data.school.current_term[0]!.toUpperCase()}${data.school.current_term.slice(1)} term` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Clock />
            <span className="inline-flex items-center gap-1 rounded-full bg-card/20 px-2.5 py-1 text-[11px] font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> {roles.length ? roles.map((r) => r.replace("_", " ")).join(" • ") : "Awaiting role"}</span>
          </div>
        </div>
      </div>

      {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Could not load school figures: {(error as Error).message}</p>}
      {!schoolId && <p className="text-sm text-muted-foreground">Select a school to see its figures.</p>}

      {/* Figures */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Students" value={isLoading ? "…" : n(data?.students)} color="var(--dept-blue)" to="/students" hint={data ? `${n(data.boys)} boys · ${n(data.girls)} girls` : undefined} />
        <StatCard icon={UserCheck} label="Total Staff" value={isLoading ? "…" : n(data?.staff)} color="var(--dept-emerald)" to={canSeeStaff ? "/staff" : undefined} hint={canSeeStaff ? "Active in Staff Register" : "Admins only"} />
        <StatCard icon={CalendarCheck} label="Attendance Today" value={isLoading ? "…" : pct(a?.rate)} color="var(--dept-violet)" to="/attendance" hint={a ? `${n(a.marked)} pupils marked` : undefined} />
        <StatCard icon={FileText} label="Pending Submissions" value={isLoading ? "…" : n(data?.pendingSubmissions)} color="var(--dept-amber)" to="/academics" hint="Lesson notes & schemes to review" />
      </div>

      {/* Departments */}
      <Card className="shadow-sm">
        <CardContent className="p-3 sm:p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <LayoutGrid className="mt-0.5 h-6 w-6 text-primary" aria-hidden />
              <div>
                <h2 className="text-lg font-bold sm:text-xl">Departmental Access</h2>
                <p className="text-xs text-muted-foreground sm:text-sm">Tap a department to manage its records and activities</p>
              </div>
            </div>
            <Link to="/departments" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-secondary/80">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-8">
            {depts.map((d) => (
              <Link
                key={d.slug}
                to="/departments/$dept"
                params={{ dept: d.slug }}
                className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-xl border border-border p-2 text-center text-xs font-semibold text-foreground transition hover:-translate-y-0.5 hover:shadow-md sm:text-sm"
                style={{ background: `color-mix(in oklab, ${d.color} 9%, var(--card))` }}
              >
                <DepartmentIcon slug={d.slug} color={d.color} className="h-8 w-8" />
                <span className="leading-tight">{d.short}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bottom row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden shadow-sm">
          <div className="flex items-center justify-between bg-sidebar px-4 py-2.5 text-sidebar-foreground">
            <span className="text-sm font-semibold">Attendance Overview</span><span className="text-xs opacity-80">Today</span>
          </div>
          <CardContent className="p-4">
            {a && a.marked > 0 ? (
              <>
                <div className="flex items-center gap-4">
                  <div className="relative h-32 w-32 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={pie} dataKey="value" innerRadius="72%" outerRadius="100%" stroke="none">{pie.map((p) => <Cell key={p.name} fill={p.fill} />)}</Pie></PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-bold">{pct(a.rate)}</span><span className="text-[10px] text-muted-foreground">present</span></div>
                  </div>
                  <ul className="flex-1 space-y-1.5 text-sm">
                    {pie.map((p) => <li key={p.name} className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.fill }} />{p.name}</span><span className="font-semibold">{n(p.value)}</span></li>)}
                  </ul>
                </div>
                <div className="mt-3 grid grid-cols-2 border-t border-border pt-3 text-center text-sm">
                  <div><p className="text-muted-foreground">Boys</p><p className="text-lg font-bold" style={{ color: "var(--dept-blue)" }}>{pct(a.boys.rate)}</p></div>
                  <div className="border-l border-border"><p className="text-muted-foreground">Girls</p><p className="text-lg font-bold" style={{ color: "var(--dept-pink)" }}>{pct(a.girls.rate)}</p></div>
                </div>
              </>
            ) : <p className="py-8 text-center text-sm text-muted-foreground">No attendance has been marked today.</p>}
          </CardContent>
        </Card>

        <Card className="overflow-hidden shadow-sm">
          <div className="flex items-center justify-between bg-sidebar px-4 py-2.5 text-sidebar-foreground">
            <span className="text-sm font-semibold">Recent Submissions</span>
            <Link to="/academics" className="inline-flex items-center gap-1 text-xs opacity-90 hover:opacity-100">View all <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <CardContent className="p-0">
            {data?.recentSubmissions.length ? (
              <ul className="divide-y divide-border">
                {data.recentSubmissions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <div className="min-w-0"><p className="truncate font-medium">{s.title}</p><p className="text-xs text-muted-foreground">{s.kind} · {fmtDate(s.date)}</p></div>
                    <Badge variant={STATUS[s.status]?.variant ?? "outline"} className="shrink-0">{STATUS[s.status]?.label ?? s.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">No lesson notes or schemes submitted yet.</p>}
          </CardContent>
        </Card>

        <Card className="overflow-hidden shadow-sm">
          <div className="flex items-center justify-between bg-sidebar px-4 py-2.5 text-sidebar-foreground">
            <span className="text-sm font-semibold">Upcoming Holidays & Events</span><CalendarDays className="h-4 w-4 opacity-80" />
          </div>
          <CardContent className="p-0">
            {data?.events.length ? (
              <ul className="divide-y divide-border">
                {data.events.map((e) => {
                  const d = new Date(`${e.start}T12:00:00`);
                  return (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-12 shrink-0 rounded-md bg-secondary py-1 text-center"><p className="text-lg font-bold leading-none text-primary">{d.getDate()}</p><p className="text-[10px] uppercase text-muted-foreground">{d.toLocaleDateString("en-NG", { month: "short" })}</p></div>
                      <div className="min-w-0"><p className="truncate text-sm font-medium">{e.title}</p><p className="text-xs capitalize text-muted-foreground">{e.kind.replace("_", " ")}{e.end !== e.start ? ` · until ${fmtDate(e.end)}` : ""}</p></div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">No upcoming holidays recorded. The full school calendar comes in Phase 3.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
