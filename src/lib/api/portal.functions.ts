import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { invoiceOutstanding } from "@/lib/finance-math";

const TokenOnly = z.object({ token: z.string().min(10) });
const WithChild = z.object({ token: z.string().min(10), student_id: z.string().uuid().optional() });

async function verify(token: string, studentId?: string) {
  const { verifyParentToken } = await import("@/lib/parent-auth.server");
  const claims = verifyParentToken(token);
  if (studentId) await requireActiveChild(claims, studentId);
  return claims;
}
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireActiveChild(claims: { parent_id: string; school_id: string }, studentId: string) {
  const db = await admin();
  const [link, student] = await Promise.all([
    db.from("student_parents").select("id").eq("parent_id", claims.parent_id).eq("student_id", studentId).maybeSingle(),
    db.from("students").select("id").eq("id", studentId).eq("school_id", claims.school_id).eq("active", true).eq("pending_activation", false).maybeSingle(),
  ]);
  if (link.error || student.error) throw new Error("Student access could not be verified");
  if (!link.data || !student.data) throw new Error("Student access is unavailable until the school administrator activates the admission");
}

/** List parent's children + school. */
export const getPortalContext = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenOnly.parse(d))
  .handler(async ({ data }) => {
    const claims = await verify(data.token);
      const db = await admin();
      const [parentResult, schoolResult, linksResult] = await Promise.all([
        db.from("parents").select("id, full_name, phone, email").eq("id", claims.parent_id).maybeSingle(),
        db.from("schools").select("id, name, logo_url, code, phone, address, motto, current_session, current_term, branch_name").eq("id", claims.school_id).maybeSingle(),
        db.from("student_parents").select("is_primary, students!inner(id, admission_no, first_name, last_name, photo_url, classes(name))").eq("parent_id", claims.parent_id).eq("students.school_id", claims.school_id).eq("students.active", true).eq("students.pending_activation", false),
      ]);
      if (parentResult.error || schoolResult.error || linksResult.error) throw new Error("Family details could not be loaded");
      if (!parentResult.data || !schoolResult.data) throw new Error("Family account not found");
      const students = (linksResult.data ?? []).map((l: any) => l.students).filter(Boolean);
      return { parent: parentResult.data, school: schoolResult.data, students };
  });

export const getPortalSummary = createServerFn({ method: "POST" })
  .inputValidator((d) => WithChild.parse(d))
  .handler(async ({ data }) => {
    const claims = await verify(data.token, data.student_id);
    const sid = data.student_id;
    if (!sid) return { attendance: { present: 0, total: 0 }, balance: 0, unreadCount: 0, latestReport: null };

    const db = await admin();
    const { data: ok, error: linkError } = await db.from("student_parents").select("student_id").eq("parent_id", claims.parent_id).eq("student_id", sid).maybeSingle();
    if (linkError) throw new Error("Family details could not be loaded");
    if (!ok) throw new Error("Student access is unavailable");
    const since = new Date(); since.setDate(since.getDate() - 30);
    const [att, invs, notifs, rc] = await Promise.all([
      db.from("attendance").select("status").eq("student_id", sid).gte("date", since.toISOString().slice(0, 10)),
      db.from("fee_invoices").select("amount_due, amount_paid, discount_amount, status").eq("student_id", sid),
      db.from("parent_notifications").select("id", { count: "exact", head: true }).eq("parent_id", claims.parent_id).is("read_at", null).lte("visible_from", new Date().toISOString()),
      db.from("report_cards").select("id, session, term, average, position, class_size, published").eq("student_id", sid).eq("published", true).order("created_at", { ascending: false }).limit(1),
    ]);
    if (att.error || invs.error || notifs.error || rc.error) throw new Error("Family summary could not be loaded. Please try again.");
    const present = (att.data ?? []).filter((a: any) => a.status === "present" || a.status === "late").length;
    const total = (att.data ?? []).length;
    const balance = (invs.data ?? []).reduce((s: number, i: any) => s + Math.max(0, invoiceOutstanding(i)), 0);
    return {
      attendance: { present, total },
      balance,
      unreadCount: notifs.count ?? 0,
      latestReport: rc.data?.[0] ?? null,
    };
  });

export const getPortalAttendance = createServerFn({ method: "POST" })
  .inputValidator((d) => WithChild.extend({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data }) => {
    if (!data.student_id) throw new Error("Choose an activated student");
    const claims = await verify(data.token, data.student_id);
    const db = await admin();
    const { data: rows, error } = await db.from("attendance").select("date, status, note").eq("student_id", data.student_id).gte("date", data.from).lte("date", data.to).order("date", { ascending: false });
    if (error) throw new Error("Attendance could not be loaded. Please try again.");
    return { rows: rows ?? [] };
  });

