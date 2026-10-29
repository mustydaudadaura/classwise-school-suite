import test from 'node:test';
import assert from 'node:assert/strict';
import type { Tables } from '@/integrations/supabase/types';
import { prepareClassImport, prepareSubjectCopy, verifyImportedRows } from './class-import';

const source: Tables<'classes'> = { id: 'source', school_id: 'school', name: 'Primary 1', section: 'primary', level: 'Primary', arm: 'A', active: true, campus_id: null, teacher_id: 'teacher', created_at: '' };
const target = { ...source, id: 'target', name: 'Primary 2' };
const subject: Tables<'subjects'> = { id: 'math', school_id: 'school', class_id: 'source', name: 'Mathematics', code: 'MTH', active: true, created_at: '' };

test('multiple new classes inherit class settings without copying teacher or records', () => {
  const { rows } = prepareClassImport('Primary 2\nPrimary 3', 'school', [source], 'source');
  assert.deepEqual(rows, ['Primary 2', 'Primary 3'].map(name => ({ school_id: 'school', name, section: 'primary', level: 'Primary', arm: 'A' })));
});
test('class import skips repeated names and existing classes', () => {
  const result = prepareClassImport('primary 1\nPrimary 2\nPRIMARY 2', 'school', [source], 'source');
  assert.equal(result.rows.length, 1);
  assert.equal(result.skipped, 1);
});
test('subjects can be copied to several classes, skipping existing subjects', () => {
  const third = { ...target, id: 'third', name: 'Primary 3' };
  const existing = { ...subject, id: 'existing', class_id: 'target', name: 'mathematics' };
  const result = prepareSubjectCopy('school', 'source', ['target', 'third'], [source, target, third], [subject, existing]);
  assert.deepEqual(result.rows, [{ school_id: 'school', class_id: 'third', name: 'Mathematics', code: 'MTH' }]);
  assert.equal(result.skipped, 1);
});
test('subject copying rejects cross-school destinations and the source itself', () => {
  assert.throws(() => prepareSubjectCopy('school', 'source', ['target'], [source, { ...target, school_id: 'other' }], [subject]));
  assert.throws(() => prepareSubjectCopy('school', 'source', ['source'], [source], [subject]));
});
test('inactive sources are not copied', () => {
  assert.throws(() => prepareClassImport('Primary 2', 'school', [{ ...source, active: false }], 'source'));
  assert.throws(() => prepareSubjectCopy('school', 'source', ['target'], [source, target], [{ ...subject, active: false }]));
});
test('imports must confirm every saved row in the selected school', () => {
  assert.throws(() => verifyImportedRows([], 2, 'school'));
  assert.throws(() => verifyImportedRows([{ id: 'a', school_id: 'other' }], 1, 'school'));
  assert.doesNotThrow(() => verifyImportedRows([{ id: 'a', school_id: 'school' }], 1, 'school'));
});