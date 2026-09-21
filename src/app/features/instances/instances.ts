import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BPM_API } from '../../core/api/bpm-api';
import { InstanceFilter, InstanceSearchResult, StatusOverview } from '../../core/api/models';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { errorText } from '../../shared/ui/errors';

/** Instances: search (status, text, application, process, involved only), status overview, paging; rows open the instance page. */
@Component({
  selector: 'hp-instances',
  imports: [RouterLink, FormsModule, MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, MatPaginatorModule, MatProgressBarModule, MatTooltipModule, RelativeTimePipe],
  styles: [`
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .stat { padding: 12px 16px; cursor: pointer; border: 2px solid transparent; } .stat.on { border-color: var(--hp-accent); }
    .stat .n { font-size: 24px; font-weight: 700; } .stat .l { font-size: 12px; color: var(--hp-muted); }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 12px 16px; margin-bottom: 12px; }
    .toolbar mat-form-field { width: 200px; } .toolbar .spacer { flex: 1; }
    .row { display: grid; grid-template-columns: 1fr 160px 120px 140px 140px; gap: 12px; align-items: center; padding: 12px 16px; border-top: 1px solid var(--hp-border); }
    .row:first-child { border-top: 0; } .row:hover { background: color-mix(in srgb, var(--hp-accent) 5%, transparent); }
    .row .n { font-weight: 600; } .row .m { font-size: 12px; color: var(--hp-muted); }
    @media (max-width: 900px) { .row { grid-template-columns: 1fr 100px; } .row .c3, .row .c4, .row .c5 { display: none; } }
  `],
  template: `
    <div class="hp-page">
      <h1 class="hp-page-title"><mat-icon>account_tree</mat-icon> Instances <span class="spacer"></span><button mat-icon-button (click)="load()" matTooltip="Refresh"><mat-icon>refresh</mat-icon></button></h1>
      <div class="stats">
        @for (s of statuses; track s.key) { <div class="stat hp-card" [class.on]="filter().statuses?.[0] === s.key" (click)="set({ statuses: filter().statuses?.[0] === s.key ? [] : [s.key], offset: 0 })"><div class="n">{{ overview()?.[s.key] ?? '–' }}</div><div class="l">{{ s.label }}</div></div> }
      </div>
      <div class="toolbar hp-card">
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Name contains</mat-label><input matInput [ngModel]="filter().text" (keydown.enter)="set({ text: $any($event.target).value, offset: 0 })" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Application (acronym)</mat-label><input matInput [ngModel]="filter().app" (keydown.enter)="set({ app: $any($event.target).value, offset: 0 })" /></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Process</mat-label><input matInput [ngModel]="filter().process" (keydown.enter)="set({ process: $any($event.target).value, offset: 0 })" /></mat-form-field>
        <mat-slide-toggle [checked]="!!filter().involvedOnly" (change)="set({ involvedOnly: $event.checked, offset: 0 })">Only mine</mat-slide-toggle>
        <span class="spacer"></span>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Sort</mat-label><mat-select [ngModel]="filter().sort ?? 'instanceModifyDate'" (ngModelChange)="set({ sort: $event })"><mat-option value="instanceModifyDate">Modified</mat-option><mat-option value="instanceCreateDate">Created</mat-option><mat-option value="instanceDueDate">Due</mat-option><mat-option value="instanceName">Name</mat-option><mat-option value="bpdName">Process</mat-option></mat-select></mat-form-field>
        <button mat-icon-button (click)="set({ sortDir: filter().sortDir === 'asc' ? 'desc' : 'asc' })"><mat-icon>{{ filter().sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon></button>
      </div>
      <div class="hp-card">
        @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
        @for (i of result()?.rows ?? []; track i.instanceId) {
          <div class="row">
            <div><a class="n" [routerLink]="['/instance', i.instanceId]">{{ i.name || ('#' + i.instanceId) }}</a><div class="m">{{ i.processName }} &middot; #{{ i.instanceId }}</div></div>
            <div class="c3"><span class="hp-chip neutral">{{ i.appAcronym || '-' }}</span></div>
            <div><span class="hp-chip" [class]="'hp-chip ' + chip(i.status)">{{ i.status }}</span></div>
            <div class="c4 m">modified {{ i.modified | relativeTime }}</div>
            <div class="c5 m">@if (i.dueDate) { due {{ i.dueDate | relativeTime }} }</div>
          </div>
        } @empty { @if (!loading()) { <div class="hp-empty"><mat-icon>account_tree</mat-icon><div>No instances match.</div></div> } }
        <mat-paginator [length]="result()?.totalCount ?? 0" [pageSize]="filter().size ?? 25" [pageIndex]="(filter().offset ?? 0) / (filter().size ?? 25)" [pageSizeOptions]="[10, 25, 50, 100]" (page)="page($event)" showFirstLastButtons />
      </div>
    </div>
  `,
})
export class InstancesPage {
  private readonly api = inject(BPM_API); private readonly snack = inject(MatSnackBar);
  readonly statuses = [{ key: 'Active', label: 'Active' }, { key: 'Completed', label: 'Completed' }, { key: 'Failed', label: 'Failed' }, { key: 'Suspended', label: 'Suspended' }, { key: 'Terminated', label: 'Terminated' }] as const;
  readonly filter = signal<InstanceFilter>({ statuses: ['Active'], sort: 'instanceModifyDate', sortDir: 'desc', size: 25, offset: 0 });
  readonly result = signal<InstanceSearchResult | null>(null); readonly overview = signal<StatusOverview | null>(null); readonly loading = signal(false);
  constructor() { effect(() => { void this.fetch(this.filter()); }); void this.api.statusOverview().then(o => this.overview.set(o)).catch(() => undefined); }
  set(patch: Partial<InstanceFilter>) { this.filter.update(f => ({ ...f, ...patch })); }
  load() { void this.fetch(this.filter()); void this.api.statusOverview().then(o => this.overview.set(o)).catch(() => undefined); }
  private async fetch(f: InstanceFilter) { this.loading.set(true); try { this.result.set(await this.api.searchInstances(f)); } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 6000, panelClass: 'hp-error' }); } finally { this.loading.set(false); } }
  page(e: PageEvent) { this.filter.update(f => ({ ...f, size: e.pageSize, offset: e.pageIndex * e.pageSize })); }
  chip(status: string) { return { Active: '', Completed: 'ok', Failed: 'danger', Suspended: 'warn', Terminated: 'neutral' }[status] ?? 'neutral'; }
}
