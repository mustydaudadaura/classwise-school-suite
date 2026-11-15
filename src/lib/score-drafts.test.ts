import { describe, expect, it } from 'vitest';
import { loadScoreDraft, saveScoreDraft, scoreDraftKey, loadClassScoreDraft, saveClassScoreDraft } from './score-drafts';

function memoryStore(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => { m.set(k, v); },
  };
}

describe('score drafts', () => {
  it('shares general and individual cells without erasing other subjects', () => {
    const store = memoryStore();
    const parts = ['school', 'class', '2025/2026', 'first'];
    saveClassScoreDraft(parts, ['maths', 'english'], { 's1:maths': { ca1: 12, ca2: 8, exam: 45 }, 's1:english': { ca1: 15, ca2: 10, exam: 50 } }, store);
    expect(loadClassScoreDraft(parts, ['maths'], store)['s1:maths']).toEqual({ ca1: 12, ca2: 8, exam: 45 });
    saveClassScoreDraft(parts, ['maths'], {}, store);
    expect(loadClassScoreDraft(parts, ['maths', 'english'], store)).toEqual({ 's1:english': { ca1: 15, ca2: 10, exam: 50 } });
  });
  it('migrates old individual and general drafts and does not resurrect saved cells', () => {
    const store = memoryStore();
    const parts = ['school', 'class', '2025/2026', 'first'];
    saveScoreDraft(scoreDraftKey(['broadsheet', ...parts]), { 's1:maths': { ca1: 12, ca2: 8, exam: 45 } }, store);
    saveScoreDraft(scoreDraftKey(['school', 'class', 'english', '2025/2026', 'first']), { s1: { ca1: 15, ca2: 10, exam: 50 } }, store);
    const migrated = loadClassScoreDraft(parts, ['maths', 'english'], store);
    expect(Object.keys(migrated).sort()).toEqual(['s1:english', 's1:maths']);
    saveClassScoreDraft(parts, ['maths', 'english'], {}, store);
    expect(loadClassScoreDraft(parts, ['maths', 'english'], store)).toEqual({});
  });
  it('keeps typed scores after leaving and coming back', () => {
    const store = memoryStore();
    const key = scoreDraftKey(['school', 'class', 'maths', '2025/2026', 'first']);
    saveScoreDraft(key, { s1: { ca1: 12, ca2: 8, exam: 45 } }, store);
    expect(loadScoreDraft(key, store)).toEqual({ s1: { ca1: 12, ca2: 8, exam: 45 } });
  });

  it('clears the draft once everything is finally saved', () => {
    const store = memoryStore();
    const key = scoreDraftKey(['a', 'b', 'c', 'd', 'e']);
    saveScoreDraft(key, { s1: { ca1: 1, ca2: 2, exam: 3 } }, store);
    saveScoreDraft(key, {}, store);
    expect(key && store.getItem(key)).toBeNull();
  });

  it('keeps drafts for different subjects apart', () => {
    const store = memoryStore();
    saveScoreDraft(scoreDraftKey(['s', 'c', 'maths', 'x', 't']), { s1: { ca1: 10, ca2: 0, exam: 0 } }, store);
    expect(loadScoreDraft(scoreDraftKey(['s', 'c', 'english', 'x', 't']), store)).toEqual({});
  });

  it('has no key until class and subject are chosen', () => {
    expect(scoreDraftKey(['school', '', 'maths', 'x', 't'])).toBeNull();
  });
});

import { withoutSavedCells as dropSaved } from './score-drafts';
import { test as t2, expect as e2 } from 'vitest';
t2('drafts matching the saved mark are dropped, changed ones kept', () => {
  const draft = { 'a:m': { ca1: 10, ca2: 5, exam: 40 }, 'b:m': { ca1: 0, ca2: 0, exam: 0 }, 'c:m': { ca1: 3, ca2: 0, exam: 0 } };
  const saved = [{ student_id: 'a', subject_id: 'm', ca1: 10, ca2: 5, exam: 40 }, { student_id: 'b', subject_id: 'm', ca1: 12, ca2: 6, exam: 30 }];
  e2(Object.keys(dropSaved(draft, saved)).sort()).toEqual(['b:m', 'c:m']);
});
