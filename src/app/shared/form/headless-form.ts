import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormField, HeadlessForm } from '../../core/api/models';

/** Renders a HeadlessForm contract (fields of type text / textarea / number / date / select / checkbox / radio) as a reactive form and
 *  emits the typed values keyed by field name. Options: "a|b|c" or "value:Label|value:Label". */
@Component({
  selector: 'hp-headless-form',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule, MatRadioModule, MatDatepickerModule, MatNativeDateModule, MatButtonModule, MatIconModule],
  styles: [`
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 4px 20px; }
    .full { grid-column: 1 / -1; }
    .check { padding: 8px 0 16px; }
    .radio-group { display: flex; flex-direction: column; gap: 4px; padding: 4px 0 16px; }
    .label { font-size: 12px; color: var(--hp-muted); margin-bottom: 4px; }
    .help { font-size: 12px; color: var(--hp-muted); }
    .actions { display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
    .actions .spacer { flex: 1; }
  `],
  template: `
    <form [formGroup]="group()" (ngSubmit)="submit()">
      <div class="grid">
        @for (f of fields(); track f.name) {
          @switch (f.type) {
            @case ('textarea') {
              <mat-form-field appearance="outline" class="full" [attr.data-field]="f.name"><mat-label>{{ f.label }}</mat-label><textarea matInput [formControlName]="f.name" rows="3"></textarea>@if (f.help) { <mat-hint>{{ f.help }}</mat-hint> }</mat-form-field>
            }
            @case ('number') {
              <mat-form-field appearance="outline" [attr.data-field]="f.name"><mat-label>{{ f.label }}</mat-label><input matInput type="number" [formControlName]="f.name" />@if (f.help) { <mat-hint>{{ f.help }}</mat-hint> }</mat-form-field>
            }
            @case ('date') {
              <mat-form-field appearance="outline" [attr.data-field]="f.name"><mat-label>{{ f.label }}</mat-label><input matInput [matDatepicker]="dp" [formControlName]="f.name" /><mat-datepicker-toggle matIconSuffix [for]="dp" /><mat-datepicker #dp />@if (f.help) { <mat-hint>{{ f.help }}</mat-hint> }</mat-form-field>
            }
            @case ('select') {
              <mat-form-field appearance="outline" [attr.data-field]="f.name"><mat-label>{{ f.label }}</mat-label><mat-select [formControlName]="f.name">@for (o of options(f); track o.value) { <mat-option [value]="o.value">{{ o.label }}</mat-option> }</mat-select>@if (f.help) { <mat-hint>{{ f.help }}</mat-hint> }</mat-form-field>
            }
            @case ('checkbox') {
              <div class="check" [attr.data-field]="f.name"><mat-checkbox [formControlName]="f.name">{{ f.label }}</mat-checkbox>@if (f.help) { <div class="help">{{ f.help }}</div> }</div>
            }
            @case ('radio') {
              <div class="full" [attr.data-field]="f.name"><div class="label">{{ f.label }}{{ f.required ? ' *' : '' }}</div><mat-radio-group class="radio-group" [formControlName]="f.name">@for (o of options(f); track o.value) { <mat-radio-button [value]="o.value">{{ o.label }}</mat-radio-button> }</mat-radio-group>@if (f.help) { <div class="help">{{ f.help }}</div> }</div>
            }
            @default {
              <mat-form-field appearance="outline" [attr.data-field]="f.name"><mat-label>{{ f.label }}</mat-label><input matInput [formControlName]="f.name" />@if (f.help) { <mat-hint>{{ f.help }}</mat-hint> }</mat-form-field>
            }
          }
        }
      </div>
      <div class="actions">
        <ng-content />
        <span class="spacer"></span>
        @if (showSave()) { <button mat-stroked-button type="button" (click)="save.emit(values())" [disabled]="busy()"><mat-icon>save</mat-icon> Save draft</button> }
        <button mat-flat-button type="submit" [disabled]="busy() || group().invalid"><mat-icon>check</mat-icon> {{ submitLabel() }}</button>
      </div>
    </form>
  `,
})
export class HeadlessFormComponent {
  private readonly fb = inject(FormBuilder);
  readonly form = input.required<HeadlessForm>();
  readonly busy = input(false);
  readonly showSave = input(true);
  readonly submitLabel = input('Complete task');
  readonly submitted = output<Record<string, unknown>>();
  readonly save = output<Record<string, unknown>>();
  readonly fields = computed(() => this.form().fields ?? []);
  readonly group = signal<FormGroup>(this.fb.group({}));
  constructor() { effect(() => { this.group.set(this.build(this.fields())); }); }

  options(f: FormField): { value: string; label: string }[] {
    return (f.options || '').split('|').filter(Boolean).map(o => { const i = o.indexOf(':'); return i > 0 ? { value: o.slice(0, i), label: o.slice(i + 1) } : { value: o, label: o }; });
  }
  values(): Record<string, unknown> {
    const raw = this.group().getRawValue() as Record<string, unknown>; const out: Record<string, unknown> = {};
    for (const f of this.fields()) {
      const v = raw[f.name];
      if (f.type === 'number') out[f.name] = v === '' || v === null || v === undefined ? null : Number(v);
      else if (f.type === 'checkbox') out[f.name] = !!v;
      else if (f.type === 'date') out[f.name] = v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? '');
      else if (f.type === 'radio' && (v === 'true' || v === 'false')) out[f.name] = v === 'true';
      else out[f.name] = v ?? '';
    }
    return out;
  }
  submit() { if (this.group().valid) this.submitted.emit(this.values()); else this.group().markAllAsTouched(); }
  private build(fields: FormField[]): FormGroup {
    const controls: Record<string, unknown> = {};
    for (const f of fields) {
      const validators: ValidatorFn[] = f.required && f.type !== 'checkbox' ? [Validators.required] : [];
      let initial: unknown = f.value ?? '';
      if (f.type === 'checkbox') initial = String(f.value).toLowerCase() === 'true';
      else if (f.type === 'date') initial = f.value ? new Date(f.value) : null;
      else if (f.type === 'number') initial = f.value === '' || f.value == null ? null : Number(f.value);
      controls[f.name] = [initial, validators];
    }
    return this.fb.group(controls);
  }
}
