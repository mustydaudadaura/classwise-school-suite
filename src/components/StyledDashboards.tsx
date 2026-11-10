import { Link } from "@tanstack/react-router";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, RadialBarChart, RadialBar,
} from "recharts";
import {
  Users, Wallet, BookOpen, GraduationCap, UserCheck, Award, Receipt, ClipboardList,
  ArrowUpRight, Smile, ShieldCheck, Layers, UserCog,
} from "lucide-react";
import type { DashboardMetrics } from "@/lib/dashboard-metrics";

const C = {
  a: "var(--analytic-purple)", b: "var(--analytic-pink)", c: "var(--analytic-emerald)",
  d: "var(--analytic-rose)", e: "var(--analytic-indigo)", f: "var(--analytic-blue)",
};
const PALETTE = [C.a, C.b, C.c, C.d, C.e, C.f];
const tip = { borderRadius: 12, border: "none", background: "var(--popover)", color: "var(--foreground)", fontSize: 12 };

export function money(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `₦${Math.round(n / 1000).toLocaleString("en-NG")}K`;
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}
const v = (m: DashboardMetrics | undefined, f: (m: DashboardMetrics) => string | number) => (m ? f(m) : "—");

function Panel({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`dash-panel rounded-2xl p-4 sm:p-5 ${className}`}>{children}</div>;
}
function PanelHead({ title, sub, to }: { title: string; sub?: string; to?: string }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      {to && (
        <Link to={to as any} aria-label={`Open ${title}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground">
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

/* ---------------- Vision (deep blue) ---------------- */

function VisionStat({ label, value, note, icon: Icon }: { label: string; value: string | number; note?: string; icon: any }) {
  return (
    <Panel className="flex items-center justify-between !p-4">
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold text-foreground truncate">
          {value} {note && <span className="text-[11px] font-semibold text-[color:var(--analytic-emerald)]">{note}</span>}
        </p>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-analytic)]">
        <Icon className="h-5 w-5" />
      </div>
    </Panel>
  );
}

function Gauge({ value, color, children }: { value: number; color: string; children: React.ReactNode }) {
  return (
    <div className="relative mx-auto h-40 w-40">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="78%" outerRadius="100%" data={[{ value, fill: color }]} startAngle={210} endAngle={-30} >
          <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "var(--analytic-track)" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function VisionDashboard({ m, name, subtitle }: { m?: DashboardMetrics; name: string; subtitle: string }) {
  const months = m?.trend ?? [];
  const att = m?.attendanceRate ?? 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <VisionStat label="Fees collected" value={v(m, (x) => money(x.fees.collected))} note={m ? `${m.fees.collectionRate}%` : undefined} icon={Wallet} />
        <VisionStat label="Active students" value={v(m, (x) => x.totalStudents)} note={m && m.pendingStudents ? `+${m.pendingStudents} pending` : undefined} icon={Users} />
        <VisionStat label="Staff" value={v(m, (x) => x.staff)} icon={UserCog} />
        <VisionStat label="Classes / Subjects" value={v(m, (x) => `${x.classes} / ${x.subjects}`)} icon={BookOpen} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="dash-hero flex min-h-48 flex-col justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Welcome back,</p>
            <h2 className="mt-1 text-2xl font-bold text-foreground">{name}</h2>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <Link to="/students" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-foreground">
            Open students <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Panel>

        <Panel>
          <PanelHead title="Attendance rate" sub="Last 30 days, all marked days" />
          <Gauge value={att} color={C.f}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><Smile className="h-5 w-5" /></span>
          </Gauge>
          <div className="dash-inset mx-auto -mt-4 flex max-w-56 items-center justify-between rounded-xl px-3 py-2 text-[10px] text-muted-foreground">
            <span>0%</span>
            <span className="text-center"><b className="block text-xl text-foreground">{att}%</b>{v(m, (x) => x.attendanceMarked)} marks</span>
            <span>100%</span>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Results tracking" sub="Saved scores this session" to="/results" />
          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="space-y-2">
              <div className="dash-inset rounded-xl px-3 py-2"><p className="text-[11px] text-muted-foreground">Scores recorded</p><p className="font-bold text-foreground">{v(m, (x) => x.assessments)}</p></div>
              <div className="dash-inset rounded-xl px-3 py-2"><p className="text-[11px] text-muted-foreground">Report cards published</p><p className="font-bold text-foreground">{v(m, (x) => x.reportsPublished)}</p></div>
            </div>
            <Gauge value={m?.passRate ?? 0} color={C.c}>
              <span className="text-[10px] text-muted-foreground">Pass rate</span>
              <b className="text-3xl text-foreground">{m?.passRate ?? 0}%</b>
              <span className="text-[10px] text-muted-foreground">Avg {m?.avgScore ?? 0}%</span>
            </Gauge>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <PanelHead title="School activity" sub="Scores recorded and students admitted per month" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={months} margin={{ left: -20, right: 6, top: 6 }}>
                <defs>
                  <linearGradient id="vA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.a} stopOpacity={0.8} /><stop offset="100%" stopColor={C.a} stopOpacity={0} /></linearGradient>
                  <linearGradient id="vB" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.b} stopOpacity={0.5} /><stop offset="100%" stopColor={C.b} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--analytic-grid)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--analytic-axis)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--analytic-axis)" allowDecimals={false} />
                <Tooltip contentStyle={tip} />
                <Area type="monotone" name="Scores" dataKey="a" stroke={C.a} strokeWidth={2} fill="url(#vA)" />
                <Area type="monotone" name="Admitted" dataKey="b" stroke={C.b} strokeWidth={2} fill="url(#vB)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <div className="dash-inset h-44 rounded-xl p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m?.subjectScores ?? []} margin={{ left: -24, right: 4, top: 8 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="var(--analytic-axis)" />
                <YAxis tick={{ fontSize: 9 }} stroke="var(--analytic-axis)" domain={[0, 100]} />
                <Tooltip contentStyle={tip} />
                <Bar dataKey="score" name="Average" fill="var(--foreground)" barSize={6} radius={[6, 6, 6, 6]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">Subject averages</h3>
          <p className="text-xs text-muted-foreground">{m?.subjectScores.length ? "Average score per subject" : "No scores recorded yet"}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: "Parents", n: v(m, (x) => x.parents), p: m?.parentEngagement ?? 0, i: Users },
              { l: "Invoices", n: v(m, (x) => x.invoices), p: m?.fees.collectionRate ?? 0, i: Receipt },
              { l: "Approved", n: v(m, (x) => x.approved), p: m?.approvalRate ?? 0, i: ShieldCheck },
              { l: "Pending", n: v(m, (x) => x.submitted), p: m?.submissionRate ?? 0, i: ClipboardList },
            ].map((s) => (
              <div key={s.l}>
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary text-primary-foreground"><s.i className="h-3 w-3" /></span>{s.l}</p>
                <p className="mt-1 font-bold text-foreground">{s.n}</p>
                <div className="mt-1 h-1 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${s.p}%` }} /></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <PanelHead title="Records overview" sub="Everything registered in this school" />
          <RecordsTable m={m} />
        </Panel>
        <Panel className="lg:col-span-2">
          <PanelHead title="Money overview" sub="Billed, collected and spent" to="/fees" />
          <MoneyList m={m} />
        </Panel>
      </div>
    </div>
  );
}

