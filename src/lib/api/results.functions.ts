import { computePositions, resolveRanking } from "@/lib/position-ranking";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  calculateGrade,
  resolveSchoolAcademicConfig,
  getScaleForSection,
  computeCumulativeAverage,
  evaluatePromotion,
} from "@/lib/grading";

import {
  canAccessReportCardRecord,
  type HierarchyActor,
  type ClassScopeRow,
  type TeacherAllocationScopeRow,
} from "@/lib/hierarchical-rbac";

const PublishInput = z.object({
  class_id: z.string().uuid(),
  session: z.string().min(4).max(20),
  term: z.enum(["first", "second", "third"]),
  next_resumption_date: z.string().optional().nullable(),
  teacher_remark_default: z.string().max(500).optional(),
  principal_remark_default: z.string().max(500).optional(),
});

const ReportCardDetailInput = z.object({ id: z.string().min(1) });

async function resolveCallerHierarchyContext(context: {
  userId: string;
  claims?: any;
  supabase: any;
}): Promise<{
  actor: HierarchyActor;
  classes: ClassScopeRow[];
  allocations: TeacherAllocationScopeRow[];
}> {
  const { userId, claims, supabase: db } = context;
  const claimRoles: string[] = Array.isArray(claims?.app_metadata?.roles)
    ? claims.app_metadata.roles
    : claims?.role && claims.role !== "authenticated"
    ? [claims.role]
    : [];
  let roles = [...claimRoles];
  let schoolId: string | null = claims?.user_metadata?.school_id ?? null;
  let studentId: string | null = claims?.user_metadata?.student_id ?? null;
  let linkedStudentIds: string[] = Array.isArray(claims?.user_metadata?.linked_student_ids)
    ? claims.user_metadata.linked_student_ids
    : [];
  let classes: ClassScopeRow[] = [];
  let allocations: TeacherAllocationScopeRow[] = [];

  try {
    const [rolesRes, profileRes] = await Promise.all([
      db.from("user_roles").select("role, school_id").eq("user_id", userId).eq("active", true),
      db.from("profiles").select("school_id").eq("user_id", userId).maybeSingle(),
    ]);
    if (rolesRes.data?.length) {
      roles = Array.from(new Set([...roles, ...rolesRes.data.map((r: any) => r.role)]));
      const roleSchool = rolesRes.data.find((r: any) => r.school_id)?.school_id;
      if (roleSchool) schoolId = roleSchool;
    }
    if (profileRes.data?.school_id) {
      schoolId = profileRes.data.school_id;
    }

    if (schoolId && (roles.includes("teacher") || roles.includes("form_master") || roles.includes("school_admin"))) {
      const [clsRes, allocRes] = await Promise.all([
        db.from("classes").select("id, name, school_id, teacher_id").eq("school_id", schoolId).eq("active", true),
        db.from("teacher_allocations").select("id, school_id, teacher_id, class_id, subject_id, is_class_teacher").eq("school_id", schoolId).eq("teacher_id", userId),
      ]);
      classes = clsRes.data ?? [];
      allocations = allocRes.data ?? [];
    }

    if (roles.includes("student")) {
      const { data: st } = await db.from("students").select("id, school_id").eq("user_id", userId).eq("active", true).maybeSingle();
      if (st?.id) {
        studentId = st.id;
        if (!schoolId) schoolId = st.school_id;
      }
    }

    if (roles.includes("parent")) {
      const { data: parentRow } = await db.from("parents").select("id, school_id").eq("user_id", userId).maybeSingle();
      if (parentRow?.id) {
        if (!schoolId) schoolId = parentRow.school_id;
        const { data: links } = await db.from("student_parents").select("student_id").eq("parent_id", parentRow.id);
        linkedStudentIds = Array.from(new Set([...linkedStudentIds, ...(links ?? []).map((l: any) => l.student_id)]));
      }
    }
  } catch {
    // Offline fallback uses token claims
  }

  return {
    actor: {
      userId,
      roles,
      schoolId,
      studentId,
      linkedStudentIds,
    },
    classes,
    allocations,
  };
}

