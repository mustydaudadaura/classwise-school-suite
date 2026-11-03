import type { CSSProperties } from "react";

export type ScratchSchool = { name: string; logo_url: string | null; address: string | null; phone: string | null; theme_color: string | null; email?: string | null; website?: string | null; motto?: string | null };
export type ScratchPrintCard = { serial_no: string; pin: string };

// Printed cards use the school's own brand colour as inline values so they print identically.
export function ScratchCardFace({ school, card, price, views, validUntil, portalUrl }: { school: ScratchSchool; card: ScratchPrintCard; price: number; views: number; validUntil: string; portalUrl: string }) {
  const primary = school.theme_color || "#0a6d3b";
  const frame: CSSProperties = { width: 324, height: 204, borderRadius: 12, overflow: "hidden", position: "relative", background: `linear-gradient(135deg, ${primary} 0%, ${primary} 55%, #d4a017 140%)`, color: "#fff", fontFamily: "inherit", boxShadow: "0 0 0 1px rgba(0,0,0,.15)" };
  return (
    <div style={frame}>
      {school.logo_url && <img src={school.logo_url} alt="" crossOrigin="anonymous" style={{ position: "absolute", right: -20, bottom: -20, width: 150, opacity: 0.12 }} />}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "#d4a017" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 12px 4px" }}>
        {school.logo_url && <img src={school.logo_url} alt="" crossOrigin="anonymous" style={{ width: 30, height: 30, objectFit: "contain", background: "#fff", borderRadius: 6, padding: 2 }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 11, lineHeight: 1.1 }}>{school.name}</div>
          {school.address && <div style={{ fontSize: 7, opacity: 0.85, lineHeight: 1.2 }}>{school.address}</div>}
        </div>
      </div>
      <div style={{ textAlign: "center", fontWeight: 800, fontSize: 13, letterSpacing: 2, marginTop: 2 }}>RESULT CHECKER CARD</div>
      <div style={{ fontSize: 7.5, textAlign: "center", opacity: 0.9 }}>Check your child's report card online</div>
      <div style={{ margin: "7px 14px 0", background: "linear-gradient(90deg,#c0c0c0,#e8e8e8,#b5b5b5)", borderRadius: 6, padding: "6px 8px", textAlign: "center", color: "#111", border: "1px dashed #555" }}>
        <div style={{ fontSize: 7, color: "#444", letterSpacing: 1 }}>SCRATCH GENTLY TO REVEAL PIN</div>
        <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 17, letterSpacing: 2 }}>{card.pin}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 14px 0", fontSize: 7.5 }}>
        <span>Serial: <strong>{card.serial_no}</strong></span>
        <span>₦{price.toLocaleString("en-NG")} · {views} view{views === 1 ? "" : "s"}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 14px 0", fontSize: 7, opacity: 0.9 }}>
        <span>Valid until {validUntil}</span>
        <span>{portalUrl}</span>
      </div>
    </div>
  );
}

/** Back of the card: school contacts, the portal address and a step-by-step guide for parents. */
export const PARENT_STEPS = (portalUrl: string, views: number) => [
  `Open ${portalUrl} on your phone or computer (or scan the QR code).`,
  "Enter the phone number you gave the school and tap Parent sign in.",
  "Choose your child, then open Report Cards and pick the term.",
  "Gently scratch the silver box and type the PIN when asked.",
  `View, download or print the result. The card allows ${views} view${views === 1 ? "" : "s"}.`,
];

export function ScratchCardBack({ school, portalUrl, views, qr }: { school: ScratchSchool; portalUrl: string; views: number; qr?: string }) {
  const primary = school.theme_color || "#0a6d3b";
  const steps = PARENT_STEPS(portalUrl, views);
  return (
    <div style={{ width: 324, height: 204, borderRadius: 12, overflow: "hidden", position: "relative", background: "#fff", color: "#111", border: `2px solid ${primary}`, fontFamily: "inherit" }}>
      {school.logo_url && <img src={school.logo_url} alt="" crossOrigin="anonymous" style={{ position: "absolute", inset: 0, margin: "auto", width: 120, opacity: 0.06 }} />}
      <div style={{ background: primary, color: "#fff", padding: "4px 10px", fontSize: 8.5, fontWeight: 800, letterSpacing: 1 }}>HOW TO CHECK YOUR CHILD'S RESULT</div>
      {qr && <img src={qr} alt="" style={{ position: "absolute", right: 8, top: 22, width: 52, height: 52 }} />}
      <ol style={{ margin: 0, padding: qr ? "4px 64px 0 22px" : "4px 10px 0 22px", fontSize: 7.2, lineHeight: 1.3 }}>
        {steps.map((t) => <li key={t}>{t}</li>)}
      </ol>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "#f5f5f4", borderTop: `2px solid #d4a017`, padding: "4px 10px", fontSize: 7, lineHeight: 1.35 }}>
        <div style={{ fontWeight: 800, color: primary, fontSize: 8 }}>{school.name}{school.motto ? ` — ${school.motto}` : ""}</div>
        {school.address && <div>{school.address}</div>}
        <div>{[school.phone && `Tel: ${school.phone}`, school.email && `Email: ${school.email}`].filter(Boolean).join(" · ")}</div>
        <div><strong>Portal:</strong> {portalUrl}{school.website ? ` · Website: ${school.website}` : ""}</div>
      </div>
    </div>
  );
}

