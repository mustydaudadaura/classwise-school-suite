import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyRegistrationReview } from './registration-review';
test('administrator editing preserves pending inactive status and saved changes', () => {
  const row = { id: 'c1', active: false, pending_activation: true, name: 'Primary 1' };
  assert.equal(verifyRegistrationReview(row, 'c1', 'edit', { name: 'Primary 1' }).name, 'Primary 1');
  assert.throws(() => verifyRegistrationReview({ ...row, active: true }, 'c1', 'edit'));
  assert.throws(() => verifyRegistrationReview(row, 'c1', 'edit', { name: 'Primary 2' }));
});
test('rejection requires a saved reason and leaves registration inactive outside approval queue', () => {
  const row = { id: 's1', active: false, pending_activation: false, rejected_at: '2026-10-29', rejection_reason: 'Duplicate admission' };
  assert.equal(verifyRegistrationReview(row, 's1', 'reject').rejection_reason, 'Duplicate admission');
  assert.throws(() => verifyRegistrationReview({ ...row, rejection_reason: null }, 's1', 'reject'));
  assert.throws(() => verifyRegistrationReview({ ...row, pending_activation: true }, 's1', 'reject'));
});