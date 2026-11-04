// Unsaved score drafts kept on this device so teachers never lose typed scores
// when they leave the tab, refresh or lose connection. Final saving still goes
// through the normal approval-checked save.
export type DraftScore = { ca1: number; ca2: number; exam: number };
export type ScoreDraft = Record<string, DraftScore>;

const PREFIX = 'score-draft:v1:';

function storage(): Storage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

export function scoreDraftKey(parts: (string | undefined | null)[]): string | null {
  if (parts.some((p) => !p)) return null;
  return PREFIX + parts.join(':');
}

function isScore(v: unknown): v is DraftScore {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return ['ca1', 'ca2', 'exam'].every((k) => typeof s[k] === 'number' && Number.isFinite(s[k] as number));
}

export function loadScoreDraft(key: string | null, store: Storage | null = storage()): ScoreDraft {
  if (!key || !store) return {};
  try {
    const parsed = JSON.parse(store.getItem(key) ?? '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    const out: ScoreDraft = {};
    for (const [id, v] of Object.entries(parsed)) if (isScore(v)) out[id] = { ca1: v.ca1, ca2: v.ca2, exam: v.exam };
    return out;
  } catch { return {}; }
}

export function saveScoreDraft(key: string | null, draft: ScoreDraft, store: Storage | null = storage()): void {
  if (!key || !store) return;
  try {
    if (Object.keys(draft).length) store.setItem(key, JSON.stringify(draft));
    else store.removeItem(key);
  } catch { /* storage full or blocked: drafts are best-effort */ }
}
