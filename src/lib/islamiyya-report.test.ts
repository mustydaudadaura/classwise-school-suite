import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { islamiyyaTotals } from './islamiyya-report';
import { resolveReportTemplate } from './report-template';
describe('Islamiyya report data', () => {
  it('does not invent scores for an empty report', () => {
    assert.deepEqual(islamiyyaTotals([]), { total: null, average: null });
  });
  it('includes a recorded zero in the average', () => {
    const row = { id: 'a', ca1: 0, ca2: 0, exam: 0, grade: null, remark: null, subjects: null };
    assert.deepEqual(islamiyyaTotals([{ ...row, total: 0 }, { ...row, id: 'b', total: 80 }]), { total: 80, average: 40 });
  });
  it('resolves the separate Islamiyya template without changing the existing default', () => {
    assert.equal(resolveReportTemplate({ layout_id: 'islamiyya_arabic' }).layout_id, 'islamiyya_arabic');
    assert.equal(resolveReportTemplate({}).layout_id, 'classic_comprehensive');
  });
});