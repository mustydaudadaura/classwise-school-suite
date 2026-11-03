/** Shared ID card helpers. */
export type IdDesign = { primary: string; accent: string; text: string; layout: "horizontal" | "vertical"; title: string };
export const DEFAULT_STUDENT_DESIGN: IdDesign = { primary: "#0f5132", accent: "#d4a017", text: "#ffffff", layout: "horizontal", title: "STUDENT ID CARD" };
export const DEFAULT_STAFF_DESIGN: IdDesign = { primary: "#1e3a8a", accent: "#d4a017", text: "#ffffff", layout: "horizontal", title: "STAFF ID CARD" };
const HEX = /^#[0-9a-fA-F]{6}$/;

export function resolveDesign(value: unknown, fallback: IdDesign): IdDesign {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    primary: typeof v.primary === "string" && HEX.test(v.primary) ? v.primary : fallback.primary,
    accent: typeof v.accent === "string" && HEX.test(v.accent) ? v.accent : fallback.accent,
    text: typeof v.text === "string" && HEX.test(v.text) ? v.text : fallback.text,
    layout: v.layout === "vertical" ? "vertical" : v.layout === "horizontal" ? "horizontal" : fallback.layout,
    title: typeof v.title === "string" && v.title.trim() ? v.title.slice(0, 40) : fallback.title,
  };
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** 12-character random verification code (no look-alike characters). */
export function newCardCode(): string {
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Cards per A4 sheet: 2 × 5 landscape cards or 3 × 3 portrait cards. */
export function perSheet(layout: IdDesign["layout"]) { return layout === "vertical" ? 9 : 10; }
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
