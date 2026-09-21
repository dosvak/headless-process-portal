import { Component, computed, effect, inject, input, signal } from '@angular/core';
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
import { BPM_API } from '../../core/api/bpm-api';
import { InstanceDetails, StreamItem } from '../../core/api/models';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { PriorityClassPipe } from '../../shared/pipes/priority.pipe';
import { plain } from '../../shared/ui/plain';
import { errorText } from '../../shared/ui/errors';
import { DiagramComponent } from '../../shared/ui/diagram';

/** Instance page: header with state and actions (suspend / resume / terminate / retry / delete / due date), tasks, diagram with the
 *  current tokens, variables, comments and the activity stream. */
@Component({
  selector: 'hp-instance',
  imports: [RouterLink, DatePipe, FormsModule, MatIconModule, MatButtonModule, MatMenuModule, MatTabsModule, MatProgressBarModule, MatTooltipModule, MatFormFieldModule, MatInputModule, RelativeTimePipe, PriorityClassPipe, DiagramComponent],
  styles: [`
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; } .layout > * { min-width: 0; } mat-tab-group { max-width: 100%; } @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
    .card { padding: 18px; }
    .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; font-size: 13px; } .facts .k { color: var(--hp-muted); font-size: 12px; }
    .task { display: grid; grid-template-columns: 1fr 110px 130px 120px; gap: 10px; align-items: center; padding: 10px 0; border-top: 1px solid var(--hp-border); font-size: 13px; } .task:first-child { border-top: 0; }
    .task .n { font-weight: 600; } .task .m { font-size: 12px; color: var(--hp-muted); }
    .data { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; font-size: 13px; } .data .k { color: var(--hp-muted); }
    .stream .item { padding: 10px 0; border-top: 1px solid var(--hp-border); font-size: 13px; } .stream .item:first-child { border-top: 0; } .stream .who { font-weight: 600; } .stream .when { color: var(--hp-muted); font-size: 12px; margin-left: 6px; }
    .comment { display: flex; gap: 8px; margin: 4px 0 8px; } .comment mat-form-field { flex: 1; }
    pre { background: var(--hp-bg); padding: 12px; border-radius: 10px; overflow: auto; font-size: 12px; }
  `],
  template: `
    <div class="hp-page">
      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
      @if (inst(); as i) {
        <h1 class="hp-page-title"><a routerLink="/instances" mat-icon-button matTooltip="Back"><mat-icon>arrow_back</mat-icon></a> {{ i.name }}
          <span class="hp-chip" [class]="'hp-chip ' + chip(i.executionState)">{{ i.executionState }}</span><span class="spacer"></span>
          @if (i.executionState === 'Active') { <button mat-stroked-button (click)="action('suspend')"><mat-icon>pause</mat-icon> Suspend</button> }
          @if (i.executionState === 'Suspended') { <button mat-stroked-button (click)="action('resume')"><mat-icon>play_arrow</mat-icon> Resume</button> }
          @if (i.executionState === 'Failed') { <button mat-stroked-button (click)="action('retry')"><mat-icon>replay</mat-icon> Retry</button> }
          <button mat-stroked-button [matMenuTriggerFor]="more"><mat-icon>more_horiz</mat-icon> More</button>
          <mat-menu #more="matMenu">
            <button mat-menu-item (click)="dueDialog()"><mat-icon>event</mat-icon> Due date...</button>
            @if (i.executionState === 'Active' || i.executionState === 'Suspended' || i.executionState === 'Failed') { <button mat-menu-item (click)="action('terminate')"><mat-icon>stop_circle</mat-icon> Terminate</button> }
            <button mat-menu-item (click)="action('delete')"><mat-icon>delete</mat-icon> Delete instance</button>
          </mat-menu>
          <button mat-icon-button [matTooltip]="following() ? 'Stop following' : 'Follow'" (click)="toggleFollow()"><mat-icon>{{ following() ? 'notifications_active' : 'notifications_none' }}</mat-icon></button>
        </h1>
        <div class="layout">
          <div style="display:grid;gap:16px;align-content:start">
            <mat-tab-group class="hp-card">
              <mat-tab label="Tasks ({{ i.tasks.length }})">
                <div class="card">
                  @for (t of sortedTasks(); track t.tkiid) {
                    <div class="task"><div><a class="n" [routerLink]="['/task', t.tkiid]">{{ t.displayName || t.name }}</a><div class="m">#{{ t.tkiid }} &middot; {{ t.teamDisplayName || '' }} &middot; {{ t.assignedToDisplayName || t.assignedTo || 'unassigned' }}</div></div>
                      <span class="hp-chip" [class]="'hp-chip ' + (t.priorityName | priorityClass)">{{ t.priorityName }}</span><span class="hp-chip" [class]="'hp-chip ' + (t.status === 'Closed' ? 'ok' : 'neutral')">{{ t.status }}</span><span class="m">{{ t.status === 'Closed' ? ('done ' + (t.completionTime | relativeTime)) : (t.dueTime ? 'due ' + (t.dueTime | relativeTime) : '') }}</span></div>
                  } @empty { <div class="hp-muted">No tasks.</div> }
                </div>
              </mat-tab>
              <mat-tab label="Diagram"><div class="card"><hp-diagram [steps]="i.diagram" [tokens]="i.tokens" /></div></mat-tab>
              <mat-tab label="Variables"><div class="card">@if (entries().length) { <div class="data">@for (e of entries(); track e[0]) { <span class="k">{{ e[0] }}</span><span>{{ e[1] }}</span> }</div> } @else { <div class="hp-muted">No variables.</div> }<pre style="margin-top:14px">{{ json() }}</pre></div></mat-tab>
              <mat-tab label="Comments ({{ i.comments.length }})">
                <div class="card stream">
                  <div class="comment"><mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Add a comment</mat-label><input matInput [(ngModel)]="commentText" (keydown.enter)="comment()" /></mat-form-field><button mat-flat-button [disabled]="!commentText.trim()" (click)="comment()"><mat-icon>send</mat-icon></button></div>
                  @for (c of i.comments; track c.id + c.created) { <div class="item"><span class="who">{{ c.author }}</span><span class="when">{{ c.created | relativeTime }}</span><div>{{ c.text }}</div></div> } @empty { <div class="hp-muted">No comments.</div> }
                </div>
              </mat-tab>
              <mat-tab label="Activity ({{ stream().length }})"><div class="card stream">@for (s of stream(); track s.published + s.content) { <div class="item"><span class="who">{{ s.actor?.displayName || s.actor?.id || 'system' }}</span><span class="when">{{ s.published | relativeTime }}</span><div [innerHTML]="s.content"></div></div> } @empty { <div class="hp-muted">No activity.</div> }</div></mat-tab>
            </mat-tab-group>
          </div>
          <div class="card hp-card" style="align-self:start">
            <div class="facts">
              <div><div class="k">Instance</div>#{{ i.piid }}</div><div><div class="k">Process</div>{{ i.processTemplateName }}</div>
              <div><div class="k">Application</div>{{ i.processAppName }} ({{ i.processAppAcronym }})</div><div><div class="k">Snapshot</div>{{ i.snapshotName }}</div>
              <div><div class="k">Created</div>{{ i.creationTime | date:'medium' }}</div><div><div class="k">Modified</div>{{ i.lastModificationTime | relativeTime }}</div>
              <div><div class="k">Due</div>{{ i.dueDate ? (i.dueDate | date:'medium') : 'none' }}</div><div><div class="k">State</div>{{ i.state }}</div>
              <div style="grid-column:1/-1"><div class="k">Current steps</div>@for (t of i.tokens; track t.tokenId) { <span class="hp-chip" style="margin:2px 4px 2px 0">{{ t.name }}</span> } @empty { <span class="hp-muted">none (finished)</span> }</div>
            </div>
          </div>
        </div>
      } @else if (!loading()) { <div class="hp-empty"><mat-icon>error_outline</mat-icon><div>{{ error() || 'Instance not found' }}</div></div> }
    </div>
  `,
})
export class InstancePage {
  private readonly api = inject(BPM_API); private readonly snack = inject(MatSnackBar); private readonly router = inject(Router);
  readonly id = input.required<string>();
  readonly inst = signal<InstanceDetails | null>(null); readonly loading = signal(true); readonly error = signal(''); readonly stream = signal<StreamItem[]>([]); readonly following = signal(false);
  commentText = '';
  readonly variables = computed(() => plain<Record<string, unknown>>(this.inst()?.variables ?? {}));
  readonly entries = computed(() => { const out: [string, string][] = []; const walk = (o: Record<string, unknown>, p: string) => { for (const [k, x] of Object.entries(o)) { if (x && typeof x === 'object' && !Array.isArray(x)) walk(x as Record<string, unknown>, p + k + '.'); else out.push([p + k, Array.isArray(x) ? JSON.stringify(x) : String(x ?? '')]); } }; walk(this.variables(), ''); return out; });
  readonly json = computed(() => JSON.stringify(this.variables(), null, 2));
  readonly sortedTasks = computed(() => [...(this.inst()?.tasks ?? [])].sort((a, b) => (a.status === 'Closed' ? 1 : 0) - (b.status === 'Closed' ? 1 : 0) || (b.activationTime ?? '').localeCompare(a.activationTime ?? '')));
  constructor() { effect(() => { void this.load(this.id()); }); }
  async load(id: string) { this.loading.set(true); this.error.set(''); try { this.inst.set(await this.api.instance(id)); void this.loadStream(id); } catch (e) { this.error.set(errorText(e)); this.inst.set(null); } finally { this.loading.set(false); } }
  async loadStream(id: string) { try { const [s, f] = await Promise.all([this.api.instanceStream(id), this.api.isFollowingInstance(id)]); this.stream.set(s); this.following.set(f); } catch { /* optional */ } }
  chip(state: string) { return { Active: '', Completed: 'ok', Failed: 'danger', Suspended: 'warn', Terminated: 'neutral' }[state] ?? 'neutral'; }
  async action(a: 'suspend' | 'resume' | 'terminate' | 'retry' | 'delete') {
    if ((a === 'terminate' || a === 'delete') && !confirm(`${a === 'delete' ? 'Delete' : 'Terminate'} instance #${this.id()}?`)) return;
    try { await this.api.instanceAction(this.id(), a); this.snack.open(`Instance ${a === 'delete' ? 'deleted' : a + 'd'}`, undefined, { duration: 2500 }); if (a === 'delete') await this.router.navigate(['/instances']); else await this.load(this.id()); }
    catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); }
  }
  async dueDialog() {
    const cur = this.inst()?.dueDate ? new Date(this.inst()!.dueDate!) : new Date(Date.now() + 86400000);
    const v = prompt('New due date and time (local, YYYY-MM-DD HH:mm)', cur.toISOString().slice(0, 16).replace('T', ' ')); if (!v) return;
    const d = new Date(v.replace(' ', 'T')); if (isNaN(d.getTime())) return;
    try { await this.api.setInstanceDueDate(this.id(), d.toISOString()); await this.load(this.id()); } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); }
  }
  async comment() { const t = this.commentText.trim(); if (!t) return; try { await this.api.commentInstance(this.id(), t); this.commentText = ''; await this.load(this.id()); } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); } }
  async toggleFollow() { try { await this.api.followInstance(this.id(), !this.following()); this.following.update(f => !f); } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); } }
}
