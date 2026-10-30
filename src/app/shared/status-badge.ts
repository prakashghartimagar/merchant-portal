import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ApplicationStatus, STATUS_LABELS } from '../core/api/models';

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="status-badge" [attr.data-status]="status()">{{ label() }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<ApplicationStatus>();
  protected readonly label = computed(() => STATUS_LABELS[this.status()]);
}
