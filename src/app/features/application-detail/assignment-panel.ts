import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { ApplicationsApi } from '../../core/api/applications.api';
import { ApplicationDetail, UserRef } from '../../core/api/models';
import { describeHttpError } from '../../core/http/http-error';

@Component({
  selector: 'app-assignment-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="assign-row">
      <div class="flex-grow-1">
        <label class="form-label fw-semibold" for="reviewer">Reviewer</label>
        <select
          id="reviewer"
          class="form-select"
          [value]="selected()"
          (change)="selected.set($any($event.target).value)"
        >
          <option value="">Choose a reviewer…</option>
          @for (r of reviewers(); track r.id) {
            <option [value]="r.id" [selected]="selected() === r.id">{{ r.name }}</option>
          }
        </select>
      </div>
      <button
        type="button"
        class="btn btn-primary"
        [disabled]="!selected() || selected() === currentReviewerId() || saving()"
        (click)="assign()"
      >
        {{ saving() ? 'Saving…' : currentReviewerId() ? 'Reassign' : 'Assign reviewer' }}
      </button>
    </div>
    @if (error()) {
      <p class="text-danger mt-2 mb-0" role="alert">{{ error() }}</p>
    }
  `,
})
export class AssignmentPanel {
  private readonly api = inject(ApplicationsApi);

  readonly applicationId = input.required<string>();
  readonly currentReviewerId = input<string | null>(null);
  readonly assigned = output<ApplicationDetail>();

  protected readonly error = signal<string | null>(null);
  protected readonly reviewers = toSignal(
    this.api.reviewers().pipe(
      catchError((err) => {
        this.error.set(`Couldn’t load reviewers. ${describeHttpError(err)}`);
        return of([] as UserRef[]);
      }),
    ),
    { initialValue: [] as UserRef[] },
  );
  protected readonly selected = signal('');
  protected readonly saving = signal(false);

  assign(): void {
    this.saving.set(true);
    this.error.set(null);
    this.api.assign(this.applicationId(), this.selected()).subscribe({
      next: (app) => {
        this.saving.set(false);
        this.assigned.emit(app);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(describeHttpError(err));
      },
    });
  }
}
