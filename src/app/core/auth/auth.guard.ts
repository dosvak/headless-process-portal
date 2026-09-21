import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService); const router = inject(Router);
  if (await auth.resume()) return true;
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