export const getReportCardsList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const { actor, classes: authClasses, allocations } = await resolveCallerHierarchyContext(context);
    let rows: any[] = [];
    try {
      const query = db.from("report_cards")
        .select("id, school_id, student_id, class_id, session, term, total_score, average, gpa, position, class_size, published, verification_code, created_at")
        .order("created_at", { ascending: false }).limit(500);

      const res = await query;
      if (res.data && res.data.length > 0) {
        rows = res.data;
      }
    } catch {
      // DB offline fallback
    }

    if (!rows.length) {
      const { ALL_DEMO_REPORT_CARDS } = await import("@/lib/demo-school-data");
      const demoClasses: ClassScopeRow[] = authClasses.length
        ? authClasses
        : Array.from(
            new Map(
              ALL_DEMO_REPORT_CARDS.map((r) => [
                r.class_id,
                { id: r.class_id, name: r.classes.name, school_id: r.school_id, teacher_id: null },
              ])
            ).values()
          );

      const authorizedDemoCards = ALL_DEMO_REPORT_CARDS.filter((r) => {
        if (!actor.roles.length) return false;
        // If demo admin/super_admin, enforce school/role rules
        if (actor.roles.includes("super_admin") || actor.roles.includes("school_admin")) {
          return canAccessReportCardRecord(
            { ...actor, schoolId: actor.schoolId ?? r.school_id },
            { id: r.id, school_id: r.school_id, student_id: r.student_id, class_id: r.class_id, published: r.published },
            demoClasses,
            allocations
          );
        }
        return canAccessReportCardRecord(
          actor,
          { id: r.id, school_id: r.school_id, student_id: r.student_id, class_id: r.class_id, published: r.published },
          demoClasses,
          allocations
        );
      });

      return {
        cards: authorizedDemoCards.map((r) => ({
          id: r.id,
          school_id: r.school_id,
          student_id: r.student_id,
          class_id: r.class_id,
          session: r.session,
          term: r.term,
          total_score: r.total_score,
          average: r.average,
          gpa: r.gpa,
          position: r.position,
          class_size: r.class_size,
          published: r.published,
          verification_code: r.verification_code,
          created_at: r.created_at,
          students: {
            id: r.students.id,
            first_name: r.students.first_name,
            last_name: r.students.last_name,
            admission_no: r.students.admission_no,
          },
          classes: {
            id: r.classes.id,
            name: r.classes.name,
            arm: r.classes.arm,
          },
        })),
      };
    }

    const authorizedRows = rows.filter((r: any) =>
      canAccessReportCardRecord(actor, r, authClasses, allocations)
    );

    const studentIds = Array.from(new Set(authorizedRows.map((r: any) => r.student_id).filter(Boolean)));
    const classIds = Array.from(new Set(authorizedRows.map((r: any) => r.class_id).filter(Boolean)));
    const [{ data: students }, { data: classes }] = await Promise.all([
      studentIds.length
        ? db.from("students").select("id, first_name, last_name, admission_no").in("id", studentIds)
        : Promise.resolve({ data: [] }),
      classIds.length
        ? db.from("classes").select("id, name, arm").in("id", classIds)
        : Promise.resolve({ data: [] }),
    ]);
    const studentMap = new Map((students ?? []).map((s: any) => [s.id, s]));
    const classMap = new Map((classes ?? []).map((c: any) => [c.id, c]));

    return {
      cards: authorizedRows.map((r: any) => ({
        ...r,
        students: studentMap.get(r.student_id) ?? null,
        classes: r.class_id ? classMap.get(r.class_id) ?? null : null,
      })),
    };
  });

