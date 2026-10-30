import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { ApplicationDetail, ApplicationDraft } from '../../core/api/models';
import {
  accountHolderMatchesValidator,
  accountNumberValidator,
  idNumberValidator,
  matchingFieldsValidator,
  nepalMobileValidator,
  panValidator,
  registrationNumberValidator,
  ticketWithinVolumeValidator,
  websiteValidator,
} from './validators';

export const BUSINESS_TYPES = [
  { value: 'SOLE_PROPRIETORSHIP', label: 'Sole proprietorship' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'PRIVATE_LIMITED', label: 'Private limited company' },
  { value: 'PUBLIC_LIMITED', label: 'Public limited company' },
];

export const CATEGORIES = [
  { value: 'RETAIL', label: 'Retail' },
  { value: 'FOOD_AND_BEVERAGE', label: 'Food and beverage' },
  { value: 'TRAVEL', label: 'Travel and tourism' },
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'HEALTH', label: 'Health and pharmacy' },
  { value: 'EDUCATION', label: 'Education' },
];

export const PROVINCES = [
  'Koshi',
  'Madhesh',
  'Bagmati',
  'Gandaki',
  'Lumbini',
  'Karnali',
  'Sudurpashchim',
];

export const BANKS = [
  'Example Commercial Bank',
  'Sample Development Bank',
  'Demo Finance Ltd',
  'Test Investment Bank',
];

export const labelFor = (list: { value: string; label: string }[], value: string | undefined) =>
  list.find((x) => x.value === value)?.label ?? value ?? '';

export function buildApplicationForm(fb: NonNullableFormBuilder) {
  return fb.group(
    {
      business: fb.group(
        {
          businessName: [
            '',
            [Validators.required, Validators.minLength(3), Validators.maxLength(120)],
          ],
          legalName: ['', [Validators.required, Validators.maxLength(160)]],
          businessType: ['', Validators.required],
          registrationNumber: ['', [Validators.required, registrationNumberValidator]],
          panNumber: ['', [Validators.required, panValidator]],
          category: ['', Validators.required],
          website: ['', websiteValidator],
          expectedMonthlyVolume: fb.control<number | null>(null, [
            Validators.required,
            Validators.min(10000),
            Validators.max(1_000_000_000),
          ]),
          averageTicketSize: fb.control<number | null>(null, [
            Validators.required,
            Validators.min(1),
          ]),
        },
        { validators: ticketWithinVolumeValidator },
      ),
      contact: fb.group({
        ownerName: ['', [Validators.required, Validators.maxLength(120)]],
        ownerIdNumber: ['', [Validators.required, idNumberValidator]],
        email: ['', [Validators.required, Validators.email]],
        phone: ['', [Validators.required, nepalMobileValidator]],
        province: ['', Validators.required],
        city: ['', [Validators.required, Validators.maxLength(80)]],
        street: ['', Validators.maxLength(160)],
      }),
      bank: fb.group(
        {
          bankName: ['', Validators.required],
          accountHolderName: ['', [Validators.required, Validators.maxLength(160)]],
          accountNumber: ['', [Validators.required, accountNumberValidator]],
          confirmAccountNumber: ['', Validators.required],
        },
        { validators: matchingFieldsValidator('accountNumber', 'confirmAccountNumber') },
      ),
    },
    { validators: accountHolderMatchesValidator },
  );
}

export type ApplicationForm = ReturnType<typeof buildApplicationForm>;
export type ApplicationFormValue = ReturnType<ApplicationForm['getRawValue']>;

/** What gets sent to the API. The confirmation field never leaves the browser. */
export function toDraft(value: ApplicationFormValue): ApplicationDraft {
  const { confirmAccountNumber: _confirm, ...bank } = value.bank;
  return { business: value.business, contact: value.contact, bank };
}

export function fromDetail(detail: ApplicationDetail): ApplicationFormValue {
  const b = detail.business;
  const c = detail.contact;
  const k = detail.bank;
  return {
    business: {
      businessName: b.businessName ?? '',
      legalName: b.legalName ?? '',
      businessType: b.businessType ?? '',
      registrationNumber: b.registrationNumber ?? '',
      panNumber: b.panNumber ?? '',
      category: b.category ?? '',
      website: b.website ?? '',
      expectedMonthlyVolume: b.expectedMonthlyVolume ?? null,
      averageTicketSize: b.averageTicketSize ?? null,
    },
    contact: {
      ownerName: c.ownerName ?? '',
      ownerIdNumber: c.ownerIdNumber ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      province: c.province ?? '',
      city: c.city ?? '',
      street: c.street ?? '',
    },
    bank: {
      bankName: k.bankName ?? '',
      accountHolderName: k.accountHolderName ?? '',
      accountNumber: k.accountNumber ?? '',
      confirmAccountNumber: k.accountNumber ?? '',
    },
  };
}

export const formatAddress = (c: { street?: string; city?: string; province?: string }) =>
  [c.street, c.city, c.province].filter(Boolean).join(', ') || '—';
