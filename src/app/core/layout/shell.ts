import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ThemeService } from '../state/theme.service';
import { NotificationsService } from '../state/notifications.service';
import { NotificationsDrawer } from '../../features/notifications/notifications-drawer';
import { environment } from '../../../environments/environment';

/** Application shell: side navigation, header with search, notifications and the user menu, routed content. */
@Component({
  selector: 'hp-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatSidenavModule, MatToolbarModule, MatListModule, MatIconModule, MatButtonModule, MatMenuModule, MatBadgeModule, MatTooltipModule, MatDividerModule, NotificationsDrawer],
  styles: [`
    :host { display: block; height: 100%; }
    mat-sidenav-container { height: 100%; background: var(--hp-bg); }
    mat-sidenav { width: 248px; border-right: 1px solid var(--hp-border); background: var(--hp-surface); }
    .brand { display: flex; align-items: center; gap: 10px; padding: 18px 20px 10px; font-weight: 700; font-size: 17px; letter-spacing: .2px; }
    .brand .logo { width: 30px; height: 30px; border-radius: 9px; background: linear-gradient(135deg, #2f6feb, #7c3aed); display: grid; place-items: center; color: #fff; font-size: 15px; }
    .brand small { display: block; font-weight: 400; font-size: 11px; color: var(--hp-muted); }
    .nav { padding: 8px 12px; }
    .nav a { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; color: var(--hp-text); font-weight: 500; margin-bottom: 2px; transition: background .15s; }
    .nav a:hover { background: color-mix(in srgb, var(--hp-accent) 8%, transparent); }
    .nav a.active { background: color-mix(in srgb, var(--hp-accent) 14%, transparent); color: var(--hp-accent); }
    .nav mat-icon { font-size: 21px; width: 21px; height: 21px; }
    .nav .section { margin: 14px 12px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--hp-muted); }
    .mode { margin: auto 16px 16px; padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, var(--hp-warn) 14%, transparent); font-size: 12px; }
    .sidenav-inner { display: flex; flex-direction: column; height: 100%; }
    mat-toolbar { background: var(--hp-surface); border-bottom: 1px solid var(--hp-border); gap: 8px; position: sticky; top: 0; z-index: 5; }
    .search { flex: 1; max-width: 520px; display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 10px; background: var(--hp-bg); border: 1px solid var(--hp-border); color: var(--hp-muted); cursor: text; }
    .search input { border: 0; outline: 0; background: transparent; flex: 1; color: var(--hp-text); font: inherit; }
    .avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--hp-accent); color: #fff; display: grid; place-items: center; font-weight: 600; font-size: 13px; overflow: hidden; }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .spacer { flex: 1; }
    .content { min-height: calc(100% - 64px); }
  `],
  template: `
    <mat-sidenav-container>
      <mat-sidenav #nav [mode]="handset() ? 'over' : 'side'" [opened]="!handset()">
        <div class="sidenav-inner">
          <div class="brand"><span class="logo">H</span><span>{{ title }}<small>Headless Process Portal</small></span></div>
          <nav class="nav">
            <div class="section">Work</div>
            <a routerLink="/work" routerLinkActive="active" (click)="handset() && nav.close()"><mat-icon>inbox</mat-icon> Tasks</a>
            <a routerLink="/launch" routerLinkActive="active" (click)="handset() && nav.close()"><mat-icon>rocket_launch</mat-icon> Launch</a>
            <a routerLink="/instances" routerLinkActive="active" (click)="handset() && nav.close()"><mat-icon>account_tree</mat-icon> Instances</a>
            <div class="section">Insight</div>
            <a routerLink="/dashboards" routerLinkActive="active" (click)="handset() && nav.close()"><mat-icon>insights</mat-icon> Dashboards</a>
            <a routerLink="/search" routerLinkActive="active" (click)="handset() && nav.close()"><mat-icon>manage_search</mat-icon> Search</a>
            <div class="section">People</div>
            <a routerLink="/teams" routerLinkActive="active" (click)="handset() && nav.close()"><mat-icon>groups</mat-icon> Teams</a>
            <a routerLink="/profile" routerLinkActive="active" (click)="handset() && nav.close()"><mat-icon>person</mat-icon> Profile</a>
          </nav>
          @if (demo) { <div class="mode"><b>Demo mode</b> - stubbed engine, no Process Center behind this page.</div> }
        </div>
      </mat-sidenav>
      <mat-sidenav-content>
        <mat-toolbar>
          @if (handset()) { <button mat-icon-button (click)="nav.toggle()" aria-label="Menu"><mat-icon>menu</mat-icon></button> }
          <div class="search" (click)="focusSearch(q)"><mat-icon>search</mat-icon><input #q placeholder="Search tasks, instances, processes..." (keydown.enter)="search(q.value)" /></div>
          <span class="spacer"></span>
          <button mat-icon-button [matTooltip]="theme.dark() ? 'Light theme' : 'Dark theme'" (click)="theme.toggle()"><mat-icon>{{ theme.dark() ? 'light_mode' : 'dark_mode' }}</mat-icon></button>
          <button mat-icon-button matTooltip="Notifications" (click)="notifications.open.set(!notifications.open())" [matBadge]="notifications.count() || null" matBadgeColor="warn" matBadgeSize="small"><mat-icon>notifications</mat-icon></button>
          <button mat-button [matMenuTriggerFor]="userMenu" class="user"><span class="avatar">@if (auth.avatarUrl()) { <img [src]="auth.avatarUrl()" alt="" /> } @else { {{ auth.initials() }} }</span>&nbsp; {{ auth.displayName() }} <mat-icon>expand_more</mat-icon></button>
          <mat-menu #userMenu="matMenu">
            <a mat-menu-item routerLink="/profile"><mat-icon>person</mat-icon> Edit profile</a>
            <button mat-menu-item (click)="auth.signOut()"><mat-icon>logout</mat-icon> Sign out</button>
          </mat-menu>
        </mat-toolbar>
        <div class="content"><router-outlet /></div>
        <hp-notifications-drawer />
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly notifications = inject(NotificationsService);
  readonly title = environment.appTitle;
  readonly demo = environment.mode === 'demo';
  private readonly bp = inject(BreakpointObserver);
  readonly handset = toSignal(this.bp.observe('(max-width: 900px)').pipe(map(r => r.matches)), { initialValue: false });
  constructor() { effect(() => { if (this.auth.isAuthenticated()) void this.notifications.refresh(); }); }
  focusSearch(input: HTMLInputElement) { input.focus(); }
  search(text: string) { if (text.trim()) window.location.assign('/search?q=' + encodeURIComponent(text.trim())); }
}
