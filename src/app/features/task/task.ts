import { Component, computed, inject, input, signal, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { BPM_API } from '../../core/api/bpm-api';
import { HeadlessForm, Priority, StreamItem, TaskDetails } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { HeadlessFormComponent } from '../../shared/form/headless-form';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { PriorityClassPipe } from '../../shared/pipes/priority.pipe';
import { plain } from '../../shared/ui/plain';
import { errorText } from '../../shared/ui/errors';
import { AssignDialog } from './assign-dialog';

/** Task page: header (status, priority, due, owner, team), the headless form (contract from the task data), business data, actions,
 *  collaboration stream with comments and follow. */
@Component({
  selector: 'hp-task',
  imports: [RouterLink, DatePipe, FormsModule, MatIconModule, MatButtonModule, MatMenuModule, MatTabsModule, MatProgressBarModule, MatTooltipModule, MatFormFieldModule, MatInputModule, HeadlessFormComponent, RelativeTimePipe, PriorityClassPipe],
  styles: [`
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; } .layout > * { min-width: 0; }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
    .card { padding: 20px; }
    .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; font-size: 13px; }
    .facts .k { color: var(--hp-muted); font-size: 12px; }
    .desc { color: var(--hp-muted); margin: 4px 0 16px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .data { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; font-size: 13px; }
    .data .k { color: var(--hp-muted); }
    .stream .item { padding: 10px 0; border-top: 1px solid var(--hp-border); font-size: 13px; }
    .stream .item:first-child { border-top: 0; }
    .stream .who { font-weight: 600; } .stream .when { color: var(--hp-muted); font-size: 12px; margin-left: 6px; }
    .comment { display: flex; gap: 8px; align-items: flex-start; margin-top: 8px; }
    .comment mat-form-field { flex: 1; }
    .closed { padding: 14px 16px; border-radius: 10px; background: color-mix(in srgb, var(--hp-ok) 12%, transparent); color: var(--hp-ok); font-weight: 500; }
    pre { background: var(--hp-bg); padding: 12px; border-radius: 10px; overflow: auto; font-size: 12px; }
  `],
  template: `
    <div class="hp-page">
      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
      @if (task(); as t) {
        <h1 class="hp-page-title"><a routerLink="/work" mat-icon-button matTooltip="Back to Work"><mat-icon>arrow_back</mat-icon></a> {{ t.displayName || t.name }}
          <span class="hp-chip" [class]="'hp-chip ' + (t.priorityName | priorityClass)">{{ t.priorityName }}</span>
          <span class="hp-chip" [class]="'hp-chip ' + (t.status === 'Closed' ? 'ok' : overdue() ? 'danger' : 'neutral')">{{ t.status }}</span>
          <span class="spacer"></span>
          @if (t.status !== 'Closed') {
            @if (!mine()) { <button mat-flat-button (click)="act('claim')"><mat-icon>pan_tool</mat-icon> Claim</button> } @else { <button mat-stroked-button (click)="act('release')"><mat-icon>undo</mat-icon> Release</button> }
            <button mat-stroked-button [matMenuTriggerFor]="more"><mat-icon>more_horiz</mat-icon> More</button>
            <mat-menu #more="matMenu">
              <button mat-menu-item (click)="act('assign')"><mat-icon>person_add</mat-icon> Assign to...</button>
              <button mat-menu-item [matMenuTriggerFor]="prio"><mat-icon>flag</mat-icon> Priority</button>
              <button mat-menu-item (click)="dueDialog()"><mat-icon>event</mat-icon> Due date...</button>
              <button mat-menu-item (click)="act('cancel')"><mat-icon>cancel</mat-icon> Cancel task</button>
            </mat-menu>
            <mat-menu #prio="matMenu">@for (p of priorities; track p) { <button mat-menu-item (click)="setPriority(p)">{{ p }}</button> }</mat-menu>
          }
          <button mat-icon-button [matTooltip]="following() ? 'Stop following' : 'Follow'" (click)="toggleFollow()"><mat-icon>{{ following() ? 'notifications_active' : 'notifications_none' }}</mat-icon></button>
        </h1>
        <div class="layout">
          <div style="display:grid;gap:16px;align-content:start">
            <div class="card hp-card">
              @if (t.status === 'Closed') {
                <div class="closed"><mat-icon style="vertical-align:-6px">check_circle</mat-icon> This task was completed {{ t.completionTime | relativeTime }} by {{ t.closeByUserFullName || t.closeByUser || t.owner || 'the engine' }}.</div>
              } @else if (form(); as f) {
                <h2 style="margin:0 0 4px;font-size:18px">{{ f.title }}</h2>
                <div class="desc">{{ f.description }}</div>
                <hp-headless-form [form]="f" [busy]="busy()" (submitted)="complete($event)" (save)="saveDraft($event)">
                  @if (!mine()) { <span class="hp-muted" style="align-self:center">Claim the task to complete it - or complete it directly, the engine assigns it to you.</span> }
                </hp-headless-form>
              } @else {
                <h2 style="margin:0 0 4px;font-size:18px">Complete task</h2>
                <div class="desc">This task carries no headless form contract. Its data is shown below; complete it with the values as they are or edit them as JSON.</div>
                <mat-form-field appearance="outline" style="width:100%"><mat-label>Output data (JSON)</mat-label><textarea matInput rows="6" [(ngModel)]="rawJson"></textarea></mat-form-field>
                <div class="actions"><span style="flex:1"></span><button mat-flat-button [disabled]="busy()" (click)="completeRaw()"><mat-icon>check</mat-icon> Complete task</button></div>
              }
            </div>
            <mat-tab-group class="hp-card">
              <mat-tab label="Business data">
                <div class="card">
                  @if (dataEntries().length) { <div class="data">@for (e of dataEntries(); track e[0]) { <span class="k">{{ e[0] }}</span><span>{{ e[1] }}</span> }</div> } @else { <div class="hp-muted">No business data.</div> }
                </div>
              </mat-tab>
              <mat-tab label="Raw variables"><div class="card"><pre>{{ variablesJson() }}</pre></div></mat-tab>
              <mat-tab label="Activity ({{ stream().length }})">
                <div class="card stream">
                  <div class="comment"><mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Add a comment</mat-label><input matInput [(ngModel)]="commentText" (keydown.enter)="comment()" /></mat-form-field><button mat-flat-button [disabled]="!commentText.trim()" (click)="comment()"><mat-icon>send</mat-icon></button></div>
                  @for (s of stream(); track s.published + s.content) { <div class="item"><span class="who">{{ s.actor?.displayName || s.actor?.id || 'system' }}</span><span class="when">{{ s.published | relativeTime }}</span><div [innerHTML]="s.content"></div></div> } @empty { <div class="hp-muted" style="padding:8px 0">No activity yet.</div> }
                </div>
              </mat-tab>
            </mat-tab-group>
          </div>
          <div style="display:grid;gap:16px;align-content:start">
            <div class="card hp-card">
              <div class="facts">
                <div><div class="k">Instance</div><a [routerLink]="['/instance', t.piid]">{{ t.processInstanceName }}</a></div>
                <div><div class="k">Task id</div>#{{ t.tkiid }}</div>
                <div><div class="k">Assigned to</div>{{ t.assignedToDisplayName || t.assignedTo || 'unassigned' }} <span class="hp-muted">({{ t.assignedToType || '-' }})</span></div>
                <div><div class="k">Team</div>{{ t.teamDisplayName || '-' }}</div>
                <div><div class="k">Due</div><span [style.color]="overdue() ? 'var(--hp-danger)' : ''">{{ t.dueTime ? (t.dueTime | relativeTime) : 'none' }}</span><div class="hp-muted" style="font-size:11px">{{ t.dueTime ? (t.dueTime | date:'medium') : '' }}</div></div>
                <div><div class="k">Received</div>{{ t.activationTime | relativeTime }}</div>
                <div><div class="k">Originator</div>{{ t.originator }}</div>
                <div><div class="k">At risk</div>{{ t.isAtRisk ? 'yes' : 'no' }}</div>
                <div><div class="k">Manager team</div>{{ t.managerTeamDisplayName || '-' }}</div>
                <div><div class="k">Service type</div>{{ t.serviceType }}</div>
              </div>
            </div>
          </div>
        </div>
      } @else if (!loading()) { <div class="hp-empty"><mat-icon>error_outline</mat-icon><div>{{ error() || 'Task not found' }}</div></div> }
    </div>
  `,
})
export class TaskPage {
  private readonly api = inject(BPM_API); private readonly auth = inject(AuthService); private readonly router = inject(Router); private readonly snack = inject(MatSnackBar); private readonly dialog = inject(MatDialog);
  readonly id = input.required<string>();
  readonly task = signal<TaskDetails | null>(null); readonly loading = signal(true); readonly busy = signal(false); readonly error = signal('');
  readonly stream = signal<StreamItem[]>([]); readonly following = signal(false);
  readonly priorities: Priority[] = ['Highest', 'High', 'Normal', 'Low', 'Lowest'];
  commentText = ''; rawJson = '{}';
  readonly variables = computed(() => plain<Record<string, unknown>>(this.task()?.data?.variables ?? {}));
  readonly form = computed<HeadlessForm | null>(() => { const f = this.variables()['form'] as HeadlessForm | undefined; return f && Array.isArray(f.fields) ? f : null; });
  readonly dataEntries = computed(() => { const v = this.variables(); const out: [string, string][] = []; const walk = (o: Record<string, unknown>, prefix: string) => { for (const [k, x] of Object.entries(o)) { if (k === 'form') continue; if (x && typeof x === 'object' && !Array.isArray(x)) walk(x as Record<string, unknown>, prefix + k + '.'); else out.push([prefix + k, Array.isArray(x) ? JSON.stringify(x) : String(x ?? '')]); } }; walk(v, ''); return out; });
  readonly variablesJson = computed(() => JSON.stringify(this.variables(), null, 2));
  readonly mine = computed(() => this.task()?.assignedToType === 'User' && this.task()?.assignedTo === this.auth.userName());
  readonly overdue = computed(() => { const t = this.task(); return !!t?.dueTime && t.status !== 'Closed' && new Date(t.dueTime).getTime() < Date.now(); });
  constructor() { effect(() => { void this.load(this.id()); }); }

  async load(id: string) {
    this.loading.set(true); this.error.set('');
    try { const t = await this.api.task(id); this.task.set(t); const v = plain<Record<string, unknown>>(t.data?.variables ?? {}); delete v['form']; this.rawJson = JSON.stringify(v, null, 2); void this.loadStream(id); }
    catch (e) { this.error.set(errorText(e)); this.task.set(null); }
    finally { this.loading.set(false); }
  }
  async loadStream(id: string) { try { const [s, f] = await Promise.all([this.api.taskStream(id), this.api.isFollowingTask(id)]); this.stream.set(s); this.following.set(f); } catch { /* social API optional */ } }
  async complete(values: Record<string, unknown>) {
    this.busy.set(true);
    try { await this.api.complete(this.id(), values); this.snack.open('Task completed', undefined, { duration: 2500 }); await this.router.navigate(['/work']); }
    catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); }
    finally { this.busy.set(false); }
  }
  async completeRaw() { try { await this.complete(JSON.parse(this.rawJson || '{}')); } catch (e) { this.snack.open('Invalid JSON: ' + (e as Error).message, 'Close', { duration: 6000, panelClass: 'hp-error' }); } }
  async saveDraft(values: Record<string, unknown>) { try { await this.api.saveTaskData(this.id(), values); this.snack.open('Draft saved in the task data', undefined, { duration: 2500 }); } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); } }
  async act(action: 'claim' | 'release' | 'assign' | 'cancel') {
    try {
      if (action === 'claim') await this.api.claim(this.id());
      else if (action === 'release') await this.api.release(this.id());
      else if (action === 'cancel') { if (!confirm('Cancel this task?')) return; await this.api.cancelTask(this.id()); await this.router.navigate(['/work']); return; }
      else { const target = await this.dialog.open(AssignDialog, { width: '520px' }).afterClosed().toPromise(); if (!target) return; await this.api.assign(this.id(), target); }
      await this.load(this.id());
    } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); }
  }
  async setPriority(p: Priority) { try { await this.api.setPriority(this.id(), p); await this.load(this.id()); } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); } }
  async dueDialog() {
    const current = this.task()?.dueTime ? new Date(this.task()!.dueTime!) : new Date(Date.now() + 86400000);
    const v = prompt('New due date and time (local, YYYY-MM-DD HH:mm)', current.toISOString().slice(0, 16).replace('T', ' ')); if (!v) return;
    const d = new Date(v.replace(' ', 'T')); if (isNaN(d.getTime())) { this.snack.open('Invalid date', 'Close', { duration: 4000, panelClass: 'hp-error' }); return; }
    try { await this.api.setDueDate(this.id(), d.toISOString()); await this.load(this.id()); } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); }
  }
  async comment() { const t = this.commentText.trim(); if (!t) return; try { await this.api.commentTask(this.id(), t); this.commentText = ''; await this.loadStream(this.id()); } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); } }
  async toggleFollow() { try { await this.api.followTask(this.id(), !this.following()); this.following.update(f => !f); } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); } }
}
