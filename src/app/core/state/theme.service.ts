import { Injectable, effect, signal } from '@angular/core';

/** Light / dark theme, remembered per browser. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal<boolean>(ThemeService.initial());
  constructor() { effect(() => { document.documentElement.classList.toggle('dark', this.dark()); try { localStorage.setItem('hp.theme', this.dark() ? 'dark' : 'light'); } catch { /* private mode */ } }); }
  toggle() { this.dark.update(d => !d); }
  private static initial(): boolean {
    try { const v = localStorage.getItem('hp.theme'); if (v) return v === 'dark'; } catch { /* ignore */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
