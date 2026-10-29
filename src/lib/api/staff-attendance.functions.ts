import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  SCHOOL_TZ_OFFSET, arrival, departure, eachDate, evaluateRange, haversineMeters, localParts,
  normaliseSettings, penaltiesForDay, checkSites, evaluateDay, type AttSettings, type Site,
} from "@/lib/staff-attendance";
import { canMoveTo, computePay, type PayrollStatus } from "@/lib/payroll-calc";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };
const DENIED = "Attendance action denied. You are outside the approved school location.";

async function can(ctx: Ctx, school_id: string, permission: string) {
  const { data } = await ctx.supabase.rpc("school_permission", { _user_id: ctx.userId, _school_id: school_id, _permission: permission });
  return Boolean(data);
}
async function must(ctx: Ctx, school_id: string, permission: string) {
  if (!(await can(ctx, school_id, permission))) throw new Error("You are not authorized for this action");
}
async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}
async function loadSettings(db: SupabaseClient<Database>, school_id: string): Promise<AttSettings> {
  const { data } = await db.from("attendance_settings").select("*").eq("school_id", school_id).maybeSingle();
  return normaliseSettings(data as never);
}
async function loadSites(db: SupabaseClient<Database>, school_id: string, s: AttSettings): Promise<Site[]> {
  const { data } = await db.from("attendance_sites").select("name,latitude,longitude,radius_m").eq("school_id", school_id).eq("active", true);
  if (data?.length) return data as Site[];
  return s.latitude != null && s.longitude != null ? [{ name: "School", latitude: s.latitude, longitude: s.longitude, radius_m: s.radius_m }] : [];
}
async function sha(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const pinHash = (school_id: string, pin: string) => sha(`eduerp-kiosk:${school_id}:${pin}`);

type Geo = { lat?: number | null; lng?: number | null; accuracy?: number | null };
const GeoSchema = { lat: z.number().min(-90).max(90).nullable().optional(), lng: z.number().min(-180).max(180).nullable().optional(), accuracy: z.number().min(0).max(100000).nullable().optional() };

/** Core punch logic shared by phone and kiosk. Server clock, server-side GPS check, one row per day. */
async function punch(school_id: string, user_id: string, action: "in" | "out", method: "phone" | "kiosk", geo: Geo, device_user_id: string) {
  const db = await admin();
  const s = await loadSettings(db, school_id);
  const now = new Date();
  const { date, minutes } = localParts(now);
  const needGps = method === "phone" ? s.gps_phone : s.gps_kiosk;
  let distance: number | null = null, verified: boolean | null = null;
  const log = (result: string) => db.from("attendance_attempts").insert({
    school_id, user_id, device_user_id, action, method, result, lat: geo.lat ?? null, lng: geo.lng ?? null, accuracy: geo.accuracy ?? null, distance_m: distance,
  });
  const sites = await loadSites(db, school_id, s);
  const hit = geo.lat != null && geo.lng != null ? checkSites({ lat: geo.lat, lng: geo.lng }, sites) : null;
  if (hit) { distance = hit.distance; verified = hit.inside; }
  if (needGps) {
    if (!sites.length) { await log("no_school_location"); throw new Error("The school location has not been set yet. Ask the administrator to add a site in Attendance settings."); }
    if (geo.lat == null || geo.lng == null) { await log("no_gps"); throw new Error("Location is required. Turn on location (GPS) and allow this site to use it, then try again."); }
    if (!verified) { await log("outside"); throw new Error(`${DENIED} (about ${distance} m from ${hit!.site.name}; allowed ${hit!.site.radius_m} m)`); }
  }
  const { data: existing } = await db.from("staff_attendance").select("*").eq("school_id", school_id).eq("user_id", user_id).eq("date", date).maybeSingle();
  const g = { lat: geo.lat ?? null, lng: geo.lng ?? null, accuracy: geo.accuracy ?? null, distance_m: distance, verified, method };
  if (action === "in") {
    if (existing?.check_in_at) { await log("duplicate"); return { ok: true, already: true, time: existing.check_in_at, action }; }
    const a = arrival(minutes, s);
    const row = { school_id, user_id, date, check_in_at: now.toISOString(), in_lat: g.lat, in_lng: g.lng, in_accuracy: g.accuracy, in_distance_m: g.distance_m, in_verified: g.verified, in_method: method, status: a.late ? "late" : "present", late_minutes: a.lateMinutes };
    const { error } = await db.from("staff_attendance").insert(row);
    if (error) {
      if (error.code === "23505") { // network retry / double tap
        const { data: again } = await db.from("staff_attendance").select("check_in_at").eq("school_id", school_id).eq("user_id", user_id).eq("date", date).single();
        return { ok: true, already: true, time: again?.check_in_at ?? now.toISOString(), action };
      }
      throw new Error(error.message);
    }
    await log("ok");
    return { ok: true, already: false, time: row.check_in_at, action, late: a.late, lateMinutes: a.lateMinutes };
  }
  if (!existing?.check_in_at) { await log("not_checked_in"); throw new Error("You have not checked in today, so you cannot check out."); }
  if (existing.check_out_at) { await log("duplicate"); return { ok: true, already: true, time: existing.check_out_at, action }; }
  const d = departure(minutes, s);
  const worked = Math.max(0, Math.round((now.getTime() - new Date(existing.check_in_at).getTime()) / 60000));
  const { error } = await db.from("staff_attendance").update({
    check_out_at: now.toISOString(), out_lat: g.lat, out_lng: g.lng, out_accuracy: g.accuracy, out_distance_m: g.distance_m, out_verified: g.verified, out_method: method,
    early_minutes: d.early ? d.earlyMinutes : 0, worked_minutes: worked, updated_at: now.toISOString(),
  }).eq("id", existing.id).is("check_out_at", null);
  if (error) throw new Error(error.message);
  await log("ok");
  return { ok: true, already: false, time: now.toISOString(), action, early: d.early, workedMinutes: worked };
}

export const myAttendanceToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ school_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { date } = localParts(new Date());
    const [{ data: rec }, { data: profile }, { data: prof }, s] = await Promise.all([
      context.supabase.from("staff_attendance").select("check_in_at,check_out_at,status,late_minutes,worked_minutes").eq("school_id", data.school_id).eq("user_id", context.userId).eq("date", date).maybeSingle(),
      context.supabase.from("profiles").select("full_name,avatar_url").eq("user_id", context.userId).maybeSingle(),
      context.supabase.from("staff_profiles").select("staff_no,department,photo_url,active").eq("school_id", data.school_id).eq("user_id", context.userId).maybeSingle(),
      loadSettings(context.supabase, data.school_id),
    ]);
    return { date, record: rec, name: profile?.full_name ?? "Staff", photo: prof?.photo_url ?? profile?.avatar_url ?? null, staff_no: prof?.staff_no ?? null, gps_required: s.gps_phone, report_time: s.report_time, closing_time: s.closing_time };
  });

