import test from 'node:test';
import assert from 'node:assert/strict';
import { admissionMode, requireRegistryPermission, classSubmissionState } from './registry-permissions';

test('class and subject registration require school edit permission', () => {
  assert.throws(() => requireRegistryPermission(false));
  assert.doesNotThrow(() => requireRegistryPermission(true));
});
test('authorized student editors use normal admission', () => {
  assert.equal(admissionMode(true, [], 'class-one'), 'direct');
});
test('form masters use approval admission only for their assigned class', () => {
  assert.equal(admissionMode(false, ['class-one'], 'class-one'), 'form-master');
  assert.throws(() => admissionMode(false, ['class-one'], 'class-two'));
});
test('unassigned teachers cannot admit students', () => {
  assert.throws(() => admissionMode(false, [], 'class-one'));
  assert.throws(() => admissionMode(false, ['class-one'], ''));
});
test('teachers submit classes inactive and awaiting administrator activation', () => {
  assert.deepEqual(classSubmissionState(false, true, 'teacher-1'), { active: false, pending_activation: true, submitted_by: 'teacher-1' });
  assert.throws(() => classSubmissionState(false, false, 'teacher-1'));
});
test('administrator class registrations are immediately active', () => {
  assert.deepEqual(classSubmissionState(true, false, 'admin-1'), { active: true, pending_activation: false, submitted_by: 'admin-1' });
});
test('teacher admissions always use pending submission even with student edit permission', () => {
  assert.equal(admissionMode(true, [], 'class-one', true), 'teacher');
  assert.throws(() => admissionMode(true, [], '', true));
});