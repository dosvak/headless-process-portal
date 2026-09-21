import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { HeadlessFormComponent } from './headless-form';
import { HeadlessForm } from '../../core/api/models';

const FORM: HeadlessForm = { title: 'Resolve ticket', description: 'd', fields: [
  { name: 'resolution', label: 'Resolution', type: 'textarea', required: true, options: '', value: 'draft', help: '' },
  { name: 'rootCause', label: 'Root cause', type: 'select', required: true, options: 'configuration|defect', value: '', help: '' },
  { name: 'timeSpent', label: 'Minutes', type: 'number', required: true, options: '', value: '30', help: '' },
  { name: 'satisfied', label: 'Accepted', type: 'radio', required: true, options: 'true:Yes|false:No', value: 'true', help: '' },
  { name: 'verified', label: 'Verified', type: 'checkbox', required: false, options: '', value: 'false', help: '' },
  { name: 'paidOn', label: 'Paid on', type: 'date', required: false, options: '', value: '2026-09-11', help: '' }] };

describe('HeadlessFormComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HeadlessFormComponent], providers: [provideZonelessChangeDetection(), provideNoopAnimations()] }));
  it('builds a reactive form from the contract with defaults and validators', async () => {
    const f = TestBed.createComponent(HeadlessFormComponent); f.componentRef.setInput('form', FORM); await f.whenStable();
    const g = f.componentInstance.group();
    expect(Object.keys(g.controls).sort()).toEqual(['paidOn', 'resolution', 'rootCause', 'satisfied', 'timeSpent', 'verified']);
    expect(g.get('resolution')!.value).toBe('draft'); expect(g.get('timeSpent')!.value).toBe(30); expect(g.get('verified')!.value).toBe(false);
    expect(g.valid).toBe(false);   // rootCause required and empty
    g.get('rootCause')!.setValue('defect'); expect(g.valid).toBe(true);
  });
  it('emits typed values (numbers, booleans, ISO dates)', async () => {
    const f = TestBed.createComponent(HeadlessFormComponent); f.componentRef.setInput('form', FORM); await f.whenStable();
    f.componentInstance.group().get('rootCause')!.setValue('configuration');
    const v = f.componentInstance.values();
    expect(v).toEqual({ resolution: 'draft', rootCause: 'configuration', timeSpent: 30, satisfied: true, verified: false, paidOn: '2026-09-11' });
  });
  it('parses value:label options', () => { const c = TestBed.createComponent(HeadlessFormComponent).componentInstance; expect(c.options(FORM.fields[3])).toEqual([{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]); expect(c.options(FORM.fields[1])[0]).toEqual({ value: 'configuration', label: 'configuration' }); });
});