export const staffPunch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ school_id: z.string().uuid(), action: z.enum(["in", "out"]), ...GeoSchema }))
  .handler(async ({ data, context }) => {
    const { data: staff } = await context.supabase.rpc("is_school_staff", { _user_id: context.userId, _school_id: data.school_id });
    if (!staff) throw new Error("Only staff of this school can record staff attendance");
    const { data: sp } = await context.supabase.from("staff_profiles").select("active").eq("school_id", data.school_id).eq("user_id", context.userId).maybeSingle();
    if (sp && !sp.active) throw new Error("Your staff record is inactive. Contact the administrator.");
    return punch(data.school_id, context.userId, data.action, "phone", data, context.userId);
  });

async function kioskStaff(ctx: Ctx, school_id: string, pin: string) {
  if (!(await can(ctx, school_id, "staffatt.kiosk")) && !(await can(ctx, school_id, "staffatt.edit"))) throw new Error("This device is not authorized as an attendance kiosk");
  const db = await admin();
  const since = new Date(Date.now() - 10 * 60000).toISOString();
  const { count } = await db.from("attendance_attempts").select("id", { count: "exact", head: true }).eq("device_user_id", ctx.userId).eq("result", "bad_pin").gte("created_at", since);
  if ((count ?? 0) >= 5) throw new Error("Too many wrong PINs. The kiosk is locked for 10 minutes.");
  const { data: sp } = await db.from("staff_profiles").select("user_id,photo_url,active").eq("school_id", school_id).eq("pin_hash", await pinHash(school_id, pin)).maybeSingle();
  if (!sp || !sp.active) {
    await db.from("attendance_attempts").insert({ school_id, device_user_id: ctx.userId, action: "pin", method: "kiosk", result: "bad_pin" });
    throw new Error("PIN not recognised");
  }
  return { db, sp };
}

