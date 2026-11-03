import type { CSSProperties } from "react";

export type ScratchSchool = { name: string; logo_url: string | null; address: string | null; phone: string | null; theme_color: string | null };
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

/** One A4 sheet (794×1123 px) holding up to 10 ID-card-size scratch cards with cutting gaps. */
export function ScratchSheet({ children }: { children: React.ReactNode }) {
  return <div style={{ width: 794, height: 1123, padding: "34px 50px", display: "grid", gridTemplateColumns: "repeat(2, 324px)", gap: "14px 46px", justifyContent: "center", alignContent: "start", background: "#fff" }}>{children}</div>;
}
