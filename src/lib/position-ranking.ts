/**
 * Class position ranking — shared by publishing, preview and tests.
 * Positions never change a student's total, average, grade or GPA.
 *
 * Methods:
 * - "total"   (original behaviour): sort by total score, positions 1..n with no ties.
 * - "average": highest average first; equal averages share a position and the
 *              next position is skipped (competition ranking: 1, 2, 2, 4).
 * - "ranges":  the school maps average ranges to positions.
 *
 * Range boundary rule: a range covers averages from its "min" (inclusive) up to,
 * but not including, the next higher range's "min". The top range also includes
 * its "max". So with 90–94 and 95–100, an average of 94.6 belongs to 90–94 and
 * 95 belongs to 95–100 — a score can never belong to two positions.
 * Averages below the lowest range get no position.
 */
export type RankingMethod = "total" | "average" | "ranges";
export type RankRange = { min: number; max: number; position: number };
export type RankInput = { student_id: string; total_score: number; average: number };

export const RANKING_METHODS: { id: RankingMethod; label: string; help: string }[] = [
  { id: "total", label: "Rank by total score (original)", help: "Highest total score is 1st; every student gets a different position." },
  { id: "average", label: "Rank by average", help: "Highest average is 1st. Equal averages share a position (1, 2, 2, 4)." },
  { id: "ranges", label: "Custom average ranges", help: "You decide which average range gets each position." },
];

export const DEFAULT_RANGES: RankRange[] = [
  { min: 95, max: 100, position: 1 },
  { min: 90, max: 94, position: 2 },
  { min: 85, max: 89, position: 3 },
  { min: 80, max: 84, position: 4 },
  { min: 75, max: 79, position: 5 },
];

export function resolveRanking(template: unknown): { method: RankingMethod; ranges: RankRange[] } {
  const src = template && typeof template === "object" ? (template as Record<string, unknown>) : {};
  const method = (["total", "average", "ranges"] as const).includes(src.ranking_method as RankingMethod)
    ? (src.ranking_method as RankingMethod)
    : "total";
  const ranges = Array.isArray(src.ranking_ranges)
    ? (src.ranking_ranges as unknown[])
        .filter((r): r is RankRange => !!r && typeof r === "object" && ["min", "max", "position"].every((k) => typeof (r as any)[k] === "number"))
        .map((r) => ({ min: r.min, max: r.max, position: r.position }))
    : [];
  return { method, ranges };
}

/** Returns a list of problems; empty means the ranges are valid. */
export function validateRanges(ranges: RankRange[]): string[] {
  const errors: string[] = [];
  if (!ranges.length) return ["Add at least one range."];
  ranges.forEach((r, i) => {
    const n = i + 1;
    if (![r.min, r.max, r.position].every(Number.isFinite)) errors.push(`Range ${n}: fill in every box with a number.`);
    else {
      if (r.min < 0 || r.max > 100) errors.push(`Range ${n}: scores must be between 0 and 100.`);
      if (r.min > r.max) errors.push(`Range ${n}: "from" must not be higher than "to".`);
      if (r.position < 1 || !Number.isInteger(r.position)) errors.push(`Range ${n}: position must be a whole number from 1.`);
    }
  });
  if (errors.length) return errors;
  const sorted = [...ranges].sort((a, b) => b.min - a.min);
  for (let i = 0; i < sorted.length - 1; i++) {
    const hi = sorted[i], lo = sorted[i + 1];
    if (lo.max >= hi.min) errors.push(`Ranges ${lo.min}–${lo.max} and ${hi.min}–${hi.max} overlap.`);
    if (lo.position <= hi.position) errors.push(`The higher range ${hi.min}–${hi.max} must have a better (smaller) position than ${lo.min}–${lo.max}.`);
  }
  const positions = ranges.map((r) => r.position);
  if (new Set(positions).size !== positions.length) errors.push("Each position can only be used by one range.");
  return Array.from(new Set(errors));
}

export function positionForAverage(average: number, ranges: RankRange[]): number | null {
  const sorted = [...ranges].sort((a, b) => b.min - a.min);
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const upper = i === 0 ? r.max : sorted[i - 1].min; // exclusive for lower ranges
    const inside = i === 0 ? average >= r.min && average <= upper : average >= r.min && average < upper;
    if (inside) return r.position;
  }
  return null;
}

export function computePositions(rows: RankInput[], method: RankingMethod, ranges: RankRange[] = []): Map<string, number | null> {
  const out = new Map<string, number | null>();
  if (method === "total") {
    [...rows].sort((a, b) => b.total_score - a.total_score).forEach((r, i) => out.set(r.student_id, i + 1));
    return out;
  }
  if (method === "average") {
    const sorted = [...rows].sort((a, b) => b.average - a.average);
    sorted.forEach((r, i) => {
      const prev = sorted[i - 1];
      out.set(r.student_id, prev && prev.average === r.average ? (out.get(prev.student_id) as number) : i + 1);
    });
    return out;
  }
  if (validateRanges(ranges).length) throw new Error("Custom position ranges are not valid. Fix them in Report Card settings.");
  rows.forEach((r) => out.set(r.student_id, positionForAverage(r.average, ranges)));
  return out;
}

export function ordinal(n: number | null | undefined): string {
  if (n == null) return "—";
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
