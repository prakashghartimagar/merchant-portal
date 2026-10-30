import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService, Session } from './auth.service';

const session = (token: string): Session => ({
  accessToken: token,
  expiresIn: 60,
  user: { id: 'u1', name: 'User', role: 'SALES' },
});
const unauthorized = (req: TestRequest) =>
  req.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });
const bearer = (req: TestRequest) => req.request.headers.get('Authorization');

describe('authInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);

    auth.login('u1').subscribe();
    ctrl.expectOne('/api/auth/login').flush(session('token-1'));
  });

  afterEach(() => ctrl.verify());

  it('attaches the bearer token to API requests', () => {
    http.get('/api/applications').subscribe();
    expect(bearer(ctrl.expectOne('/api/applications'))).toBe('Bearer token-1');
  });

  it('never sends the token to other hosts or to the public auth endpoints', () => {
    http.get('https://example.com/api/applications').subscribe();
    http.post('/api/auth/refresh', {}).subscribe({ error: () => undefined });
    expect(bearer(ctrl.expectOne('https://example.com/api/applications'))).toBeNull();
    const refresh = ctrl.expectOne('/api/auth/refresh');
    expect(bearer(refresh)).toBeNull();
    refresh.flush(session('token-x'));
  });

  it('refreshes exactly once when several requests get 401 together, then replays them all', () => {
    const results: string[] = [];
    ['/api/applications/a', '/api/applications/b', '/api/applications/c'].forEach((url) =>
      http.get<{ url: string }>(url).subscribe((r) => results.push(r.url)),
    );

    const first = ctrl.match((r) => r.url.startsWith('/api/applications/'));
    expect(first).toHaveLength(3);
    first.forEach((r) => expect(bearer(r)).toBe('Bearer token-1'));
    first.forEach(unauthorized);

    const refreshes = ctrl.match('/api/auth/refresh');
    expect(refreshes).toHaveLength(1);
    refreshes[0].flush(session('token-2'));

    const retried = ctrl.match((r) => r.url.startsWith('/api/applications/'));
    expect(retried).toHaveLength(3);
    retried.forEach((r) => {
      expect(bearer(r)).toBe('Bearer token-2');
      r.flush({ url: r.request.url });
    });

    expect(results.sort()).toEqual([
      '/api/applications/a',
      '/api/applications/b',
      '/api/applications/c',
    ]);
    expect(auth.accessToken()).toBe('token-2');
  });

  it('retries a late 401 with the already-refreshed token instead of refreshing again', () => {
    http.get('/api/applications/a').subscribe();
    http.get('/api/applications/b').subscribe();
    const [a, b] = ctrl.match((r) => r.url.startsWith('/api/applications/'));

    unauthorized(a);
    ctrl.expectOne('/api/auth/refresh').flush(session('token-2'));
    ctrl.expectOne('/api/applications/a').flush({});

    // b was sent with token-1 and only now comes back as 401.
    unauthorized(b);
    ctrl.expectNone('/api/auth/refresh');
    const retryB = ctrl.expectOne('/api/applications/b');
    expect(bearer(retryB)).toBe('Bearer token-2');
    retryB.flush({});
  });

  it('does not loop: a second 401 after the retry is passed to the caller', () => {
    let error: HttpErrorResponse | undefined;
    http.get('/api/applications').subscribe({ error: (e) => (error = e) });

    unauthorized(ctrl.expectOne('/api/applications'));
    ctrl.expectOne('/api/auth/refresh').flush(session('token-2'));
    unauthorized(ctrl.expectOne('/api/applications'));

    ctrl.expectNone('/api/auth/refresh');
    expect(error?.status).toBe(401);
  });

  it('ends the session and sends the user to sign in when the refresh fails', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const errors: number[] = [];
    http.get('/api/applications/a').subscribe({ error: (e) => errors.push(e.status) });
    http.get('/api/applications/b').subscribe({ error: (e) => errors.push(e.status) });

    ctrl.match((r) => r.url.startsWith('/api/applications/')).forEach(unauthorized);
    ctrl
      .expectOne('/api/auth/refresh')
      .flush({ message: 'gone' }, { status: 401, statusText: 'Unauthorized' });

    expect(errors).toEqual([401, 401]);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.accessToken()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(
      ['/login'],
      expect.objectContaining({ queryParams: expect.objectContaining({ reason: 'expired' }) }),
    );
  });

  it('passes other errors straight through without refreshing', () => {
    let status = 0;
    http.get('/api/applications').subscribe({ error: (e) => (status = e.status) });
    ctrl.expectOne('/api/applications').flush({}, { status: 403, statusText: 'Forbidden' });
    ctrl.expectNone('/api/auth/refresh');
    expect(status).toBe(403);
  });
});
