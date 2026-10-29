import { test, expect } from './test-compat';
import { scoreEntryClasses } from './form-master';
const classes = [{ id: 'primary1', teacher_id: 'formmaster' }, { id: 'primary2', teacher_id: 'other' }];
test('form master sees their administrator-assigned class only', () => {
  expect(scoreEntryClasses(classes, 'formmaster', false, []).map(c => c.id)).toEqual(['primary1']);
});
test('administrator can enter scores for every class', () => {
  expect(scoreEntryClasses(classes, 'admin', true, []).map(c => c.id)).toEqual(['primary1', 'primary2']);
});
test('subject teacher retains allocated class access', () => {
  expect(scoreEntryClasses(classes, 'teacher', false, [{ class_id: 'primary2', teacher_id: 'teacher' }]).map(c => c.id)).toEqual(['primary2']);
});