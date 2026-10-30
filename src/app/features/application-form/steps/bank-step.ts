import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldErrors, showInvalid } from '../../../shared/field-errors';
import { ApplicationForm, BANKS } from '../application-form';

@Component({
  selector: 'app-bank-step',
  imports: [ReactiveFormsModule, FieldErrors],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div [formGroup]="group()" class="form-grid">
      <div class="field">
        <label class="form-label" for="bankName">Bank</label>
        <select
          id="bankName"
          class="form-select"
          formControlName="bankName"
          [class.is-invalid]="invalid('bankName')"
          [attr.aria-invalid]="invalid('bankName')"
          aria-describedby="bankName-err"
        >
          <option value="">Choose…</option>
          @for (b of banks; track b) {
            <option [value]="b">{{ b }}</option>
          }
        </select>
        <app-field-errors id="bankName-err" [control]="group().controls.bankName" />
      </div>
      <div class="field">
        <label class="form-label" for="accountHolderName">Account holder name</label>
        <input
          id="accountHolderName"
          class="form-control"
          formControlName="accountHolderName"
          [class.is-invalid]="holderInvalid()"
          [attr.aria-invalid]="holderInvalid()"
          aria-describedby="accountHolderName-hint accountHolderName-err"
        />
        <div id="accountHolderName-hint" class="form-text">
          Must match the legal business name or the owner’s name.
        </div>
        <app-field-errors
          id="accountHolderName-err"
          [control]="group().controls.accountHolderName"
          [group]="form()"
          [groupKeys]="['accountHolderMismatch']"
        />
      </div>
      <div class="field">
        <label class="form-label" for="accountNumber">Account number</label>
        <input
          id="accountNumber"
          class="form-control sensitive-input"
          formControlName="accountNumber"
          inputmode="numeric"
          autocomplete="off"
          [class.is-invalid]="invalid('accountNumber')"
          [attr.aria-invalid]="invalid('accountNumber')"
          aria-describedby="accountNumber-err"
        />
        <app-field-errors id="accountNumber-err" [control]="group().controls.accountNumber" />
      </div>
      <div class="field">
        <label class="form-label" for="confirmAccountNumber">Confirm account number</label>
        <input
          id="confirmAccountNumber"
          class="form-control sensitive-input"
          formControlName="confirmAccountNumber"
          inputmode="numeric"
          autocomplete="off"
          (paste)="$event.preventDefault()"
          [class.is-invalid]="invalid('confirmAccountNumber', ['fieldsDoNotMatch'])"
          [attr.aria-invalid]="invalid('confirmAccountNumber', ['fieldsDoNotMatch'])"
          aria-describedby="confirmAccountNumber-hint confirmAccountNumber-err"
        />
        <div id="confirmAccountNumber-hint" class="form-text">
          Type it again; pasting is turned off to catch typos.
        </div>
        <app-field-errors
          id="confirmAccountNumber-err"
          [control]="group().controls.confirmAccountNumber"
          [group]="group()"
          [groupKeys]="['fieldsDoNotMatch']"
        />
      </div>
    </div>
  `,
})
export class BankStep {
  readonly group = input.required<ApplicationForm['controls']['bank']>();
  /** The whole form, for the rule that compares the holder with earlier steps. */
  readonly form = input.required<ApplicationForm>();
  protected readonly banks = BANKS;

  protected invalid(
    name: keyof ApplicationForm['controls']['bank']['controls'],
    groupKeys: string[] = [],
  ): boolean {
    return showInvalid(this.group().controls[name], this.group(), groupKeys);
  }

  protected holderInvalid(): boolean {
    return showInvalid(this.group().controls.accountHolderName, this.form(), [
      'accountHolderMismatch',
    ]);
  }
}
