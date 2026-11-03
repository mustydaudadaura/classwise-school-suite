import { describe, expect, it } from "vitest";
import { chunk, newCardCode, perSheet, resolveDesign, DEFAULT_STUDENT_DESIGN } from "./id-cards";

describe("id cards", () => {
  it("makes unique 12-character codes", () => {
    const codes = new Set(Array.from({ length: 300 }, newCardCode));
    expect(codes.size).toBe(300);
    for (const c of codes) expect(c).toMatch(/^[A-Z0-9]{12}$/);
  });
  it("fits 10 landscape or 9 portrait cards on an A4 sheet", () => {
    expect(perSheet("horizontal")).toBe(10);
    expect(perSheet("vertical")).toBe(9);
    expect(chunk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 10).map((p) => p.length)).toEqual([10, 1]);
  });
  it("ignores invalid colours", () => {
    expect(resolveDesign({ primary: "red" }, DEFAULT_STUDENT_DESIGN).primary).toBe(DEFAULT_STUDENT_DESIGN.primary);
    expect(resolveDesign({ primary: "#123456" }, DEFAULT_STUDENT_DESIGN).primary).toBe("#123456");
  });
});
