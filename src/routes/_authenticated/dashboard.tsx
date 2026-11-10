import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getSuperAdminDashboardData } from "@/lib/api/rbac.functions";
import { selectSchool } from "@/lib/school-access";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Building2, FileText, BookOpen, GraduationCap, Wallet,
  TrendingUp, TrendingDown, Award, UserCheck, ClipboardList, Sparkles,
  KeyRound, ShieldCheck, HardDrive, Eye, Settings, ArrowUpRight, CheckCircle2,
  UserPlus,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
  RadialBarChart, RadialBar,
} from "recharts";
import { StudentPerformanceAnalytics } from "@/components/StudentPerformanceAnalytics";
import { AdminAIAssistantWidget } from "@/components/AdminAIAssistantWidget";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import type { DashboardMetrics } from "@/lib/dashboard-metrics";
import { VisionDashboard, CorelyticsDashboard } from "@/components/StyledDashboards";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Alegacy" }, { name: "description", content: "Dashboard for authorized school accounts and families in Alegacy." }, { property: "og:title", content: "Dashboard — Alegacy" }, { property: "og:description", content: "Dashboard for authorized school accounts and families in Alegacy." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

// ---------- shared building blocks ----------

const DASH_STYLE_KEY = "alegacy-dashboard-style";
const DASH_STYLES = [
  { id: "classic", label: "Classic (bright)" },
  { id: "vision", label: "Vision (deep blue)" },
  { id: "corelytics", label: "Corelytics (dark)" },
] as const;
type DashStyle = (typeof DASH_STYLES)[number]["id"];

const PINK = "var(--analytic-pink)";
const PURPLE = "var(--analytic-purple)";
const EMERALD = "var(--analytic-emerald)";
const BLUE = "var(--analytic-blue)";
const INDIGO = "var(--analytic-indigo)";
const ROSE = "var(--analytic-rose)";

