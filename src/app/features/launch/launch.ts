import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BPM_API } from '../../core/api/bpm-api';
import { ExposedProcess, FormField, HeadlessForm, ProcessModel } from '../../core/api/models';
import { HeadlessFormComponent } from '../../shared/form/headless-form';
import { errorText } from '../../shared/ui/errors';

/** Launch: the processes the user may start (GET /exposed/process), grouped by application with favorites; the start form is generated
 *  from the process model inputs (GET /processModel/{bpdId}); start = POST /process?action=start with the params JSON. */
@Component({
  selector: 'hp-launch',
  imports: [FormsModule, MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressBarModule, MatTooltipModule, HeadlessFormComponent],
  styles: [`
    .layout { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 16px; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    .apps { padding: 8px 0; max-height: calc(100vh - 200px); overflow: auto; }
    .app { padding: 10px 16px 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--hp-muted); display: flex; align-items: center; gap: 8px; }
    .proc { display: flex; align-items: center; gap: 10px; padding: 9px 16px; cursor: pointer; border-left: 3px solid transparent; }
    .proc:hover { background: color-mix(in srgb, var(--hp-accent) 6%, transparent); }
    .proc.sel { background: color-mix(in srgb, var(--hp-accent) 12%, transparent); border-left-color: var(--hp-accent); }
    .proc .n { flex: 1; font-weight: 500; } .proc .s { font-size: 11px; color: var(--hp-muted); }
    .proc mat-icon.fav { color: var(--hp-warn); }
    .card { padding: 22px; }
    .desc { color: var(--hp-muted); margin-bottom: 16px; }
    .filter { padding: 12px 16px 0; }
    .empty-form { padding: 12px 0; color: var(--hp-muted); }
  `],
  template: `
    <div class="hp-page">
      <h1 class="hp-page-title"><mat-icon>rocket_launch</mat-icon> Launch <span class="spacer"></span><button mat-icon-button (click)="load()" matTooltip="Refresh"><mat-icon>refresh</mat-icon></button></h1>
      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
      <div class="layout">
        <div class="hp-card apps">
          <div class="filter"><mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:100%"><mat-label>Filter processes</mat-label><input matInput [ngModel]="q()" (ngModelChange)="q.set($event)" /><mat-icon matSuffix>search</mat-icon></mat-form-field></div>
          @if (favorites().length) { <div class="app"><mat-icon style="font-size:16px;width:16px;height:16px">star</mat-icon> Favorites</div>
            @for (p of favorites(); track p.itemID + p.snapshotID) { <div class="proc" [class.sel]="selected()?.itemID === p.itemID && selected()?.snapshotID === p.snapshotID" (click)="select(p)"><mat-icon>play_circle</mat-icon><span class="n">{{ p.display }}<div class="s">{{ p.processAppAcronym }} &middot; {{ p.snapshotName }}{{ p.tip ? ' (tip)' : '' }}</div></span></div> } }
          @for (g of groups(); track g.app) {
            <div class="app">{{ g.app }}</div>
            @for (p of g.items; track p.itemID + p.snapshotID) {
              <div class="proc" [class.sel]="selected()?.itemID === p.itemID && selected()?.snapshotID === p.snapshotID" (click)="select(p)">
                <mat-icon>play_circle</mat-icon><span class="n">{{ p.display }}<div class="s">{{ p.processAppAcronym }} &middot; {{ p.snapshotName }}{{ p.tip ? ' (tip)' : '' }}</div></span>
                <mat-icon class="fav" [class.fav]="isFav(p)" style="cursor:pointer" (click)="toggleFav(p, $event)">{{ isFav(p) ? 'star' : 'star_border' }}</mat-icon>
              </div>
            }
          } @empty { @if (!loading()) { <div class="hp-empty">No process is exposed to you.</div> } }
        </div>
        <div class="card hp-card">
          @if (selected(); as p) {
            <h2 style="margin:0 0 4px;font-size:20px">{{ p.display }}</h2>
            <div class="desc">{{ model()?.description || (p.processAppName + ' - snapshot ' + p.snapshotName) }}</div>
            @if (modelLoading()) { <mat-progress-bar mode="indeterminate" /> }
            @if (form(); as f) {
              @if (!f.fields.length) { <div class="empty-form">This process takes no input.</div> }
              <hp-headless-form [form]="f" [busy]="starting()" [showSave]="false" submitLabel="Start process" (submitted)="start($event)" />
            }
            @if (lastStarted(); as s) { <div class="hp-chip ok" style="margin-top:14px"><mat-icon style="font-size:16px;width:16px;height:16px">check</mat-icon> Started instance {{ s.name }} (#{{ s.piid }})</div> }
          } @else { <div class="hp-empty"><mat-icon>rocket_launch</mat-icon><div>Pick a process to start.</div></div> }
        </div>
      </div>
    </div>
  `,
})
export class LaunchPage {
  private readonly api = inject(BPM_API); private readonly router = inject(Router); private readonly snack = inject(MatSnackBar);
  readonly items = signal<ExposedProcess[]>([]); readonly loading = signal(false); readonly q = signal('');
  readonly selected = signal<ExposedProcess | null>(null); readonly model = signal<ProcessModel | null>(null); readonly modelLoading = signal(false);
  readonly starting = signal(false); readonly lastStarted = signal<{ piid: string; name: string } | null>(null);
  readonly favs = signal<string[]>(LaunchPage.loadFavs());
  readonly filtered = computed(() => { const q = this.q().toLowerCase(); return this.items().filter(p => !q || p.display.toLowerCase().includes(q) || p.processAppName.toLowerCase().includes(q) || p.processAppAcronym.toLowerCase().includes(q)); });
  readonly groups = computed(() => { const m = new Map<string, ExposedProcess[]>(); for (const p of this.filtered()) { const k = `${p.processAppName} (${p.processAppAcronym})`; m.set(k, [...(m.get(k) ?? []), p]); } return [...m.entries()].map(([app, items]) => ({ app, items })); });
  readonly favorites = computed(() => this.filtered().filter(p => this.isFav(p)));
  readonly form = computed<HeadlessForm | null>(() => { const m = this.model(); if (!m) return null; return { title: m.name, description: m.description, fields: m.inputs.map(i => this.field(i.name, i.type, i.isList)) }; });
  constructor() { void this.load(); }
  async load() { this.loading.set(true); try { this.items.set(await this.api.exposedProcesses()); } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 6000, panelClass: 'hp-error' }); } finally { this.loading.set(false); } }
  async select(p: ExposedProcess) {
    this.selected.set(p); this.model.set(null); this.lastStarted.set(null); this.modelLoading.set(true);
    try { this.model.set(await this.api.processModel(p.itemID, p.snapshotID)); } catch (e) { this.model.set({ name: p.display, description: '', inputs: [], steps: [] }); this.snack.open('Process model unavailable: ' + errorText(e), 'Close', { duration: 6000 }); } finally { this.modelLoading.set(false); }
  }
  private field(name: string, type: string, isList: boolean): FormField {
    const t = type.toLowerCase(); const label = name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
    if (isList || !['string', 'integer', 'decimal', 'boolean', 'date', 'time', 'datetime'].includes(t)) return { name, label: `${label} (${type}${isList ? ' list' : ''}, JSON)`, type: 'textarea', required: false, options: '', value: isList ? '[]' : '{}', help: 'Enter the value as JSON' };
    if (t === 'integer' || t === 'decimal') return { name, label, type: 'number', required: false, options: '', value: '', help: '' };
    if (t === 'boolean') return { name, label, type: 'checkbox', required: false, options: '', value: 'false', help: '' };
    if (t === 'date' || t === 'datetime') return { name, label, type: 'date', required: false, options: '', value: '', help: '' };
    return { name, label, type: /purpose|description|notes|comment/i.test(name) ? 'textarea' : 'text', required: false, options: '', value: '', help: '' };
  }
  async start(values: Record<string, unknown>) {
    const p = this.selected(); const m = this.model(); if (!p || !m) return;
    const params: Record<string, unknown> = {};
    for (const i of m.inputs) { const v = values[i.name]; const t = i.type.toLowerCase(); if (i.isList || !['string', 'integer', 'decimal', 'boolean', 'date', 'time', 'datetime'].includes(t)) { try { params[i.name] = JSON.parse(String(v || (i.isList ? '[]' : '{}'))); } catch { this.snack.open(`${i.name}: invalid JSON`, 'Close', { duration: 5000, panelClass: 'hp-error' }); return; } } else params[i.name] = v ?? ''; }
    this.starting.set(true);
    try {
      const r = await this.api.startProcess(p.itemID, p.snapshotID, params); this.lastStarted.set(r);
      this.snack.open(`Process started: ${r.name} (#${r.piid})`, r.firstTaskId ? 'Open first task' : 'Open instance', { duration: 6000 }).onAction().subscribe(() => void this.router.navigate(r.firstTaskId ? ['/task', r.firstTaskId] : ['/instance', r.piid]));
    } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); }
    finally { this.starting.set(false); }
  }
  isFav(p: ExposedProcess) { return this.favs().includes(p.itemID); }
  toggleFav(p: ExposedProcess, ev: Event) { ev.stopPropagation(); this.favs.update(f => f.includes(p.itemID) ? f.filter(x => x !== p.itemID) : [...f, p.itemID]); try { localStorage.setItem('hp.favs', JSON.stringify(this.favs())); } catch { /* ignore */ } }
  private static loadFavs(): string[] { try { return JSON.parse(localStorage.getItem('hp.favs') || '[]'); } catch { return []; } }
}
