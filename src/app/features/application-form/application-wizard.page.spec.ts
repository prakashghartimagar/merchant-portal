import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { ApplicationsApi } from '../../core/api/applications.api';
import { SaveResult } from '../../core/api/models';
import { makeDetail } from '../../../testing/test-helpers';
import { AUTOSAVE_DEBOUNCE_MS, ApplicationWizardPage } from './application-wizard.page';

const VALID = {
  business: {
    businessName: 'Phewa Books',
    legalName: 'Phewa Books Pvt. Ltd.',
    businessType: 'PRIVATE_LIMITED',
    registrationNumber: '12345/078',
    panNumber: '123456789',
    category: 'RETAIL',
    website: '',
    expectedMonthlyVolume: 500000,
    averageTicketSize: 1500,
  },
  contact: {
    ownerName: 'Test Owner',
    ownerIdNumber: '12-34-56-78901',
    email: 'owner@example.com',
    phone: '9800000000',
    province: 'Gandaki',
    city: 'Pokhara',
    street: '',
  },
  bank: {
    bankName: 'Example Commercial Bank',
    accountHolderName: 'Phewa Books Pvt. Ltd.',
    accountNumber: '12345678901234',
    confirmAccountNumber: '12345678901234',
  },
};

const saved = (id = 'app_new'): SaveResult => ({
  id,
  reference: 'MA-20001',
  updatedAt: '2026-10-30T00:00:00Z',
});

function setup(id?: string) {
  const api = {
    create: vi.fn(() => of(saved())),
    saveDraft: vi.fn((draftId: string) => of(saved(draftId))),
    submit: vi.fn((draftId: string) => of(makeDetail({ id: draftId, status: 'SUBMITTED' }))),
    getForEdit: vi.fn(() =>
      of(
        makeDetail({
          id: 'app_1',
          status: 'DRAFT',
          business: VALID.business,
          contact: VALID.contact,
          bank: { ...VALID.bank },
        }),
      ),
    ),
  };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: ApplicationsApi, useValue: api }],
  });
  const fixture = TestBed.createComponent(ApplicationWizardPage);
  if (id) fixture.componentRef.setInput('id', id);
  fixture.detectChanges();
  const page = fixture.componentInstance;
  const el = fixture.nativeElement as HTMLElement;
  const click = (label: string) => {
    Array.from(el.querySelectorAll<HTMLButtonElement>('.wizard__actions button'))
      .find((b) => b.textContent?.includes(label))!
      .click();
    fixture.detectChanges();
  };
  return { fixture, page, el, api, click, form: page['form'] };
}

describe('ApplicationWizardPage', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps the user on a step until it is valid, and shows why', () => {
    const { el, click, page } = setup();
    click('Continue');
    expect(page['step']()).toBe(0);
    expect(el.querySelectorAll('.is-invalid').length).toBeGreaterThan(0);
    expect(el.textContent).toContain('This field is required.');
  });

  it('moves on once the step is valid', () => {
    const { click, page, form, el } = setup();
    form.controls.business.setValue(VALID.business);
    click('Continue');
    expect(page['step']()).toBe(1);
    expect(el.querySelector('#step-title')?.textContent).toContain('Owner and contact');
  });

  it('auto-saves after a pause: creates the draft once, then updates it', () => {
    vi.useFakeTimers();
    const { form, api, page } = setup();
    const replaceState = vi.spyOn(TestBed.inject(Location), 'replaceState');

    form.controls.business.controls.businessName.setValue('Phe');
    form.controls.business.controls.businessName.setValue('Phewa');
    expect(page.hasUnsavedChanges()).toBe(true);
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith('/applications/app_new/edit');
    expect(page.hasUnsavedChanges()).toBe(false);

    form.controls.business.controls.legalName.setValue('Phewa Books Pvt. Ltd.');
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.saveDraft).toHaveBeenCalledWith(
      'app_new',
      expect.objectContaining({
        business: expect.objectContaining({ legalName: 'Phewa Books Pvt. Ltd.' }),
      }),
    );
  });

  it('never creates two drafts when Submit is pressed while the first auto-save is still creating', () => {
    vi.useFakeTimers();
    const { form, api, page } = setup();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const create$ = new Subject<SaveResult>();
    api.create.mockReturnValue(create$);

    form.setValue(VALID);
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS); // auto-save starts creating the draft
    page['submit'](); // submit needs an id too, so it must wait for that create

    create$.next(saved());
    create$.complete();

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.saveDraft).toHaveBeenCalledWith('app_new', expect.anything());
    expect(api.submit).toHaveBeenCalledWith('app_new');
  });

  it('keeps everything the user typed when a save fails', () => {
    vi.useFakeTimers();
    const { form, api, page, fixture, el } = setup();
    // 403 is not retried, so the error shows straight away.
    api.create.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));

    form.controls.business.controls.businessName.setValue('Phewa Books');
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    fixture.detectChanges();

    expect(page['saveState']().status).toBe('error');
    expect(page.hasUnsavedChanges()).toBe(true);
    expect(el.querySelector('.save-status')?.textContent).toContain('Not saved');
    expect(form.controls.business.controls.businessName.value).toBe('Phewa Books');
  });

  it('loads an existing draft for editing without re-saving it', () => {
    vi.useFakeTimers();
    const { api, form } = setup('app_1');
    expect(api.getForEdit).toHaveBeenCalledWith('app_1');
    expect(form.valid).toBe(true);
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2);
    expect(api.saveDraft).not.toHaveBeenCalled();
  });

  it('on submit, jumps to the first step that needs attention', () => {
    const { page, form } = setup();
    form.controls.business.setValue(VALID.business);
    page['submit']();
    expect(page['step']()).toBe(1);
    expect(page['submitError']()).toContain('Owner and contact');
  });

  it('saves and submits a complete application, then opens it', () => {
    const { page, form, api } = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    form.setValue(VALID);
    page['submit']();
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.submit).toHaveBeenCalledWith('app_new');
    expect(navigate).toHaveBeenCalledWith(['/applications', 'app_new'], expect.anything());
    expect(page.hasUnsavedChanges()).toBe(false);
  });
});
