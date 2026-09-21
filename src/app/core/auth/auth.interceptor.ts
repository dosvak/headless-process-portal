import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/** Adds the basic authentication of the signed-in user to every call of the engine APIs. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const header = auth.authorization();
  const isEngine = req.url.startsWith('/rest/') || req.url.startsWith('/bpm/') || req.url.startsWith('/ops/');
  return next(header && isEngine ? req.clone({ setHeaders: { Authorization: header } }) : req);
};
