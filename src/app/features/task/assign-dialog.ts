import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { BPM_API } from '../../core/api/bpm-api';
import { GroupSummary, UserSummary } from '../../core/api/models';

/** Assign a task to a user or a group: filterable directory read from the engine. */
@Component({
  selector: 'hp-assign-dialog',
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatButtonToggleModule, MatListModule, MatIconModule],
  styles: [`.list { max-height: 320px; overflow: auto; border: 1px solid var(--hp-border); border-radius: 10px; } .sel { background: color-mix(in srgb, var(--hp-accent) 14%, transparent); }`],
  template: `
    <h2 mat-dialog-title>Assign task</h2>
    <mat-dialog-content style="display:grid;gap:10px;min-width:420px">
      <mat-button-toggle-group [(ngModel)]="kind" (ngModelChange)="search()" hideSingleSelectionIndicator><mat-button-toggle value="user">User</mat-button-toggle><mat-button-toggle value="group">Group / team</mat-button-toggle></mat-button-toggle-group>
      <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Filter</mat-label><input matInput [(ngModel)]="filter" (keydown.enter)="search()" placeholder="name or pattern, e.g. cell*" /><mat-icon matSuffix>search</mat-icon></mat-form-field>
      <div class="list">
        <mat-nav-list>
          @for (u of users(); track u.userName) { <a mat-list-item [class.sel]="picked() === u.userName" (click)="picked.set(u.userName)"><mat-icon matListItemIcon>person</mat-icon><span matListItemTitle>{{ u.fullName }}</span><span matListItemLine>{{ u.userName }}</span></a> }
          @for (g of groups(); track g.groupName) { <a mat-list-item [class.sel]="picked() === g.groupName" (click)="picked.set(g.groupName)"><mat-icon matListItemIcon>groups</mat-icon><span matListItemTitle>{{ g.displayName }}</span><span matListItemLine>{{ g.members.length }} member(s)</span></a> }
        </mat-nav-list>
        @if (!users().length && !groups().length) { <div class="hp-empty">No match</div> }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Cancel</button><button mat-flat-button [disabled]="!picked()" (click)="ref.close(kind === 'user' ? { user: picked() } : { group: picked() })">Assign</button></mat-dialog-actions>
  `,
})
export class AssignDialog {
  readonly ref = inject(MatDialogRef<AssignDialog>); private readonly api = inject(BPM_API);
  kind: 'user' | 'group' = 'user'; filter = '';
  readonly users = signal<UserSummary[]>([]); readonly groups = signal<GroupSummary[]>([]); readonly picked = signal<string | null>(null);
  constructor() { void this.search(); }
  async search() {
    this.picked.set(null); const f = this.filter.trim() || '*';
    if (this.kind === 'user') { this.groups.set([]); this.users.set(await this.api.users(f)); }
    else { this.users.set([]); this.groups.set((await this.api.groups(f)).filter(g => !/_[TS]_[0-9a-f-]{36}\.[0-9a-f-]{36}$/.test(g.groupName) || g.groupName.includes('_T_')).slice(0, 300)); }
  }
}
