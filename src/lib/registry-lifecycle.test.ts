import test from 'node:test';
import assert from 'node:assert/strict';
import { protectRoleRemoval } from './registry-lifecycle';
test('administrators cannot remove their own access', () => assert.throws(() => protectRoleRemoval('owner','owner','teacher')));
test('Super Admin access is protected', () => assert.throws(() => protectRoleRemoval('owner','another','super_admin')));
test('other teacher access can be managed', () => assert.doesNotThrow(() => protectRoleRemoval('owner','teacher','teacher')));