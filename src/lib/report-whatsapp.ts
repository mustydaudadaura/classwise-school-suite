/** Browser-safe helpers for sending report cards to parents on WhatsApp. */
export type DeliveryStatus = "pending" | "sent" | "failed" | "invalid_number" | "confirmed";

export const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  pending: "Pending",
  sent: "Sent",
  failed: "Failed",
  invalid_number: "Invalid number",
  confirmed: "Confirmed",
};

/** Normalises a Nigerian or international number to WhatsApp digits (no "+"), or null if invalid. */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (/^0\d{10}$/.test(d)) d = "234" + d.slice(1);
  else if (/^[789]\d{9}$/.test(d)) d = "234" + d;
  if (d.startsWith("234")) return /^234[789]\d{9}$/.test(d) ? d : null;
  return /^[1-9]\d{9,14}$/.test(d) ? d : null;
}

export function reportMessage(p: { parentName?: string | null; studentName: string; className: string; term: string; session: string; schoolName: string }) {
  const greet = p.parentName ? `Assalamu alaikum ${p.parentName},` : "Assalamu alaikum,";
  const term = p.term ? p.term.charAt(0).toUpperCase() + p.term.slice(1) : "";
  return `${greet}\n\nPlease find attached the ${term} Term ${p.session} report card of ${p.studentName} (${p.className}).\n\n${p.schoolName}`;
}

export function whatsappLink(phoneDigits: string, message: string) {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}

export function reportFileName(p: { studentName: string; admissionNo?: string | null; className?: string | null; term?: string | null; session?: string | null }) {
  const clean = (s?: string | null) => (s ?? "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return [clean(p.studentName), clean(p.admissionNo), clean(p.className), clean(p.term), clean(p.session)].filter(Boolean).join("_") + ".pdf";
}
