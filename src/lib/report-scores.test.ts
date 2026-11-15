import { expect, test } from "./test-compat";
import { aggregateEnteredScores, hasEnteredScore } from "./report-scores";

test("a draft or submitted score counts without approval", () => {
  const agg = aggregateEnteredScores(["s1"], [
    { student_id: "s1", ca1: 10, ca2: 12, exam: 40, total: 62 },
    { student_id: "s1", ca1: 15, ca2: null, exam: null, total: 15 },
  ]);
  expect(agg.get("s1")).toEqual({ total: 77, count: 2 });
});

test("subjects with no score entered are not counted", () => {
  expect(hasEnteredScore({ student_id: "s1", ca1: null, ca2: null, exam: null, total: 0 })).toBe(false);
  const agg = aggregateEnteredScores(["s1", "s2"], [{ student_id: "s1", ca1: null, ca2: null, exam: null, total: null }]);
  expect(agg.get("s1")).toEqual({ total: 0, count: 0 });
  expect(agg.get("s2")).toEqual({ total: 0, count: 0 });
});

test("a zero mark that was typed in still counts", () => {
  expect(hasEnteredScore({ student_id: "s1", ca1: 0, total: 0 })).toBe(true);
});

test("scores of students outside the class are ignored", () => {
  const agg = aggregateEnteredScores(["s1"], [{ student_id: "x", ca1: 20, total: 20 }]);
  expect(agg.has("x")).toBe(false);
});
