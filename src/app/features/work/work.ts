import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { BPM_API } from '../../core/api/bpm-api';
import { Priority, SavedSearch, TaskFilter, TaskRow, TaskStats } from '../../core/api/models';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { PriorityClassPipe } from '../../shared/pipes/priority.pipe';
import { AssignDialog } from '../task/assign-dialog';
import { SavedSearchDialog } from './saved-search-dialog';
import { errorText } from '../../shared/ui/errors';

/** Work: the task list of Process Portal - scopes (my tasks / team tasks / all / closed), filters, quick search, stats header,
 *  row actions and bulk actions, saved searches (create / update / delete / run), paging. */
@Component({
  selector: 'hp-work',
  imports: [RouterLink, FormsModule, MatIconModule, MatButtonModule, MatMenuModule, MatButtonToggleModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule, MatPaginatorModule, MatProgressBarModule, MatTooltipModule, RelativeTimePipe, PriorityClassPipe],
  styles: [`
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .stat { padding: 14px 16px; }
    .stat .n { font-size: 26px; font-weight: 700; line-height: 1.1; }
    .stat .l { font-size: 12px; color: var(--hp-muted); }
    .stat.overdue .n { color: var(--hp-danger); } .stat.risk .n { color: #b46b00; } .stat.ok .n { color: var(--hp-ok); }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 12px 16px; margin-bottom: 12px; }
    .toolbar .spacer { flex: 1; }
    .toolbar mat-form-field { width: 170px; }
    .toolbar .q { width: 260px; }
    .list { overflow: hidden; }
    .row { display: grid; grid-template-columns: 32px 1fr 180px 110px 150px 40px; gap: 12px; align-items: center; padding: 12px 16px; border-top: 1px solid var(--hp-border); transition: background .12s; }
    .row:first-child { border-top: 0; }
    .row:hover { background: color-mix(in srgb, var(--hp-accent) 5%, transparent); }
    .row.selected { background: color-mix(in srgb, var(--hp-accent) 10%, transparent); }
    .row .subject { font-weight: 600; color: var(--hp-text); }
    .row .meta { font-size: 12px; color: var(--hp-muted); display: flex; gap: 10px; flex-wrap: wrap; }
    .row .bdata { font-size: 12px; color: var(--hp-text); display: flex; gap: 12px; flex-wrap: wrap; margin-top: 3px; } .row .bdata b { font-weight: 500; color: var(--hp-muted); margin-right: 3px; }
    .row .due { font-size: 13px; } .row .due.over { color: var(--hp-danger); font-weight: 600; } .row .due.soon { color: #b46b00; }
    .head { display: flex; align-items: center; gap: 12px; padding: 10px 16px; font-size: 12px; color: var(--hp-muted); border-bottom: 1px solid var(--hp-border); }
    .head .spacer { flex: 1; }
    .bulk { display: flex; gap: 8px; align-items: center; }
    @media (max-width: 900px) { .row { grid-template-columns: 32px 1fr 40px; } .row .c3, .row .c4, .row .c5 { display: none; } }
  `],
  template: `
    <div class="hp-page">
      <h1 class="hp-page-title"><mat-icon>inbox</mat-icon> Work <span class="spacer"></span>
        <button mat-stroked-button [matMenuTriggerFor]="savedMenu"><mat-icon>bookmark</mat-icon> Saved searches</button>
        <mat-menu #savedMenu="matMenu">
          @for (s of saved(); track s.id) { <button mat-menu-item (click)="runSaved(s)"><mat-icon>{{ s.shared ? 'group' : 'bookmark' }}</mat-icon> {{ s.name }}</button> } @empty { <button mat-menu-item disabled>No saved searches yet</button> }
          <button mat-menu-item (click)="saveCurrent()"><mat-icon>bookmark_add</mat-icon> Save the current search...</button>
          @if (activeSaved()) { <button mat-menu-item (click)="deleteSaved()"><mat-icon>delete</mat-icon> Delete "{{ activeSaved()!.name }}"</button> }
        </mat-menu>
        <button mat-icon-button matTooltip="Refresh" (click)="load()"><mat-icon>refresh</mat-icon></button>
      </h1>
      <div class="stats">
        <div class="stat hp-card"><div class="n">{{ stats()?.total ?? '–' }}</div><div class="l">Open tasks</div></div>
        <div class="stat hp-card ok"><div class="n">{{ stats()?.onTrack ?? '–' }}</div><div class="l">On track</div></div>
        <div class="stat hp-card risk"><div class="n">{{ stats()?.atRisk ?? '–' }}</div><div class="l">At risk</div></div>
        <div class="stat hp-card overdue"><div class="n">{{ stats()?.overdue ?? '–' }}</div><div class="l">Overdue</div></div>
        <div class="stat hp-card"><div class="n">{{ stats()?.byPriority?.['High'] ?? 0 }}</div><div class="l">High priority</div></div>
      </div>
      <div class="toolbar hp-card">
        <mat-button-toggle-group [value]="filter().scope" (change)="set({ scope: $event.value, offset: 0 })" hideSingleSelectionIndicator>
          <mat-button-toggle value="mine">My tasks</mat-button-toggle><mat-button-toggle value="team">Team tasks</mat-button-toggle><mat-button-toggle value="all">All open</mat-button-toggle><mat-button-toggle value="closed">Closed</mat-button-toggle>
        </mat-button-toggle-group>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="q"><mat-label>Search subject</mat-label><input matInput [ngModel]="filter().text" (keydown.enter)="set({ text: $any($event.target).value, offset: 0 })" /><mat-icon matSuffix>search</mat-icon></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Priority</mat-label><mat-select [ngModel]="filter().priorities ?? []" (ngModelChange)="set({ priorities: $event, offset: 0 })" multiple>@for (p of priorities; track p) { <mat-option [value]="p">{{ p }}</mat-option> }</mat-select></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Due</mat-label><mat-select [ngModel]="filter().due ?? 'any'" (ngModelChange)="set({ due: $event, offset: 0 })"><mat-option value="any">Any time</mat-option><mat-option value="overdue">Overdue</mat-option><mat-option value="today">Today</mat-option><mat-option value="week">Next 7 days</mat-option></mat-select></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Sort</mat-label><mat-select [ngModel]="filter().sort ?? 'taskDueDate'" (ngModelChange)="set({ sort: $event })"><mat-option value="taskDueDate">Due date</mat-option><mat-option value="taskPriority">Priority</mat-option><mat-option value="taskReceivedDate">Received</mat-option><mat-option value="taskSubject">Subject</mat-option><mat-option value="instanceName">Instance</mat-option></mat-select></mat-form-field>
        <button mat-icon-button (click)="set({ sortDir: filter().sortDir === 'desc' ? 'asc' : 'desc' })" [matTooltip]="filter().sortDir === 'desc' ? 'Descending' : 'Ascending'"><mat-icon>{{ filter().sortDir === 'desc' ? 'arrow_downward' : 'arrow_upward' }}</mat-icon></button>
        <span class="spacer"></span>
        @if (selected().size) {
          <div class="bulk"><span class="hp-muted">{{ selected().size }} selected</span>
            <button mat-stroked-button (click)="bulk('claim')"><mat-icon>pan_tool</mat-icon> Claim</button>
            <button mat-stroked-button color="warn" (click)="bulk('cancel')"><mat-icon>cancel</mat-icon> Cancel</button>
          </div>
        }
      </div>
      <div class="list hp-card">
        @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
        <div class="head"><mat-checkbox [checked]="allSelected()" [indeterminate]="selected().size > 0 && !allSelected()" (change)="toggleAll($event.checked)" /> <span>{{ result()?.totalCount ?? 0 }} task(s)</span> <span class="spacer"></span> @if (activeSaved()) { <span class="hp-chip"><mat-icon style="font-size:14px;width:14px;height:14px">bookmark</mat-icon> {{ activeSaved()!.name }}</span> }</div>
        @for (t of result()?.rows ?? []; track t.taskId) {
          <div class="row" [class.selected]="selected().has(t.taskId)">
            <mat-checkbox [checked]="selected().has(t.taskId)" (change)="toggle(t.taskId, $event.checked)" />
            <div><a class="subject" [routerLink]="['/task', t.taskId]">{{ t.subject }}</a>
              <div class="meta"><span>{{ t.instanceName }}</span><span>{{ t.processName }}</span>@if (t.appAcronym) { <span class="hp-chip neutral">{{ t.appAcronym }}</span> }<span>#{{ t.taskId }}</span></div>
              @if (t.businessData) { <div class="bdata">@for (e of entries(t.businessData); track e[0]) { <span><b>{{ e[0] }}</b> {{ e[1] }}</span> }</div> }</div>
            <div class="c3 hp-muted" style="font-size:12px">@if (t.assignedType === 'Group') { <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:-2px">groups</mat-icon> } @else { <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:-2px">person</mat-icon> } {{ display(t.assignedTo) }}</div>
            <div class="c4"><span class="hp-chip" [class]="'hp-chip ' + (t.priority | priorityClass)">{{ t.priority }}</span></div>
            <div class="c5 due" [class.over]="isOverdue(t)" [class.soon]="isSoon(t)">@if (t.dueDate) { <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:-2px">schedule</mat-icon> {{ t.dueDate | relativeTime }} } @else { <span class="hp-muted">no due date</span> }</div>
            <button mat-icon-button [matMenuTriggerFor]="rowMenu" [matMenuTriggerData]="{ t: t }" aria-label="Actions"><mat-icon>more_vert</mat-icon></button>
          </div>
        } @empty { @if (!loading()) { <div class="hp-empty"><mat-icon>inbox</mat-icon><div>No tasks match this view.</div></div> } }
        <mat-paginator [length]="result()?.totalCount ?? 0" [pageSize]="filter().size ?? 25" [pageIndex]="(filter().offset ?? 0) / (filter().size ?? 25)" [pageSizeOptions]="[10, 25, 50, 100]" (page)="page($event)" showFirstLastButtons />
      </div>
      <mat-menu #rowMenu="matMenu">
        <ng-template matMenuContent let-t="t">
          <a mat-menu-item [routerLink]="['/task', t.taskId]"><mat-icon>open_in_new</mat-icon> Open task</a>
          @if (t.status !== 'Closed') {
            <button mat-menu-item (click)="act('claim', t)"><mat-icon>pan_tool</mat-icon> Claim</button>
            <button mat-menu-item (click)="act('release', t)"><mat-icon>undo</mat-icon> Release to team</button>
            <button mat-menu-item (click)="act('assign', t)"><mat-icon>person_add</mat-icon> Assign to...</button>
            <button mat-menu-item [matMenuTriggerFor]="prioMenu" [matMenuTriggerData]="{ t: t }"><mat-icon>flag</mat-icon> Priority</button>
            <button mat-menu-item (click)="act('cancel', t)"><mat-icon>cancel</mat-icon> Cancel task</button>
          }
          <a mat-menu-item [routerLink]="['/instance', t.instanceId]"><mat-icon>account_tree</mat-icon> Open instance</a>
        </ng-template>
      </mat-menu>
      <mat-menu #prioMenu="matMenu"><ng-template matMenuContent let-t="t">@for (p of priorities; track p) { <button mat-menu-item (click)="setPriority(t, p)">{{ p }}</button> }</ng-template></mat-menu>
    </div>
  `,
})
export class WorkPage {
  private readonly api = inject(BPM_API); private readonly snack = inject(MatSnackBar); private readonly dialog = inject(MatDialog); private readonly router = inject(Router);
  readonly priorities: Priority[] = ['Highest', 'High', 'Normal', 'Low', 'Lowest'];
  readonly filter = signal<TaskFilter>(WorkPage.restore());
  readonly result = signal<import('../../core/api/models').TaskSearchResult | null>(null);
  readonly stats = signal<TaskStats | null>(null);
  readonly loading = signal(false);
  readonly selected = signal(new Set<number>());
  readonly saved = signal<SavedSearch[]>([]);
  readonly activeSaved = signal<SavedSearch | null>(null);
  readonly allSelected = computed(() => { const rows = this.result()?.rows ?? []; return rows.length > 0 && rows.every(r => this.selected().has(r.taskId)); });
  constructor() { effect(() => { const f = this.filter(); void this.fetch(f); try { sessionStorage.setItem('hp.work.filter', JSON.stringify(f)); } catch { /* ignore */ } }); void this.loadSaved(); }

