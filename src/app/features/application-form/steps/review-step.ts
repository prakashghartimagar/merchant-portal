import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NprPipe } from '../../../shared/npr.pipe';
import {
  ApplicationFormValue,
  BUSINESS_TYPES,
  CATEGORIES,
  formatAddress,
  labelFor,
} from '../application-form';

const maskForReview = (v: string) =>
  v ? '•'.repeat(Math.max(v.length - 4, 2)) + v.slice(-4) : '—';

@Component({
  selector: 'app-review-step',
  imports: [NprPipe],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    @let v = value();
    <div class="review-grid">
      <section>
        <div class="review-head">
          <h3 class="h6">Business</h3>
          <button type="button" class="btn btn-link btn-sm" (click)="edit.emit(0)">Edit</button>
        </div>
        <dl class="kv">
          <div class="kv-row">
            <dt>Trading name</dt>
            <dd>{{ v.business.businessName || '—' }}</dd>
          </div>
          <div class="kv-row">
            <dt>Legal name</dt>
            <dd>{{ v.business.legalName || '—' }}</dd>
          </div>
          <div class="kv-row">
            <dt>Type</dt>
            <dd>{{ type(v.business.businessType) || '—' }}</dd>
          </div>
          <div class="kv-row">
            <dt>Category</dt>
            <dd>{{ category(v.business.category) || '—' }}</dd>
          </div>
          <div class="kv-row">
            <dt>Registration no.</dt>
            <dd>{{ v.business.registrationNumber || '—' }}</dd>
          </div>
          <div class="kv-row">
            <dt>PAN</dt>
            <dd>{{ mask(v.business.panNumber) }}</dd>
          </div>
          <div class="kv-row">
            <dt>Monthly volume</dt>
            <dd>{{ v.business.expectedMonthlyVolume | npr }}</dd>
          </div>
          <div class="kv-row">
            <dt>Average transaction</dt>
            <dd>{{ v.business.averageTicketSize | npr }}</dd>
          </div>
        </dl>
      </section>
      <section>
        <div class="review-head">
          <h3 class="h6">Owner and contact</h3>
          <button type="button" class="btn btn-link btn-sm" (click)="edit.emit(1)">Edit</button>
        </div>
        <dl class="kv">
          <div class="kv-row">
            <dt>Owner</dt>
            <dd>{{ v.contact.ownerName || '—' }}</dd>
          </div>
          <div class="kv-row">
            <dt>ID number</dt>
            <dd>{{ mask(v.contact.ownerIdNumber) }}</dd>
          </div>
          <div class="kv-row">
            <dt>Email</dt>
            <dd>{{ v.contact.email || '—' }}</dd>
          </div>
          <div class="kv-row">
            <dt>Mobile</dt>
            <dd>{{ v.contact.phone || '—' }}</dd>
          </div>
          <div class="kv-row">
            <dt>Address</dt>
            <dd>{{ address(v.contact) }}</dd>
          </div>
        </dl>
      </section>
      <section>
        <div class="review-head">
          <h3 class="h6">Settlement account</h3>
          <button type="button" class="btn btn-link btn-sm" (click)="edit.emit(2)">Edit</button>
        </div>
        <dl class="kv">
          <div class="kv-row">
            <dt>Bank</dt>
            <dd>{{ v.bank.bankName || '—' }}</dd>
          </div>
          <div class="kv-row">
            <dt>Account holder</dt>
            <dd>{{ v.bank.accountHolderName || '—' }}</dd>
          </div>
          <div class="kv-row">
            <dt>Account number</dt>
            <dd>{{ mask(v.bank.accountNumber) }}</dd>
          </div>
        </dl>
      </section>
    </div>
  `,
})
export class ReviewStep {
  readonly value = input.required<ApplicationFormValue>();
  readonly edit = output<number>();

  protected mask = maskForReview;
  protected address = formatAddress;
  protected type = (v: string) => labelFor(BUSINESS_TYPES, v);
  protected category = (v: string) => labelFor(CATEGORIES, v);
}
