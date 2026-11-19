import { z } from 'zod';

export const DeleteReportCardsInput = z.object({
  school_id: z.string().uuid(),
  report_card_ids: z.array(z.string().uuid()).min(1).max(50000).transform(ids => [...new Set(ids)]),
  confirmation: z.literal('DELETE'),
});

export function selectedReportCardIds<T extends { id: string }>(cards: T[], selected: Set<string>): string[] {
  return cards.filter(card => selected.has(card.id)).map(card => card.id);
}