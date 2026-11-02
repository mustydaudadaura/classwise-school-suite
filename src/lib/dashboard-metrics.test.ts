import { describe, it, expect } from "./test-compat";
import { computeDashboardMetrics, pct, type RawDashboardData } from "./dashboard-metrics";

const base: RawDashboardData = {
  students: [], classes: 0, subjects: [], assessments: [], attendance: [], reportCards: [],
  invoices: [], payments: [], parents: [], scholarships: 0,
};

describe("dashboard metrics", () => {
  it("returns 0% instead of fake figures when no data exists", () => {
    const m = computeDashboardMetrics(base);
    expect(m.passRate).toBe(0);
    expect(m.attendanceRate).toBe(0);
    expect(m.totalStudents).toBe(0);
    expect(pct(1, 0)).toBe(0);
  });

  it("counts pass rate at 40 and averages real scores", () => {
    const now = new Date().toISOString();
    const m = computeDashboardMetrics({
      ...base,
      subjects: [{ id: "s", name: "Maths" }],
      assessments: [
        { student_id: "1", subject_id: "s", total: 80, status: "approved", created_at: now },
        { student_id: "2", subject_id: "s", total: 39, status: "submitted", created_at: now },
      ],
    });
    expect(m.passRate).toBe(50);
    expect(m.avgScore).toBe(60);
    expect(m.approvalRate).toBe(50);
    expect(m.subjectScores).toEqual([{ name: "Maths", score: 60 }]);
  });

  it("treats late as attended and computes fee collection from invoices", () => {
    const m = computeDashboardMetrics({
      ...base,
      attendance: [{ status: "present" }, { status: "late" }, { status: "absent" }, { status: "excused" }],
      invoices: [
        { amount_due: 100000, amount_paid: 50000, discount_amount: 0, status: "partial", student_id: "a" },
        { amount_due: 50000, amount_paid: 50000, discount_amount: 0, status: "paid", student_id: "b" },
      ],
    });
    expect(m.attendanceRate).toBe(50);
    expect(m.fees.collected).toBe(100000);
    expect(m.fees.outstanding).toBe(50000);
    expect(m.fees.collectionRate).toBe(67);
    expect(m.paidStudents).toBe(1);
  });
});
