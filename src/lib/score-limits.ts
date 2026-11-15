/**
 * Score-entry limits and missing-score detection, shared by Results Entry and report generation.
 */
export type LimitCheck = { ok: true; value: number } | { ok: false; error: string };

/** A typed mark is accepted only when it is a number from 0 up to the column's maximum. Blank counts as 0. */
export function checkScoreLimit(raw: string, max: number, label: string): LimitCheck {
  const text = raw.trim();
  if (text === "") return { ok: true, value: 0 };
  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false, error: `${label}: enter a number` };
  if (value < 0) return { ok: false, error: `${label} cannot be below 0` };
  if (value > max) return { ok: false, error: `${value} is more than the ${label} limit of ${max}` };
  return { ok: true, value };
}

export type MissingScore = { student_id: string; subject_id: string };

/** Every pupil × class subject that has no saved score row for the term. */
export function findMissingScores(
  studentIds: string[],
  subjectIds: string[],
  saved: { student_id: string; subject_id: string }[],
): MissingScore[] {
  const have = new Set(saved.map((r) => `${r.student_id}:${r.subject_id}`));
  const out: MissingScore[] = [];
  for (const student_id of studentIds) for (const subject_id of subjectIds) {
    if (!have.has(`${student_id}:${subject_id}`)) out.push({ student_id, subject_id });
  }
  return out;
}