function DonutStat({ label, value, color }: { label: string; value: number; color: string }) {
  const data = [{ name: label, value, fill: color }];
  return (
    <Card className="overflow-hidden border-0 shadow-[var(--shadow-analytic)]">
      <CardContent className="p-3 sm:p-4">
        <div className="relative mx-auto h-20 w-20 sm:h-28 sm:w-28">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "var(--analytic-track)" }} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center text-sm sm:text-lg font-bold" style={{ color }}>
            {value}%
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] sm:text-xs text-muted-foreground line-clamp-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function GradientStat({
  icon: Icon, label, value, delta, gradient,
}: { icon: any; label: string; value: string | number; delta?: number; gradient: string }) {
  const up = (delta ?? 0) >= 0;
  return (
    <Card className="overflow-hidden border-0 text-white shadow-[var(--shadow-analytic)]" style={{ background: gradient }}>
      <CardContent className="flex items-center justify-between p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs uppercase tracking-wide opacity-80 truncate">{label}</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold truncate">{value}</p>
          {delta !== undefined && (
            <p className="mt-1 flex items-center gap-1 text-[10px] sm:text-xs opacity-90">
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {up ? "+" : ""}{delta}% this term
            </p>
          )}
        </div>
        <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressRow({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ---------- main ----------

function Dashboard() {
  const { fullName, roles, schoolId } = useAuth();
  const role = roles.includes("super_admin")
    ? "super_admin"
    : roles.includes("school_admin")
    ? "school_admin"
    : roles.includes("teacher")
    ? "teacher"
    : roles.includes("accountant")
    ? "accountant"
    : roles.includes("parent")
    ? "parent"
    : roles[0] ?? "student";

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", schoolId, role],
    queryFn: async () => {
      const [schools, students, classes, assessments, staff] = await Promise.all([
        supabase.from("schools").select("id", { count: "exact", head: true }),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("assessments").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      return {
        schools: schools.count ?? 0,
        students: students.count ?? 0,
        classes: classes.count ?? 0,
        assessments: assessments.count ?? 0,
        staff: staff.count ?? 0,
      };
    },
  });

  const title =
    role === "super_admin" ? "Platform Overview"
    : role === "school_admin" ? "School Administration"
    : role === "teacher" ? "Teacher Workspace"
    : role === "accountant" ? "Finance Overview"
    : role === "parent" ? "Parent Portal"
    : "My Learning";

  const [dashStyle, setDashStyle] = useState<DashStyle>("classic");
  useEffect(() => {
    const saved = window.localStorage.getItem(DASH_STYLE_KEY) as DashStyle | null;
    if (saved && DASH_STYLES.some((d) => d.id === saved)) setDashStyle(saved);
  }, []);
  const changeStyle = (v: string) => {
    setDashStyle(v as DashStyle);
    window.localStorage.setItem(DASH_STYLE_KEY, v);
  };

  return (
    <div data-dash-style={dashStyle} className="dash-surface space-y-4 sm:space-y-6">
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">Dashboard style</span>
        <Select value={dashStyle} onValueChange={changeStyle}>
          <SelectTrigger className="h-8 w-40 text-xs" aria-label="Dashboard style"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DASH_STYLES.map((d) => <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {dashStyle !== "classic" && role !== "parent" && role !== "student" && roles.length > 0 ? (
        <StyledView style={dashStyle} role={role} schoolId={schoolId} name={fullName || "there"} title={title} />
      ) : (<>
      {/* Header */}
      <div
        className="flex flex-col gap-2 rounded-2xl p-4 sm:p-6 text-white shadow-[var(--shadow-analytic)] sm:flex-row sm:items-center sm:justify-between"
        style={{ background: "var(--gradient-analytic-1)" }}
      >
        <div className="min-w-0">
          <p className="text-xs sm:text-sm opacity-80">{title}</p>
          <h1 className="text-xl font-bold sm:text-3xl truncate flex items-center gap-2">
            <span>Welcome{fullName ? `, ${fullName.split(" ")[0]}` : ""}</span>
            <Sparkles className="h-6 w-6 text-white/90" />
          </h1>
          <p className="mt-1 text-xs sm:text-sm opacity-90">
            {new Date().toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <Badge className="self-start bg-white/20 text-white hover:bg-white/30 text-[10px] sm:text-xs">
          {roles.length ? roles.join(" • ") : "Awaiting role"}
        </Badge>
      </div>

      {role === "super_admin" && <SuperAdminView stats={stats} schoolId={schoolId} />}
      {role === "school_admin" && <SchoolAdminView stats={stats} schoolId={schoolId} />}
      {role === "teacher" && <TeacherView schoolId={schoolId} />}
      {role === "accountant" && <AccountantView />}
      {role === "parent" && <ParentView />}
      {role === "student" && <StudentView />}
      {roles.length === 0 && <StudentView />}
      </>)}
    </div>
  );
}

function StyledView({ style, role, schoolId, name, title }: { style: DashStyle; role: string; schoolId?: string | null; name: string; title: string }) {
  const { user } = useAuth();
  const { data: m } = useDashboardMetrics({ schoolId, teacherId: role === "teacher" ? user?.id ?? null : null });
  const sub = `${title} · ${new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`;
  return (
    <>
      <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Dashboard</h1>
      {style === "vision" ? <VisionDashboard m={m} name={name} subtitle={sub} /> : <CorelyticsDashboard m={m} />}
    </>
  );
}

// ---------- ROLE VIEWS ----------

function SuperAdminView({ stats, schoolId }: { stats: any; schoolId?: string | null }) {
  const getSuperDataFn = useServerFn(getSuperAdminDashboardData);
  const { data: superData } = useQuery({
    queryKey: ["super-admin-dashboard-metrics"],
    queryFn: () => getSuperDataFn(),
  });

  const inspectedSchool = superData?.schools?.find((s) => s.id === schoolId);

  return (
    <div className="space-y-5">
      {/* Super Admin Status & School Inspection Banner */}
      <div className="flex flex-col gap-3 rounded-xl border border-purple-200 bg-purple-50/70 p-4 dark:border-purple-900/60 dark:bg-purple-950/30 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">Platform Owner Oversight</span>
              <Badge className="bg-purple-600 text-white hover:bg-purple-700 text-[10px]">Super Admin</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {inspectedSchool
                ? `Inspecting School: ${inspectedSchool.name} (${inspectedSchool.code}) · Read-only administrative mode`
                : "Global Platform Mode · Full access to all registered schools, users, and registration codes"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {inspectedSchool && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-medium"
              onClick={() => {
                selectSchool(superData?.schools?.[0]?.id ?? "");
              }}
            >
              <Eye className="mr-1.5 h-3.5 w-3.5 text-primary" />
              Switch Inspection
            </Button>
          )}
          <Button asChild size="sm" variant="default" className="text-xs font-semibold bg-purple-600 hover:bg-purple-700">
            <Link to="/users">
              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
              Manage Roles & Codes
            </Link>
          </Button>
        </div>
      </div>

      {/* Primary Executive Stats Grid */}
      <div className="grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <GradientStat
          icon={Building2}
          label="Registered Schools"
          value={superData?.totalSchools ?? stats?.schools ?? "—"}
          gradient="var(--gradient-analytic-1)"
        />
        <GradientStat
          icon={Users}
          label="Platform Users"
          value={superData?.totalUsers ?? stats?.staff ?? "—"}
          gradient="var(--gradient-analytic-2)"
        />
        <GradientStat
          icon={KeyRound}
          label="Active Registration Codes"
          value={superData?.registrationCodes?.active ?? "—"}
          gradient="var(--gradient-analytic-3)"
        />
        <GradientStat
          icon={HardDrive}
          label="Platform Storage Used"
          value={superData?.storageMetrics?.totalUsedMb != null ? `${superData.storageMetrics.totalUsedMb} MB` : "—"}
          gradient="var(--gradient-analytic-1)"
        />
      </div>

      {/* Quick Governance Navigation Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/schools" className="group">
          <Card className="h-full border border-border/70 hover:border-primary/50 transition-all shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                  Schools Directory
                </span>
                <p className="text-sm font-bold text-foreground">Create & Audit Schools</p>
                <p className="text-[11px] text-muted-foreground">Manage school registrations</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/users" className="group">
          <Card className="h-full border border-border/70 hover:border-primary/50 transition-all shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                  Role Governance
                </span>
                <p className="text-sm font-bold text-foreground">Users & Role Assignment</p>
                <p className="text-[11px] text-muted-foreground">Assign, modify, revoke roles</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/users" search={{ tab: "codes" }} className="group">
          <Card className="h-full border border-border/70 hover:border-primary/50 transition-all shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                  Registration Codes
                </span>
                <p className="text-sm font-bold text-foreground">Unique School Codes</p>
                <p className="text-[11px] text-muted-foreground">Single-use & reusable codes</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/settings" className="group">
          <Card className="h-full border border-border/70 hover:border-primary/50 transition-all shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                  Platform Settings
                </span>
                <p className="text-sm font-bold text-foreground">School Config & Audits</p>
                <p className="text-[11px] text-muted-foreground">Modules, grading, stamps</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Registered Schools Management Table */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Registered School Workspaces</CardTitle>
            <CardDescription>
              Super Admin school accounts directory. Select any school to inspect its dashboard and records.
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/schools">
              <Building2 className="mr-1.5 h-3.5 w-3.5" />
              Manage All Schools
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School Name & Code</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Registration Date</TableHead>
                  <TableHead>Account Status</TableHead>
                  <TableHead className="text-right">Inspection Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {superData?.schools?.map((sch: any) => {
                  const isCurrent = sch.id === schoolId;
                  return (
                    <TableRow key={sch.id} className={isCurrent ? "bg-purple-50/50 dark:bg-purple-950/20" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary shrink-0" />
                          <div>
                            <span className="font-semibold text-xs text-foreground">{sch.name}</span>
                            <span className="ml-2 font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {sch.code}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {sch.phone || sch.email || "Official Contact on File"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(sch.created_at || Date.now()).toLocaleDateString("en-NG", {
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={isCurrent ? "secondary" : "outline"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            selectSchool(sch.id);
                          }}
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5 text-primary" />
                          {isCurrent ? "Currently Inspecting" : "Inspect Dashboard"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Platform Analytics & Assistant */}
      <AdminAIAssistantWidget schoolId={schoolId} />
      <StudentPerformanceAnalytics schoolId={schoolId} />
      <SuperAdminCharts schoolId={schoolId} />
    </div>
  );
}

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

function SchoolAdminView({ schoolId }: { stats?: any; schoolId?: string | null }) {
  const { data: m } = useDashboardMetrics({ schoolId });
  return (
    <>
      <div className="grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <GradientStat icon={Users} label="Active Students" value={m ? m.totalStudents : "—"} gradient="var(--gradient-stat-1)" />
        <GradientStat icon={Award} label="Report Cards Published" value={m ? m.reportsPublished : "—"} gradient="var(--gradient-stat-2)" />
        <GradientStat icon={Wallet} label="Total Fees Collected" value={m ? fmtMoney(m.fees.collected) : "—"} gradient="var(--gradient-stat-3)" />
        <GradientStat icon={BookOpen} label="Active Classes" value={m ? m.classes : "—"} gradient="var(--gradient-stat-4)" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-sm">
          <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-lg">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Publish Results Online</span>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                Share results with parents instantly
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Generate beautiful Nigerian-standard report sheets, share via link or QR code, and keep parents informed in real time.
              </p>
            </div>
            <a
              href="/results"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 shrink-0"
            >
              Publish Results →
            </a>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
            <a
              href="/users"
              className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-primary/40 bg-primary/5 hover:bg-primary/10 transition text-center text-xs font-semibold text-primary"
            >
              <UserPlus className="h-4 w-4 text-primary mb-1.5" />
              <span>Staff Logins</span>
            </a>
            <a
              href="/results"
              className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/60 transition text-center text-xs font-medium text-foreground"
            >
              <FileText className="h-4 w-4 text-primary mb-1.5" />
              <span>Add Results</span>
            </a>
            <a
              href="/students"
              className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/60 transition text-center text-xs font-medium text-foreground"
            >
              <Users className="h-4 w-4 text-primary mb-1.5" />
              <span>Students</span>
            </a>
            <a
              href="/report-cards"
              className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/60 transition text-center text-xs font-medium text-foreground"
            >
              <Award className="h-4 w-4 text-primary mb-1.5" />
              <span>Report Cards</span>
            </a>
            <a
              href="/announcements"
              className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/60 transition text-center text-xs font-medium text-foreground"
            >
              <UserCheck className="h-4 w-4 text-primary mb-1.5" />
              <span>Noticeboard</span>
            </a>
            <a
              href="/settings"
              className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/60 transition text-center text-xs font-medium text-foreground"
            >
              <Settings className="h-4 w-4 text-primary mb-1.5" />
              <span>Settings</span>
            </a>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:gap-4 sm:grid-cols-4">
        <DonutStat label="Attendance (30 days)" value={m?.attendanceRate ?? 0} color={PINK} />
        <DonutStat label="Pass Rate" value={m?.passRate ?? 0} color={PURPLE} />
        <DonutStat label="Fees Paid" value={m?.fees.collectionRate ?? 0} color={EMERALD} />
        <DonutStat label="Reports Published" value={m?.reportsRate ?? 0} color={ROSE} />
      </div>

      <AdminAIAssistantWidget schoolId={schoolId} />
      <StudentPerformanceAnalytics schoolId={schoolId} />
      <ChartsRow metrics={m} title="School Activity" subtitle="Scores recorded (purple) and students admitted (pink) per month" />
      <ProgressCard m={m} />
    </>
  );
}

function TeacherView({ schoolId }: { schoolId?: string | null }) {
  const { user } = useAuth();
  const { data: m } = useDashboardMetrics({ schoolId, teacherId: user?.id ?? null });
  return (
    <>
      <div className="grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <GradientStat icon={BookOpen} label="My Classes" value={m ? m.classes : "—"} gradient="var(--gradient-analytic-1)" />
        <GradientStat icon={Users} label="My Students" value={m ? m.totalStudents : "—"} gradient="var(--gradient-analytic-2)" />
        <GradientStat icon={ClipboardList} label="Awaiting Approval" value={m ? m.submitted : "—"} gradient="var(--gradient-analytic-3)" />
        <GradientStat icon={Award} label="Avg Class Score" value={m ? `${m.avgScore}%` : "—"} gradient="var(--gradient-analytic-1)" />
      </div>
      <AdminAIAssistantWidget schoolId={schoolId} />
      <div className="grid gap-3 grid-cols-2 sm:gap-4 sm:grid-cols-4">
        <DonutStat label="Submitted" value={m?.submissionRate ?? 0} color={PINK} />
        <DonutStat label="Attendance (30 days)" value={m?.attendanceRate ?? 0} color={PURPLE} />
        <DonutStat label="Graded" value={m?.gradedRate ?? 0} color={INDIGO} />
        <DonutStat label="Approved" value={m?.approvalRate ?? 0} color={ROSE} />
      </div>
      <StudentPerformanceAnalytics schoolId={schoolId} />
      <ChartsRow metrics={m} title="My Class Activity" subtitle="Scores recorded (purple) and students admitted (pink) per month" />
    </>
  );
}

function AccountantView() {
  const { schoolId } = useAuth();
  const { data: m } = useDashboardMetrics({ schoolId });
  return (
    <>
      <div className="grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <GradientStat icon={Wallet} label="Collected (NGN)" value={m ? fmtMoney(m.fees.collected) : "—"} gradient="var(--gradient-analytic-1)" />
        <GradientStat icon={TrendingUp} label="Outstanding" value={m ? fmtMoney(m.fees.outstanding) : "—"} gradient="var(--gradient-analytic-2)" />
        <GradientStat icon={Users} label="Fully Paid Students" value={m ? m.paidStudents : "—"} gradient="var(--gradient-analytic-3)" />
        <GradientStat icon={FileText} label="Invoices" value={m ? m.invoices : "—"} gradient="var(--gradient-analytic-1)" />
      </div>
      <div className="grid gap-3 grid-cols-2 sm:gap-4 sm:grid-cols-4">
        <DonutStat label="Collection" value={m?.fees.collectionRate ?? 0} color={PINK} />
        <DonutStat label="Discount share" value={m ? Math.round(m.fees.billed ? (m.fees.discounts / m.fees.billed) * 100 : 0) : 0} color={PURPLE} />
        <DonutStat label="Scholarships" value={m?.scholarshipRate ?? 0} color={INDIGO} />
        <DonutStat label="Overdue" value={m?.overdueRate ?? 0} color={ROSE} />
      </div>
      <ChartsRow metrics={m} fees title="Revenue Analytics" subtitle="Fees collected per month (₦)" />
    </>
  );
}

function FamilyView({ parent }: { parent: boolean }) {
  const { schoolId } = useAuth();
  const { data: m } = useDashboardMetrics({ schoolId });
  return (
    <>
      <div className="grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {parent
          ? <GradientStat icon={GraduationCap} label="Children" value={m ? m.totalStudents : "—"} gradient="var(--gradient-analytic-1)" />
          : <GradientStat icon={BookOpen} label="Subjects Scored" value={m ? m.subjectScores.length : "—"} gradient="var(--gradient-analytic-1)" />}
        <GradientStat icon={Award} label="Avg Score" value={m ? `${m.avgScore}%` : "—"} gradient="var(--gradient-analytic-2)" />
        <GradientStat icon={UserCheck} label="Attendance (30 days)" value={m ? `${m.attendanceRate}%` : "—"} gradient="var(--gradient-analytic-3)" />
        <GradientStat icon={Wallet} label="Fees Due" value={m ? fmtMoney(m.fees.outstanding) : "—"} gradient="var(--gradient-analytic-1)" />
      </div>
      <div className="grid gap-3 grid-cols-2 sm:gap-4 sm:grid-cols-4">
        <DonutStat label="Pass Rate" value={m?.passRate ?? 0} color={PINK} />
        <DonutStat label="Attendance" value={m?.attendanceRate ?? 0} color={PURPLE} />
        <DonutStat label="Fees Paid" value={m?.fees.collectionRate ?? 0} color={INDIGO} />
        <DonutStat label="Reports Published" value={m?.reportsRate ?? 0} color={ROSE} />
      </div>
      <ChartsRow metrics={m} title={parent ? "Children Performance" : "My Performance"} subtitle="Scores recorded per month" />
    </>
  );
}
function ParentView() { return <FamilyView parent />; }
function StudentView() { return <FamilyView parent={false} />; }

// ---------- charts row (reusable) ----------

function ChartsRow({ metrics, fees, title, subtitle }: { metrics?: DashboardMetrics; fees?: boolean; title: string; subtitle: string }) {
  const areaData = (fees ? metrics?.feeTrend : metrics?.trend) ?? [];
  const barData = metrics?.subjectScores ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2 border-0 shadow-[var(--shadow-analytic)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </CardHeader>
        <CardContent className="h-56 sm:h-72 px-2 sm:px-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={areaData} margin={{ left: -20, right: 10, top: 10 }}>
              <defs>
                <linearGradient id="gPink" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PINK} stopOpacity={0.7} />
                  <stop offset="100%" stopColor={PINK} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gPurple" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PURPLE} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={PURPLE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--analytic-grid)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--analytic-axis)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--analytic-axis)" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "var(--shadow-analytic)", background: "var(--card)", color: "var(--foreground)" }} />
              <Area type="monotone" dataKey="a" stroke={PURPLE} strokeWidth={2.5} fill="url(#gPurple)" />
              {!fees && <Area type="monotone" dataKey="b" stroke={PINK} strokeWidth={2.5} fill="url(#gPink)" />}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-[var(--shadow-analytic)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Subject Breakdown</CardTitle>
          <p className="text-xs text-muted-foreground">{barData.length ? "Average score per subject" : "No scores recorded yet"}</p>
        </CardHeader>
        <CardContent className="h-56 sm:h-72 px-2 sm:px-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ left: -20, right: 10, top: 10 }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ROSE} />
                  <stop offset="100%" stopColor={INDIGO} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--analytic-grid)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--analytic-axis)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--analytic-axis)" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "var(--shadow-analytic)", background: "var(--card)", color: "var(--foreground)" }} />
              <Bar dataKey="score" fill="url(#barGrad)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function ProgressCard({ m }: { m?: DashboardMetrics }) {
  return (
    <Card className="border-0 shadow-[var(--shadow-analytic)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Operational Health</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <ProgressRow label="Result Approval Rate" value={m?.approvalRate ?? 0} sub={`${m?.approved ?? 0} of ${m?.assessments ?? 0} results approved`} color={PINK} />
        <ProgressRow label="Fee Collection" value={m?.fees.collectionRate ?? 0} sub={`${fmtMoney(m?.fees.collected ?? 0)} of ${fmtMoney(m?.fees.netPayable ?? 0)} collected`} color={PURPLE} />
        <ProgressRow label="Attendance (last 30 days)" value={m?.attendanceRate ?? 0} sub={`${m?.attendanceMarked ?? 0} attendance marks recorded`} color={INDIGO} />
        <ProgressRow label="Parent Engagement" value={m?.parentEngagement ?? 0} sub={`${m?.linkedParents ?? 0} of ${m?.parents ?? 0} parents have portal access`} color={ROSE} />
      </CardContent>
    </Card>
  );
}

function SuperAdminCharts({ schoolId }: { schoolId?: string | null }) {
  const { data: m } = useDashboardMetrics({ schoolId });
  return <ChartsRow metrics={m} title="School Activity Trends" subtitle="Scores recorded (purple) and students admitted (pink) per month" />;
}