export const kioskIdentify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ school_id: z.string().uuid(), pin: z.string().regex(/^\d{4}$/) }))
  .handler(async ({ data, context }) => {
    const { db, sp } = await kioskStaff(context, data.school_id, data.pin);
    const { date } = localParts(new Date());
    const [{ data: p }, { data: rec }] = await Promise.all([
      db.from("profiles").select("full_name,avatar_url").eq("user_id", sp.user_id).maybeSingle(),
      db.from("staff_attendance").select("check_in_at,check_out_at,status").eq("school_id", data.school_id).eq("user_id", sp.user_id).eq("date", date).maybeSingle(),
    ]);
    // Only what the kiosk screen needs — no IDs, pay or contact details.
    return { name: p?.full_name ?? "Staff", photo: sp.photo_url ?? p?.avatar_url ?? null, check_in_at: rec?.check_in_at ?? null, check_out_at: rec?.check_out_at ?? null, status: rec?.status ?? null };
  });

export const kioskPunch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ school_id: z.string().uuid(), pin: z.string().regex(/^\d{4}$/), action: z.enum(["in", "out"]), ...GeoSchema }))
  .handler(async ({ data, context }) => {
    const { sp } = await kioskStaff(context, data.school_id, data.pin);
    return punch(data.school_id, sp.user_id, data.action, "kiosk", data, context.userId);
  });