export const getReportCardDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ReportCardDetailInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: db } = context;
    const { actor, classes: authClasses, allocations } = await resolveCallerHierarchyContext(context);
    let rc: any = null;
    try {
      const res = await db.from("report_cards").select("*").eq("id", data.id).maybeSingle();
      rc = res.data;
    } catch {
      // offline
    }

    if (!rc) {
      const { findDemoReportCard } = await import("@/lib/demo-school-data");
      const demo = findDemoReportCard(data.id);
      if (demo) {
        const effectiveActor =
          actor.roles.includes("super_admin") || actor.roles.includes("school_admin")
            ? { ...actor, schoolId: actor.schoolId ?? demo.school_id }
            : actor;
        const allowed = canAccessReportCardRecord(
          effectiveActor,
          {
            id: demo.id,
            school_id: demo.school_id,
            student_id: demo.student_id,
            class_id: demo.class_id,
            published: demo.published,
          },
          authClasses.length
            ? authClasses
            : [{ id: demo.class_id, name: demo.classes.name, school_id: demo.school_id, teacher_id: null }],
          allocations
        );
        if (!allowed) {
          throw new Error("Access Denied: You are not authorized to view this report card.");
        }
        return {
          rc: {
            ...demo,
            schools: demo.schools,
            students: demo.students,
            classes: demo.classes,
            annual_evaluation: {
              term1: demo.assessments[0]?.first_term_total || 55,
              term2: demo.assessments[0]?.second_term_total || 58,
              term3: demo.average,
              cumulativeAverage: demo.average,
              formula: "Equal Weight (33.3% × 3 Terms)",
              termsAvailable: 3,
              promotion: {
                promoted: demo.status_verdict.includes("PROMOTED"),
                status: demo.status_verdict,
                reason: "Satisfied cumulative academic benchmark and minimum core pass requirements",
              },
            },
          },
          assessments: demo.assessments,
        };
      }
      throw new Error("Report card not found");
    }

    if (!canAccessReportCardRecord(actor, rc, authClasses, allocations)) {
      throw new Error("Access Denied: You are not authorized to view this report card.");
    }

    const [{ data: school }, { data: student }, { data: klass }, { data: rawAssessments }, { data: termReports }] = await Promise.all([
      db.from("schools").select("name, motto, address, email, phone, logo_url, stamp_url, website, branch_name, principal_name, principal_signature_url, report_template, current_session, current_term").eq("id", (rc as any).school_id).maybeSingle(),
      db.from("students").select("first_name, middle_name, last_name, admission_no, gender, dob, photo_url, house, next_resumption_date").eq("id", (rc as any).student_id).maybeSingle(),
      (rc as any).class_id
        ? db.from("classes").select("name, arm, level, section").eq("id", (rc as any).class_id).maybeSingle()
        : Promise.resolve({ data: null }),
      db.from("assessments").select("id, subject_id, ca1, ca2, exam, total, grade, remark, created_at").eq("student_id", (rc as any).student_id).eq("session", (rc as any).session).eq("term", (rc as any).term).order("created_at"),
      db.from("report_cards").select("term, average, total_score, position").eq("student_id", (rc as any).student_id).eq("session", (rc as any).session),
    ]);

    const { data: subjectPositions, error: positionError } = await db.rpc("report_subject_positions", { _report_id: rc.id });
    if (positionError) throw new Error(positionError.message);
    const positionMap = new Map((subjectPositions ?? []).map(p => [p.subject_id, p.subject_position]));
    const subjectIds = Array.from(new Set((rawAssessments ?? []).map((a: any) => a.subject_id).filter(Boolean)));
    const { data: subjects } = subjectIds.length
      ? await db.from("subjects").select("id, name, code").in("id", subjectIds)
      : { data: [] };
    const subjectMap = new Map((subjects ?? []).map((s: any) => [s.id, { name: s.name, code: s.code }]));

    let annualEvaluation: any = null;
    if (termReports && termReports.length > 0) {
      const t1 = termReports.find((r: any) => r.term === "first")?.average;
      const t2 = termReports.find((r: any) => r.term === "second")?.average;
      const t3 = termReports.find((r: any) => r.term === "third")?.average;
      const academicConfig = resolveSchoolAcademicConfig(school?.report_template);
      const cum = computeCumulativeAverage(t1, t2, t3, academicConfig.promotionWeighting);

      const subs = (rawAssessments ?? []).map((a: any) => ({
        name: subjectMap.get(a.subject_id)?.name || "Subject",
        score: Number(a.total) || 0,
        grade: a.grade || "F9",
      }));

      const scaleType = getScaleForSection((klass as any)?.level || (klass as any)?.section || klass?.name);
      const isFinalClass = Boolean(
        klass?.name?.toLowerCase().includes("ss 3") ||
        klass?.name?.toLowerCase().includes("sss 3") ||
        klass?.name?.toLowerCase().includes("primary 6") ||
        klass?.name?.toLowerCase().includes("basic 6")
      );

      const promo = evaluatePromotion(
        {
          cumulativeAverage: cum.cumulativeAverage,
          subjects: subs,
          isFinalClass,
          scaleType,
        },
        {
          passMark: academicConfig.passMark,
          requireEnglish: academicConfig.requireEnglishAndMaths,
          requireMaths: academicConfig.requireEnglishAndMaths,
          weighting: academicConfig.promotionWeighting,
        }
      );

      annualEvaluation = {
        term1: t1 ?? null,
        term2: t2 ?? null,
        term3: t3 ?? null,
        cumulativeAverage: cum.cumulativeAverage,
        formula: cum.formula,
        termsAvailable: cum.termsAvailable,
        promotion: promo,
      };
    }

    return {
      rc: { ...(rc as any), schools: school, students: student, classes: klass, annual_evaluation: annualEvaluation },
      assessments: (rawAssessments ?? []).map((a: any) => ({ ...a, subject_position: positionMap.get(a.subject_id) ?? null, subjects: subjectMap.get(a.subject_id) ?? null })),
    };
  });

