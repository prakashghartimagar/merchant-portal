import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ApplicationsApi } from '../../core/api/applications.api';
import { ApplicationDetail, Decision, RiskLevel } from '../../core/api/models';
import { describeHttpError } from '../../core/http/http-error';
import { FieldErrors, showInvalid } from '../../shared/field-errors';

/** Mirrors the API's rules: no approving high risk, and rejections need a real reason. */
export function decisionRulesValidator(group: AbstractControl): ValidationErrors | null {
  const decision = group.get('decision')?.value as Decision | '';
  const risk = group.get('riskLevel')?.value as RiskLevel | '';
  const note = String(group.get('note')?.value ?? '').trim();
  if (decision === 'APPROVE' && risk === 'HIGH') return { highRiskApproval: true };
  if (decision === 'REJECT' && note.length > 0 && note.length < 20) return { rejectNote: true };
  return null;
}

@Component({
  selector: 'app-decision-form',
  imports: [ReactiveFormsModule, FieldErrors],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <fieldset class="mb-3">
        <legend class="form-label fw-semibold">Decision</legend>
        <div class="choice-row">
          <label class="choice"
            ><input type="radio" formControlName="decision" value="APPROVE" /> Approve</label
          >
          <label class="choice"
            ><input type="radio" formControlName="decision" value="REJECT" /> Reject</label
          >
        </div>
        <app-field-errors id="decision-err" [control]="form.controls.decision" />
      </fieldset>

      <div class="mb-3">
        <label class="form-label fw-semibold" for="riskLevel">Risk level</label>
        <select
          id="riskLevel"
          class="form-select"
          formControlName="riskLevel"
          [class.is-invalid]="invalid('riskLevel', ['highRiskApproval'])"
          [attr.aria-invalid]="invalid('riskLevel', ['highRiskApproval'])"
          aria-describedby="riskLevel-err"
        >
          <option value="">Choose…</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
        <app-field-errors
          id="riskLevel-err"
          [control]="form.controls.riskLevel"
          [group]="form"
          [groupKeys]="['highRiskApproval']"
        />
      </div>

      <div class="mb-3">
        <label class="form-label fw-semibold" for="note">Reviewer note</label>
        <textarea
          id="note"
          rows="3"
          class="form-control"
          formControlName="note"
          [class.is-invalid]="invalid('note', ['rejectNote'])"
          [attr.aria-invalid]="invalid('note', ['rejectNote'])"
          aria-describedby="note-err"
        ></textarea>
        <app-field-errors
          id="note-err"
          [control]="form.controls.note"
          [group]="form"
          [groupKeys]="['rejectNote']"
        />
      </div>

      @if (error()) {
        <div class="alert alert-danger" role="alert">{{ error() }}</div>
      }

      <button
        type="submit"
        class="btn"
        [class.btn-primary]="form.value.decision !== 'REJECT'"
        [class.btn-danger]="form.value.decision === 'REJECT'"
        [disabled]="saving()"
      >
        @if (saving()) {
          Recording…
        } @else if (form.value.decision === 'REJECT') {
          Record rejection
        } @else if (form.value.decision === 'APPROVE') {
          Record approval
        } @else {
          Record decision
        }
      </button>
    </form>
  `,
})
export class DecisionForm {
  private readonly api = inject(ApplicationsApi);

  readonly applicationId = input.required<string>();
  readonly decided = output<ApplicationDetail>();

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      decision: ['' as Decision | '', Validators.required],
      riskLevel: ['' as RiskLevel | '', Validators.required],
      note: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
    },
    { validators: decisionRulesValidator },
  );
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected invalid(name: 'decision' | 'riskLevel' | 'note', groupKeys: string[] = []): boolean {
    return showInvalid(this.form.controls[name], this.form, groupKeys);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { decision, riskLevel, note } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api
      .recordDecision(this.applicationId(), {
        decision: decision as Decision,
        riskLevel: riskLevel as RiskLevel,
        note: note.trim(),
      })
      .subscribe({
        next: (app) => {
          this.saving.set(false);
          this.decided.emit(app);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(describeHttpError(err));
        },
      });
  }
}
