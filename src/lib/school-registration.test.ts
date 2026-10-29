import test from 'node:test';
import assert from 'node:assert/strict';
import { schoolRegistrationSchema } from './school-registration';

const form = { name: 'Test Academy', code: 'TA-001', address: '', phone: '', email: '', motto: '', current_session: '2026/2027' };
test('school registration rejects an empty school name', () => {
  assert.equal(schoolRegistrationSchema.safeParse({ ...form, name: '  ' }).success, false);
});
test('school registration normalizes school codes', () => {
  assert.equal(schoolRegistrationSchema.parse({ ...form, code: ' ta-001 ' }).code, 'TA-001');
});
test('school registration rejects an invalid school code', () => {
  assert.equal(schoolRegistrationSchema.safeParse({ ...form, code: 'TA / 001' }).success, false);
});