export const setStaffPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ school_id: z.string().uuid(), user_id: z.string().uuid(), pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits") }))
  .handler(async ({ data, context }) => {
    await must(context, data.school_id, "staffatt.edit");
    const db = await admin();
    const hash = await pinHash(data.school_id, data.pin);
    const { data: clash } = await db.from("staff_profiles").select("user_id").eq("school_id", data.school_id).eq("pin_hash", hash).maybeSingle();
    if (clash && clash.user_id !== data.user_id) throw new Error("That PIN is already used by another staff member. Choose a different one.");
    const { error } = await db.from("staff_profiles").upsert({ school_id: data.school_id, user_id: data.user_id, pin_hash: hash }, { onConflict: "school_id,user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const correctAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    school_id: z.string().uuid(), user_id: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    check_in: z.string().regex(/^\d{2}:\d{2}$/).nullable(), check_out: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    reason: z.string().trim().min(3, "Give a reason for the correction").max(500),
  }))
  .handler(async ({ data, context }) => {
    await must(context, data.school_id, "staffatt.edit");
    const { data: sup } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
    if (data.user_id === context.userId && !sup) throw new Error("You cannot correct your own attendance");
    if (!data.check_in && data.check_out) throw new Error("A check-out needs a check-in time");
    const db = await admin();
    const s = await loadSettings(db, data.school_id);
    const iso = (t: string | null) => (t ? new Date(`${data.date}T${t}:00${SCHOOL_TZ_OFFSET}`).toISOString() : null);
    const inAt = iso(data.check_in), outAt = iso(data.check_out);
    if (inAt && outAt && outAt < inAt) throw new Error("Check-out must be after check-in");
    const { data: existing } = await db.from("staff_attendance").select("id").eq("school_id", data.school_id).eq("user_id", data.user_id).eq("date", data.date).maybeSingle();
    if (!inAt) {
      if (existing) {
        const { error } = await db.from("staff_attendance").update({ check_in_at: null, check_out_at: null, status: "absent", late_minutes: 0, early_minutes: 0, worked_minutes: 0, corrected_by: context.userId, correction_reason: data.reason, updated_at: new Date().toISOString() }).eq("id", existing.id);
        if (error) throw new Error(error.message);
      }
      return { ok: true };
    }
    const a = arrival(toLocalMinutes(inAt), s);
    const d = outAt ? departure(toLocalMinutes(outAt), s) : { early: false, earlyMinutes: 0 };
    const row = {
      school_id: data.school_id, user_id: data.user_id, date: data.date, check_in_at: inAt, check_out_at: outAt,
      in_method: "admin", out_method: outAt ? "admin" : null, status: a.late ? "late" : "present", late_minutes: a.lateMinutes,
      early_minutes: d.early ? d.earlyMinutes : 0, worked_minutes: outAt ? Math.round((Date.parse(outAt) - Date.parse(inAt)) / 60000) : 0,
      corrected_by: context.userId, correction_reason: data.reason, updated_at: new Date().toISOString(),
    };
    const { error } = existing ? await db.from("staff_attendance").update(row).eq("id", existing.id) : await db.from("staff_attendance").insert(row);
    if (error) throw new Error(error.message);
    // A corrected day may no longer deserve its pending penalties.
    await db.from("staff_penalties").delete().eq("school_id", data.school_id).eq("user_id", data.user_id).eq("date", data.date).eq("status", "pending");
    return { ok: true };
  });
function toLocalMinutes(iso: string) { return localParts(new Date(iso)).minutes; }

export const reviewLeave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), approve: z.boolean(), note: z.string().max(500).optional() }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: req } = await db.from("leave_requests").select("school_id,user_id,status").eq("id", data.id).single();
    if (!req) throw new Error("Leave request not found");
    await must(context, req.school_id, "staffatt.edit");
    if (req.user_id === context.userId) throw new Error("You cannot approve your own leave");
    if (req.status !== "pending") throw new Error("This request has already been reviewed");
    const { error } = await db.from("leave_requests").update({ status: data.approve ? "approved" : "rejected", reviewed_by: context.userId, reviewed_at: new Date().toISOString(), review_note: data.note ?? null }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const waivePenalty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), reason: z.string().trim().min(3, "Give a reason").max(300) }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: p } = await db.from("staff_penalties").select("school_id,user_id,status").eq("id", data.id).single();
    if (!p) throw new Error("Penalty not found");
    await must(context, p.school_id, "staffatt.edit");
    if (p.user_id === context.userId) throw new Error("You cannot waive your own penalty");
    if (p.status !== "pending") throw new Error("Only pending penalties can be waived");
    const { error } = await db.from("staff_penalties").update({ status: "waived", waived_by: context.userId, waive_reason: data.reason }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Evaluate days already finished and record any penalties due (pending — not yet deducted). */
async function evaluateAndRecord(db: SupabaseClient<Database>, school_id: string, from: string, to: string) {
  const s = await loadSettings(db, school_id);
  const now = localParts(new Date());
  const lastDay = to < now.date ? to : now.date;
  const [{ data: roles }, { data: profiles }, { data: records }, { data: holidays }, { data: leaves }, { data: types }, { data: ex }] = await Promise.all([
    db.from("user_roles").select("user_id").eq("school_id", school_id).in("role", ["school_admin", "teacher", "accountant"]),
    db.from("staff_profiles").select("user_id,active,attendance_exempt").eq("school_id", school_id),
    db.from("staff_attendance").select("user_id,date,check_in_at,check_out_at").eq("school_id", school_id).gte("date", from).lte("date", to),
    db.from("staff_holidays").select("title,start_date,end_date").eq("school_id", school_id).lte("start_date", to).gte("end_date", from),
    db.from("leave_requests").select("user_id,start_date,end_date,leave_type_id").eq("school_id", school_id).eq("status", "approved").lte("start_date", to).gte("end_date", from),
    db.from("leave_types").select("id,name").eq("school_id", school_id),
    db.from("attendance_exemptions").select("user_id,start_date,end_date,reason").eq("school_id", school_id).lte("start_date", to).gte("end_date", from),
  ]);
  const pmap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const ids = [...new Set((roles ?? []).map((r) => r.user_id))].filter((id) => pmap.get(id)?.active !== false);
  const tmap = new Map((types ?? []).map((t) => [t.id, t.name]));
  const rows = evaluateRange({
    from, to: lastDay < from ? from : lastDay, today: now.date, nowMinutes: now.minutes, settings: s,
    staff: ids.map((user_id) => ({ user_id, attendance_exempt: pmap.get(user_id)?.attendance_exempt })),
    records: (records ?? []) as never, holidays: holidays ?? [],
    leaves: (leaves ?? []).map((l) => ({ ...l, label: `Leave: ${tmap.get(l.leave_type_id ?? "") ?? "Approved leave"}` })),
    exemptions: ex ?? [],
  });
  const pen = rows.filter((r) => r.date < now.date || r.date <= lastDay).flatMap((r) => penaltiesForDay(r, s).map((p) => ({ school_id, user_id: r.user_id, date: r.date, kind: p.kind, amount: p.amount, minutes: p.minutes ?? null })));
  if (pen.length) {
    const { error } = await db.from("staff_penalties").upsert(pen, { onConflict: "school_id,user_id,date,kind", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  return { rows, settings: s, staffIds: ids };
}

export const recordPenalties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ school_id: z.string().uuid(), from: z.string(), to: z.string() }))
  .handler(async ({ data, context }) => {
    await must(context, data.school_id, "staffatt.edit");
    if (eachDate(data.from, data.to).length > 120) throw new Error("Choose at most 120 days");
    const { rows } = await evaluateAndRecord(await admin(), data.school_id, data.from, data.to);
    return { evaluated: rows.length };
  });

export const generatePayroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ period_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: period } = await db.from("payroll_periods").select("*").eq("id", data.period_id).single();
    if (!period) throw new Error("Payroll period not found");
    await must(context, period.school_id, "payroll.edit");
    if (period.status === "approved" || period.status === "paid") throw new Error("Approved or paid payroll cannot be regenerated. Move it back to draft first (approved only).");
    const { rows, settings, staffIds } = await evaluateAndRecord(db, period.school_id, period.start_date, period.end_date);
    const workingDays = eachDate(period.start_date, period.end_date).filter((d) => settings.working_days.includes(new Date(`${d}T12:00:00Z`).getUTCDay())).length;
    const [{ data: sal }, { data: pens }, { data: names }] = await Promise.all([
      db.from("staff_salary_settings").select("user_id,basic,allowances,other_deductions,salary_type").eq("school_id", period.school_id),
      db.from("staff_penalties").select("user_id,kind,amount,status").eq("school_id", period.school_id).gte("date", period.start_date).lte("date", period.end_date),
      db.from("profiles").select("user_id,full_name").in("user_id", staffIds.length ? staffIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const salMap = new Map((sal ?? []).map((x) => [x.user_id, x]));
    const nameMap = new Map((names ?? []).map((n) => [n.user_id, n.full_name]));
    const version = (period.version ?? 0) + 1;
    await db.from("payroll_records").delete().eq("period_id", period.id);
    const records = staffIds.map((uid) => {
      const sv = salMap.get(uid);
      const mine = rows.filter((r) => r.user_id === uid);
      const pay = computePay({
        basic: Number(sv?.basic ?? 0), allowances: Number(sv?.allowances ?? 0), other_deductions: Number(sv?.other_deductions ?? 0),
        salary_type: (sv?.salary_type as "monthly" | "weekly") ?? "monthly", period_kind: period.kind as "monthly", period_working_days: workingDays,
        penalties: (pens ?? []).filter((p) => p.user_id === uid).map((p) => ({ ...p, amount: Number(p.amount) })), apply_penalties: settings.apply_penalties_in_payroll,
      });
      return {
        school_id: period.school_id, period_id: period.id, user_id: uid, staff_name: nameMap.get(uid) ?? "Staff", version,
        days_present: mine.filter((r) => r.status === "present" || r.status === "late").length,
        days_absent: mine.filter((r) => r.status === "absent").length,
        days_exempt: mine.filter((r) => ["leave", "exempt", "holiday"].includes(r.status)).length,
        late_count: mine.filter((r) => r.late).length, ...pay,
      };
    });
    if (records.length) {
      const { data: saved, error } = await db.from("payroll_records").insert(records).select("id,user_id,basic,allowances,late_penalty,absence_penalty,other_penalty,other_deductions");
      if (error) throw new Error(error.message);
      const items = (saved ?? []).flatMap((r) => [
        { school_id: period.school_id, record_id: r.id, kind: "earning", label: "Basic salary", amount: r.basic },
        { school_id: period.school_id, record_id: r.id, kind: "allowance", label: "Allowances", amount: r.allowances },
        { school_id: period.school_id, record_id: r.id, kind: "penalty", label: "Late penalties", amount: r.late_penalty },
        { school_id: period.school_id, record_id: r.id, kind: "penalty", label: "Absence penalties", amount: r.absence_penalty },
        { school_id: period.school_id, record_id: r.id, kind: "penalty", label: "Early / missing check-out", amount: r.other_penalty },
        { school_id: period.school_id, record_id: r.id, kind: "deduction", label: "Other deductions", amount: r.other_deductions },
      ].filter((i) => Number(i.amount) > 0));
      if (items.length) await db.from("payroll_items").insert(items);
    }
    await db.from("payroll_periods").update({ status: "draft", version, generated_at: new Date().toISOString(), reviewed_by: null, reviewed_at: null }).eq("id", period.id);
    return { staff: records.length, version };
  });

export const setPayrollStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ period_id: z.string().uuid(), status: z.enum(["draft", "reviewed", "approved", "paid"]) }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: period } = await db.from("payroll_periods").select("*").eq("id", data.period_id).single();
    if (!period) throw new Error("Payroll period not found");
    await must(context, period.school_id, data.status === "approved" || data.status === "paid" ? "payroll.approve" : "payroll.edit");
    if (!canMoveTo(period.status as PayrollStatus, data.status)) throw new Error(`Cannot move payroll from ${period.status} to ${data.status}`);
    if (!period.generated_at) throw new Error("Generate the payroll first");
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "reviewed") Object.assign(patch, { reviewed_by: context.userId, reviewed_at: now });
    if (data.status === "approved") Object.assign(patch, { approved_by: context.userId, approved_at: now });
    if (data.status === "paid") Object.assign(patch, { paid_by: context.userId, paid_at: now });
    const { error } = await db.from("payroll_periods").update(patch as never).eq("id", period.id);
    if (error) throw new Error(error.message);
    if (data.status === "paid") {
      const s = await loadSettings(db, period.school_id);
      if (s.apply_penalties_in_payroll) {
        await db.from("staff_penalties").update({ status: "applied" }).eq("school_id", period.school_id).eq("status", "pending").gte("date", period.start_date).lte("date", period.end_date);
      }
    }
    return { ok: true };
  });

