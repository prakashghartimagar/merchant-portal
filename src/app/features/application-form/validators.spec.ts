import { FormControl, FormGroup, NonNullableFormBuilder } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import {
  accountHolderMatchesValidator,
  errorMessage,
  matchingFieldsValidator,
  nepalMobileValidator,
  panValidator,
  ticketWithinVolumeValidator,
  websiteValidator,
} from './validators';
import { buildApplicationForm, fromDetail, toDraft } from './application-form';
import { makeDetail } from '../../../testing/test-helpers';

const check = (validator: (c: FormControl) => unknown, value: unknown) =>
  validator(new FormControl(value));

describe('field validators', () => {
  it('PAN must be exactly 9 digits; empty is left to required', () => {
    expect(check(panValidator, '123456789')).toBeNull();
    expect(check(panValidator, '12345678')).toEqual({ pan: true });
    expect(check(panValidator, '12345678a')).toEqual({ pan: true });
    expect(check(panValidator, '')).toBeNull();
  });

  it('accepts Nepali mobile numbers with or without +977', () => {
    expect(check(nepalMobileValidator, '9812345678')).toBeNull();
    expect(check(nepalMobileValidator, '+977-9712345678')).toBeNull();
    expect(check(nepalMobileValidator, '0141234567')).toEqual({ nepalMobile: true });
  });

  it('website is optional but must be http(s) when given', () => {
    expect(check(websiteValidator, '')).toBeNull();
    expect(check(websiteValidator, 'https://shop.example.com')).toBeNull();
    expect(check(websiteValidator, 'shop.example.com')).toEqual({ website: true });
  });
});

describe('cross-field validators', () => {
  it('average ticket cannot exceed monthly volume', () => {
    const g = new FormGroup({
      expectedMonthlyVolume: new FormControl(10000),
      averageTicketSize: new FormControl(20000),
    });
    expect(ticketWithinVolumeValidator(g)).toEqual({ ticketExceedsVolume: true });
    g.patchValue({ averageTicketSize: 500 });
    expect(ticketWithinVolumeValidator(g)).toBeNull();
  });

  it('confirmation must match', () => {
    const v = matchingFieldsValidator('a', 'b');
    expect(
      v(new FormGroup({ a: new FormControl('1234567890'), b: new FormControl('1234567899') })),
    ).toEqual({ fieldsDoNotMatch: true });
    expect(
      v(new FormGroup({ a: new FormControl('1234567890'), b: new FormControl('1234567890') })),
    ).toBeNull();
  });

  it('account holder must match legal name or owner, ignoring case and spacing', () => {
    const form = buildApplicationForm(TestBed.inject(NonNullableFormBuilder));
    form.patchValue({
      business: { legalName: 'Phewa Books Pvt. Ltd.' },
      contact: { ownerName: 'Test Owner' },
    });

    form.patchValue({ bank: { accountHolderName: 'someone else' } });
    expect(accountHolderMatchesValidator(form)).toEqual({ accountHolderMismatch: true });
    form.patchValue({ bank: { accountHolderName: '  phewa books  pvt. ltd. ' } });
    expect(accountHolderMatchesValidator(form)).toBeNull();
    form.patchValue({ bank: { accountHolderName: 'TEST OWNER' } });
    expect(accountHolderMatchesValidator(form)).toBeNull();
  });

  it('has a readable message for every custom error', () => {
    for (const key of [
      'pan',
      'nepalMobile',
      'accountNumber',
      'idNumber',
      'registrationNumber',
      'website',
      'ticketExceedsVolume',
      'fieldsDoNotMatch',
      'accountHolderMismatch',
      'highRiskApproval',
      'rejectNote',
    ]) {
      expect(errorMessage(key, true)).not.toBe('Check this value.');
    }
  });
});

describe('form mapping', () => {
  it('a loaded draft is valid and never sends the confirmation field to the API', () => {
    const detail = makeDetail({
      business: { ...makeDetail().business, panNumber: '123456789' },
      contact: { ...makeDetail().contact, ownerIdNumber: '12-34-56-78901' },
      bank: { ...makeDetail().bank, accountNumber: '12345678901234' },
    });
    const form = buildApplicationForm(TestBed.inject(NonNullableFormBuilder));
    form.reset(fromDetail(detail));
    expect(form.valid).toBe(true);
    expect(toDraft(form.getRawValue()).bank).not.toHaveProperty('confirmAccountNumber');
  });
});
