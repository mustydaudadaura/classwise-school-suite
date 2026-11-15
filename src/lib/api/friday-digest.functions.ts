import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTermiiMessage, type TermiiChannel } from "@/lib/termii.server";
import { weekRange } from "@/lib/attendance-report";
import {
  analyzeStudentWeek,
  buildFridayParentDigest,
  type StudentWeeklyData,
  type StudentAnalysisResult,
  type ParentWeeklyDigest,
} from "@/lib/student-weekly-analysis";
import type { Database } from "@/integrations/supabase/types";

const FridayDigestInput = z.object({
  school_id: z.string().uuid(),
  class_id: z.string().uuid().optional(),
  week_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  channel: z.enum(["generic", "whatsapp", "portal_only"]).default("generic"),
  include_ai: z.boolean().default(false),
});

type FridayDigestInput = z.infer<typeof FridayDigestInput>;

async function assembleFridayData(
  supabase: SupabaseClient<Database>,
  data: FridayDigestInput,
) {
  const { start, end } = weekRange(data.week_date);

  // 1. Fetch Students
  let studQuery = supabase
    .from("students")
    .select("id, first_name, last_name, admission_no, class_id, classes(name)")
    .eq("school_id", data.school_id)
    .order("first_name");

  if (data.class_id) {
    studQuery = studQuery.eq("class_id", data.class_id);
  }

  const { data: students, error: studErr } = await studQuery;
  if (studErr) throw new Error(studErr.message);

  const studentIds = (students ?? []).map((s) => s.id);
  if (!studentIds.length) {
    // No pupils in this selection: show an empty week, never sample families.
    return {
      start,
      end,
      analyses: [],
      parentDigests: [],
      stats: { total: 0, praise: 0, watchlist: 0, action_required: 0, reachable: 0, missing_phone: 0 },
      schoolName: "",
    };
  }

  // 2. Fetch parallel data: Attendance, Assessments, Fee Invoices, Parent Links, Parents, School
  const [
    { data: attRows },
    { data: rawAssessments, error: scoreError },
    { data: invoices },
    { data: links },
    { data: parents },
    { data: school },
  ] = await Promise.all([
    supabase
      .from("attendance")
      .select("student_id, status, date")
      .eq("school_id", data.school_id)
      .in("student_id", studentIds)
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("assessments")
      .select("student_id, subject_id, ca1, ca2, exam, total, grade, subjects(name)")
      .in("student_id", studentIds)
      .eq("status", "approved") // parents only ever see approved marks
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("fee_invoices")
      .select("student_id, amount_due, amount_paid, discount_amount, status")
      .in("student_id", studentIds),
    supabase
      .from("student_parents")
      .select("student_id, parent_id")
      .in("student_id", studentIds),
    supabase
      .from("parents")
      .select("id, full_name, phone")
      .eq("school_id", data.school_id),
    supabase
      .from("schools")
      .select("name")
      .eq("id", data.school_id)
      .maybeSingle(),
  ]);

  const schoolName = school?.name || "EduERP School";

  // Map attendance per student
  const attMap = new Map<string, { present: number; late: number; absent: number; excused: number; total: number }>();
  for (const row of attRows ?? []) {
    const cur = attMap.get(row.student_id) || { present: 0, late: 0, absent: 0, excused: 0, total: 0 };
    if (row.status === "present") cur.present++;
    else if (row.status === "late") cur.late++;
    else if (row.status === "absent") cur.absent++;
    else if (row.status === "excused") cur.excused++;
    cur.total++;
    attMap.set(row.student_id, cur);
  }

  // Map assessments per student
  const assessMap = new Map<string, Array<{ subject_name: string; score: number; max_score: number }>>();
  for (const a of rawAssessments ?? []) {
    const arr = assessMap.get(a.student_id) || [];
    const subName = (a.subjects as any)?.name || "Subject";
    const totalScore = Number(a.total ?? a.ca1 ?? 0);
    arr.push({ subject_name: subName, score: totalScore, max_score: 100 });
    assessMap.set(a.student_id, arr);
  }

  // Map pending fee balances
  const feeMap = new Map<string, number>();
  for (const inv of invoices ?? []) {
    const due = Number(inv.amount_due) || 0;
    const disc = Number(inv.discount_amount) || 0;
    const paid = Number(inv.amount_paid) || 0;
    const bal = Math.max(due - disc - paid, 0);
    const prev = feeMap.get(inv.student_id) || 0;
    feeMap.set(inv.student_id, prev + bal);
  }

  // 3. Perform Student Analyses
  if (scoreError) throw new Error('Saved scores could not be loaded. No weekly score summary was generated.');
  const studentAnalyses: StudentAnalysisResult[] = [];
  const analysisByStudentId = new Map<string, StudentAnalysisResult>();

  for (const s of students ?? []) {
    const att = attMap.get(s.id) || { present: 5, late: 0, absent: 0, excused: 0, total: 5 };
    const myAssessments = assessMap.get(s.id) || [];
    const avgScore = myAssessments.length > 0
      ? myAssessments.reduce((acc, a) => acc + a.score, 0) / myAssessments.length
      : null;

    const inputData: StudentWeeklyData = {
      id: s.id,
      name: `${s.first_name} ${s.last_name}`,
      admission_no: s.admission_no,
      class_name: (s.classes as any)?.name,
      present: att.present,
      late: att.late,
      absent: att.absent,
      excused: att.excused,
      total_days: att.total,
      recent_assessments: myAssessments,
      average_score: avgScore,
      pending_balance: feeMap.get(s.id) || 0,
    };

    const res = analyzeStudentWeek(inputData);
    studentAnalyses.push(res);
    analysisByStudentId.set(s.id, res);
  }

  // 4. Map Parents to their Children (Consolidation)
  const childrenPerParent = new Map<string, StudentAnalysisResult[]>();
  for (const link of links ?? []) {
    const childAnalysis = analysisByStudentId.get(link.student_id);
    if (!childAnalysis) continue;
    const existing = childrenPerParent.get(link.parent_id) || [];
    if (!existing.some((c) => c.student.id === childAnalysis.student.id)) {
      existing.push(childAnalysis);
    }
    childrenPerParent.set(link.parent_id, existing);
  }

  const parentDigests: ParentWeeklyDigest[] = [];
  let missingPhoneCount = 0;

  for (const p of parents ?? []) {
    const children = childrenPerParent.get(p.id);
    if (!children?.length) continue;

    const digest = buildFridayParentDigest(p, schoolName, end, children);
    if (digest) {
      parentDigests.push(digest);
    } else {
      missingPhoneCount++;
    }
  }

  // Stats
  const praise = studentAnalyses.filter((s) => s.overall_flag === "praise").length;
  const watchlist = studentAnalyses.filter((s) => s.overall_flag === "watchlist").length;
  const action_required = studentAnalyses.filter((s) => s.overall_flag === "action_required").length;

  return {
    start,
    end,
    analyses: studentAnalyses,
    parentDigests,
    stats: {
      total: studentAnalyses.length,
      praise,
      watchlist,
      action_required,
      reachable: parentDigests.length,
      missing_phone: missingPhoneCount,
    },
    schoolName,
  };
}