/** Kiosk wall board: today's and yesterday's attendance with late minutes and penalty, plus active sites for the live location badge. */
export const kioskBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ school_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    if (!(await can(context, data.school_id, "staffatt.kiosk")) && !(await can(context, data.school_id, "staffatt.view"))) throw new Error("This device is not authorized as an attendance kiosk");
    const db = await admin();
    const s = await loadSettings(db, data.school_id);
    const now = localParts(new Date());
    const y = new Date(`${now.date}T12:00:00Z`); y.setUTCDate(y.getUTCDate() - 1);
    const yesterday = y.toISOString().slice(0, 10);
    const [{ data: staff }, { data: recs }, { data: hols }, sites] = await Promise.all([
      db.from("staff_profiles").select("user_id,attendance_exempt").eq("school_id", data.school_id).eq("active", true),
      db.from("staff_attendance").select("user_id,date,check_in_at,check_out_at").eq("school_id", data.school_id).in("date", [now.date, yesterday]),
      db.from("staff_holidays").select("title,start_date,end_date").eq("school_id", data.school_id).lte("start_date", now.date).gte("end_date", yesterday),
      loadSites(db, data.school_id, s),
    ]);
    const ids = (staff ?? []).map((x) => x.user_id);
    const { data: profs } = ids.length ? await db.from("profiles").select("user_id,full_name").in("user_id", ids) : { data: [] };
    const nameOf = new Map((profs ?? []).map((p) => [p.user_id, p.full_name ?? "Staff"]));
    const day = (date: string) => {
      const hol = (hols ?? []).find((h) => h.start_date <= date && h.end_date >= date)?.title ?? null;
      const rows = (staff ?? []).map((st) => {
        const rec = (recs ?? []).find((r) => r.user_id === st.user_id && r.date === date) ?? null;
        const r = evaluateDay({ date, today: now.date, nowMinutes: now.minutes, holiday: hol, staffExempt: st.attendance_exempt, record: rec }, s);
        const penalty = penaltiesForDay(r, s).reduce((a, p) => a + p.amount, 0);
        const stillIn = !!rec?.check_in_at && !rec.check_out_at && !r.missingCheckout;
        return { name: nameOf.get(st.user_id) ?? "Staff", status: r.status, late: r.late, lateMinutes: r.lateMinutes, stillIn, missedOut: r.missingCheckout, penalty };
      }).sort((a, b) => a.name.localeCompare(b.name));
      return {
        date, holiday: hol, rows,
        counts: {
          onTime: rows.filter((r) => r.status === "present").length, late: rows.filter((r) => r.late).length,
          stillIn: rows.filter((r) => r.stillIn).length, missedOut: rows.filter((r) => r.missedOut).length, absent: rows.filter((r) => r.status === "absent").length,
        },
      };
    };
    return { today: day(now.date), yesterday: day(yesterday), sites, gps_kiosk: s.gps_kiosk };
  });