export const getPortalReportCards = createServerFn({ method: "POST" })
  .inputValidator((d) => WithChild.parse(d))
  .handler(async ({ data }) => {
    if (!data.student_id) return { rows: [] };
    const claims = await verify(data.token, data.student_id);
    const db = await admin();
    const { data: rows, error } = await db.from("report_cards").select("id, session, term, average, total_score, position, class_size, gpa, published, verification_code").eq("student_id", data.student_id).eq("published", true).order("created_at", { ascending: false });
    if (error) throw new Error('Report cards could not be loaded. Please try again.');
    return { rows: rows ?? [] };
  });

export const getPortalReportCardDetail = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenOnly.extend({ id: z.string().uuid(), pin: z.string().max(40).optional() }).parse(d))
  .handler(async ({ data }) => {
    const claims = await verify(data.token);
    const db = await admin();
    const { data: rc, error } = await db.from("report_cards").select("*").eq("id", data.id).eq("published", true).maybeSingle();
    if (error || !rc) throw new Error("Report card not found");
    await requireActiveChild(claims, rc.student_id);
    if (rc.school_id !== claims.school_id) throw new Error("Report card not found");

    // Scratch-card access: each successful view uses one view on the card.
    let access: { remaining: number; valid_until: string; serial_no: string } | null = null;
    const { data: rules } = await db.from("scratch_card_settings").select("access_mode, price, max_views, validity_days").eq("school_id", rc.school_id).maybeSingle();
    if (rules?.access_mode === "scratch") {
      const { normalizePin, hashPin, REDEEM_MESSAGES } = await import("@/lib/scratch-cards");
      const pin = normalizePin(data.pin ?? "");
      if (!pin) return { locked: true as const, rules: { price: Number(rules.price), max_views: rules.max_views, validity_days: rules.validity_days } };
      if (pin.length !== 12) throw new Error(REDEEM_MESSAGES.invalid);
      const { data: result, error: rErr } = await db.rpc("redeem_scratch_card", {
        _school_id: rc.school_id, _pin_hash: await hashPin(rc.school_id, pin), _student_id: rc.student_id, _report_card_id: rc.id, _parent_id: claims.parent_id,
      });
      if (rErr) throw new Error("Scratch card could not be checked. Please try again.");
      const res = result as { ok: boolean; reason?: string; remaining?: number; valid_until?: string; serial_no?: string };
      if (!res.ok) throw new Error(REDEEM_MESSAGES[res.reason ?? "invalid"] ?? REDEEM_MESSAGES.invalid);
      access = { remaining: res.remaining ?? 0, valid_until: res.valid_until ?? "", serial_no: res.serial_no ?? "" };
    }

    const [{ data: school }, { data: student }, { data: klass }, { data: rawAssessments, error: scoreError }] = await Promise.all([
      db.from("schools").select("name, motto, address, email, phone, logo_url, stamp_url, website, branch_name, principal_name, principal_signature_url, report_template, current_session, current_term").eq("id", (rc as any).school_id).maybeSingle(),
      db.from("students").select("first_name, middle_name, last_name, admission_no, gender, dob, photo_url, house, next_resumption_date").eq("id", (rc as any).student_id).maybeSingle(),
      (rc as any).class_id
        ? db.from("classes").select("name, arm, level, section").eq("id", (rc as any).class_id).maybeSingle()
        : Promise.resolve({ data: null }),
      db.from("assessments").select("id, subject_id, ca1, ca2, exam, total, grade, remark, created_at").eq("student_id", (rc as any).student_id).eq("session", (rc as any).session).eq("term", (rc as any).term).order("created_at"),
    ]);

    if (scoreError) throw new Error('Report scores could not be loaded. Please try again.');

    const subjectIds = Array.from(new Set((rawAssessments ?? []).map((a: any) => a.subject_id).filter(Boolean)));
    const { data: subjects } = subjectIds.length
      ? await db.from("subjects").select("id, name, code").in("id", subjectIds)
      : { data: [] };
    const subjectMap = new Map((subjects ?? []).map((s: any) => [s.id, { name: s.name, code: s.code }]));

    let positionMap = new Map<string, number>();
    try {
      const { data: subjectPositions } = await db.rpc("report_subject_positions", { _report_id: rc.id });
      if (subjectPositions) {
        positionMap = new Map(subjectPositions.map((p: any) => [p.subject_id, p.subject_position]));
      }
    } catch {
      // ignore
    }

    const assessments = (rawAssessments ?? []).map((a: any) => ({
      ...a,
      subject_position: positionMap.get(a.subject_id) ?? null,
      subjects: subjectMap.get(a.subject_id) ?? null,
    }));

    return {
      locked: false as const,
      access,
      rc: { ...(rc as any), schools: school, students: student, classes: klass },
      assessments,
    };
  });

