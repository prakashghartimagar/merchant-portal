import { computed, signal } from '@angular/core';
import { ApplicationDetail, Role, UserRef } from '../app/core/api/models';
import { AuthService } from '../app/core/auth/auth.service';

export const SALES: UserRef = { id: 'u_sales_1', name: 'Sales One', role: 'SALES' };
export const OTHER_SALES: UserRef = { id: 'u_sales_2', name: 'Sales Two', role: 'SALES' };
export const REVIEWER: UserRef = { id: 'u_rev_1', name: 'Reviewer One', role: 'REVIEWER' };
export const OTHER_REVIEWER: UserRef = { id: 'u_rev_2', name: 'Reviewer Two', role: 'REVIEWER' };
export const ADMIN: UserRef = { id: 'u_admin', name: 'Admin', role: 'ADMIN' };

/** A minimal AuthService stand-in with the signals components read. */
export function authStub(user: UserRef | null) {
  const current = signal(user);
  return {
    provide: AuthService,
    useValue: {
      user: current.asReadonly(),
      role: computed<Role | null>(() => current()?.role ?? null),
      isAuthenticated: computed(() => current() !== null),
      accessToken: signal('test-token').asReadonly(),
      logout: () => current.set(null),
    },
  };
}

export function makeDetail(overrides: Partial<ApplicationDetail> = {}): ApplicationDetail {
  return {
    id: 'app_1',
    reference: 'MA-10001',
    businessName: 'Phewa Books',
    category: 'RETAIL',
    status: 'IN_REVIEW',
    createdBy: SALES,
    assignedReviewer: REVIEWER,
    expectedMonthlyVolume: 500000,
    updatedAt: '2026-10-01T10:00:00Z',
    createdAt: '2026-10-01T09:00:00Z',
    submittedAt: '2026-10-01T09:30:00Z',
    business: {
      businessName: 'Phewa Books',
      legalName: 'Phewa Books Pvt. Ltd.',
      businessType: 'PRIVATE_LIMITED',
      registrationNumber: '12345/078',
      panNumber: '•••••6789',
      category: 'RETAIL',
      website: '',
      expectedMonthlyVolume: 500000,
      averageTicketSize: 1500,
    },
    contact: {
      ownerName: 'Test Owner',
      ownerIdNumber: '••••••••01',
      email: 'owner@example.com',
      phone: '9800000000',
      province: 'Gandaki',
      city: 'Pokhara',
      street: 'Ward 6',
    },
    bank: {
      bankName: 'Example Commercial Bank',
      accountHolderName: 'Phewa Books Pvt. Ltd.',
      accountNumber: '••••••••••1234',
    },
    sensitiveFields: ['panNumber', 'ownerIdNumber', 'accountNumber'],
    ...overrides,
  };
}
