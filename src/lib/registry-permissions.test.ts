import test from 'node:test';
import assert from 'node:assert/strict';
import { admissionMode, requireRegistryPermission } from './registry-permissions';

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