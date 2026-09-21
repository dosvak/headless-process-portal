import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BPM_API } from '../api/bpm-api';
import { CurrentUser } from '../api/models';

const STORAGE_KEY = 'hp.session';
interface Session { user: string; password: string; }

/** Integrated sign-on: the credentials of the login page are kept for the session (session storage) and sent as basic
 *  authentication on every REST call by the auth interceptor; the current user comes from the engine. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(BPM_API);
  private readonly router = inject(Router);
  private readonly session = signal<Session | null>(AuthService.restore());
  readonly user = signal<CurrentUser | null>(null);
  readonly isAuthenticated = computed(() => this.session() !== null && this.user() !== null);
  readonly userName = computed(() => this.user()?.userName ?? this.session()?.user ?? '');
  readonly displayName = computed(() => this.user()?.fullName || this.userName());
  readonly avatarUrl = signal<string | null>(null);
  readonly initials = computed(() => this.displayName().split(/\s+/).map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase());

  /** Basic authentication header value, or null when nobody is signed in. */
  authorization(): string | null {
    const s = this.session();
    return s ? 'Basic ' + btoa(unescape(encodeURIComponent(`${s.user}:${s.password}`))) : null;
  }

  async signIn(user: string, password: string): Promise<CurrentUser> {
    this.session.set({ user, password }); (this.api as { setUser?: (u: string) => void }).setUser?.(user);
    try {
      const me = await this.api.currentUser();
      this.user.set(me); void this.api.avatar().then(a => this.avatarUrl.set(a)).catch(() => undefined);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ user, password }));
      return me;
    } catch (e) {
      this.session.set(null); this.user.set(null);
      throw e;
    }
  }

  /** Re-validates a stored session on reload; false when the engine refuses it. */
  async resume(): Promise<boolean> {
    if (!this.session()) return false;
    if (this.user()) return true;
    (this.api as { setUser?: (u: string) => void }).setUser?.(this.session()!.user);
    try { this.user.set(await this.api.currentUser()); void this.api.avatar().then(a => this.avatarUrl.set(a)).catch(() => undefined); return true; } catch { this.signOut(false); return false; }
  }

  signOut(navigate = true): void {
    this.session.set(null); this.user.set(null); sessionStorage.removeItem(STORAGE_KEY);
    if (navigate) void this.router.navigate(['/login']);
  }

  private static restore(): Session | null {
    try { const raw = sessionStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) as Session : null; } catch { return null; }
  }
}
