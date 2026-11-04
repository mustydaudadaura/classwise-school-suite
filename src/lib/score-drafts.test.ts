import { describe, expect, it } from 'vitest';
import { loadScoreDraft, saveScoreDraft, scoreDraftKey } from './score-drafts';

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
    expect(store.getItem(key!)).toBeNull();
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
