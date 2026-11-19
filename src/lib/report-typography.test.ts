import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveTypography, TEXT_DEFAULTS, textColourCss } from './report-typography';

describe('report card font settings', () => {
  it('defaults the body to Candara 11pt and the school name to 17pt', () => {
    const t = resolveTypography(undefined);
    assert.deepEqual([t.body.font, t.body.size, t.school_name.size], ['candara', 11, 17]);
  });
  it('keeps each part independent', () => {
    const t = resolveTypography({ school_name: { font: 'cinzel', size: 22, colour: 'gold' } });
    assert.deepEqual([t.school_name.font, t.school_name.size, t.school_name.colour], ['cinzel', 22, 'gold']);
    assert.deepEqual(t.body, TEXT_DEFAULTS.body);
  });
  it('rejects sizes outside 6–36pt and unknown fonts', () => {
    const t = resolveTypography({ body: { size: 50, font: 'comic' }, headings: { size: 5 } });
    assert.equal(t.body.size, 11); assert.equal(t.body.font, 'candara'); assert.equal(t.headings.size, 11);
  });
  it('maps colours to report tokens', () => {
    assert.equal(textColourCss('auto', 'X'), 'X');
    assert.equal(textColourCss('red', 'X'), 'var(--report-colour-red)');
  });
});