  private static restore(): TaskFilter { try { const raw = sessionStorage.getItem('hp.work.filter'); if (raw) return { ...JSON.parse(raw), offset: 0 }; } catch { /* ignore */ } return { scope: 'mine', sort: 'taskDueDate', sortDir: 'asc', size: 25, offset: 0 }; }
  set(patch: Partial<TaskFilter>) { this.activeSaved.set(null); this.filter.update(f => ({ ...f, ...patch })); }
  load() { void this.fetch(this.filter()); }
  private async fetch(f: TaskFilter) {
    this.loading.set(true);
    try { const [r, s] = await Promise.all([this.api.searchTasks(f), this.api.taskStats(f.scope === 'closed' ? 'mine' : f.scope)]); this.result.set(r); this.stats.set(s); this.selected.set(new Set()); }
    catch (e) { this.snack.open(errorText(e), 'Close', { duration: 6000, panelClass: 'hp-error' }); }
    finally { this.loading.set(false); }
  }
  page(e: PageEvent) { this.filter.update(f => ({ ...f, size: e.pageSize, offset: e.pageIndex * e.pageSize })); }
  toggle(id: number, on: boolean) { this.selected.update(s => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; }); }
  toggleAll(on: boolean) { this.selected.set(on ? new Set((this.result()?.rows ?? []).map(r => r.taskId)) : new Set()); }
  display(who: string | null) { if (!who) return 'unassigned'; const m = /^(.+?)_[TS]_[0-9a-f-]+/.exec(who); return m ? m[1] : who; }
  entries(o: Record<string, string>) { return Object.entries(o); }
  isOverdue(t: TaskRow) { return !!t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== 'Closed'; }
  isSoon(t: TaskRow) { return !!t.dueDate && !this.isOverdue(t) && new Date(t.dueDate).getTime() - Date.now() < 4 * 3600000; }
  async act(action: 'claim' | 'release' | 'assign' | 'cancel', t: TaskRow) {
    try {
      if (action === 'claim') { await this.api.claim(String(t.taskId)); this.snack.open(`Task #${t.taskId} claimed`, undefined, { duration: 2500 }); }
      else if (action === 'release') { await this.api.release(String(t.taskId)); this.snack.open(`Task #${t.taskId} released to the team`, undefined, { duration: 2500 }); }
      else if (action === 'cancel') { if (!confirm(`Cancel task #${t.taskId} "${t.subject}"?`)) return; await this.api.cancelTask(String(t.taskId)); this.snack.open(`Task #${t.taskId} cancelled`, undefined, { duration: 2500 }); }
      else { const target = await this.dialog.open(AssignDialog, { width: '520px' }).afterClosed().toPromise(); if (!target) return; await this.api.assign(String(t.taskId), target); this.snack.open(`Task #${t.taskId} assigned to ${target.user ?? target.group}`, undefined, { duration: 2500 }); }
      this.load();
    } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); }
  }
  async setPriority(t: TaskRow, p: Priority) { try { await this.api.setPriority(String(t.taskId), p); this.load(); } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); } }
  async bulk(action: 'claim' | 'cancel') {
    const ids = [...this.selected()].map(String); if (!ids.length) return;
    if (action === 'cancel' && !confirm(`Cancel ${ids.length} task(s)?`)) return;
    try { action === 'claim' ? await this.api.bulkClaim(ids) : await this.api.bulkCancel(ids); this.snack.open(`${ids.length} task(s) ${action === 'claim' ? 'claimed' : 'cancelled'}`, undefined, { duration: 2500 }); this.load(); }
    catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); }
  }
  async loadSaved() { try { this.saved.set(await this.api.savedSearches()); } catch { /* optional */ } }
  runSaved(s: SavedSearch) { const f = (s as SavedSearch & { filter?: TaskFilter }).filter; if (f) { this.filter.set({ ...f, offset: 0, size: f.size ?? 25 }); this.activeSaved.set(s); } }
  async saveCurrent() {
    const res = await this.dialog.open(SavedSearchDialog, { width: '460px', data: { name: this.activeSaved()?.name ?? '', shared: this.activeSaved()?.shared ?? false } }).afterClosed().toPromise(); if (!res) return;
    try { const s = await this.api.saveSearch({ id: res.update ? this.activeSaved()?.id : undefined, name: res.name, shared: res.shared, filter: this.filter() }); this.snack.open(`Search "${s.name}" saved`, undefined, { duration: 2500 }); await this.loadSaved(); this.activeSaved.set(this.saved().find(x => x.id === s.id) ?? s); }
    catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); }
  }
  async deleteSaved() { const s = this.activeSaved(); if (!s || !confirm(`Delete saved search "${s.name}"?`)) return; try { await this.api.deleteSearch(s.id); this.activeSaved.set(null); await this.loadSaved(); } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); } }
}
