import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChartConfiguration } from 'chart.js';
import { BPM_API } from '../../core/api/bpm-api';
import { InstanceRow, StatusOverview, TaskRow } from '../../core/api/models';
import { ChartComponent, PALETTE } from '../../shared/ui/chart';

/** Dashboards of Process Portal computed from engine searches: My Work (tasks by status / priority / due), Process Performance
 *  (instances per process and state, cycle times) and Team Performance (open tasks per team, per user, overdue). */
@Component({
  selector: 'hp-dashboards',
  imports: [MatIconModule, MatButtonModule, MatTabsModule, MatProgressBarModule, MatTooltipModule, ChartComponent],
  styles: [`
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .card { padding: 16px; } .card h3 { margin: 0 0 8px; font-size: 14px; font-weight: 600; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .kpi { padding: 14px 16px; } .kpi .n { font-size: 26px; font-weight: 700; } .kpi .l { font-size: 12px; color: var(--hp-muted); }
    table { width: 100%; border-collapse: collapse; font-size: 13px; } td, th { padding: 6px 8px; border-top: 1px solid var(--hp-border); text-align: left; } th { color: var(--hp-muted); font-weight: 500; border-top: 0; } td.n { text-align: right; font-variant-numeric: tabular-nums; }
  `],
  template: `
    <div class="hp-page">
      <h1 class="hp-page-title"><mat-icon>insights</mat-icon> Dashboards <span class="spacer"></span><button mat-icon-button (click)="load()" matTooltip="Refresh"><mat-icon>refresh</mat-icon></button></h1>
      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
      <mat-tab-group>
        <mat-tab label="My Work">
          <div style="padding-top:16px">
            <div class="kpis">
              <div class="kpi hp-card"><div class="n">{{ mine().length }}</div><div class="l">My open tasks</div></div>
              <div class="kpi hp-card"><div class="n" style="color:var(--hp-danger)">{{ overdue(mine()) }}</div><div class="l">Overdue</div></div>
              <div class="kpi hp-card"><div class="n" style="color:#b46b00">{{ dueToday(mine()) }}</div><div class="l">Due today</div></div>
              <div class="kpi hp-card"><div class="n">{{ team().length }}</div><div class="l">Available in my teams</div></div>
              <div class="kpi hp-card"><div class="n" style="color:var(--hp-ok)">{{ closedByMe() }}</div><div class="l">Completed by me (recent)</div></div>
            </div>
            <div class="grid">
              <div class="card hp-card"><h3>My tasks by priority</h3><hp-chart [config]="byPriority()" /></div>
              <div class="card hp-card"><h3>My tasks by due date</h3><hp-chart [config]="byDue()" /></div>
              <div class="card hp-card"><h3>My tasks by process</h3><hp-chart [config]="byProcess(mine())" /></div>
            </div>
          </div>
        </mat-tab>
        <mat-tab label="Process Performance">
          <div style="padding-top:16px">
            <div class="kpis">@for (s of overviewEntries(); track s[0]) { <div class="kpi hp-card"><div class="n">{{ s[1] }}</div><div class="l">{{ s[0] }} instances</div></div> }</div>
            <div class="grid">
              <div class="card hp-card"><h3>Instances by state</h3><hp-chart [config]="instancesByState()" /></div>
              <div class="card hp-card"><h3>Active instances by process</h3><hp-chart [config]="instancesByProcess()" /></div>
              <div class="card hp-card"><h3>Average cycle time of completed instances (hours)</h3><hp-chart [config]="cycleTimes()" /></div>
              <div class="card hp-card"><h3>Instances started per day (last 14 days)</h3><hp-chart [config]="startedPerDay()" /></div>
            </div>
          </div>
        </mat-tab>
        <mat-tab label="Team Performance">
          <div style="padding-top:16px">
            <div class="grid">
              <div class="card hp-card"><h3>Open tasks by team</h3><hp-chart [config]="byTeam()" /></div>
              <div class="card hp-card"><h3>Open tasks by assignee</h3><hp-chart [config]="byUser()" /></div>
              <div class="card hp-card" style="grid-column:1/-1"><h3>Teams</h3>
                <table><tr><th>Team</th><th class="n">Open</th><th class="n">Overdue</th><th class="n">At risk</th><th class="n">High priority</th></tr>
                @for (r of teamRows(); track r.team) { <tr><td>{{ r.team }}</td><td class="n">{{ r.open }}</td><td class="n" [style.color]="r.overdue ? 'var(--hp-danger)' : ''">{{ r.overdue }}</td><td class="n">{{ r.atRisk }}</td><td class="n">{{ r.high }}</td></tr> }</table>
              </div>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
})
export class DashboardsPage {
  private readonly api = inject(BPM_API);
  readonly loading = signal(false);
  readonly mine = signal<TaskRow[]>([]); readonly team = signal<TaskRow[]>([]); readonly allOpen = signal<TaskRow[]>([]); readonly closed = signal<TaskRow[]>([]);
  readonly instances = signal<InstanceRow[]>([]); readonly completed = signal<InstanceRow[]>([]); readonly overview = signal<StatusOverview | null>(null);
  constructor() { void this.load(); }
  async load() {
    this.loading.set(true);
    try {
      const [m, t, a, c, i, comp, o] = await Promise.all([
        this.api.searchTasks({ scope: 'mine', size: 3000 }), this.api.searchTasks({ scope: 'team', size: 3000 }), this.api.searchTasks({ scope: 'all', size: 3000 }), this.api.searchTasks({ scope: 'closed', size: 3000, sort: 'taskClosedDate' }),
        this.api.searchInstances({ statuses: ['Active'], size: 3000 }), this.api.searchInstances({ statuses: ['Completed'], size: 3000, sort: 'instanceModifyDate' }), this.api.statusOverview().catch(() => null)]);
      this.mine.set(m.rows); this.team.set(t.rows); this.allOpen.set(a.rows); this.closed.set(c.rows); this.instances.set(i.rows); this.completed.set(comp.rows); this.overview.set(o);
    } finally { this.loading.set(false); }
  }
  overdue(rows: TaskRow[]) { const n = Date.now(); return rows.filter(r => r.dueDate && new Date(r.dueDate).getTime() < n).length; }
  dueToday(rows: TaskRow[]) { const d = new Date().toDateString(); return rows.filter(r => r.dueDate && new Date(r.dueDate).toDateString() === d).length; }
  readonly closedByMe = computed(() => this.closed().filter(r => r.assignedTo === this.meName()).length);
  private meName() { try { return JSON.parse(sessionStorage.getItem('hp.session') || '{}').user as string; } catch { return ''; } }
  readonly overviewEntries = computed(() => Object.entries(this.overview() ?? {}).filter(([k]) => k !== 'Total'));
  private counts<T>(rows: T[], key: (r: T) => string): [string, number][] { const m = new Map<string, number>(); for (const r of rows) { const k = key(r) || 'unassigned'; m.set(k, (m.get(k) ?? 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); }
  private bar(entries: [string, number][], label: string, horizontal = false): ChartConfiguration { return { type: 'bar', data: { labels: entries.map(e => e[0]), datasets: [{ label, data: entries.map(e => e[1]), backgroundColor: entries.map((_, i) => PALETTE[i % PALETTE.length]), borderRadius: 6 }] }, options: horizontal ? { indexAxis: 'y' } : {} }; }
  private doughnut(entries: [string, number][]): ChartConfiguration { return { type: 'doughnut', data: { labels: entries.map(e => e[0]), datasets: [{ data: entries.map(e => e[1]), backgroundColor: entries.map((_, i) => PALETTE[i % PALETTE.length]) }] }, options: { scales: { x: { display: false }, y: { display: false } } } }; }
  readonly byPriority = computed(() => this.doughnut(this.counts(this.mine(), r => r.priority)));
  readonly byDue = computed(() => { const n = Date.now(); const b: Record<string, number> = { Overdue: 0, Today: 0, 'This week': 0, Later: 0, 'No due date': 0 }; const today = new Date().toDateString(); for (const r of this.mine()) { if (!r.dueDate) b['No due date']++; else { const t = new Date(r.dueDate); if (t.getTime() < n) b['Overdue']++; else if (t.toDateString() === today) b['Today']++; else if (t.getTime() - n < 7 * 86400000) b['This week']++; else b['Later']++; } } return this.bar(Object.entries(b), 'Tasks'); });
  byProcess(rows: TaskRow[]) { return this.bar(this.counts(rows, r => r.processName).slice(0, 10), 'Tasks', true); }
  readonly instancesByState = computed(() => this.doughnut(this.overviewEntries().map(([k, v]) => [k, Number(v)] as [string, number]).filter(e => e[1] > 0)));
  readonly instancesByProcess = computed(() => this.bar(this.counts(this.instances(), r => r.processName).slice(0, 10), 'Active instances', true));
  readonly cycleTimes = computed(() => { const m = new Map<string, number[]>(); for (const r of this.completed()) if (r.created && r.modified) { const h = (new Date(r.modified).getTime() - new Date(r.created).getTime()) / 3600000; m.set(r.processName, [...(m.get(r.processName) ?? []), h]); } const e: [string, number][] = [...m.entries()].map(([k, v]): [string, number] => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10]).sort((a, b) => b[1] - a[1]).slice(0, 10); return this.bar(e, 'Hours', true); });
  readonly startedPerDay = computed(() => { const days: [string, number][] = []; for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000); days.push([d.toISOString().slice(5, 10), 0]); } const idx = new Map(days.map((d, i) => [d[0], i])); for (const r of [...this.instances(), ...this.completed()]) { if (!r.created) continue; const k = r.created.slice(5, 10); const i = idx.get(k); if (i !== undefined) days[i][1]++; } return { type: 'line', data: { labels: days.map(d => d[0]), datasets: [{ label: 'Started', data: days.map(d => d[1]), borderColor: PALETTE[0], backgroundColor: PALETTE[0] + '33', fill: true, tension: .3 }] } } as ChartConfiguration; });
  private teamName(who: string | null) { if (!who) return 'unassigned'; const m = /^(.+?)_[TS]_[0-9a-f-]+/.exec(who); return m ? m[1] : who; }
  readonly byTeam = computed(() => this.bar(this.counts(this.allOpen().filter(r => r.assignedType === 'Group'), r => this.teamName(r.assignedTo)).slice(0, 12), 'Open tasks', true));
  readonly byUser = computed(() => this.bar(this.counts(this.allOpen().filter(r => r.assignedType === 'User'), r => r.assignedTo ?? '').slice(0, 12), 'Claimed tasks', true));
  readonly teamRows = computed(() => { const n = Date.now(); const m = new Map<string, { team: string; open: number; overdue: number; atRisk: number; high: number }>(); for (const r of this.allOpen()) { if (r.assignedType !== 'Group') continue; const k = this.teamName(r.assignedTo); const t = m.get(k) ?? { team: k, open: 0, overdue: 0, atRisk: 0, high: 0 }; t.open++; if (r.dueDate && new Date(r.dueDate).getTime() < n) t.overdue++; if (r.isAtRisk) t.atRisk++; if (r.priority === 'High' || r.priority === 'Highest') t.high++; m.set(k, t); } return [...m.values()].sort((a, b) => b.open - a.open); });
}
