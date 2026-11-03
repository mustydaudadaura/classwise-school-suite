import { describe, expect, it } from "vitest";
import { cardState, formatPin, generatePin, hashPin, scratchStats } from "./scratch-cards";

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();

describe("scratch cards", () => {
  it("generates 12-digit unique PINs", () => {
    const pins = new Set(Array.from({ length: 500 }, () => generatePin()));
    expect(pins.size).toBe(500);
    for (const p of pins) expect(p).toMatch(/^\d{12}$/);
  });
  it("hashes are school-bound and ignore dashes", async () => {
    expect(await hashPin("a", "1234-5678-9012")).toBe(await hashPin("a", "123456789012"));
    expect(await hashPin("a", "123456789012")).not.toBe(await hashPin("b", "123456789012"));
    expect(formatPin("123456789012")).toBe("1234-5678-9012");
  });
  it("separates remaining views from validity", () => {
    expect(cardState({ status: "sold", price: 500, max_views: 3, views_used: 1, valid_until: past })).toBe("expired");
    expect(cardState({ status: "sold", price: 500, max_views: 3, views_used: 3, valid_until: future })).toBe("exhausted");
    expect(cardState({ status: "unsold", price: 500, max_views: 3, views_used: 0, valid_until: future })).toBe("unused");
  });
  it("counts revenue only from sold cards", () => {
    const s = scratchStats([
      { status: "sold", price: 500, max_views: 3, views_used: 1, valid_until: future },
      { status: "unsold", price: 500, max_views: 3, views_used: 0, valid_until: future },
      { status: "void", price: 500, max_views: 3, views_used: 0, valid_until: future },
    ]);
    expect(s).toMatchObject({ generated: 3, sold: 1, revenue: 500, used: 1, unused: 1, voided: 1, remainingViews: 5 });
  });
});
