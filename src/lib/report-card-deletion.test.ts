import test from 'node:test';
import assert from 'node:assert/strict';
import { DeleteReportCardsInput, selectedReportCardIds } from './report-card-deletion';

const school_id = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
test('bulk deletion includes every selected report, published or draft', () => {
  assert.deepEqual(selectedReportCardIds([{ id, published: true }, { id: school_id, published: false }], new Set([id, school_id])), [id, school_id]);
});
test('deletion excludes report cards outside the current filtered list', () => {
  assert.deepEqual(selectedReportCardIds([{ id }], new Set([id, school_id])), [id]);
});
test('report deletion requires explicit DELETE confirmation', () => {
  assert.equal(DeleteReportCardsInput.safeParse({ school_id, report_card_ids: [id], confirmation: '' }).success, false);
});
test('deletion accepts only report IDs and keeps score inputs out of the request', () => {
  assert.deepEqual(DeleteReportCardsInput.parse({ school_id, report_card_ids: [id, id], confirmation: 'DELETE', assessments: [id] }), { school_id, report_card_ids: [id], confirmation: 'DELETE' });
});