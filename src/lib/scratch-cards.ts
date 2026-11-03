/** Browser- and Worker-safe scratch card helpers (Web Crypto only). */
export type ScratchSettings = { access_mode: "free" | "scratch"; price: number; max_views: number; validity_days: number };
export const DEFAULT_SCRATCH_SETTINGS: ScratchSettings = { access_mode: "free", price: 500, max_views: 3, validity_days: 90 };

/** 12-digit PIN from cryptographically secure randomness (rejection sampling avoids bias). */
export function generatePin(digits = 12): string {
  let out = "";
  const buf = new Uint8Array(1);
  while (out.length < digits) {
    crypto.getRandomValues(buf);
    if (buf[0] < 250) out += String(buf[0] % 10);
  }
  return out;
}

export function normalizePin(pin: string): string {
  return pin.replace(/\D/g, "");
}

export function formatPin(pin: string): string {
  return normalizePin(pin).replace(/(\d{4})(?=\d)/g, "$1-");
}

/** PINs are stored only as a school-bound SHA-256 hash. */
export async function hashPin(schoolId: string, pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`alegacy-scratch:${schoolId}:${normalizePin(pin)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type CardRow = { status: string; price: number; max_views: number; views_used: number; valid_until: string };

export function cardState(c: CardRow, now = new Date()): "void" | "expired" | "exhausted" | "used" | "unused" {
  if (c.status === "void") return "void";
  if (new Date(c.valid_until) <= now) return "expired";
  if (c.views_used >= c.max_views) return "exhausted";
  return c.views_used > 0 ? "used" : "unused";
}

export function scratchStats(cards: CardRow[], now = new Date()) {
  const s = { generated: cards.length, sold: 0, revenue: 0, used: 0, unused: 0, expired: 0, exhausted: 0, voided: 0, remainingViews: 0 };
  for (const c of cards) {
    const st = cardState(c, now);
    if (c.status === "sold") { s.sold++; s.revenue += Number(c.price) || 0; }
    if (st === "void") s.voided++;
    else if (st === "expired") s.expired++;
    else if (st === "exhausted") { s.exhausted++; s.used++; }
    else if (st === "used") { s.used++; s.remainingViews += c.max_views - c.views_used; }
    else { s.unused++; s.remainingViews += c.max_views - c.views_used; }
  }
  return s;
}

export const REDEEM_MESSAGES: Record<string, string> = {
  invalid: "This scratch card PIN is not valid for this school.",
  void: "This scratch card has been cancelled by the school.",
  expired: "This scratch card has expired.",
  exhausted: "This scratch card has no views left.",
  other_student: "This scratch card is already being used for another student.",
};
