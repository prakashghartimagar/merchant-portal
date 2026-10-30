import { DatePipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HistoryEntry } from '../../core/api/models';

const EVENT_LABELS: Record<HistoryEntry['type'], string> = {
  SUBMITTED: 'Submitted',
  ASSIGNED: 'Reviewer assigned',
  DECISION: 'Decision recorded',
};

@Component({
  selector: 'app-risk-history',
  imports: [DatePipe, TitleCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (entries().length === 0) {
      <p class="text-secondary mb-0">
        No activity yet. Events appear here once the application is submitted.
      </p>
    } @else {
      <ol class="timeline">
        @for (e of entries(); track e.id) {
          <li class="timeline__item" [attr.data-type]="e.type" [attr.data-decision]="e.decision">
            <div class="timeline__head">
              <strong>
                @if (e.type === 'DECISION') {
                  {{ e.decision === 'APPROVE' ? 'Approved' : 'Rejected' }}
                } @else {
                  {{ labels[e.type] }}
                }
              </strong>
              @if (e.riskLevel) {
                <span class="risk-pill" [attr.data-risk]="e.riskLevel"
                  >{{ e.riskLevel | titlecase }} risk</span
                >
              }
            </div>
            <p class="timeline__note">{{ e.note }}</p>
            <p class="timeline__meta">
              {{ e.actor.name }},
              <time [attr.datetime]="e.at">{{ e.at | date: 'd MMM y, HH:mm' }}</time>
            </p>
          </li>
        }
      </ol>
    }
  `,
})
export class RiskHistory {
  readonly entries = input.required<HistoryEntry[]>();
  protected readonly labels = EVENT_LABELS;
}
