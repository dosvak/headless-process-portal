import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth/auth.service';
import { BPM_API } from '../../core/api/bpm-api';
import { ThemeService } from '../../core/state/theme.service';
import { errorText } from '../../shared/ui/errors';

/** Profile: user details and memberships from the engine, avatar upload / removal, editable user preferences, theme. */
@Component({
  selector: 'hp-profile',
  imports: [FormsModule, MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSlideToggleModule],
  styles: [`.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; } .card { padding: 20px; } .card h3 { margin: 0 0 12px; font-size: 15px; } .avatar { width: 96px; height: 96px; border-radius: 50%; background: var(--hp-accent); color: #fff; display: grid; place-items: center; font-size: 34px; font-weight: 600; overflow: hidden; } .avatar img { width: 100%; height: 100%; object-fit: cover; } .who { display: flex; gap: 18px; align-items: center; margin-bottom: 12px; } .k { font-size: 12px; color: var(--hp-muted); } .pref { display: grid; grid-template-columns: 1fr 200px; gap: 8px 12px; align-items: center; font-size: 13px; padding: 4px 0; } .chips span { margin: 2px 4px 2px 0; }`],
  template: `
    <div class="hp-page">
      <h1 class="hp-page-title"><mat-icon>person</mat-icon> Profile</h1>
      <div class="grid">
        <div class="card hp-card">
          <div class="who"><div class="avatar">@if (auth.avatarUrl()) { <img [src]="auth.avatarUrl()" alt="" /> } @else { {{ auth.initials() }} }</div>
            <div><div style="font-size:20px;font-weight:600">{{ auth.displayName() }}</div><div class="k">{{ auth.userName() }} &middot; id {{ auth.user()?.userID }}</div><div class="k">{{ auth.user()?.emailAddress || 'no e-mail address' }}</div></div></div>
          <input type="file" accept="image/*" #file hidden (change)="upload(file)" />
          <button mat-stroked-button (click)="file.click()"><mat-icon>upload</mat-icon> Change avatar</button> <button mat-button (click)="removeAvatar()" [disabled]="!auth.avatarUrl()"><mat-icon>delete</mat-icon> Remove</button>
          <h3 style="margin-top:20px">Appearance</h3>
          <mat-slide-toggle [checked]="theme.dark()" (change)="theme.toggle()">Dark theme</mat-slide-toggle>
        </div>
        <div class="card hp-card"><h3>Preferences <span class="k">({{ editable().length }} editable on this engine)</span></h3>
          @for (p of editable(); track p) { <div class="pref"><span>{{ p }}</span><mat-form-field appearance="outline" subscriptSizing="dynamic"><input matInput [ngModel]="prefs()[p] ?? ''" (ngModelChange)="setPref(p, $event)" /></mat-form-field></div> } @empty { <div class="k">No editable preference.</div> }
          @if (editable().length) { <button mat-flat-button style="margin-top:10px" [disabled]="!dirty()" (click)="save()"><mat-icon>save</mat-icon> Save preferences</button> }
        </div>
        <div class="card hp-card"><h3>Memberships ({{ memberships().length }})</h3><div class="chips">@for (m of memberships(); track m) { <span class="hp-chip neutral">{{ m }}</span> }</div></div>
      </div>
    </div>
  `,
})
export class ProfilePage {
  readonly auth = inject(AuthService); readonly theme = inject(ThemeService); private readonly api = inject(BPM_API); private readonly snack = inject(MatSnackBar);
  readonly editable = computed(() => this.auth.user()?.editableUserPreferences ?? []);
  readonly prefs = signal<Record<string, string>>({ ...(this.auth.user()?.userPreferences ?? {}) });
  readonly dirty = signal(false);
  readonly memberships = computed(() => (this.auth.user()?.memberships ?? []).map(m => m.replace(/_[TS]_[0-9a-f-]+(\.[0-9a-f-]+)?$/, '')).filter((v, i, a) => a.indexOf(v) === i).sort());
  setPref(k: string, v: string) { this.prefs.update(p => ({ ...p, [k]: v })); this.dirty.set(true); }
  async save() { try { const changed: Record<string, string> = {}; for (const k of this.editable()) if (this.prefs()[k] !== this.auth.user()?.userPreferences[k]) changed[k] = this.prefs()[k]; await this.api.setPreferences(changed); await this.auth.resume(); this.dirty.set(false); this.snack.open('Preferences saved', undefined, { duration: 2500 }); } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); } }
  upload(input: HTMLInputElement) { const f = input.files?.[0]; if (!f) return; const fr = new FileReader(); fr.onload = async () => { try { await this.api.setAvatar(fr.result as string); this.auth.avatarUrl.set(await this.api.avatar()); this.snack.open('Avatar updated', undefined, { duration: 2500 }); } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); } }; fr.readAsDataURL(f); input.value = ''; }
  async removeAvatar() { try { await this.api.setAvatar(null); this.auth.avatarUrl.set(null); } catch (e) { this.snack.open(errorText(e), 'Close', { duration: 8000, panelClass: 'hp-error' }); } }
}
