import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { Role, UserRef } from '../api/models';

export interface Session {
  accessToken: string;
  expiresIn: number;
  user: UserRef;
}

/**
 * Owns the session. The access token is held in memory only (a signal), never
 * in localStorage, so an injected script cannot lift it from storage. The
 * refresh token is an HttpOnly cookie the browser sends to /api/auth/* and
 * that JavaScript cannot read at all.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _accessToken = signal<string | null>(null);
  private readonly _user = signal<UserRef | null>(null);

  readonly accessToken = this._accessToken.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly role = computed<Role | null>(() => this._user()?.role ?? null);

  /** The one refresh request currently in flight, shared by every caller. */
  private refreshInFlight: Observable<string> | null = null;

  demoUsers(): Observable<UserRef[]> {
    return this.http.get<UserRef[]>('/api/auth/demo-users');
  }

  login(userId: string): Observable<UserRef> {
    return this.http.post<Session>('/api/auth/login', { userId }).pipe(
      tap((s) => this.setSession(s)),
      map((s) => s.user),
    );
  }

  /**
   * Single-flight refresh: however many callers ask at the same moment, only
   * one POST /api/auth/refresh is sent and they all receive its result.
   */
  refreshAccessToken(): Observable<string> {
    this.refreshInFlight ??= this.http.post<Session>('/api/auth/refresh', {}).pipe(
      tap((s) => this.setSession(s)),
      map((s) => s.accessToken),
      catchError((err) => {
        this.clearSession();
        return throwError(() => err);
      }),
      finalize(() => (this.refreshInFlight = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight;
  }

  /** Called once at startup: the refresh cookie survives a page reload. */
  restoreSession(): Observable<boolean> {
    return this.refreshAccessToken().pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  logout(): void {
    this.http.post('/api/auth/logout', {}).subscribe({ error: () => undefined });
    this.clearSession();
    void this.router.navigate(['/login']);
  }

  /** The refresh token is gone or rejected; send the user to sign in again. */
  expireSession(): void {
    const returnUrl = this.router.url;
    this.clearSession();
    if (!returnUrl.startsWith('/login')) {
      void this.router.navigate(['/login'], { queryParams: { reason: 'expired', returnUrl } });
    }
  }

  private setSession(s: Session): void {
    this._accessToken.set(s.accessToken);
    this._user.set(s.user);
  }

  private clearSession(): void {
    this._accessToken.set(null);
    this._user.set(null);
  }
}