export const getPortalFees = createServerFn({ method: "POST" })
  .inputValidator((d) => WithChild.parse(d))
  .handler(async ({ data }) => {
    if (!data.student_id) throw new Error("Choose an activated student");
    const claims = await verify(data.token, data.student_id);
    const db = await admin();
    const [inv, pay, stu, sch] = await Promise.all([
      db.from("fee_invoices").select("id, title, session, term, amount_due, amount_paid, discount_amount, discount_reason, discount_kind, status, due_date").eq("student_id", data.student_id).order("created_at", { ascending: false }),
      db.from("fee_payments").select("id, invoice_id, amount, method, reference, paid_at, receipt_no, notes").eq("student_id", data.student_id).order("paid_at", { ascending: false }),
      db.from("students").select("id, first_name, middle_name, last_name, admission_no, classes(name)").eq("id", data.student_id).maybeSingle(),
      db.from("schools").select("id, name, address, phone, email, logo_url, motto, branch_name").eq("id", claims.school_id).maybeSingle(),
    ]);
    if (inv.error || pay.error || stu.error || sch.error) throw new Error("Fees could not be loaded. Please try again.");
    return { invoices: inv.data ?? [], payments: pay.data ?? [], student: stu.data, school: sch.data };
  });

export const getPortalNotifications = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenOnly.parse(d))
  .handler(async ({ data }) => {
    const claims = await verify(data.token);
    const db = await admin();
    const { data: rows, error } = await db.from("parent_notifications").select("id, type, title, body, meta, read_at, created_at, visible_from, student_id").eq("parent_id", claims.parent_id).lte("visible_from", new Date().toISOString()).order("visible_from", { ascending: false }).limit(100);
    if (error) throw new Error("Messages could not be loaded. Please try again.");
    return { rows: rows ?? [] };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenOnly.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const claims = await verify(data.token);
    const db = await admin();
    const { error } = await db.from("parent_notifications").update({ read_at: new Date().toISOString() }).eq("id", data.id).eq("parent_id", claims.parent_id);
    if (error) throw new Error("Message could not be updated");
    return { ok: true };
  });

export const getReceipt = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenOnly.extend({ payment_id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const claims = await verify(data.token);
    const receiptDb = await admin();
    const payment = await receiptDb.from("fee_payments").select("student_id").eq("id", data.payment_id).maybeSingle();
    if (payment.error || !payment.data) throw new Error("Receipt not found");
    await requireActiveChild(claims, payment.data.student_id);
    const { data: p, error: pErr } = await receiptDb.from("fee_payments").select("id, amount, method, reference, paid_at, receipt_no, invoice_id, student_id, school_id, notes").eq("id", data.payment_id).maybeSingle();
    if (pErr || !p) throw new Error("Receipt not found");
    const [inv, stu, sch] = await Promise.all([
      receiptDb.from("fee_invoices").select("id, title, session, term, amount_due, amount_paid, discount_amount, discount_reason, discount_kind, status, due_date").eq("id", p.invoice_id).maybeSingle(),
      receiptDb.from("students").select("first_name, middle_name, last_name, admission_no, classes(name)").eq("id", p.student_id).maybeSingle(),
      receiptDb.from("schools").select("name, address, phone, email, logo_url, motto, branch_name").eq("id", p.school_id).maybeSingle(),
    ]);
    if (inv.error || stu.error || sch.error) throw new Error("Receipt could not be loaded. Please try again.");
    return { payment: p, invoice: inv.data, student: stu.data, school: sch.data };
  });

export const getParentPreferences = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenOnly.parse(d))
  .handler(async ({ data }) => {
    return { muted_types: [] };
  });

export const saveParentPreferences = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenOnly.extend({ muted_types: z.array(z.enum(["news", "general"])).max(2) }).parse(d))
  .handler(async ({ data }) => {
    return { ok: true };
  });

/** Report access rules shown to parents before they buy or use a scratch card. */
export const getPortalAccessRules = createServerFn({ method: "POST" })
  .inputValidator((d) => TokenOnly.parse(d))
  .handler(async ({ data }) => {
    const claims = await verify(data.token);
    const db = await admin();
    const { data: rules } = await db.from("scratch_card_settings").select("access_mode, price, max_views, validity_days").eq("school_id", claims.school_id).maybeSingle();
    return rules?.access_mode === "scratch"
      ? { mode: "scratch" as const, price: Number(rules.price), max_views: rules.max_views, validity_days: rules.validity_days }
      : { mode: "free" as const };
  });
