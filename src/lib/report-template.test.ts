import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { REPORT_COLOURS, resolveReportTemplate, positionVisibility, REPORT_LAYOUTS } from './report-template';
describe('school report configuration', () => {
  it('offers more than 20 distinct colours', () => { assert.ok(new Set(REPORT_COLOURS).size > 20); });
  it('independently resolves selected parts', () => { const c = resolveReportTemplate({ border: 'red', table: 'teal', comments: 'gold' }, 'primary'); assert.deepEqual([c.border,c.table,c.comments,c.heading],['red','teal','gold','blue']); });
  it('keeps section defaults', () => { assert.deepEqual(['nursery','primary','secondary',null].map(s => resolveReportTemplate({},s).border),['forest','blue','purple','purple']); });
  it('supports both positions', () => { assert.deepEqual(positionVisibility('both'),{ class: true, subject: true }); });
  it('supports no positions', () => { assert.deepEqual(positionVisibility('none'),{ class: false, subject: false }); });
  it('supports class-only positions', () => { assert.deepEqual(positionVisibility('class'),{ class: true, subject: false }); });
  it('supports subject-only positions', () => { assert.deepEqual(positionVisibility('subject'),{ class: false, subject: true }); });
  it('offers exactly the four report sheet designs', () => {
    assert.deepEqual(REPORT_LAYOUTS.map(l => l.id), ['sheet_alqalam', 'sheet_emerald', 'sheet_hisgrace', 'sheet_fmp']);
  });
  it('defaults to the first design in English and maps removed designs to it', () => {
    const c1 = resolveReportTemplate({});
    assert.equal(c1.layout_id, 'sheet_alqalam');
    assert.equal(c1.report_language, 'en');
    assert.equal(resolveReportTemplate({ layout_id: 'waec_senior' }).layout_id, 'sheet_alqalam');
    assert.equal(resolveReportTemplate({ layout_id: 'sheet_fmp', report_language: 'ha' }).report_language, 'ha');
  });
  it('keeps the language of a removed Arabic or Hausa design', () => {
    assert.equal(resolveReportTemplate({ layout_id: 'islamiyya_arabic' }).report_language, 'ar');
    assert.equal(resolveReportTemplate({ layout_id: 'islamiyya_hausa' }).report_language, 'ha');
  });
});
