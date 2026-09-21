import { describe, expect, it } from 'vitest';
import { plain } from './plain';
import { errorText } from './errors';

describe('plain (engine serialisation -> JSON)', () => {
  it('unwraps {selected, items} lists and drops @metadata', () => {
    const v = plain<any>({ form: { '@metadata': { className: 'HeadlessForm' }, title: 'T', fields: { selected: [], items: [{ name: 'a', '@metadata': {} }, { name: 'b' }] } } });
    expect(v.form.title).toBe('T'); expect(v.form.fields).toEqual([{ name: 'a' }, { name: 'b' }]); expect(v.form['@metadata']).toBeUndefined();
  });
  it('keeps scalars, arrays and nested objects', () => { expect(plain({ a: 1, b: [1, { c: 'x' }], d: null })).toEqual({ a: 1, b: [1, { c: 'x' }], d: null }); });
});
describe('errorText', () => {
  it('reads the classic API error body', () => { expect(errorText({ status: 403, error: { Data: { errorMessage: 'CWTBG0570E: refused' } } })).toBe('HTTP 403: refused'); });
  it('reads the v2 error body and plain messages', () => { expect(errorText({ status: 400, error: { error_message: 'bad' } })).toBe('HTTP 400: bad'); expect(errorText(new Error('boom'))).toBe('boom'); });
});
