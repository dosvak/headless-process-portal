import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { BPM_API } from '../../core/api/bpm-api';
import { TeamInfo, UserSummary } from '../../core/api/models';

/** Teams and people: the teams of the installed applications (engine security groups) with their members, and the user directory. */
@Component({
  selector: 'hp-teams',
  imports: [FormsModule, MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressBarModule, MatTabsModule],
  styles: [`.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; padding-top: 14px; } .card { padding: 14px 16px; } .card h3 { margin: 0 0 6px; font-size: 14px; display: flex; align-items: center; gap: 8px; } .m { font-size: 12px; color: var(--hp-muted); } .chips span { margin: 2px 4px 2px 0; } .user { display: flex; gap: 12px; align-items: center; padding: 10px 0; border-top: 1px solid var(--hp-border); } .user:first-child { border-top: 0; } .av { width: 34px; height: 34px; border-radius: 50%; background: var(--hp-accent); color: #fff; display: grid; place-items: center; font-weight: 600; font-size: 13px; }`],
  template: `
    <div class="hp-page">
      <h1 class="hp-page-title"><mat-icon>groups</mat-icon> Teams and people</h1>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:320px"><mat-label>Filter</mat-label><input matInput [(ngModel)]="q" /><mat-icon matSuffix>search</mat-icon></mat-form-field>
      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
      <mat-tab-group>
        <mat-tab label="Teams ({{ filteredTeams().length }})"><div class="grid">@for (t of filteredTeams(); track t.displayName) { <div class="card hp-card"><h3><mat-icon>groups</mat-icon> {{ t.displayName }}</h3><div class="m" style="margin-bottom:6px">{{ t.description || (t.members.length + ' member(s)') }}</div><div class="chips">@for (m of t.members; track m) { <span class="hp-chip neutral">{{ m }}</span> } @empty { <span class="m">no members</span> }</div></div> }</div></mat-tab>
        <mat-tab label="People ({{ filteredUsers().length }})"><div class="hp-card" style="margin-top:14px;padding:4px 16px">@for (u of filteredUsers(); track u.userName) { <div class="user"><div class="av">{{ (u.fullName || u.userName).slice(0, 2).toUpperCase() }}</div><div><div style="font-weight:600">{{ u.fullName }}</div><div class="m">{{ u.userName }} @if (u.emailAddress) { &middot; {{ u.emailAddress }} }</div></div></div> }</div></mat-tab>
      </mat-tab-group>
    </div>
  `,
})
export class TeamsPage {
  private readonly api = inject(BPM_API);
  q = ''; readonly loading = signal(true); readonly teams = signal<TeamInfo[]>([]); readonly users = signal<UserSummary[]>([]);
  constructor() { void Promise.all([this.api.teams(), this.api.users('*')]).then(([t, u]) => { this.teams.set(t); this.users.set(u); }).finally(() => this.loading.set(false)); }
  filteredTeams() { const q = this.q.toLowerCase(); return this.teams().filter(t => !q || t.displayName.toLowerCase().includes(q) || t.members.some(m => m.toLowerCase().includes(q))); }
  filteredUsers() { const q = this.q.toLowerCase(); return this.users().filter(u => !q || u.userName.toLowerCase().includes(q) || (u.fullName ?? '').toLowerCase().includes(q)); }
}