/**
 * Publish report cards for a whole class: aggregates assessments,
 * computes total, average, GPA, position, and upserts report_cards rows.
 * Sets published=true so parents/students can view & verify.
 */
export const publishReportCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PublishInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase: db } = context;

    // Verify the caller is staff on the class's school
    const { data: cls, error: clsErr } = await db
      .from("classes")
      .select("id, school_id, name, level, section")
      .eq("id", data.class_id)
      .maybeSingle();
    if (clsErr || !cls) throw new Error("Class not found");

    const [{ data: staffOk }, { data: school }] = await Promise.all([
      db.rpc("school_permission", {
        _user_id: userId,
        _school_id: cls.school_id,
        _permission: "results.publish",
      }),
      db.from("schools").select("report_template").eq("id", cls.school_id).maybeSingle(),
    ]);
    if (!staffOk) throw new Error("Not authorized for this school");

    const academicConfig = resolveSchoolAcademicConfig(school?.report_template);
    const scaleType = getScaleForSection((cls as any).level || (cls as any).section || cls.name);

    // Fetch students in the class
    const { data: students } = await db
      .from("students")
      .select("id")
      .eq("class_id", data.class_id);
    if (!students?.length) throw new Error("No students in this class");

    // Fetch all assessments for this class/session/term
    const { data: assess } = await db
      .from("assessments")
      .select("student_id, total, status")
      .eq("class_id", data.class_id)
      .eq("session", data.session)
      .eq("term", data.term);
    const pending = (assess ?? []).filter((a: any) => a.status !== "approved").length;
    if (pending) throw new Error(`${pending} result(s) in this class are not approved yet. Approve them before publishing.`);

    // Aggregate per student
    type Agg = { total: number; count: number };
    const agg = new Map<string, Agg>();
    for (const s of students) agg.set(s.id, { total: 0, count: 0 });
    (assess ?? []).forEach((a: any) => {
      const cur = agg.get(a.student_id) ?? { total: 0, count: 0 };
      cur.total += Number(a.total ?? 0);
      cur.count += 1;
      agg.set(a.student_id, cur);
    });

    // Build ranked array
    const ranked = Array.from(agg.entries())
      .map(([student_id, v]) => ({
        student_id,
        total_score: v.total,
        subjects_count: v.count,
        average: v.count > 0 ? +(v.total / v.count).toFixed(2) : 0,
      }))
      .sort((a, b) => b.total_score - a.total_score);

    const gradeToGpa = (avg: number) => calculateGrade(avg, scaleType).gpa;

    const classSize = ranked.length;
    const rankingConfig = resolveRanking(school?.report_template);
    const positions = computePositions(ranked, rankingConfig.method, rankingConfig.ranges);
    let written = 0;

    for (let i = 0; i < ranked.length; i++) {
      const r = ranked[i];
      const position = positions.get(r.student_id) ?? null;
      const payload = {
        school_id: cls.school_id,
        student_id: r.student_id,
        class_id: cls.id,
        session: data.session,
        term: data.term,
        total_score: r.total_score,
        average: r.average,
        gpa: gradeToGpa(r.average),
        subjects_count: r.subjects_count,
        position,
        class_size: classSize,
        next_resumption_date: data.next_resumption_date || null,
        teacher_remark: data.teacher_remark_default || null,
        principal_remark: data.principal_remark_default || null,
        published: true,
      };

      // Find existing
      const { data: existing } = await db
        .from("report_cards")
        .select("id")
        .eq("student_id", r.student_id)
        .eq("session", data.session)
        .eq("term", data.term)
        .maybeSingle();

      if (existing) {
        const { error } = await db.from("report_cards").update(payload).eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await db.from("report_cards").insert(payload);
        if (error) throw new Error(error.message);
      }
      written++;
    }

    return { ok: true, published: written, class_name: cls.name };
  });

