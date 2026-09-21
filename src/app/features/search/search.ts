import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { BPM_API } from '../../core/api/bpm-api';
import { ExposedProcess, InstanceRow, TaskRow } from '../../core/api/models';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';

/** Global search across tasks (subject), instances (name) and startable processes. */
@Component({
  selector: 'hp-search',
  imports: [RouterLink, FormsModule, MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressBarModule, RelativeTimePipe],
  styles: [`.box { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; } .box mat-form-field { flex: 1; } .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; } .card { padding: 14px 16px; } .card h3 { margin: 0 0 6px; font-size: 14px; } .item { padding: 8px 0; border-top: 1px solid var(--hp-border); font-size: 13px; } .item:first-of-type { border-top: 0; } .m { font-size: 12px; color: var(--hp-muted); }`],
  template: `
    <div class="hp-page">
      <h1 class="hp-page-title"><mat-icon>manage_search</mat-icon> Search</h1>
      <div class="box"><mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Search tasks, instances and processes</mat-label><input matInput [(ngModel)]="q" (keydown.enter)="run()" autofocus /><mat-icon matSuffix>search</mat-icon></mat-form-field><button mat-flat-button (click)="run()">Search</button></div>
      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
      @if (ran()) {
        <div class="grid">
          <div class="card hp-card"><h3>Tasks ({{ tasks().length }})</h3>@for (t of tasks(); track t.taskId) { <div class="item"><a [routerLink]="['/task', t.taskId]">{{ t.subject }}</a><div class="m">{{ t.instanceName }} &middot; {{ t.status }} &middot; {{ t.priority }} @if (t.dueDate) { &middot; due {{ t.dueDate | relativeTime }} }</div></div> } @empty { <div class="m">No task subject contains "{{ last }}".</div> }</div>
          <div class="card hp-card"><h3>Instances ({{ instances().length }})</h3>@for (i of instances(); track i.instanceId) { <div class="item"><a [routerLink]="['/instance', i.instanceId]">{{ i.name }}</a><div class="m">{{ i.processName }} &middot; {{ i.status }} &middot; modified {{ i.modified | relativeTime }}</div></div> } @empty { <div class="m">No instance name contains "{{ last }}".</div> }</div>
          <div class="card hp-card"><h3>Processes ({{ processes().length }})</h3>@for (p of processes(); track p.itemID + p.snapshotID) { <div class="item"><a routerLink="/launch">{{ p.display }}</a><div class="m">{{ p.processAppName }} &middot; {{ p.snapshotName }}</div></div> } @empty { <div class="m">No startable process matches.</div> }</div>
        </div>
      }
    </div>
  `,
})
export class SearchPage {
  private readonly api = inject(BPM_API); private readonly route = inject(ActivatedRoute);
  q = ''; last = ''; readonly loading = signal(false); readonly ran = signal(false);
  readonly tasks = signal<TaskRow[]>([]); readonly instances = signal<InstanceRow[]>([]); readonly processes = signal<ExposedProcess[]>([]);
  constructor() { const q = this.route.snapshot.queryParamMap.get('q'); if (q) { this.q = q; void this.run(); } }
  async run() {
    const q = this.q.trim(); if (!q) return; this.last = q; this.loading.set(true);
    try {
      const [t, i, p] = await Promise.all([this.api.searchTasks({ scope: 'all', text: q, size: 50 }), this.api.searchInstances({ text: q, size: 50 }), this.api.exposedProcesses()]);
      this.tasks.set(t.rows); this.instances.set(i.rows); this.processes.set(p.filter(x => x.display.toLowerCase().includes(q.toLowerCase()) || x.processAppName.toLowerCase().includes(q.toLowerCase())));
    } finally { this.loading.set(false); this.ran.set(true); }
  }
}
