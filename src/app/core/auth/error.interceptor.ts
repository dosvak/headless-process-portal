import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/** 401 from the engine -> back to the login page; every other failure is passed on with the engine's message. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  return next(req).pipe(catchError((e: HttpErrorResponse) => {
    if (e.status === 401 && !req.url.includes('/user/current')) void router.navigate(['/login'], { queryParams: { expired: 1 } });
    return throwError(() => e);
  }));
};
