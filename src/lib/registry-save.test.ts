import test from 'node:test';
import assert from 'node:assert/strict';
import { requireSavedRecord } from './registry-save';

test('registration cannot report success without a saved record', () => {
  assert.throws(() => requireSavedRecord(null, 'school-a'));
});
test('registration cannot report success for a different school', () => {
  assert.throws(() => requireSavedRecord({ id: 'class-1', school_id: 'school-b' }, 'school-a'));
});
test('registration returns the actual saved school record', () => {
  const record = { id: 'student-1', school_id: 'school-a' };
  assert.equal(requireSavedRecord(record, 'school-a'), record);
});