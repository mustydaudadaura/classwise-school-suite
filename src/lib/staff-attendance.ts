// Shared, browser-safe staff attendance rules. Used by server functions, screens and reports.

export type Penalties = { late: number; late_per_minute: number; late_extra: number; absence: number; early: number; missing_checkout: number };
export type AttSettings = {
  report_time: string; grace_minutes: number; closing_time: string; min_hours: number;
  late_threshold_minutes: number; early_departure_minutes: number; working_days: number[];
  latitude: number | null; longitude: number | null; radius_m: number;
  gps_phone: boolean; gps_kiosk: boolean; penalties: Penalties;
  apply_penalties_in_payroll: boolean; leave_requires_approval: boolean;
};

export const SCHOOL_TZ = "Africa/Lagos";
export const SCHOOL_TZ_OFFSET = "+01:00";

export const DEFAULT_SETTINGS: AttSettings = {
  report_time: "07:30", grace_minutes: 15, closing_time: "14:00", min_hours: 6,
  late_threshold_minutes: 30, early_departure_minutes: 15, working_days: [1, 2, 3, 4, 5],
  latitude: null, longitude: null, radius_m: 150, gps_phone: true, gps_kiosk: false,
  penalties: { late: 0, late_per_minute: 0, late_extra: 0, absence: 0, early: 0, missing_checkout: 0 },
  apply_penalties_in_payroll: false, leave_requires_approval: true,
};

export function normaliseSettings(row: Partial<AttSettings> | null | undefined): AttSettings {
  if (!row) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS, ...row,
    report_time: String(row.report_time ?? DEFAULT_SETTINGS.report_time).slice(0, 5),
    closing_time: String(row.closing_time ?? DEFAULT_SETTINGS.closing_time).slice(0, 5),
    penalties: { ...DEFAULT_SETTINGS.penalties, ...(row.penalties ?? {}) },
    min_hours: Number(row.min_hours ?? DEFAULT_SETTINGS.min_hours),
  } as AttSettings;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Local date (YYYY-MM-DD), minutes since midnight and weekday (0=Sun) in the school time zone. */
export function localParts(d: Date, tz = SCHOOL_TZ) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(g("weekday"));
  return { date: `${g("year")}-${g("month")}-${g("day")}`, minutes: Number(g("hour")) * 60 + Number(g("minute")), weekday: wd };
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (d <= end && out.length < 400) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** On time up to report time + grace (inclusive). After that, late; minutes counted from the official time. */
export function arrival(minutes: number, s: AttSettings) {
  const official = toMinutes(s.report_time);
  const late = minutes > official + s.grace_minutes;
  return { late, lateMinutes: late ? minutes - official : 0 };
}

export function departure(minutes: number, s: AttSettings) {
  const earlyMinutes = Math.max(0, toMinutes(s.closing_time) - minutes);
  return { early: earlyMinutes > s.early_departure_minutes, earlyMinutes };
}

export type DayRecord = { check_in_at: string | null; check_out_at: string | null; late_minutes?: number; early_minutes?: number; worked_minutes?: number };
export type DayStatus = "present" | "late" | "absent" | "holiday" | "leave" | "exempt" | "off_day" | "not_yet";
export type DayResult = {
  date: string; status: DayStatus; reason?: string;
  late: boolean; lateMinutes: number; early: boolean; earlyMinutes: number;
  missingCheckout: boolean; workedMinutes: number;
  /** Counts toward attendance percentage (working, not excused). */
  counts: boolean;
};

export type DayContext = {
  date: string; today: string; nowMinutes: number;
  holiday?: string | null; leave?: string | null; exemption?: string | null; staffExempt?: boolean;
  record?: DayRecord | null;
};

export function evaluateDay(ctx: DayContext, s: AttSettings): DayResult {
  const base = { date: ctx.date, late: false, lateMinutes: 0, early: false, earlyMinutes: 0, missingCheckout: false, workedMinutes: 0, counts: false };
  const rec = ctx.record?.check_in_at ? ctx.record : null;
  if (ctx.holiday) return { ...base, status: "holiday", reason: ctx.holiday };
  if (ctx.leave) return { ...base, status: "leave", reason: ctx.leave };
  if (ctx.exemption) return { ...base, status: "exempt", reason: ctx.exemption };
  if (ctx.staffExempt) return { ...base, status: "exempt", reason: "Exempt from attendance" };
  if (!s.working_days.includes(weekdayOf(ctx.date))) return { ...base, status: "off_day" };
  if (ctx.date > ctx.today) return { ...base, status: "not_yet" };
  const dayOver = ctx.date < ctx.today || ctx.nowMinutes > toMinutes(s.closing_time);
  if (!rec) {
    if (!dayOver) return { ...base, status: "not_yet", counts: false };
    return { ...base, status: "absent", counts: true };
  }
  const inM = localParts(new Date(rec.check_in_at!)).minutes;
  const a = arrival(inM, s);
  let early = false, earlyMinutes = 0, worked = 0;
  if (rec.check_out_at) {
    const outM = localParts(new Date(rec.check_out_at)).minutes;
    const d = departure(outM, s); early = d.early; earlyMinutes = d.earlyMinutes;
    worked = Math.max(0, Math.round((new Date(rec.check_out_at).getTime() - new Date(rec.check_in_at!).getTime()) / 60000));
  }
  return {
    ...base, status: a.late ? "late" : "present", late: a.late, lateMinutes: a.lateMinutes,
    early, earlyMinutes, workedMinutes: worked, missingCheckout: !rec.check_out_at && dayOver, counts: true,
  };
}

