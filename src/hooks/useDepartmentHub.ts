import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SCHOOL_TZ } from "@/lib/staff-attendance";
import { summarizeAttendance, type AttendanceSummary } from "@/lib/departments";

export interface HubSubmission { id: string; title: string; kind: string; status: string; date: string }
export interface HubEvent { id: string; title: string; kind: string; start: string; end: string }
export interface DepartmentHubData {
  school: { name: string; motto: string | null; logo_url: string | null; current_session: string | null; current_term: string | null } | null;
  students: number; boys: number; girls: number;
  staff: number | null;
  attendance: AttendanceSummary;
  pendingSubmissions: number;
  recentSubmissions: HubSubmission[];
  events: HubEvent[];
  today: string;
}

export function schoolToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SCHOOL_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000 || out.length >= 20000) break;
  }
  return out;
}

/** Real, school-scoped figures for the departmental dashboard. Nothing is sampled or invented. */
export function useDepartmentHub(schoolId: string | null | undefined, canSeeStaff: boolean) {
  return useQuery({
    queryKey: ["department-hub", schoolId, canSeeStaff],
    enabled: Boolean(schoolId),
    queryFn: async (): Promise<DepartmentHubData> => {
      const sid = schoolId!;
      const today = schoolToday();
      const [school, students, attendance, staff, notes, schemes, notesPending, schemesPending, events] = await Promise.all([
        supabase.from("schools").select("name, motto, logo_url, current_session, current_term").eq("id", sid).maybeSingle(),
        fetchAll<{ id: string; gender: string | null }>((f, t) => supabase.from("students").select("id, gender").eq("school_id", sid).eq("active", true).range(f, t)),
        fetchAll<{ student_id: string; status: string }>((f, t) => supabase.from("attendance").select("student_id, status").eq("school_id", sid).eq("date", today).range(f, t)),
        canSeeStaff
          ? supabase.from("staff_members").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("active", true)
          : Promise.resolve({ count: null, error: null }),
        supabase.from("lesson_notes").select("id, topic, status, created_at, updated_at").eq("school_id", sid).neq("status", "draft").order("updated_at", { ascending: false }).limit(5),
        supabase.from("scheme_items").select("id, topic, class_label, status, created_at").eq("school_id", sid).neq("status", "draft").order("created_at", { ascending: false }).limit(5),
        supabase.from("lesson_notes").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("status", "submitted"),
        supabase.from("scheme_items").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("status", "submitted"),
        supabase.from("staff_holidays").select("id, title, kind, start_date, end_date").eq("school_id", sid).gte("end_date", today).order("start_date").limit(4),
      ]);
      for (const r of [school, staff, notes, schemes, notesPending, schemesPending, events]) if (r.error) throw r.error;

      const gender = new Map(students.map((s) => [s.id, s.gender]));
      const recent: HubSubmission[] = [
        ...(notes.data ?? []).map((n) => ({ id: `n-${n.id}`, title: `Lesson note: ${n.topic}`, kind: "Academic", status: n.status, date: n.updated_at ?? n.created_at })),
        ...(schemes.data ?? []).map((s) => ({ id: `s-${s.id}`, title: `Scheme of work: ${s.topic}${s.class_label ? ` (${s.class_label})` : ""}`, kind: "Academic", status: s.status, date: s.created_at })),
      ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

      return {
        school: school.data ?? null,
        students: students.length,
        boys: students.filter((s) => s.gender === "male").length,
        girls: students.filter((s) => s.gender === "female").length,
        staff: canSeeStaff ? staff.count ?? 0 : null,
        attendance: summarizeAttendance(attendance, (id) => gender.get(id)),
        pendingSubmissions: (notesPending.count ?? 0) + (schemesPending.count ?? 0),
        recentSubmissions: recent,
        events: (events.data ?? []).map((e) => ({ id: e.id, title: e.title, kind: e.kind, start: e.start_date, end: e.end_date })),
        today,
      };
    },
  });
}
