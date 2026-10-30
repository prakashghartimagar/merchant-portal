import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { ApplicationsApi } from '../../core/api/applications.api';
import { ApplicationSummary, Page } from '../../core/api/models';
import { ADMIN, REVIEWER, SALES, authStub } from '../../../testing/test-helpers';
import { UserRef } from '../../core/api/models';
import { DashboardPage } from './dashboard.page';
import { queryFromParams } from './application-list.store';

const row = (i: number, overrides: Partial<ApplicationSummary> = {}): ApplicationSummary => ({
  id: `app_${i}`,
  reference: `MA-${10000 + i}`,
  businessName: `Business ${i}`,
  category: 'RETAIL',
  status: 'DRAFT',
  createdBy: SALES,
  assignedReviewer: null,
  expectedMonthlyVolume: 100000,
  updatedAt: '2026-10-01T10:00:00Z',
  ...overrides,
});
const page = (items: ApplicationSummary[], total = items.length): Page<ApplicationSummary> => ({
  items,
  total,
  page: 1,
  pageSize: 10,
});

async function setup(
  user: UserRef,
  url = '/applications',
  list = vi.fn(() => of(page([row(1), row(2)], 23))),
) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'applications', component: DashboardPage }]),
      authStub(user),
      { provide: ApplicationsApi, useValue: { list } },
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  await harness.fixture.whenStable();
  return { harness, el: harness.routeNativeElement as HTMLElement, list };
}

describe('DashboardPage', () => {
  it('loads the page described by the URL and renders rows', async () => {
    const { el, list } = await setup(SALES, '/applications?status=DRAFT&page=2&search=phewa');
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'DRAFT', page: 2, search: 'phewa' }),
    );
    expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(el.textContent).toContain('Business 1');
  });

  it('fetches once on load, not once per signal update', async () => {
    const { list } = await setup(SALES);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('shows the error with a working retry', async () => {
    const list = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValue(of(page([row(1)])));
    const { harness, el } = await setup(SALES, '/applications', list);
    const alert = el.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Couldn’t load applications');

    (alert!.querySelector('button') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    expect(list).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.textContent).toContain('Business 1');
  });

  it('pages through results by updating the URL', async () => {
    const { harness, el, list } = await setup(SALES);
    const next = Array.from(el.querySelectorAll<HTMLButtonElement>('.pager button')).find((b) =>
      b.textContent?.includes('Next'),
    )!;
    next.click();
    await harness.fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(el.textContent).toContain('Page 2 of 3');
  });

  it('offers "Start new application" and "Continue" only to sales', async () => {
    const sales = await setup(SALES);
    expect(sales.el.textContent).toContain('Start new application');
    expect(sales.el.querySelector('.actions a')?.textContent).toContain('Continue');
  });

  it('hides creation controls from reviewers and shows the owner column', async () => {
    const { el } = await setup(REVIEWER);
    expect(el.textContent).not.toContain('Start new application');
    expect(el.querySelector('.actions a')).toBeNull();
    expect(el.textContent).toContain('Sales owner');
  });

  it('gives admins the "needs a reviewer" filter', async () => {
    const { el } = await setup(ADMIN);
    expect(el.querySelector('#unassigned')).not.toBeNull();
  });
});

describe('queryFromParams', () => {
  it('falls back to safe defaults for bad input', () => {
    expect(
      queryFromParams({
        page: '-3',
        pageSize: '999',
        status: 'HACKED',
        sort: 'password',
        dir: 'sideways',
      }),
    ).toEqual({
      page: 1,
      pageSize: 10,
      status: null,
      search: '',
      sort: 'updatedAt',
      dir: 'desc',
      unassigned: false,
    });
  });
});
