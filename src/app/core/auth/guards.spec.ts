import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { ADMIN, SALES, authStub } from '../../../testing/test-helpers';
import { UserRef } from '../api/models';
import { authGuard, roleGuard, unsavedChangesGuard } from './guards';

function run(user: UserRef | null, guard: typeof authGuard, url = '/applications/new') {
  TestBed.configureTestingModule({ providers: [provideRouter([]), authStub(user)] });
  return TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
}

describe('route guards', () => {
  it('authGuard lets signed-in users through', () => {
    expect(run(SALES, authGuard)).toBe(true);
  });

  it('authGuard sends guests to login and remembers where they were going', () => {
    const result = run(null, authGuard, '/applications/app_1') as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe(
      '/login?returnUrl=%2Fapplications%2Fapp_1',
    );
  });

  it('roleGuard allows listed roles and sends others to /forbidden', () => {
    expect(run(SALES, roleGuard('SALES'))).toBe(true);
    TestBed.resetTestingModule();
    const denied = run(ADMIN, roleGuard('SALES')) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(denied)).toBe('/forbidden');
  });

  it('unsavedChangesGuard asks before leaving with unsaved edits', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const route = {} as ActivatedRouteSnapshot;
    const state = {} as RouterStateSnapshot;
    expect(unsavedChangesGuard({ hasUnsavedChanges: () => false }, route, state, state)).toBe(true);
    expect(unsavedChangesGuard({ hasUnsavedChanges: () => true }, route, state, state)).toBe(false);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
  });
});
