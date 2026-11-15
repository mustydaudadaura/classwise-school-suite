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

// Preserve legacy device drafts while giving both entry views the same cells.
export function loadClassScoreDraft(parts: string[], subjects: string[], store: Storage | null = storage()): ScoreDraft {
  const [school, classId, session, term] = parts;
  const draft = loadScoreDraft(scoreDraftKey(['broadsheet', school, classId, session, term]), store);
  for (const subject of subjects) {
    const individual = loadScoreDraft(scoreDraftKey([school, classId, subject, session, term]), store);
    for (const [student, score] of Object.entries(individual)) draft[`${student}:${subject}`] = score;
  }
  return { ...draft, ...loadScoreDraft(scoreDraftKey(['shared', ...parts]), store) };
}

export function saveClassScoreDraft(parts: string[], subjects: string[], draft: ScoreDraft, store: Storage | null = storage()): void {
  const previous = loadScoreDraft(scoreDraftKey(['shared', ...parts]), store);
  const retained = Object.fromEntries(Object.entries(previous).filter(([cell]) => !subjects.includes(cell.split(':')[1])));
  saveScoreDraft(scoreDraftKey(['shared', ...parts]), { ...retained, ...draft }, store);
  const [school, classId, session, term] = parts;
  const legacy = loadScoreDraft(scoreDraftKey(['broadsheet', school, classId, session, term]), store);
  saveScoreDraft(scoreDraftKey(['broadsheet', school, classId, session, term]), Object.fromEntries(Object.entries(legacy).filter(([cell]) => !subjects.includes(cell.split(':')[1]))), store);
  for (const subject of subjects) saveScoreDraft(scoreDraftKey([school, classId, subject, session, term]), {}, store);
}

// Drop device draft cells that already match the saved mark, so an old draft
// never hides scores saved from the other entry view or blocks publishing.
export function withoutSavedCells(
  draft: ScoreDraft,
  saved: { student_id: string; subject_id: string; ca1: unknown; ca2: unknown; exam: unknown }[],
): ScoreDraft {
  const byCell = new Map(saved.map((r) => [`${r.student_id}:${r.subject_id}`, r]));
  return Object.fromEntries(Object.entries(draft).filter(([cell, s]) => {
    const r = byCell.get(cell);
    return !r || Number(r.ca1 ?? 0) !== s.ca1 || Number(r.ca2 ?? 0) !== s.ca2 || Number(r.exam ?? 0) !== s.exam;
  }));
}
