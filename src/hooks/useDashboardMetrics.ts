import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeDashboardMetrics, type RawDashboardData } from "@/lib/dashboard-metrics";

type Scope = { schoolId?: string | null; teacherId?: string | null };

/** Reads every page (the backend returns at most 1000 rows per request). */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000 || out.length >= 20000) break;
  }
  return out;
}

export function useDashboardMetrics({ schoolId, teacherId }: Scope) {
  return useQuery({
    queryKey: ["dashboard-metrics", schoolId ?? "all", teacherId ?? "all"],
    queryFn: async () => {
      const sc = <Q extends { eq: (c: string, v: string) => Q }>(q: Q) => (schoolId ? q.eq("school_id", schoolId) : q);

      let classIds: string[] | null = null;
      if (teacherId) {
        const { data, error } = await sc(supabase.from("teacher_allocations").select("class_id").eq("teacher_id", teacherId) as any) as any;
        if (error) throw error;
        const { data: own, error: ownErr } = await sc(supabase.from("classes").select("id").eq("teacher_id", teacherId) as any) as any;
        if (ownErr) throw ownErr;
        // Subject allocations plus classes where this teacher is the form master.
        classIds = [...new Set([
          ...((data ?? []) as { class_id: string }[]).map((r) => r.class_id),
          ...((own ?? []) as { id: string }[]).map((r) => r.id),
        ])];
        if (!classIds.length) classIds = ["00000000-0000-0000-0000-000000000000"];
      }
      const cl = (q: any) => (classIds ? q.in("class_id", classIds) : q);
      const since = new Date(); since.setDate(since.getDate() - 30);
      const yearAgo = new Date(); yearAgo.setMonth(yearAgo.getMonth() - 12);

      const [students, classes, subjects, assessments, attendance, reportCards, invoices, payments, parents, scholarships] = await Promise.all([
        fetchAll<any>((f, t) => cl(sc(supabase.from("students").select("id, active, created_at") as any)).range(f, t)),
        classIds
          ? Promise.resolve({ count: classIds.length, error: null })
          : sc(supabase.from("classes").select("id", { count: "exact", head: true }).eq("active", true) as any),
        fetchAll<any>((f, t) => sc(supabase.from("subjects").select("id, name").eq("active", true) as any).range(f, t)),
        fetchAll<any>((f, t) => {
          let q = cl(sc(supabase.from("assessments").select("student_id, subject_id, total, status, created_at") as any));
          return q.range(f, t);
        }),
        fetchAll<any>((f, t) => cl(sc(supabase.from("attendance").select("status") as any)).gte("date", since.toISOString().slice(0, 10)).range(f, t)),
        fetchAll<any>((f, t) => cl(sc(supabase.from("report_cards").select("student_id, published") as any)).range(f, t)),
        teacherId ? Promise.resolve([]) : fetchAll<any>((f, t) => sc(supabase.from("fee_invoices").select("amount_due, amount_paid, discount_amount, status, student_id") as any).range(f, t)),
        teacherId ? Promise.resolve([]) : fetchAll<any>((f, t) => sc(supabase.from("fee_payments").select("amount, paid_at") as any).gte("paid_at", yearAgo.toISOString()).range(f, t)),
        teacherId ? Promise.resolve([]) : fetchAll<any>((f, t) => sc(supabase.from("parents").select("user_id") as any).range(f, t)),
        teacherId ? Promise.resolve({ count: 0, error: null }) : sc(supabase.from("student_scholarships").select("id", { count: "exact", head: true }).eq("status", "approved") as any),
      ]);
      if ((classes as any).error) throw (classes as any).error;

      const raw: RawDashboardData = {
        students, classes: (classes as any).count ?? 0, subjects, assessments, attendance, reportCards,
        invoices: invoices as any[], payments: payments as any[], parents: parents as any[],
        scholarships: (scholarships as any).count ?? 0,
      };
      return computeDashboardMetrics(raw);
    },
  });
}