function RecordsTable({ m }: { m?: DashboardMetrics }) {
  const rows = [
    { name: "Students", icon: GraduationCap, n: v(m, (x) => x.totalStudents), extra: v(m, (x) => `${x.pendingStudents} awaiting activation`), p: m ? 100 - Math.round((m.pendingStudents / Math.max(1, m.totalStudents + m.pendingStudents)) * 100) : 0, to: "/students" },
    { name: "Staff", icon: UserCog, n: v(m, (x) => x.staff), extra: "Admins, teachers, accountants", p: 100, to: "/users" },
    { name: "Classes", icon: Layers, n: v(m, (x) => x.classes), extra: v(m, (x) => `${x.subjects} subjects`), p: 100, to: "/classes" },
    { name: "Scores", icon: Award, n: v(m, (x) => x.assessments), extra: v(m, (x) => `${x.approved} approved, ${x.drafts} drafts`), p: m?.approvalRate ?? 0, to: "/results" },
    { name: "Report cards", icon: ClipboardList, n: v(m, (x) => x.reportsPublished), extra: "published", p: m?.reportsRate ?? 0, to: "/report-cards" },
    { name: "Parents", icon: UserCheck, n: v(m, (x) => x.parents), extra: v(m, (x) => `${x.linkedParents} using the portal`), p: m?.parentEngagement ?? 0, to: "/students" },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground"><th className="py-2">Record</th><th>Count</th><th className="hidden sm:table-cell">Details</th><th className="w-28">Completion</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-border/50 last:border-0">
              <td className="py-2.5"><Link to={r.to as any} className="flex items-center gap-2 font-medium text-foreground hover:underline"><r.icon className="h-4 w-4 text-primary" />{r.name}</Link></td>
              <td className="font-bold text-foreground">{r.n}</td>
              <td className="hidden text-xs text-muted-foreground sm:table-cell">{r.extra}</td>
              <td><div className="flex items-center gap-2"><span className="w-9 text-xs text-foreground">{r.p}%</span><div className="h-1 flex-1 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${r.p}%` }} /></div></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MoneyList({ m }: { m?: DashboardMetrics }) {
  const items = [
    { l: "Total billed", n: v(m, (x) => money(x.fees.billed)) },
    { l: "Collected", n: v(m, (x) => money(x.fees.collected)) },
    { l: "Outstanding", n: v(m, (x) => money(x.fees.outstanding)) },
    { l: "Discounts given", n: v(m, (x) => money(x.fees.discounts)) },
    { l: "Spent (last 12 months)", n: v(m, (x) => money(x.expenseTotal)) },
    { l: "Fully paid students", n: v(m, (x) => x.paidStudents) },
  ];
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.l} className="flex items-center gap-3">
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
          <span className="flex-1 text-sm text-muted-foreground">{i.l}</span>
          <span className="font-semibold text-foreground">{i.n}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Corelytics (dark) ---------------- */

function CoreStat({ label, value, note, icon: Icon, to }: { label: string; value: string | number; note: string; icon: any; to: string }) {
  return (
    <Panel>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <Link to={to as any} aria-label={`Open ${label}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground"><Icon className="h-4 w-4" /></Link>
      </div>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </Panel>
  );
}

export function CorelyticsDashboard({ m }: { m?: DashboardMetrics }) {
  const fee = m?.feeTrend ?? [];
  const att = m?.attendanceBreakdown ?? [];
  const cats = m?.expenseCategories ?? [];
  const peak = fee.reduce((best, d, i) => (d.a > (fee[best]?.a ?? -1) ? i : best), 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <CoreStat label="Fees collected" value={v(m, (x) => money(x.fees.collected))} note={m ? `${m.fees.collectionRate}% of ${money(m.fees.netPayable)} payable` : "—"} icon={Wallet} to="/fees" />
          <CoreStat label="Total expenses" value={v(m, (x) => money(x.expenseTotal))} note="Last 12 months" icon={Receipt} to="/fees" />
          <CoreStat label="Attendance rate" value={v(m, (x) => `${x.attendanceRate}%`)} note={m ? `${m.attendanceMarked} marks in 30 days` : "—"} icon={UserCheck} to="/attendance" />
          <CoreStat label="Average score" value={v(m, (x) => x.avgScore)} note={m ? `Pass rate ${m.passRate}% from ${m.assessments} scores` : "—"} icon={Award} to="/results" />
        </div>
        <Panel>
          <PanelHead title="Fees analytics" sub="Money collected per month (₦)" to="/fees" />
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fee} margin={{ left: -10, right: 4, top: 8 }}>
                <defs>
                  <pattern id="cStripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--muted)" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--border)" strokeWidth="3" /></pattern>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--analytic-axis)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--analytic-axis)" tickFormatter={(n) => money(n)} />
                <Tooltip contentStyle={tip} formatter={(n: any) => money(Number(n))} cursor={{ fill: "transparent" }} />
                <Bar dataKey="a" name="Collected" radius={[10, 10, 10, 10]}>
                  {fee.map((_, i) => <Cell key={i} fill={i === peak && fee[i]?.a ? C.a : "url(#cStripe)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHead title="Learning analysis" sub="Scores recorded and students admitted per month" to="/results" />
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <ul className="space-y-3 text-xs">
              {[
                { l: "passed", n: `${m?.passRate ?? 0}%`, c: C.a },
                { l: "approved", n: `${m?.approvalRate ?? 0}%`, c: C.b },
                { l: "published", n: `${m?.reportsRate ?? 0}%`, c: C.d },
              ].map((r) => (
                <li key={r.l} className="flex items-center gap-2"><span className="h-6 w-1 rounded" style={{ background: r.c }} /><span><b className="text-foreground">{r.n}</b> <span className="text-muted-foreground">{r.l}</span></span></li>
              ))}
            </ul>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={m?.trend ?? []} margin={{ left: -24, right: 4, top: 8 }}>
                  <CartesianGrid stroke="var(--analytic-grid)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--analytic-axis)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--analytic-axis)" allowDecimals={false} />
                  <Tooltip contentStyle={tip} />
                  <Line type="monotone" name="Scores" dataKey="a" stroke={C.a} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" name="Admitted" dataKey="b" stroke={C.b} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Expenses analytics" sub="Spending by category" to="/fees" />
          <div className="grid items-center gap-3 sm:grid-cols-[1fr_11rem_1fr]">
            <ul className="space-y-3 text-xs">
              <li className="text-[10px] uppercase tracking-wide text-muted-foreground">Attendance, 30 days</li>
              {att.map((a) => (
                <li key={a.name}><b className="block text-base text-foreground">{a.value}</b><span className="capitalize text-muted-foreground">{a.name}</span></li>
              ))}
            </ul>
            <div className="relative h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={cats.length ? cats : [{ name: "None", value: 1 }]} dataKey="value" innerRadius="62%" outerRadius="100%" paddingAngle={cats.length > 1 ? 4 : 0} cornerRadius={8} stroke="none">
                    {(cats.length ? cats : [{ name: "None" }]).map((_, i) => <Cell key={i} fill={cats.length ? PALETTE[i % PALETTE.length] : "var(--analytic-track)"} />)}
                  </Pie>
                  {cats.length > 0 && <Tooltip contentStyle={tip} formatter={(n: any) => money(Number(n))} />}
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground">{v(m, (x) => money(x.expenseTotal))}</div>
            </div>
            <ul className="space-y-2 text-xs">
              {cats.length === 0 && <li className="text-muted-foreground">No expenses recorded yet</li>}
              {cats.slice(0, 6).map((c, i) => (
                <li key={c.name} className="flex gap-2"><span className="h-7 w-1 rounded" style={{ background: PALETTE[i % PALETTE.length] }} /><span><span className="block text-muted-foreground">{c.name}</span><b className="text-foreground">{money(c.value)}</b></span></li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHead title="Records overview" sub="Everything registered in this school" />
        <RecordsTable m={m} />
      </Panel>
    </div>
  );
}
