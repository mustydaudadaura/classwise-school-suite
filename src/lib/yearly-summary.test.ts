import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yearlySummary } from './yearly-summary';

const r = (student_id: string, term: 'first' | 'second' | 'third', average: number) => ({ student_id, term, average, total_score: null, days_present: 50, days_total: 60 });

test('yearly average is the mean of available terms', () => {
  const [row] = yearlySummary([r('a', 'first', 60), r('a', 'second', 70), r('a', 'third', 80)]);
  assert.equal(row.average, 70);
  assert.equal(row.daysPresent, 150);
});

test('missing term is excluded from the average', () => {
  assert.equal(yearlySummary([r('a', 'first', 60), r('a', 'third', 80)])[0].average, 70);
});

test('ties share a position', () => {
  const rows = yearlySummary([r('a', 'first', 80), r('b', 'first', 80), r('c', 'first', 50)]);
  assert.deepEqual(rows.map(x => x.position), [1, 1, 3]);
});

test('custom ranges decide yearly positions when the school uses them', () => {
  const ranges = [{ min: 95, max: 100, position: 1 }, { min: 90, max: 94, position: 2 }];
  const rows = yearlySummary([r('a', 'first', 96), r('b', 'first', 98), r('c', 'first', 92), r('d', 'first', 60)], { method: 'ranges', ranges });
  const pos = Object.fromEntries(rows.map(x => [x.student_id, x.position]));
  assert.deepEqual(pos, { a: 1, b: 1, c: 2, d: null });
});
