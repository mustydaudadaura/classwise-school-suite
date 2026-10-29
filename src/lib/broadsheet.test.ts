import { test, expect } from './test-compat';
import { validateBroadsheet, classSubjects } from './broadsheet';
test('selected class never merges another class or unassigned subjects', () => {
  expect(classSubjects([{ class_id: 'jss1' }, { class_id: 'jss2' }, { class_id: null }], 'jss1')).toEqual([{ class_id: 'jss1' }]);
  expect(classSubjects([{ class_id: null }], '')).toEqual([]);
});
test('general subject entry validates every changed subject score', () => {
  expect(validateBroadsheet([{ ca1: 20, ca2: 20, exam: 60 }, { ca1: 10, ca2: 15, exam: 40 }], '20_20_60')).toBe(2);
  expect(() => validateBroadsheet([{ ca1: 10, ca2: 15, exam: 40 }, { ca1: 21, ca2: 20, exam: 60 }], '20_20_60')).toThrow();
});
test('general entry does not save untouched blank sheets', () => {
  expect(() => validateBroadsheet([], '20_20_60')).toThrow();
});