/** One A4 sheet (794×1123 px): each row is a card front (left) and its back (right) for fold-and-laminate printing. */
export function ScratchSheet({ children }: { children: React.ReactNode }) {
  return <div style={{ width: 794, height: 1123, padding: "34px 50px", display: "grid", gridTemplateColumns: "repeat(2, 324px)", gap: "14px 46px", justifyContent: "center", alignContent: "start", background: "#fff" }}>{children}</div>;
}

/** First PDF page: an A4 guide for the school office and parents. */
export function ScratchGuidePage({ school, portalUrl, views, validUntil, qr, count }: { school: ScratchSchool; portalUrl: string; views: number; validUntil: string; qr: string; count: number }) {
  const primary = school.theme_color || "#0a6d3b";
  return (
    <div style={{ width: 794, height: 1123, padding: 56, background: "#fff", color: "#111", fontFamily: "inherit", position: "relative" }}>
      {school.logo_url && <img src={school.logo_url} alt="" crossOrigin="anonymous" style={{ position: "absolute", inset: 0, margin: "auto", width: 420, opacity: 0.05 }} />}
      <div style={{ display: "flex", alignItems: "center", gap: 14, borderBottom: `4px solid ${primary}`, paddingBottom: 12 }}>
        {school.logo_url && <img src={school.logo_url} alt="" crossOrigin="anonymous" style={{ width: 70, height: 70, objectFit: "contain" }} />}
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: primary }}>{school.name}</div>
          {school.motto && <div style={{ fontStyle: "italic", fontSize: 13 }}>{school.motto}</div>}
          <div style={{ fontSize: 12 }}>{[school.address, school.phone, school.email, school.website].filter(Boolean).join(" · ")}</div>
        </div>
      </div>
      <h1 style={{ fontSize: 26, margin: "26px 0 6px", color: primary }}>Result Checker Card — Parent Guide</h1>
      <p style={{ fontSize: 14, margin: 0 }}>Use your scratch card to see your child's report card online at any time.</p>
      <div style={{ display: "flex", gap: 24, alignItems: "center", margin: "22px 0", padding: 16, border: `2px dashed ${primary}`, borderRadius: 10 }}>
        <img src={qr} alt="" style={{ width: 130, height: 130 }} />
        <div>
          <div style={{ fontSize: 13, color: "#555" }}>Parent portal link</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: primary, wordBreak: "break-all" }}>{portalUrl}</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Scan the code with your phone camera or type the link in your browser.</div>
        </div>
      </div>
      <h2 style={{ fontSize: 18, margin: "8px 0" }}>Step by step</h2>
      <ol style={{ fontSize: 15, lineHeight: 1.8, paddingLeft: 24, margin: 0 }}>
        {PARENT_STEPS(portalUrl, views).map((t) => <li key={t}>{t}</li>)}
      </ol>
      <h2 style={{ fontSize: 18, margin: "22px 0 8px" }}>Good to know</h2>
      <ul style={{ fontSize: 14, lineHeight: 1.7, paddingLeft: 24, margin: 0 }}>
        <li>Each card works for one child only and shows published results.</li>
        <li>Cards in this batch are valid until <strong>{validUntil}</strong> and allow <strong>{views}</strong> view{views === 1 ? "" : "s"}.</li>
        <li>Keep your PIN private. Do not scratch the card until you are ready to use it.</li>
        <li>If your phone number is not recognised, contact the school office{school.phone ? ` on ${school.phone}` : ""} to update it.</li>
      </ul>
      <div style={{ position: "absolute", left: 56, right: 56, bottom: 40, fontSize: 11, color: "#666", borderTop: "1px solid #ddd", paddingTop: 8 }}>
        This batch contains {count} card{count === 1 ? "" : "s"} on the following pages — 5 per page, front (left) and back (right). Cut along the card edges.
      </div>
    </div>
  );
}
