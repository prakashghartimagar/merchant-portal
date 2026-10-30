import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, skip } from 'rxjs';
import {
  APPLICATION_STATUSES,
  ApplicationQuery,
  ApplicationSummary,
  STATUS_LABELS,
  SortKey,
} from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import {
  canCreateApplication,
  canEditApplication,
  canManageAssignments,
} from '../../core/auth/permissions';
import { NprPipe } from '../../shared/npr.pipe';
import { StatusBadge } from '../../shared/status-badge';
import {
  ApplicationListStore,
  PAGE_SIZES,
  paramsFromQuery,
  queryFromParams,
} from './application-list.store';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, DatePipe, NprPipe, StatusBadge],
  providers: [ApplicationListStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  protected readonly store = inject(ApplicationListStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  protected readonly statuses = APPLICATION_STATUSES;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly query = this.store.query;

  protected readonly user = this.auth.user;
  protected readonly canCreate = computed(() => canCreateApplication(this.user()));
  protected readonly isAdmin = computed(() => canManageAssignments(this.user()));
  protected readonly showOwnerColumn = computed(() => this.user()?.role !== 'SALES');
  protected readonly showReviewerColumn = computed(() => this.user()?.role !== 'REVIEWER');
  protected readonly heading = computed(() => {
    switch (this.user()?.role) {
      case 'SALES':
        return 'Your applications';
      case 'REVIEWER':
        return 'Assigned to you';
      default:
        return 'All applications';
    }
  });
  protected readonly hasFilters = computed(() => {
    const q = this.query();
    return q.status !== null || q.search !== '' || q.unassigned;
  });

  /** What's typed in the search box; pushed to the URL after a pause. */
  protected readonly searchText = signal('');

  constructor() {
    // The URL is the source of truth: back/forward and shared links restore the table.
    const params = toSignal(
      this.route.queryParamMap.pipe(
        map((p) => Object.fromEntries(p.keys.map((k) => [k, p.get(k) ?? undefined]))),
      ),
      {
        initialValue: {},
      },
    );
    effect(() => {
      const query = queryFromParams(params());
      untracked(() => {
        this.store.setQuery(query);
        if (query.search !== this.searchText()) this.searchText.set(query.search);
      });
    });

    toObservable(this.searchText)
      .pipe(skip(1), debounceTime(350), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((search) => {
        if (search !== this.query().search) this.update({ search, page: 1 });
      });
  }

  protected update(change: Partial<ApplicationQuery>): void {
    const next = { ...this.query(), ...change };
    void this.router.navigate([], { relativeTo: this.route, queryParams: paramsFromQuery(next) });
  }

  protected sortBy(sort: SortKey): void {
    const q = this.query();
    const dir = q.sort === sort && q.dir === 'asc' ? 'desc' : 'asc';
    this.update({ sort, dir, page: 1 });
  }

  protected ariaSort(sort: SortKey): 'ascending' | 'descending' | 'none' {
    const q = this.query();
    if (q.sort !== sort) return 'none';
    return q.dir === 'asc' ? 'ascending' : 'descending';
  }

  protected clearFilters(): void {
    this.searchText.set('');
    this.update({ status: null, search: '', unassigned: false, page: 1 });
  }

  protected canEdit(app: ApplicationSummary): boolean {
    return canEditApplication(this.user(), app);
  }

  protected onStatusChange(value: string): void {
    this.update({ status: (value || null) as ApplicationQuery['status'], page: 1 });
  }

  protected onPageSizeChange(value: string): void {
    this.update({ pageSize: Number(value), page: 1 });
  }
}
