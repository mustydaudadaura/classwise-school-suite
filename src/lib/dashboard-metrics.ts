import { calculateCollectionTotals } from "./finance-math";

/** Whole-number percentage; returns 0 when there is nothing to measure. */
export function pct(part: number, whole: number): number {
  if (!whole || whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

export const PASS_MARK = 40;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface RawDashboardData {
  students: { id: string; active: boolean | null; created_at: string }[];
  classes: number;
  subjects: { id: string; name: string }[];
  assessments: { student_id: string; subject_id: string; total: number | string | null; status: string; created_at: string }[];
  attendance: { status: string }[];
  reportCards: { student_id: string; published: boolean | null }[];
  invoices: { amount_due: number | string; amount_paid: number | string; discount_amount?: number | string | null; status: string; student_id: string }[];
  payments: { amount: number | string; paid_at: string }[];
  parents: { user_id: string | null }[];
  scholarships: number;
  /** Optional extras so every registered record shows on the dashboard. */
  staff?: number;
  expenses?: { amount: number | string; category: string; spent_on: string }[];
}

/** Last 12 calendar months ending at `now`, oldest first. */
export function monthBuckets(now: Date) {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, name: MONTHS[d.getMonth()] };
  });
}

function bucketKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export function computeDashboardMetrics(raw: RawDashboardData, now = new Date()) {
  const activeStudents = raw.students.filter((s) => s.active !== false);
  const scored = raw.assessments.filter((a) => a.total !== null && a.total !== "" && !Number.isNaN(Number(a.total)));
  const passed = scored.filter((a) => Number(a.total) >= PASS_MARK).length;
  const avgScore = scored.length ? Math.round(scored.reduce((s, a) => s + Number(a.total), 0) / scored.length) : 0;
  const approved = raw.assessments.filter((a) => a.status === "approved").length;
  const submitted = raw.assessments.filter((a) => a.status === "submitted").length;
  const drafts = raw.assessments.filter((a) => a.status === "draft").length;

  const present = raw.attendance.filter((a) => a.status === "present" || a.status === "late").length;
  const fees = calculateCollectionTotals(raw.invoices);
  const paidStudents = new Set(raw.invoices.filter((i) => i.status === "paid").map((i) => i.student_id)).size;
  const overdue = raw.invoices.filter((i) => i.status === "overdue").length;

  const published = raw.reportCards.filter((r) => r.published).length;
  const linkedParents = raw.parents.filter((p) => p.user_id).length;

  const buckets = monthBuckets(now);
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  const trend = buckets.map((b) => ({ name: b.name, a: 0, b: 0 }));
  const feeTrend = buckets.map((b) => ({ name: b.name, a: 0, b: 0 }));
  for (const s of raw.students) { const i = idx.get(bucketKey(s.created_at)); if (i !== undefined) trend[i].b += 1; }
  for (const a of raw.assessments) { const i = idx.get(bucketKey(a.created_at)); if (i !== undefined) trend[i].a += 1; }
  for (const p of raw.payments) { const i = idx.get(bucketKey(p.paid_at)); if (i !== undefined) feeTrend[i].a += Number(p.amount) || 0; }

  const expenses = raw.expenses ?? [];
  const expenseTotal = expenses.reduce((t, e) => t + (Number(e.amount) || 0), 0);
  const byCat = new Map<string, number>();
  for (const e of expenses) {
    const c = (e.category || "Other").trim() || "Other";
    byCat.set(c, (byCat.get(c) ?? 0) + (Number(e.amount) || 0));
    const i = idx.get(bucketKey(e.spent_on)); if (i !== undefined) feeTrend[i].b += Number(e.amount) || 0;
  }
  const expenseCategories = [...byCat.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const attendanceBreakdown = (["present", "late", "absent", "excused"] as const).map((k) => ({
    name: k, value: raw.attendance.filter((a) => a.status === k).length,
  }));

  const names = new Map(raw.subjects.map((s) => [s.id, s.name]));
  const bySubject = new Map<string, { sum: number; n: number }>();
  for (const a of scored) {
    const cur = bySubject.get(a.subject_id) ?? { sum: 0, n: 0 };
    cur.sum += Number(a.total); cur.n += 1;
    bySubject.set(a.subject_id, cur);
  }
  const subjectScores = [...bySubject.entries()]
    .map(([id, v]) => ({ name: (names.get(id) ?? "Subject").slice(0, 10), score: Math.round(v.sum / v.n) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 8);

  return {
    totalStudents: activeStudents.length,
    pendingStudents: raw.students.length - activeStudents.length,
    classes: raw.classes,
    subjects: raw.subjects.length,
    assessments: raw.assessments.length,
    approved, submitted, drafts,
    approvalRate: pct(approved, raw.assessments.length),
    gradedRate: pct(scored.length, raw.assessments.length),
    submissionRate: pct(approved + submitted, raw.assessments.length),
    passRate: pct(passed, scored.length),
    avgScore,
    attendanceRate: pct(present, raw.attendance.length),
    attendanceMarked: raw.attendance.length,
    fees,
    invoices: raw.invoices.length,
    paidStudents,
    overdueRate: pct(overdue, raw.invoices.length),
    scholarshipRate: pct(raw.scholarships, activeStudents.length),
    reportsPublished: published,
    reportsRate: pct(published, raw.reportCards.length),
    parents: raw.parents.length,
    linkedParents,
    parentEngagement: pct(linkedParents, raw.parents.length),
    trend,
    feeTrend,
    subjectScores,
    staff: raw.staff ?? 0,
    expenseTotal,
    expenseCategories,
    attendanceBreakdown,
  };
}

export type DashboardMetrics = ReturnType<typeof computeDashboardMetrics>;
