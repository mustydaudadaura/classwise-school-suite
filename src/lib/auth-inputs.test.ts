import test from 'node:test';
import assert from 'node:assert/strict';
import { requireAuthInputs } from './auth-inputs';

test('missing sign-in configuration denies access instead of creating an admin', () => {
  assert.throws(() => requireAuthInputs(undefined, undefined, ''), /not configured/);
});
test('configured requests without a bearer token are denied', () => {
  assert.throws(() => requireAuthInputs('https://example.invalid', 'public-config', ''), /Unauthorized/);
});
test('empty bearer tokens are denied', () => {
  assert.throws(() => requireAuthInputs('https://example.invalid', 'public-config', 'Bearer '), /missing/);
});