import { DatePipe, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, forkJoin, map, merge, of, startWith, switchMap } from 'rxjs';
import { ApplicationsApi } from '../../core/api/applications.api';
import { ApplicationDetail, HistoryEntry } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import {
  canEditApplication,
  canManageAssignments,
  canRecordDecision,
  canRevealSensitive,
} from '../../core/auth/permissions';
import { describeHttpError } from '../../core/http/http-error';
import { MaskedField } from '../../shared/masked-field';
import { NprPipe } from '../../shared/npr.pipe';
import { StatusBadge } from '../../shared/status-badge';
import {
  BUSINESS_TYPES,
  CATEGORIES,
  formatAddress,
  labelFor,
} from '../application-form/application-form';
import { AssignmentPanel } from './assignment-panel';
import { DecisionForm } from './decision-form';
import { RiskHistory } from './risk-history';

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; app: ApplicationDetail; history: HistoryEntry[] };

@Component({
  selector: 'app-application-detail-page',
  imports: [
    RouterLink,
    DatePipe,
    NprPipe,
    StatusBadge,
    MaskedField,
    RiskHistory,
    DecisionForm,
    AssignmentPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './application-detail.page.html',
  styleUrl: './application-detail.page.scss',
})
export class ApplicationDetailPage {
  private readonly api = inject(ApplicationsApi);
  private readonly auth = inject(AuthService);

  readonly id = input.required<string>();

  private readonly reload$ = new Subject<void>();
  protected readonly state = signal<DetailState>({ status: 'loading' });
  protected readonly flash = signal<string | null>(
    (inject(Location).getState() as { flash?: string } | null)?.flash ?? null,
  );

  protected readonly app = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.app : null;
  });
  private readonly user = this.auth.user;
  protected readonly canEdit = computed(
    () => !!this.app() && canEditApplication(this.user(), this.app()!),
  );
  protected readonly canDecide = computed(
    () => !!this.app() && canRecordDecision(this.user(), this.app()!),
  );
  protected readonly canAssign = computed(
    () => !!this.app() && canManageAssignments(this.user(), this.app()!),
  );
  protected readonly canReveal = computed(
    () => !!this.app() && canRevealSensitive(this.user(), this.app()!),
  );

  protected readonly typeLabel = (v?: string) => labelFor(BUSINESS_TYPES, v);
  protected readonly address = formatAddress;
  protected readonly categoryLabel = (v?: string) => labelFor(CATEGORIES, v);

  constructor() {
    // The application and its history load in parallel. If the access token
    // has expired, both get a 401 together and the interceptor refreshes once.
    merge(toObservable(this.id), this.reload$.pipe(map(() => this.id())))
      .pipe(
        switchMap((id) =>
          forkJoin({ app: this.api.get(id), history: this.api.history(id) }).pipe(
            map(({ app, history }): DetailState => ({ status: 'ready', app, history })),
            startWith<DetailState>({ status: 'loading' }),
            catchError((err) =>
              of<DetailState>({ status: 'error', message: describeHttpError(err) }),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((s) => {
        // Keep showing the current record during a background reload.
        if (s.status === 'loading' && this.state().status === 'ready') return;
        this.state.set(s);
      });
  }

  protected retry(): void {
    this.state.set({ status: 'loading' });
    this.reload$.next();
  }

  protected onUpdated(message: string): void {
    this.flash.set(message);
    this.reload$.next();
  }
}
