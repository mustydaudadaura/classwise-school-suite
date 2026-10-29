import test from 'node:test';
import assert from 'node:assert/strict';
import { validateClassCreation, validateSubjectCreation } from './academic-registration';

const cls = { name: 'JSS 1A', level: 'JSS 1', arm: 'A', section: 'secondary' };
const classes = [{ id: 'jss1', school_id: 'school', active: true, pending_activation: false }];
const subject = { name: 'Mathematics', code: 'MTH', class_id: 'jss1' };
for (const field of ['name', 'level', 'arm', 'section'] as const) {
  test(`class creation requires ${field}`, () => assert.throws(() => validateClassCreation({ ...cls, [field]: '  ' })));
}
for (const field of ['name', 'code', 'class_id'] as const) {
  test(`subject creation requires ${field}`, () => assert.throws(() => validateSubjectCreation({ ...subject, [field]: ' ' }, 'school', classes)));
}
test('class must exist and be activated before subject creation', () => {
  assert.throws(() => validateSubjectCreation(subject, 'school', []));
  assert.throws(() => validateSubjectCreation(subject, 'school', [{ ...classes[0], active: false }]));
  assert.throws(() => validateSubjectCreation(subject, 'school', [{ ...classes[0], pending_activation: true }]));
  assert.throws(() => validateSubjectCreation(subject, 'other-school', classes));
});
test('subject stays linked to its selected class and complete fields are trimmed', () => {
  assert.deepEqual(validateSubjectCreation({ ...subject, name: ' Mathematics ', code: ' MTH ' }, 'school', classes), subject);
  assert.deepEqual(validateClassCreation(cls), cls);
});