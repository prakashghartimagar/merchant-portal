import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ApplicationsApi } from '../core/api/applications.api';
import { SensitiveField } from '../core/api/models';
import { describeHttpError } from '../core/http/http-error';

export const REVEAL_DURATION_MS = 30_000;

/**
 * Shows a sensitive value masked. Users allowed by role can reveal it; the
 * plain value is fetched on demand (and audited by the server), kept only in
 * this component's memory, and masked again after 30 seconds.
 */
@Component({
  selector: 'div[appMaskedField]',
  host: { class: 'kv-row' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dt>{{ label() }}</dt>
    <dd class="masked-field">
      <span
        class="masked-field__value"
        aria-live="polite"
        [attr.aria-label]="revealed() ? label() + ': ' + revealed() : label() + ' hidden'"
      >
        {{ revealed() ?? maskedValue() ?? '—' }}
      </span>
      @if (canReveal() && maskedValue()) {
        @if (revealed()) {
          <button type="button" class="btn btn-link btn-sm p-0" (click)="hide()">Hide</button>
        } @else {
          <button
            type="button"
            class="btn btn-link btn-sm p-0"
            [disabled]="loading()"
            (click)="reveal()"
          >
            {{ loading() ? 'Revealing…' : 'Reveal' }}
          </button>
        }
      }
      @if (error()) {
        <span class="text-danger small d-block" role="alert">{{ error() }}</span>
      }
    </dd>
  `,
})
export class MaskedField {
  private readonly api = inject(ApplicationsApi);

  readonly applicationId = input.required<string>();
  readonly field = input.required<SensitiveField>();
  readonly label = input.required<string>();
  readonly maskedValue = input<string | undefined>();
  readonly canReveal = input(false);

  protected readonly revealed = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  reveal(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.reveal(this.applicationId(), this.field()).subscribe({
      next: ({ value }) => {
        this.loading.set(false);
        this.revealed.set(value);
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.hide(), REVEAL_DURATION_MS);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(describeHttpError(err));
      },
    });
  }

  hide(): void {
    clearTimeout(this.timer);
    this.revealed.set(null);
  }
}
