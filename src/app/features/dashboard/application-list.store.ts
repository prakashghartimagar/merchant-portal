import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Subject, catchError, combineLatest, map, of, startWith, switchMap, tap } from 'rxjs';
import { ApplicationsApi } from '../../core/api/applications.api';
import {
  APPLICATION_STATUSES,
  ApplicationQuery,
  ApplicationStatus,
  ApplicationSummary,
  Page,
  SortKey,
} from '../../core/api/models';
import { describeHttpError } from '../../core/http/http-error';

export const PAGE_SIZES = [10, 25, 50];

export const DEFAULT_QUERY: ApplicationQuery = {
  page: 1,
  pageSize: 10,
  status: null,
  search: '',
  sort: 'updatedAt',
  dir: 'desc',
  unassigned: false,
};

/** Reads a query from URL params, falling back to defaults for anything invalid. */
export function queryFromParams(params: Record<string, string | undefined>): ApplicationQuery {
  const page = Number(params['page']);
  const pageSize = Number(params['pageSize']);
  const status = params['status'] as ApplicationStatus;
  const sort = params['sort'] as SortKey;
  return {
    page: Number.isInteger(page) && page > 0 ? page : DEFAULT_QUERY.page,
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_QUERY.pageSize,
    status: APPLICATION_STATUSES.includes(status) ? status : null,
    search: params['search'] ?? '',
    sort: ['updatedAt', 'businessName', 'volume'].includes(sort) ? sort : DEFAULT_QUERY.sort,
    dir: params['dir'] === 'asc' ? 'asc' : 'desc',
    unassigned: params['unassigned'] === 'true',
  };
}

export const sameQuery = (a: ApplicationQuery, b: ApplicationQuery) =>
  (Object.keys(a) as (keyof ApplicationQuery)[]).every((k) => a[k] === b[k]);

/** Only non-default values go in the URL, so links stay short. */
export function paramsFromQuery(q: ApplicationQuery): Record<string, string | null> {
  const d = DEFAULT_QUERY;
  return {
    page: q.page !== d.page ? String(q.page) : null,
    pageSize: q.pageSize !== d.pageSize ? String(q.pageSize) : null,
    status: q.status,
    search: q.search.trim() || null,
    sort: q.sort !== d.sort ? q.sort : null,
    dir: q.dir !== d.dir ? q.dir : null,
    unassigned: q.unassigned ? 'true' : null,
  };
}

interface ListState {
  page: Page<ApplicationSummary> | null;
  loading: boolean;
  error: string | null;
}

/**
 * State for the applications table. The query is a signal; every change (or
 * a retry) triggers a fetch, and switchMap drops responses for queries the
 * user has already moved past. The last good page stays on screen while the
 * next one loads.
 */
@Injectable()
export class ApplicationListStore {
  private readonly api = inject(ApplicationsApi);
  private readonly retry$ = new Subject<void>();

  /** Equal queries never refetch, even when they arrive as new objects. */
  readonly query = signal<ApplicationQuery>(DEFAULT_QUERY, { equal: sameQuery });
  private readonly state = signal<ListState>({ page: null, loading: true, error: null });

  readonly items = computed(() => this.state().page?.items ?? []);
  readonly total = computed(() => this.state().page?.total ?? 0);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly hasLoaded = computed(() => this.state().page !== null);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.query().pageSize)));
  readonly range = computed(() => {
    const { page, pageSize } = this.query();
    const total = this.total();
    if (total === 0) return { from: 0, to: 0 };
    return { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, total) };
  });

  constructor() {
    combineLatest([toObservable(this.query), this.retry$.pipe(startWith(undefined))])
      .pipe(
        tap(() => this.state.update((s) => ({ ...s, loading: true, error: null }))),
        switchMap(([q]) =>
          this.api.list(q).pipe(
            map((page) => ({ page, error: null })),
            catchError((err) => of({ page: null, error: describeHttpError(err) })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ page, error }) =>
        this.state.update((s) => ({ page: page ?? s.page, loading: false, error })),
      );
  }

  setQuery(query: ApplicationQuery): void {
    this.query.set(query);
  }

  retry(): void {
    this.retry$.next();
  }
}