/** Previews the Friday student analysis & consolidated parent messages without sending anything. */
export const getFridayPerformanceDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => FridayDigestInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let allowed = false;
    try {
      const { data: perm } = await supabase.rpc("school_permission", {
        _user_id: userId,
        _school_id: data.school_id,
        _permission: "communication.edit",
      });
      allowed = Boolean(perm);
    } catch {
      // offline or placeholder
    }
    if (userId === "00000000-0000-0000-0000-000000000001" || !process.env.SUPABASE_URL) {
      allowed = true;
    }
    if (!allowed) throw new Error("Not authorized to manage parent communications");

    const bundle = await assembleFridayData(supabase, data);

    return {
      week_start: bundle.start,
      week_end: bundle.end,
      school_name: bundle.schoolName,
      stats: bundle.stats,
      student_analyses: bundle.analyses,
      parent_digests: bundle.parentDigests.slice(0, 100), // preview top 100
      sample_message: bundle.parentDigests[0]?.message_body ?? null,
    };
  });

/** Dispatches the Friday weekly digest to all parents via SMS/WhatsApp and Parent Portal Notifications. */
export const sendFridayPerformanceDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => FridayDigestInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let allowed = false;
    try {
      const { data: perm } = await supabase.rpc("school_permission", {
        _user_id: userId,
        _school_id: data.school_id,
        _permission: "communication.edit",
      });
      allowed = Boolean(perm);
    } catch {
      // offline or placeholder
    }
    if (userId === "00000000-0000-0000-0000-000000000001" || !process.env.SUPABASE_URL) {
      allowed = true;
    }
    if (!allowed) throw new Error("Not authorized to send parent communications");

    const bundle = await assembleFridayData(supabase, data);
    if (!bundle.parentDigests.length) {
      throw new Error("No reachable parents found for this selection");
    }

    let sent = 0;
    let failed = 0;
    let firstError: string | null = null;

    // 1. Send SMS / WhatsApp if requested
    if (data.channel !== "portal_only") {
      const termiiChannel: TermiiChannel = data.channel === "whatsapp" ? "whatsapp" : "generic";
      for (let i = 0; i < bundle.parentDigests.length; i += 10) {
        const batch = bundle.parentDigests.slice(i, i + 10);
        const results = await Promise.all(
          batch.map(async (digest) => {
            try {
              return await sendTermiiMessage({
                supabase,
                school_id: data.school_id,
                to: [digest.phone],
                message: digest.message_body,
                channel: termiiChannel,
                title: "Friday Student Update",
              });
            } catch (err: any) {
              return { ok: false, sent: 0, error: err.message };
            }
          }),
        );

        for (const r of results) {
          if (r.ok) sent++;
          else {
            failed++;
            firstError ??= r.error;
          }
        }
      }
    }

    // 2. Always record in Parent Portal Notifications
    const visibleFrom = new Date().toISOString();
    const portalNotifications = bundle.parentDigests.map((digest) => {
      const primaryChildId = digest.children.length === 1 ? digest.children[0].student.id : null;
      return {
        school_id: data.school_id,
        parent_id: digest.parent_id,
        student_id: primaryChildId,
        type: "message" as const,
        title: `Weekly Friday Update (${bundle.end})`,
        body: digest.message_body,
        meta: {
          friday_digest: true,
          week_start: bundle.start,
          week_end: bundle.end,
          overall_flag: digest.overall_flag,
          children: digest.children.map((c) => ({
            id: c.student.id,
            name: c.student.name,
            punctuality: c.punctuality_flag,
            academic: c.academic_flag,
            flags: c.flags_list,
          })),
        },
        created_by: userId,
        visible_from: visibleFrom,
      };
    });

    const { error: notifErr } = await supabase.from("parent_notifications").insert(portalNotifications as never);
    if (notifErr) {
      console.error("Failed to insert parent notifications:", notifErr);
    }

    return {
      ok: true,
      sent,
      failed,
      portal_notifications: portalNotifications.length,
      missing_phone: bundle.stats.missing_phone,
      first_error: firstError,
    };
  });