export type PenaltyLine = { kind: keyof Penalties; amount: number; minutes?: number };

export function penaltiesForDay(r: DayResult, s: AttSettings): PenaltyLine[] {
  const p = s.penalties, out: PenaltyLine[] = [];
  if (r.status === "absent" && p.absence > 0) out.push({ kind: "absence", amount: p.absence });
  const lateAmt = r.late ? (p.late || 0) + (p.late_per_minute || 0) * r.lateMinutes : 0;
  if (lateAmt > 0) out.push({ kind: "late", amount: lateAmt, minutes: r.lateMinutes });
  if (r.late && p.late_extra > 0 && r.lateMinutes > s.late_threshold_minutes) out.push({ kind: "late_extra", amount: p.late_extra, minutes: r.lateMinutes });
  if (r.early && p.early > 0) out.push({ kind: "early", amount: p.early, minutes: r.earlyMinutes });
  if (r.missingCheckout && p.missing_checkout > 0) out.push({ kind: "missing_checkout", amount: p.missing_checkout });
  return out;
}

export type RangeInput = {
  from: string; to: string; today: string; nowMinutes: number; settings: AttSettings;
  staff: { user_id: string; attendance_exempt?: boolean }[];
  records: (DayRecord & { user_id: string; date: string })[];
  holidays: { title: string; start_date: string; end_date: string }[];
  leaves: { user_id: string; start_date: string; end_date: string; label: string }[];
  exemptions: { user_id: string; start_date: string; end_date: string; reason: string }[];
};

/** One result per staff member per day across the range. */
export function evaluateRange(inp: RangeInput) {
  const recMap = new Map(inp.records.map((r) => [`${r.user_id}|${r.date}`, r]));
  const dates = eachDate(inp.from, inp.to);
  const rows: (DayResult & { user_id: string })[] = [];
  for (const st of inp.staff) {
    for (const date of dates) {
      const within = (x: { start_date: string; end_date: string }) => x.start_date <= date && x.end_date >= date;
      const hol = inp.holidays.find(within);
      const lv = inp.leaves.find((l) => l.user_id === st.user_id && within(l));
      const ex = inp.exemptions.find((e) => e.user_id === st.user_id && within(e));
      rows.push({ user_id: st.user_id, ...evaluateDay({
        date, today: inp.today, nowMinutes: inp.nowMinutes, holiday: hol?.title, leave: lv?.label, exemption: ex?.reason,
        staffExempt: st.attendance_exempt, record: recMap.get(`${st.user_id}|${date}`),
      }, inp.settings) });
    }
  }
  return rows;
}

export function summarise(rows: DayResult[]) {
  const s = { present: 0, late: 0, absent: 0, leave: 0, holiday: 0, exempt: 0, early: 0, missingCheckout: 0, workedMinutes: 0, counted: 0 };
  for (const r of rows) {
    if (r.status === "present" || r.status === "late") s.present++;
    if (r.late) s.late++;
    if (r.status === "absent") s.absent++;
    if (r.status === "leave") s.leave++;
    if (r.status === "holiday") s.holiday++;
    if (r.status === "exempt") s.exempt++;
    if (r.early) s.early++;
    if (r.missingCheckout) s.missingCheckout++;
    if (r.counts) s.counted++;
    s.workedMinutes += r.workedMinutes;
  }
  return { ...s, percent: s.counted ? Math.round((s.present / s.counted) * 100) : 100 };
}

export const STATUS_LABEL: Record<DayStatus, string> = {
  present: "Present", late: "Late", absent: "Absent", holiday: "Holiday", leave: "On leave", exempt: "Exempted", off_day: "Off day", not_yet: "Not yet",
};

export function fmtHours(min: number) {
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}
export function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-NG", { timeZone: SCHOOL_TZ, hour: "2-digit", minute: "2-digit" });
}

export type Site = { name: string; latitude: number; longitude: number; radius_m: number };
/** Nearest site and whether the point lies inside any site's radius. */
export function checkSites(p: { lat: number; lng: number }, sites: Site[]) {
  let best: { site: Site; distance: number; inside: boolean } | null = null;
  for (const site of sites) {
    const distance = Math.round(haversineMeters(p, { lat: site.latitude, lng: site.longitude }));
    const inside = distance <= site.radius_m;
    if (!best || (inside && !best.inside) || (inside === best.inside && distance < best.distance)) best = { site, distance, inside };
  }
  return best;
}
