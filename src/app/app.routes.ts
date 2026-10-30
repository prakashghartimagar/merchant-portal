import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/guards';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in · Merchant onboarding',
    loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'applications' },
      {
        path: 'applications',
        loadChildren: () =>
          import('./features/applications.routes').then((m) => m.APPLICATION_ROUTES),
      },
      {
        path: 'forbidden',
        title: 'No access · Merchant onboarding',
        loadComponent: () =>
          import('./features/forbidden/forbidden.page').then((m) => m.ForbiddenPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
