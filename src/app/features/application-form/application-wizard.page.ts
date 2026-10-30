import { DatePipe, Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Observable,
  Subject,
  Subscription,
  finalize,
  map,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs';
import { ApplicationsApi } from '../../core/api/applications.api';
import { HasUnsavedChanges } from '../../core/auth/guards';
import { describeHttpError } from '../../core/http/http-error';
import {
  ApplicationFormValue,
  buildApplicationForm,
  fromDetail,
  toDraft,
} from './application-form';
import { AutoSaveState, INITIAL_AUTOSAVE_STATE, autoSave } from './autosave';
import { BankStep } from './steps/bank-step';
import { BusinessStep } from './steps/business-step';
import { ContactStep } from './steps/contact-step';
import { ReviewStep } from './steps/review-step';

export const WIZARD_STEPS = [
  { title: 'Business details', hint: 'Who the merchant is and how much they expect to process.' },
  { title: 'Owner and contact', hint: 'The person responsible for the account.' },
  { title: 'Settlement account', hint: 'Where card payments are paid out.' },
  { title: 'Review and submit', hint: 'Check everything before sending it for review.' },
] as const;

export const AUTOSAVE_DEBOUNCE_MS = 1500;

@Component({
  selector: 'app-application-wizard-page',
  imports: [RouterLink, DatePipe, BusinessStep, ContactStep, BankStep, ReviewStep],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './application-wizard.page.html',
  styleUrl: './application-wizard.page.scss',
})
export class ApplicationWizardPage implements OnInit, HasUnsavedChanges {
  private readonly api = inject(ApplicationsApi);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Route param; absent for a new application. */
  readonly id = input<string>();

  protected readonly form = buildApplicationForm(inject(NonNullableFormBuilder));
  protected readonly steps = WIZARD_STEPS;
  protected readonly step = signal(0);
  protected readonly applicationId = signal<string | null>(null);
  protected readonly reference = signal<string | null>(null);
  protected readonly loadState = signal<'loading' | 'ready' | 'error'>('ready');
  protected readonly loadError = signal<string | null>(null);
  protected readonly saveState = signal<AutoSaveState>(INITIAL_AUTOSAVE_STATE);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  /** Snapshot for the review step, taken when it is opened. */
  protected readonly reviewValue = signal<ApplicationFormValue>(this.form.getRawValue());
  protected readonly isLastStep = computed(() => this.step() === this.steps.length - 1);

  private readonly stepHeading = viewChild<ElementRef<HTMLElement>>('stepHeading');
  private readonly saveNow$ = new Subject<ApplicationFormValue>();
  private autoSaveSub: Subscription | null = null;
  private pendingCreate$: Observable<string> | null = null;
  private submitted = false;

  constructor() {
    // Stop auto-saving when the page is destroyed.
    inject(DestroyRef).onDestroy(() => this.autoSaveSub?.unsubscribe());
  }

  ngOnInit(): void {
    const id = this.id();
    if (!id) {
      this.startAutoSave();
      return;
    }
    this.applicationId.set(id);
    this.loadState.set('loading');
    this.api.getForEdit(id).subscribe({
      next: (detail) => {
        this.reference.set(detail.reference);
        this.form.reset(fromDetail(detail));
        this.loadState.set('ready');
        this.startAutoSave(this.form.getRawValue());
      },
      error: (err) => {
        this.loadError.set(describeHttpError(err));
        this.loadState.set('error');
      },
    });
  }

  // ------------------------------------------------------------ saving

  private startAutoSave(initialValue?: ApplicationFormValue): void {
    this.autoSaveSub?.unsubscribe();
    this.autoSaveSub = autoSave(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
      save: (value) => this.persist(value),
      debounceMs: AUTOSAVE_DEBOUNCE_MS,
      saveNow$: this.saveNow$,
      initialValue,
      retries: 2,
    }).subscribe((state) => this.saveState.set(state));
  }

  /**
   * Creates the draft on first save, then updates it. If a create is still
   * in flight, later saves wait for its id instead of creating a duplicate.
   */
  private persist(value: ApplicationFormValue): Observable<string> {
    const draft = toDraft(value);
    const id = this.applicationId();
    if (id) return this.api.saveDraft(id, draft).pipe(map(() => id));

    if (this.pendingCreate$) {
      return this.pendingCreate$.pipe(
        switchMap((newId) => this.api.saveDraft(newId, draft).pipe(map(() => newId))),
      );
    }
    this.pendingCreate$ = this.api.create(draft).pipe(
      tap((created) => {
        this.applicationId.set(created.id);
        this.reference.set(created.reference);
        // Update the address bar without re-creating this component.
        this.location.replaceState(`/applications/${created.id}/edit`);
      }),
      map((created) => created.id),
      finalize(() => (this.pendingCreate$ = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.pendingCreate$;
  }

  protected saveNow(): void {
    this.saveNow$.next(this.form.getRawValue());
  }

  hasUnsavedChanges(): boolean {
    if (this.submitted) return false;
    const status = this.saveState().status;
    return status === 'pending' || status === 'saving' || status === 'error';
  }

  @HostListener('window:beforeunload', ['$event'])
  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  // ------------------------------------------------------------ navigation

  protected stepIsValid(index: number): boolean {
    const c = this.form.controls;
    switch (index) {
      case 0:
        return c.business.valid;
      case 1:
        return c.contact.valid;
      case 2:
        return c.bank.valid && !this.form.hasError('accountHolderMismatch');
      default:
        return true;
    }
  }

  private stepGroup(index: number) {
    return [this.form.controls.business, this.form.controls.contact, this.form.controls.bank][
      index
    ];
  }

  protected canOpen(index: number): boolean {
    return (
      index <= this.step() ||
      Array.from({ length: index }, (_, i) => i).every((i) => this.stepIsValid(i))
    );
  }

  protected next(): void {
    const current = this.step();
    this.stepGroup(current)?.markAllAsTouched();
    if (!this.stepIsValid(current)) {
      this.focusFirstInvalid();
      return;
    }
    this.goTo(current + 1);
  }

  protected back(): void {
    this.goTo(this.step() - 1);
  }

  protected goTo(index: number): void {
    if (index < 0 || index >= this.steps.length || !this.canOpen(index)) return;
    if (index === this.steps.length - 1) this.reviewValue.set(this.form.getRawValue());
    this.submitError.set(null);
    this.step.set(index);
    afterNextRender(() => this.stepHeading()?.nativeElement.focus(), { injector: this.injector });
  }

  private focusFirstInvalid(): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('.step-body .is-invalid')?.focus(),
      { injector: this.injector },
    );
  }

  // ------------------------------------------------------------ submit

  protected submit(): void {
    this.form.markAllAsTouched();
    const firstInvalid = [0, 1, 2].find((i) => !this.stepIsValid(i));
    if (firstInvalid !== undefined) {
      this.step.set(firstInvalid);
      this.submitError.set(`Some answers in “${this.steps[firstInvalid].title}” need attention.`);
      this.focusFirstInvalid();
      return;
    }

    // Pause auto-save so it can't write to the application after submission.
    this.autoSaveSub?.unsubscribe();
    this.submitting.set(true);
    this.submitError.set(null);

    this.persist(this.form.getRawValue())
      .pipe(switchMap((id) => this.api.submit(id)))
      .subscribe({
        next: (app) => {
          this.submitted = true;
          void this.router.navigate(['/applications', app.id], {
            state: { flash: 'Application submitted for review.' },
          });
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          const fields =
            err instanceof HttpErrorResponse && Array.isArray(err.error?.fields)
              ? ` (${err.error.fields.join(', ')})`
              : '';
          this.submitError.set(`Couldn’t submit. ${describeHttpError(err)}${fields}`);
          this.startAutoSave(this.form.getRawValue());
        },
      });
  }
}
