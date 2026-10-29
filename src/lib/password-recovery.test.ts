import test from 'node:test';
import assert from 'node:assert/strict';
import { isPasswordRecoveryHash, validateResetPassword } from './password-recovery';

test('recovery links are distinguished from ordinary sign-in links', () => {
  assert.equal(isPasswordRecoveryHash('#type=recovery&access_token=example'), true);
  assert.equal(isPasswordRecoveryHash('#type=signup'), false);
  assert.equal(isPasswordRecoveryHash(''), false);
});
test('new passwords must match their confirmation', () => {
  assert.notEqual(validateResetPassword('A-long-example', 'different-example'), null);
  assert.equal(validateResetPassword('A-long-example', 'A-long-example'), null);
});
test('new passwords require at least eight characters', () => {
  assert.notEqual(validateResetPassword('1234567', '1234567'), null);
  assert.equal(validateResetPassword('12345678', '12345678'), null);
});