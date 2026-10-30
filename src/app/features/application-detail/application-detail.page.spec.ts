import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApplicationsApi } from '../../core/api/applications.api';
import { ApplicationDetail, UserRef } from '../../core/api/models';
import {
  ADMIN,
  OTHER_REVIEWER,
  REVIEWER,
  SALES,
  authStub,
  makeDetail,
} from '../../../testing/test-helpers';
import { ApplicationDetailPage } from './application-detail.page';

async function render(user: UserRef, app: ApplicationDetail = makeDetail()) {
  const api = {
    get: vi.fn(() => of(app)),
    history: vi.fn(() => of([])),
    reviewers: vi.fn(() => of([REVIEWER, OTHER_REVIEWER])),
  };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), authStub(user), { provide: ApplicationsApi, useValue: api }],
  });
  const fixture = TestBed.createComponent(ApplicationDetailPage);
  fixture.componentRef.setInput('id', app.id);
  await fixture.whenStable();
  return { el: fixture.nativeElement as HTMLElement, api };
}

const revealButtons = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Reveal');

describe('ApplicationDetailPage', () => {
  it('loads the application and its history in parallel', async () => {
    const { el, api } = await render(REVIEWER);
    expect(api.get).toHaveBeenCalledWith('app_1');
    expect(api.history).toHaveBeenCalledWith('app_1');
    expect(el.querySelector('h1')?.textContent).toContain('Phewa Books');
  });

  it('shows sensitive values masked by default', async () => {
    const { el } = await render(REVIEWER);
    expect(el.textContent).toContain('••••••••••1234');
    expect(el.textContent).not.toMatch(/\b\d{14}\b/);
  });

  it('gives the assigned reviewer the decision controls', async () => {
    const { el } = await render(REVIEWER);
    expect(el.textContent).toContain('Record your decision');
    expect(revealButtons(el)).toHaveLength(3);
  });

  it('hides the decision controls from sales users', async () => {
    const { el } = await render(SALES);
    expect(el.textContent).not.toContain('Record your decision');
    expect(el.querySelector('app-decision-form')).toBeNull();
  });

  it('hides decision and reveal controls from a reviewer who is not assigned', async () => {
    const { el } = await render(OTHER_REVIEWER);
    expect(el.querySelector('app-decision-form')).toBeNull();
    expect(revealButtons(el)).toHaveLength(0);
  });

  it('gives admins the assignment panel but not the decision form', async () => {
    const { el } = await render(ADMIN);
    expect(el.querySelector('app-assignment-panel')).not.toBeNull();
    expect(el.querySelector('app-decision-form')).toBeNull();
  });

  it('offers "Continue editing" only to the creator of a draft', async () => {
    const draft = makeDetail({ status: 'DRAFT', assignedReviewer: null });
    expect((await render(SALES, draft)).el.textContent).toContain('Continue editing');
    TestBed.resetTestingModule();
    expect((await render(ADMIN, draft)).el.textContent).not.toContain('Continue editing');
  });
});
