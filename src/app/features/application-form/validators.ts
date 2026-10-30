import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const isEmpty = (v: unknown) => v === null || v === undefined || v === '';

function patternValidator(pattern: RegExp, errorKey: string): ValidatorFn {
  return (control) => {
    const value = control.value;
    if (isEmpty(value)) return null; // leave emptiness to Validators.required
    return pattern.test(String(value).trim()) ? null : { [errorKey]: true };
  };
}

/** Nepal PAN: exactly 9 digits. */
export const panValidator = patternValidator(/^\d{9}$/, 'pan');

/** Nepal mobile: 98/97/96 followed by 8 digits, optional +977 prefix. */
export const nepalMobileValidator = patternValidator(/^(\+977-?)?9[678]\d{8}$/, 'nepalMobile');

/** Bank account: 10 to 20 digits. */
export const accountNumberValidator = patternValidator(/^\d{10,20}$/, 'accountNumber');

/** Citizenship / national ID: digits separated by hyphens or slashes. */
export const idNumberValidator = patternValidator(/^\d[\d\-/]{4,22}\d$/, 'idNumber');

/** Company registration number, e.g. 12345 or 12345/078. */
export const registrationNumberValidator = patternValidator(
  /^\d{3,8}(\/\d{2,4})?$/,
  'registrationNumber',
);

/** Optional website; when given it must be an http(s) URL. */
export const websiteValidator = patternValidator(/^https?:\/\/[^\s/$.?#].[^\s]*$/i, 'website');

/** Group validator: the average ticket can't exceed the monthly volume. */
export const ticketWithinVolumeValidator: ValidatorFn = (
  group: AbstractControl,
): ValidationErrors | null => {
  const volume = group.get('expectedMonthlyVolume')?.value;
  const ticket = group.get('averageTicketSize')?.value;
  if (isEmpty(volume) || isEmpty(ticket)) return null;
  return Number(ticket) > Number(volume) ? { ticketExceedsVolume: true } : null;
};

/** Group validator: two fields in the same group must be identical. */
export function matchingFieldsValidator(field: string, confirmField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(field)?.value;
    const b = group.get(confirmField)?.value;
    if (isEmpty(a) || isEmpty(b)) return null;
    return a === b ? null : { fieldsDoNotMatch: true };
  };
}

const normalise = (s: unknown) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/**
 * Form-level validator spanning two steps: the settlement account must be
 * held by the registered business or by its owner (a common KYC rule).
 */
export const accountHolderMatchesValidator: ValidatorFn = (
  form: AbstractControl,
): ValidationErrors | null => {
  const holder = normalise(form.get('bank.accountHolderName')?.value);
  if (!holder) return null;
  const allowed = [form.get('business.legalName')?.value, form.get('contact.ownerName')?.value]
    .map(normalise)
    .filter(Boolean);
  if (allowed.length === 0) return null;
  return allowed.includes(holder) ? null : { accountHolderMismatch: true };
};

/** User-facing text for every error key used in the app. */
export function errorMessage(key: string, error: unknown): string {
  const e = (error ?? {}) as Record<string, unknown>;
  switch (key) {
    case 'required':
      return 'This field is required.';
    case 'minlength':
      return `Enter at least ${e['requiredLength']} characters.`;
    case 'maxlength':
      return `Use ${e['requiredLength']} characters or fewer.`;
    case 'min':
      return `Enter ${Number(e['min']).toLocaleString('en-IN')} or more.`;
    case 'max':
      return `Enter ${Number(e['max']).toLocaleString('en-IN')} or less.`;
    case 'email':
      return 'Enter an email address like name@example.com.';
    case 'pan':
      return 'PAN must be exactly 9 digits.';
    case 'nepalMobile':
      return 'Enter a 10-digit mobile number starting with 96, 97 or 98.';
    case 'accountNumber':
      return 'Account number must be 10 to 20 digits.';
    case 'idNumber':
      return 'Use digits separated by hyphens, e.g. 12-34-56-78901.';
    case 'registrationNumber':
      return 'Use the registration number format 12345 or 12345/078.';
    case 'website':
      return 'Enter a full address starting with https://';
    case 'ticketExceedsVolume':
      return 'Average transaction can’t be larger than monthly volume.';
    case 'fieldsDoNotMatch':
      return 'Account numbers don’t match.';
    case 'accountHolderMismatch':
      return 'Account holder must match the legal business name or the owner’s name.';
    case 'rejectNote':
      return 'Explain the rejection in at least 20 characters so sales can follow up.';
    case 'highRiskApproval':
      return 'High-risk applications can’t be approved. Choose a lower risk level or reject.';
    default:
      return 'Check this value.';
  }
}
