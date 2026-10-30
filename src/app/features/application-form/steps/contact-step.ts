import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldErrors, showInvalid } from '../../../shared/field-errors';
import { ApplicationForm, PROVINCES } from '../application-form';

@Component({
  selector: 'app-contact-step',
  imports: [ReactiveFormsModule, FieldErrors],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div [formGroup]="group()" class="form-grid">
      <div class="field">
        <label class="form-label" for="ownerName">Owner’s full name</label>
        <input
          id="ownerName"
          class="form-control"
          formControlName="ownerName"
          autocomplete="name"
          [class.is-invalid]="invalid('ownerName')"
          [attr.aria-invalid]="invalid('ownerName')"
          aria-describedby="ownerName-err"
        />
        <app-field-errors id="ownerName-err" [control]="group().controls.ownerName" />
      </div>
      <div class="field">
        <label class="form-label" for="ownerIdNumber">Citizenship or national ID number</label>
        <input
          id="ownerIdNumber"
          class="form-control sensitive-input"
          formControlName="ownerIdNumber"
          autocomplete="off"
          [class.is-invalid]="invalid('ownerIdNumber')"
          [attr.aria-invalid]="invalid('ownerIdNumber')"
          aria-describedby="ownerIdNumber-hint ownerIdNumber-err"
        />
        <div id="ownerIdNumber-hint" class="form-text">
          Shown masked to everyone after you submit.
        </div>
        <app-field-errors id="ownerIdNumber-err" [control]="group().controls.ownerIdNumber" />
      </div>
      <div class="field">
        <label class="form-label" for="email">Email</label>
        <input
          id="email"
          type="email"
          class="form-control"
          formControlName="email"
          autocomplete="email"
          [class.is-invalid]="invalid('email')"
          [attr.aria-invalid]="invalid('email')"
          aria-describedby="email-err"
        />
        <app-field-errors id="email-err" [control]="group().controls.email" />
      </div>
      <div class="field">
        <label class="form-label" for="phone">Mobile number</label>
        <input
          id="phone"
          type="tel"
          class="form-control"
          formControlName="phone"
          autocomplete="tel"
          placeholder="98XXXXXXXX"
          [class.is-invalid]="invalid('phone')"
          [attr.aria-invalid]="invalid('phone')"
          aria-describedby="phone-err"
        />
        <app-field-errors id="phone-err" [control]="group().controls.phone" />
      </div>
      <div class="field">
        <label class="form-label" for="province">Province</label>
        <select
          id="province"
          class="form-select"
          formControlName="province"
          [class.is-invalid]="invalid('province')"
          [attr.aria-invalid]="invalid('province')"
          aria-describedby="province-err"
        >
          <option value="">Choose…</option>
          @for (p of provinces; track p) {
            <option [value]="p">{{ p }}</option>
          }
        </select>
        <app-field-errors id="province-err" [control]="group().controls.province" />
      </div>
      <div class="field">
        <label class="form-label" for="city">City or municipality</label>
        <input
          id="city"
          class="form-control"
          formControlName="city"
          autocomplete="address-level2"
          [class.is-invalid]="invalid('city')"
          [attr.aria-invalid]="invalid('city')"
          aria-describedby="city-err"
        />
        <app-field-errors id="city-err" [control]="group().controls.city" />
      </div>
      <div class="field field--wide">
        <label class="form-label" for="street"
          >Street and ward <span class="optional">(optional)</span></label
        >
        <input
          id="street"
          class="form-control"
          formControlName="street"
          autocomplete="street-address"
          [class.is-invalid]="invalid('street')"
          [attr.aria-invalid]="invalid('street')"
          aria-describedby="street-err"
        />
        <app-field-errors id="street-err" [control]="group().controls.street" />
      </div>
    </div>
  `,
})
export class ContactStep {
  readonly group = input.required<ApplicationForm['controls']['contact']>();
  protected readonly provinces = PROVINCES;

  protected invalid(name: keyof ApplicationForm['controls']['contact']['controls']): boolean {
    return showInvalid(this.group().controls[name]);
  }
}
