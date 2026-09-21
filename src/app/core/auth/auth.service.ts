import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BPM_API } from '../api/bpm-api';
import { CurrentUser } from '../api/models';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'hp.session';
interface Session { user: string; password: string; token?: string; csrf?: string; }

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

  /** Authorization header value (basic credentials, or the Zen identity token as Bearer), or null when nobody is signed in. */
  authorization(): string | null {
    const s = this.session();
    if (!s) return null;
    return s.token ? `Bearer ${s.token}` : 'Basic ' + btoa(unescape(encodeURIComponent(`${s.user}:${s.password}`)));
  }

  /** BPMCSRFToken for /bpm and /ops calls (CP4BA requires it on every non-GET call), or null. */
  csrf(): string | null { return this.session()?.csrf ?? null; }

  /** CP4BA: exchange the credentials for a Zen identity token (GET /v1/preauth/validateAuth with basic authentication). */
  private async zenToken(user: string, password: string): Promise<string> {
    const r = await fetch(`${environment.zenBase}/v1/preauth/validateAuth`, { credentials: 'omit', headers: { Authorization: 'Basic ' + btoa(unescape(encodeURIComponent(`${user}:${password}`))), Accept: 'application/json' } });
    if (!r.ok) throw Object.assign(new Error(`Sign-in failed (${r.status})`), { status: r.status });   // the login page maps status 401 to "Wrong user name or password" like the basic-auth path
    const body = await r.json() as { accessToken?: string };
    if (!body.accessToken) throw new Error('Zen sign-on returned no identity token');
    return body.accessToken;
  }

  /** CSRF token of the Process REST API (POST /bpm/system/login); optional on traditional BAW, required on CP4BA. */
  private async csrfToken(authorization: string): Promise<string | undefined> {
    try {
      const r = await fetch(`${environment.bpmBase}/system/login`, { method: 'POST', credentials: 'omit', headers: { Authorization: authorization, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ refresh_groups: false, requested_lifetime: 7200 }) });
      if (!r.ok) return undefined;
      return ((await r.json()) as { csrf_token?: string }).csrf_token;
    } catch { return undefined; }
  }

  async signIn(user: string, password: string): Promise<CurrentUser> {
    const token = environment.authMode === 'zen' ? await this.zenToken(user, password) : undefined;
    const session: Session = { user, password, token };
    this.session.set(session); (this.api as { setUser?: (u: string) => void }).setUser?.(user);
    try {
      session.csrf = await this.csrfToken(this.authorization()!); this.session.set({ ...session });
      const me = await this.api.currentUser();
      this.user.set(me); void this.api.avatar().then(a => this.avatarUrl.set(a)).catch(() => undefined);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
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
