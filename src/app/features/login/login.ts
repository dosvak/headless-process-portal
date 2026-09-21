import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';

/** Sign-in page: credentials validated against the engine (GET /user/current); demo mode lists the fixture users. */
@Component({
  selector: 'hp-login',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  styles: [`
    :host { display: grid; place-items: center; min-height: 100%; background: radial-gradient(1200px 600px at 10% -10%, color-mix(in srgb, var(--hp-accent) 25%, transparent), transparent), radial-gradient(900px 500px at 110% 110%, rgba(124, 58, 237, .25), transparent), var(--hp-bg); padding: 24px; }
    .card { width: min(420px, 100%); padding: 32px 32px 24px; }
    .logo { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #2f6feb, #7c3aed); display: grid; place-items: center; color: #fff; font-weight: 700; font-size: 22px; margin-bottom: 16px; }
    h1 { margin: 0 0 4px; font-size: 22px; }
    p.sub { margin: 0 0 22px; color: var(--hp-muted); }
    form { display: grid; gap: 4px; }
    .error { color: var(--hp-danger); font-size: 13px; margin: 4px 0 8px; display: flex; gap: 6px; align-items: center; }
    .demo { margin-top: 18px; font-size: 12px; color: var(--hp-muted); }
    .demo button { margin: 4px 6px 0 0; }
    .foot { margin-top: 18px; font-size: 12px; color: var(--hp-muted); }
  `],
  template: `
    <div class="card hp-card">
      <div class="logo">H</div>
      <h1>{{ title }}</h1>
      <p class="sub">{{ demo ? 'Offline demonstration - the process engine is simulated' : 'Sign in with your process engine account' }}</p>
      @if (busy()) { <mat-progress-bar mode="indeterminate" /> }
      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline"><mat-label>User name</mat-label><input matInput formControlName="user" autocomplete="username" autofocus /><mat-icon matSuffix>person</mat-icon></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Password</mat-label><input matInput [type]="show() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" /><button type="button" mat-icon-button matSuffix (click)="show.set(!show())"><mat-icon>{{ show() ? 'visibility_off' : 'visibility' }}</mat-icon></button></mat-form-field>
        @if (error()) { <div class="error"><mat-icon>error_outline</mat-icon> {{ error() }}</div> }
        <button mat-flat-button type="submit" [disabled]="form.invalid || busy()">Sign in</button>
      </form>
      @if (demoUsers.length) {
        <div class="demo"><b>Demo credentials</b> - user <code>{{ demoUsers[0] }}</code>, password <code>{{ demoPassword }}</code>; click a name to sign in:<br />@for (u of demoUsers; track u) { <button mat-stroked-button type="button" (click)="quick(u)">{{ u }} / {{ demoPassword }}</button> }</div>
      }
      <div class="foot">Headless Process Portal - every screen is Angular, every action is a process engine REST call.</div>
    </div>
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder); private readonly auth = inject(AuthService); private readonly router = inject(Router); private readonly route = inject(ActivatedRoute);
  readonly title = environment.appTitle; readonly demo = environment.mode === 'demo'; readonly demoUsers = environment.demoUsers; readonly demoPassword = environment.demoPassword;
  readonly form = this.fb.nonNullable.group({ user: ['', Validators.required], password: ['', Validators.required] });
  readonly busy = signal(false); readonly error = signal(''); readonly show = signal(false);
  constructor() { if (this.route.snapshot.queryParamMap.get('expired')) this.error.set('Your session has expired, please sign in again.'); }
  quick(user: string) { this.form.setValue({ user, password: this.demoPassword }); void this.submit(); }
  async submit() {
    if (this.form.invalid) return;
    this.busy.set(true); this.error.set('');
    try {
      await this.auth.signIn(this.form.value.user!, this.form.value.password!);
      await this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('returnUrl') || '/work');
    } catch (e: unknown) {
      const status = (e as { status?: number }).status;
      this.error.set(status === 401 ? 'Wrong user name or password.' : status === 0 ? 'The process engine cannot be reached.' : 'Sign-in failed (' + (status ?? 'error') + ').');
    } finally { this.busy.set(false); }
  }
}
