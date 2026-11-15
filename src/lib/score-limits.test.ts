import { expect, test } from "./test-compat";
import { checkScoreLimit, findMissingScores } from "./score-limits";

test("a first CA of 28 is refused when the limit is 20", () => {
  expect(checkScoreLimit("28", 20, "1st CA")).toEqual({ ok: false, error: "28 is more than the 1st CA limit of 20" });
});

test("an exam of 68 is refused when the limit is 60", () => {
  expect(checkScoreLimit("68", 60, "Exam").ok).toBe(false);
});

test("a mark exactly at the limit is accepted", () => {
  expect(checkScoreLimit("20", 20, "1st CA")).toEqual({ ok: true, value: 20 });
});

test("a blank box counts as 0", () => {
  expect(checkScoreLimit("", 60, "Exam")).toEqual({ ok: true, value: 0 });
});

test("pupils with no saved score for a class subject are listed as missing", () => {
  const missing = findMissingScores(["a", "b"], ["math", "eng"], [
    { student_id: "a", subject_id: "math" },
    { student_id: "a", subject_id: "eng" },
    { student_id: "b", subject_id: "math" },
  ]);
  expect(missing).toEqual([{ student_id: "b", subject_id: "eng" }]);
});