const UpdateRemarksInput = z.object({
  report_card_id: z.string().uuid(),
  teacher_remark: z.string().max(1000).optional(),
  principal_remark: z.string().max(1000).optional(),
  psychomotor: z.record(z.string(), z.number().min(1).max(5)).optional(),
  affective: z.record(z.string(), z.number().min(1).max(5)).optional(),
  days_present: z.number().int().min(0).optional(),
  days_absent: z.number().int().min(0).optional(),
  days_total: z.number().int().min(0).optional(),
});

export const updateReportCardRemarks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateRemarksInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase: db } = context;
    const { data: rc } = await db
      .from("report_cards")
      .select("school_id")
      .eq("id", data.report_card_id)
      .maybeSingle();
    if (!rc) throw new Error("Report card not found");

    const { data: staffOk } = await db.rpc("school_permission", {
      _user_id: userId,
      _school_id: rc.school_id,
      _permission: "results.publish",
    });
    if (!staffOk) throw new Error("Not authorized");

    const update: Record<string, unknown> = {};
    for (const k of [
      "teacher_remark",
      "principal_remark",
      "psychomotor",
      "affective",
      "days_present",
      "days_absent",
      "days_total",
    ] as const) {
      if (data[k] !== undefined) update[k] = data[k];
    }
    if (Object.keys(update).length === 0) return { ok: true };
    const { error } = await db
      .from("report_cards")
      .update(update as never)
      .eq("id", data.report_card_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const RankingPreviewInput = z.object({
  class_id: z.string().uuid(),
  session: z.string().min(4).max(20),
  term: z.enum(["first", "second", "third"]),
});

/** Class totals/averages from saved assessments so admins can preview positions before publishing. */
export const previewClassRanking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RankingPreviewInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase: db } = context;
    const { data: cls, error: clsErr } = await db.from("classes").select("id, school_id, name, arm").eq("id", data.class_id).maybeSingle();
    if (clsErr || !cls) throw new Error("Class not found");
    const { data: ok } = await db.rpc("school_permission", { _user_id: userId, _school_id: cls.school_id, _permission: "results.view" });
    if (!ok) throw new Error("Not authorized for this school");
    const [{ data: students, error: sErr }, { data: assess, error: aErr }] = await Promise.all([
      db.from("students").select("id, first_name, last_name, admission_no").eq("class_id", data.class_id),
      db.from("assessments").select("student_id, total, status").eq("class_id", data.class_id).eq("session", data.session).eq("term", data.term),
    ]);
    if (sErr || aErr) throw new Error((sErr ?? aErr)!.message);
    const agg = new Map<string, { total: number; count: number }>();
    for (const s of students ?? []) agg.set(s.id, { total: 0, count: 0 });
    for (const a of assess ?? []) {
      const cur = agg.get(a.student_id) ?? { total: 0, count: 0 };
      cur.total += Number(a.total ?? 0);
      cur.count += 1;
      agg.set(a.student_id, cur);
    }
    const nameMap = new Map((students ?? []).map((s) => [s.id, s]));
    return {
      class_name: [cls.name, cls.arm].filter(Boolean).join(" "),
      pending: (assess ?? []).filter((a) => a.status !== "approved").length,
      rows: Array.from(agg.entries()).map(([student_id, v]) => {
        const s = nameMap.get(student_id);
        return {
          student_id,
          name: s ? `${s.first_name} ${s.last_name}` : "Student",
          admission_no: s?.admission_no ?? "",
          total_score: v.total,
          subjects_count: v.count,
          average: v.count > 0 ? +(v.total / v.count).toFixed(2) : 0,
        };
      }),
    };
  });

