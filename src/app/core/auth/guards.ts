import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { Role } from '../api/models';
import { AuthService } from './auth.service';

/** Signed-in users only; everyone else goes to /login and comes back after. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Restricts a route to the given roles. Use after authGuard. */
export function roleGuard(...roles: Role[]): CanActivateFn {
  return () => {
    const role = inject(AuthService).role();
    return role !== null && roles.includes(role)
      ? true
      : inject(Router).createUrlTree(['/forbidden']);
  };
}

/** Keeps signed-in users away from the login page. */
export const guestGuard: CanActivateFn = () =>
  inject(AuthService).isAuthenticated() ? inject(Router).createUrlTree(['/applications']) : true;

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Confirms before leaving a page whose latest edits are not saved yet. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component.hasUnsavedChanges() ||
  confirm('Your latest changes are not saved yet. Leave this page anyway?');
