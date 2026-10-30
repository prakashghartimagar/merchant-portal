import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, of, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** Set on the retried copy of a request so a second 401 is not refreshed again. */
const RETRIED_AFTER_REFRESH = new HttpContextToken<boolean>(() => false);

/** Endpoints that must not carry a bearer token or trigger a refresh. */
const PUBLIC_ENDPOINTS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/demo-users',
];

function withBearer(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

/**
 * Attaches the bearer token to our own API calls and recovers from expiry.
 *
 * When several requests fail with 401 together, AuthService shares a single
 * refresh between them, so POST /api/auth/refresh is sent exactly once and
 * every request is replayed with the new token. A request that was sent with
 * an old token but fails after the refresh already finished just retries with
 * the current token instead of starting another refresh.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Only same-origin API calls get the token; it never leaks to other hosts.
  if (!req.url.startsWith('/api/') || PUBLIC_ENDPOINTS.some((p) => req.url.startsWith(p))) {
    return next(req);
  }

  const auth = inject(AuthService);
  const sentToken = auth.accessToken();

  return next(withBearer(req, sentToken)).pipe(
    catchError((err: unknown) => {
      const isExpired = err instanceof HttpErrorResponse && err.status === 401;
      if (!isExpired || req.context.get(RETRIED_AFTER_REFRESH)) {
        return throwError(() => err);
      }

      const current = auth.accessToken();
      const freshToken$ =
        current && current !== sentToken ? of(current) : auth.refreshAccessToken();

      return freshToken$.pipe(
        catchError(() => {
          auth.expireSession();
          return throwError(() => err);
        }),
        switchMap((token) => {
          const retry = req.clone({ context: req.context.set(RETRIED_AFTER_REFRESH, true) });
          return next(withBearer(retry, token));
        }),
      );
    }),
  );
};
