import { validateScores, type CaRatioType } from './grading';
export type EntryScore = { ca1: number; ca2: number; exam: number };
export function validateBroadsheet(entries: EntryScore[], ratio: CaRatioType) {
  if (!entries.length) throw new Error('Enter at least one score before saving');
  for (const score of entries) {
    const result = validateScores(score.ca1, score.ca2, score.exam, ratio);
    if (!result.isValid) throw new Error(result.error || 'Invalid scores');
  }
  return entries.length;
}