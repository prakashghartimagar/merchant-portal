import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldErrors, showInvalid } from '../../../shared/field-errors';
import { ApplicationForm, BUSINESS_TYPES, CATEGORIES } from '../application-form';

// Default change detection: reactive-form validity isn't signal-based, so the
// step re-checks whenever its parent wizard does (e.g. after "Continue").
@Component({
  selector: 'app-business-step',
  imports: [ReactiveFormsModule, FieldErrors],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div [formGroup]="group()" class="form-grid">
      <div class="field">
        <label class="form-label" for="businessName">Trading name</label>
        <input
          id="businessName"
          class="form-control"
          formControlName="businessName"
          autocomplete="organization"
          [class.is-invalid]="invalid('businessName')"
          [attr.aria-invalid]="invalid('businessName')"
          aria-describedby="businessName-err"
        />
        <app-field-errors id="businessName-err" [control]="group().controls.businessName" />
      </div>
      <div class="field">
        <label class="form-label" for="legalName">Registered legal name</label>
        <input
          id="legalName"
          class="form-control"
          formControlName="legalName"
          [class.is-invalid]="invalid('legalName')"
          [attr.aria-invalid]="invalid('legalName')"
          aria-describedby="legalName-err"
        />
        <app-field-errors id="legalName-err" [control]="group().controls.legalName" />
      </div>
      <div class="field">
        <label class="form-label" for="businessType">Business type</label>
        <select
          id="businessType"
          class="form-select"
          formControlName="businessType"
          [class.is-invalid]="invalid('businessType')"
          [attr.aria-invalid]="invalid('businessType')"
          aria-describedby="businessType-err"
        >
          <option value="">Choose…</option>
          @for (t of businessTypes; track t.value) {
            <option [value]="t.value">{{ t.label }}</option>
          }
        </select>
        <app-field-errors id="businessType-err" [control]="group().controls.businessType" />
      </div>
      <div class="field">
        <label class="form-label" for="category">Business category</label>
        <select
          id="category"
          class="form-select"
          formControlName="category"
          [class.is-invalid]="invalid('category')"
          [attr.aria-invalid]="invalid('category')"
          aria-describedby="category-err"
        >
          <option value="">Choose…</option>
          @for (c of categories; track c.value) {
            <option [value]="c.value">{{ c.label }}</option>
          }
        </select>
        <app-field-errors id="category-err" [control]="group().controls.category" />
      </div>
      <div class="field">
        <label class="form-label" for="registrationNumber">Company registration number</label>
        <input
          id="registrationNumber"
          class="form-control"
          formControlName="registrationNumber"
          inputmode="numeric"
          [class.is-invalid]="invalid('registrationNumber')"
          [attr.aria-invalid]="invalid('registrationNumber')"
          aria-describedby="registrationNumber-hint registrationNumber-err"
        />
        <div id="registrationNumber-hint" class="form-text">For example 12345/078</div>
        <app-field-errors
          id="registrationNumber-err"
          [control]="group().controls.registrationNumber"
        />
      </div>
      <div class="field">
        <label class="form-label" for="panNumber">PAN</label>
        <input
          id="panNumber"
          class="form-control sensitive-input"
          formControlName="panNumber"
          inputmode="numeric"
          maxlength="9"
          autocomplete="off"
          [class.is-invalid]="invalid('panNumber')"
          [attr.aria-invalid]="invalid('panNumber')"
          aria-describedby="panNumber-hint panNumber-err"
        />
        <div id="panNumber-hint" class="form-text">
          9 digits. Shown masked to everyone after you submit.
        </div>
        <app-field-errors id="panNumber-err" [control]="group().controls.panNumber" />
      </div>
      <div class="field">
        <label class="form-label" for="expectedMonthlyVolume"
          >Expected monthly card volume (NPR)</label
        >
        <input
          id="expectedMonthlyVolume"
          type="number"
          min="0"
          step="1000"
          class="form-control"
          formControlName="expectedMonthlyVolume"
          [class.is-invalid]="invalid('expectedMonthlyVolume')"
          [attr.aria-invalid]="invalid('expectedMonthlyVolume')"
          aria-describedby="expectedMonthlyVolume-err"
        />
        <app-field-errors
          id="expectedMonthlyVolume-err"
          [control]="group().controls.expectedMonthlyVolume"
        />
      </div>
      <div class="field">
        <label class="form-label" for="averageTicketSize">Average transaction (NPR)</label>
        <input
          id="averageTicketSize"
          type="number"
          min="0"
          class="form-control"
          formControlName="averageTicketSize"
          [class.is-invalid]="invalid('averageTicketSize', ['ticketExceedsVolume'])"
          [attr.aria-invalid]="invalid('averageTicketSize', ['ticketExceedsVolume'])"
          aria-describedby="averageTicketSize-err"
        />
        <app-field-errors
          id="averageTicketSize-err"
          [control]="group().controls.averageTicketSize"
          [group]="group()"
          [groupKeys]="['ticketExceedsVolume']"
        />
      </div>
      <div class="field field--wide">
        <label class="form-label" for="website"
          >Website <span class="optional">(optional)</span></label
        >
        <input
          id="website"
          type="url"
          class="form-control"
          formControlName="website"
          placeholder="https://"
          [class.is-invalid]="invalid('website')"
          [attr.aria-invalid]="invalid('website')"
          aria-describedby="website-err"
        />
        <app-field-errors id="website-err" [control]="group().controls.website" />
      </div>
    </div>
  `,
})
export class BusinessStep {
  readonly group = input.required<ApplicationForm['controls']['business']>();
  protected readonly businessTypes = BUSINESS_TYPES;
  protected readonly categories = CATEGORIES;

  protected invalid(
    name: keyof ApplicationForm['controls']['business']['controls'],
    groupKeys: string[] = [],
  ): boolean {
    return showInvalid(this.group().controls[name], this.group(), groupKeys);
  }
}
