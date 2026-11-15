/**
 * Report cards use every score a teacher has saved — approval is not required.
 * A score counts once any of CA1, CA2 or Exam has been entered.
 */
export type SavedScore = {
  student_id: string;
  total?: number | string | null;
  ca1?: number | string | null;
  ca2?: number | string | null;
  exam?: number | string | null;
};

const filled = (v: unknown) => v !== null && v !== undefined && v !== "";

export function hasEnteredScore(a: SavedScore): boolean {
  return filled(a.ca1) || filled(a.ca2) || filled(a.exam) || Number(a.total ?? 0) > 0;
}

/** Total and subject count per student, from entered scores only. Students with nothing entered get count 0. */
export function aggregateEnteredScores(studentIds: string[], rows: SavedScore[]) {
  const agg = new Map<string, { total: number; count: number }>();
  for (const id of studentIds) agg.set(id, { total: 0, count: 0 });
  for (const a of rows) {
    if (!hasEnteredScore(a) || !agg.has(a.student_id)) continue;
    const cur = agg.get(a.student_id)!;
    cur.total += Number(a.total ?? 0);
    cur.count += 1;
  }
  return agg;
}
