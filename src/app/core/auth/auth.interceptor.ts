import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/** Adds the sign-on of the current user (basic authentication or the Zen identity token) to every call of the engine APIs,
 *  plus the BPMCSRFToken on the Process REST / Operations REST APIs when one was obtained (required on CP4BA). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const header = auth.authorization();
  const isEngine = req.url.startsWith('/rest/') || req.url.startsWith('/bpm/') || req.url.startsWith('/ops/');
  if (!header || !isEngine) return next(req);
  const headers: Record<string, string> = { Authorization: header };
  const csrf = auth.csrf();
  if (csrf) headers['BPMCSRFToken'] = csrf;   // every engine family: CP4BA's CSRF filter also guards /rest when a session cookie is present
  return next(req.clone({ setHeaders: headers }));
};
