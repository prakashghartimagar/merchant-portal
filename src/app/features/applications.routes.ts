import { Routes } from '@angular/router';
import { roleGuard, unsavedChangesGuard } from '../core/auth/guards';

/** Lazy-loaded applications feature. Each page is its own chunk. */
export const APPLICATION_ROUTES: Routes = [
  {
    path: '',
    title: 'Applications · Merchant onboarding',
    loadComponent: () => import('./dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'new',
    title: 'New application · Merchant onboarding',
    canActivate: [roleGuard('SALES')],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./application-form/application-wizard.page').then((m) => m.ApplicationWizardPage),
  },
  {
    path: ':id/edit',
    title: 'Edit application · Merchant onboarding',
    canActivate: [roleGuard('SALES')],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./application-form/application-wizard.page').then((m) => m.ApplicationWizardPage),
  },
  {
    path: ':id',
    title: 'Application · Merchant onboarding',
    loadComponent: () =>
      import('./application-detail/application-detail.page').then((m) => m.ApplicationDetailPage),
  },
];
