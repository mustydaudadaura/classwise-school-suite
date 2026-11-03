import { describe, expect, it } from "vitest";
import { computePositions, positionForAverage, validateRanges, DEFAULT_RANGES } from "./position-ranking";
import { toWhatsAppNumber, reportFileName } from "./report-whatsapp";

const rows = [
  { student_id: "a", total_score: 900, average: 90 },
  { student_id: "b", total_score: 950, average: 95 },
  { student_id: "c", total_score: 880, average: 95 },
  { student_id: "d", total_score: 700, average: 70 },
];

describe("position ranking", () => {
  it("total keeps the original 1..n order by total", () => {
    const p = computePositions(rows, "total");
    expect([p.get("b"), p.get("a"), p.get("c"), p.get("d")]).toEqual([1, 2, 3, 4]);
  });
  it("average uses competition ranking for ties", () => {
    const p = computePositions(rows, "average");
    expect([p.get("b"), p.get("c"), p.get("a"), p.get("d")]).toEqual([1, 1, 3, 4]);
  });
  it("ranges: 95-100 first, 90-94 second, below lowest gets none", () => {
    const p = computePositions(rows, "ranges", DEFAULT_RANGES);
    expect([p.get("b"), p.get("c"), p.get("a"), p.get("d")]).toEqual([1, 1, 2, null]);
  });
  it("ranges: in-between decimals belong to the lower range, 100 is included", () => {
    expect(positionForAverage(94.6, DEFAULT_RANGES)).toBe(2);
    expect(positionForAverage(95, DEFAULT_RANGES)).toBe(1);
    expect(positionForAverage(100, DEFAULT_RANGES)).toBe(1);
    expect(positionForAverage(74.99, DEFAULT_RANGES)).toBeNull();
  });
  it("rejects overlapping ranges and duplicate positions", () => {
    expect(validateRanges(DEFAULT_RANGES)).toEqual([]);
    expect(validateRanges([{ min: 90, max: 100, position: 1 }, { min: 85, max: 92, position: 2 }]).length).toBeGreaterThan(0);
    expect(validateRanges([{ min: 90, max: 100, position: 1 }, { min: 80, max: 89, position: 1 }]).length).toBeGreaterThan(0);
  });
  it("does not change averages", () => {
    const copy = rows.map((r) => ({ ...r }));
    computePositions(copy, "ranges", DEFAULT_RANGES);
    expect(copy).toEqual(rows);
  });
});

describe("whatsapp numbers", () => {
  it("normalises Nigerian numbers", () => {
    expect(toWhatsAppNumber("09039150719")).toBe("2349039150719");
    expect(toWhatsAppNumber("+234 803 123 4567")).toBe("2348031234567");
    expect(toWhatsAppNumber("12345")).toBeNull();
    expect(toWhatsAppNumber("")).toBeNull();
  });
  it("builds safe file names", () => {
    expect(reportFileName({ studentName: "Aisha Bello", admissionNo: "ATQ/2022/0001", className: "JSS 1", term: "first", session: "2025/2026" }))
      .toBe("Aisha_Bello_ATQ-2022-0001_JSS_1_first_2025-2026.pdf");
  });
});