const RecipientsInput = z.object({ report_card_ids: z.array(z.string().uuid()).min(1).max(500) });

/** Each report card's own student's registered parent phone — never mixed between students. */
export const getReportRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RecipientsInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { actor, classes: authClasses, allocations } = await resolveCallerHierarchyContext(context);
    if (!actor.roles.some((r: string) => ["super_admin", "school_admin", "teacher", "form_master"].includes(r))) {
      throw new Error("Only school staff can send report cards");
    }
    const { data: cards, error } = await db.from("report_cards").select("id, school_id, student_id, class_id, published").in("id", data.report_card_ids);
    if (error) throw new Error(error.message);
    const allowed = (cards ?? []).filter((c: any) => canAccessReportCardRecord(actor, c, authClasses, allocations));
    const studentIds = Array.from(new Set(allowed.map((c) => c.student_id)));
    if (!studentIds.length) return { recipients: [] };
    const { data: links, error: lErr } = await db.from("student_parents").select("student_id, parent_id, is_primary").in("student_id", studentIds);
    if (lErr) throw new Error(lErr.message);
    const parentIds = Array.from(new Set((links ?? []).map((l) => l.parent_id)));
    const { data: parents, error: pErr } = parentIds.length
      ? await db.from("parents").select("id, full_name, phone, school_id").in("id", parentIds)
      : { data: [], error: null };
    if (pErr) throw new Error(pErr.message);
    const parentMap = new Map((parents ?? []).map((p) => [p.id, p]));
    const { data: deliveries } = await db.from("report_deliveries").select("report_card_id, status, phone, note, updated_at").in("report_card_id", allowed.map((c) => c.id));
    const deliveryMap = new Map((deliveries ?? []).map((d) => [d.report_card_id, d]));
    return {
      recipients: allowed.map((c) => {
        const candidates = (links ?? [])
          .filter((l) => l.student_id === c.student_id)
          .map((l) => ({ link: l, parent: parentMap.get(l.parent_id) }))
          .filter((x) => x.parent && x.parent.school_id === c.school_id)
          .sort((a, b) => Number(!!b.link.is_primary) - Number(!!a.link.is_primary) || Number(!!b.parent!.phone) - Number(!!a.parent!.phone));
        const chosen = candidates[0]?.parent ?? null;
        const d = deliveryMap.get(c.id);
        return {
          report_card_id: c.id,
          school_id: c.school_id,
          student_id: c.student_id,
          parent_id: chosen?.id ?? null,
          parent_name: chosen?.full_name ?? null,
          phone: chosen?.phone ?? null,
          status: (d?.status ?? null) as string | null,
          note: d?.note ?? null,
          updated_at: d?.updated_at ?? null,
        };
      }),
    };
  });
