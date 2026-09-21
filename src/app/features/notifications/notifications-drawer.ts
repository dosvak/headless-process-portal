import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { NotificationsService } from '../../core/state/notifications.service';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';

@Component({
  selector: 'hp-notifications-drawer',
  imports: [RouterLink, MatIconModule, MatButtonModule, RelativeTimePipe],
  styles: [`
    .backdrop { position: fixed; inset: 0; z-index: 20; }
    .drawer { position: fixed; top: 64px; right: 12px; width: min(420px, calc(100vw - 24px)); max-height: calc(100vh - 88px); overflow: auto; z-index: 21; padding: 8px 0; animation: pop .18s ease-out; }
    @keyframes pop { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    .head { display: flex; align-items: center; padding: 8px 16px; font-weight: 600; }
    .head .spacer { flex: 1; }
    .item { display: flex; gap: 12px; padding: 10px 16px; border-top: 1px solid var(--hp-border); color: inherit; }
    .item:hover { background: color-mix(in srgb, var(--hp-accent) 6%, transparent); }
    .item mat-icon { flex: none; }
    .item .t { font-weight: 500; }
    .item .d { color: var(--hp-muted); font-size: 12px; }
    .overdue mat-icon { color: var(--hp-danger); } .due-today mat-icon { color: var(--hp-warn); } .at-risk mat-icon { color: #b46b00; } .assigned mat-icon { color: var(--hp-ok); } .mention mat-icon { color: var(--hp-accent); }
  `],
  template: `
    @if (svc.open()) {
      <div class="backdrop" (click)="svc.open.set(false)"></div>
      <div class="drawer hp-card">
        <div class="head"><mat-icon>notifications</mat-icon>&nbsp;Notifications <span class="spacer"></span><button mat-icon-button (click)="svc.refresh()" aria-label="Refresh"><mat-icon>refresh</mat-icon></button></div>
        @for (n of svc.items(); track n.id) {
          <a class="item" [class]="'item ' + n.kind" [routerLink]="n.link" (click)="svc.open.set(false)">
            <mat-icon>{{ icon(n.kind) }}</mat-icon>
            <div><div class="t">{{ n.title }}</div><div class="d">{{ n.detail }} @if (n.when) { <span>&middot; {{ n.when | relativeTime }}</span> }</div></div>
          </a>
        } @empty { <div class="hp-empty">All clear - nothing needs your attention.</div> }
      </div>
    }
  `,
})
export class NotificationsDrawer {
  readonly svc = inject(NotificationsService);
  icon(kind: string) { return { overdue: 'alarm', 'due-today': 'today', 'at-risk': 'warning', assigned: 'assignment_ind', mention: 'alternate_email' }[kind] ?? 'info'; }
}
