import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, map, of, startWith } from 'rxjs';
import { UserRef } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { describeHttpError } from '../../core/http/http-error';

type UsersState =
  | { status: 'loading' }
  | { status: 'ready'; users: UserRef[] }
  | { status: 'error'; message: string };

/** Only allow returning to an in-app path, never an external URL. */
export function safeReturnUrl(url: string | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/applications';
}

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly returnUrl = input<string>();
  readonly reason = input<string>();

  protected readonly users = toSignal(
    this.auth.demoUsers().pipe(
      map((users): UsersState => ({ status: 'ready', users })),
      startWith<UsersState>({ status: 'loading' }),
      catchError((err) => of<UsersState>({ status: 'error', message: describeHttpError(err) })),
    ),
    { initialValue: { status: 'loading' } as UsersState },
  );
  protected readonly selected = signal<string>('');
  protected readonly signingIn = signal(false);
  protected readonly error = signal<string | null>(null);

  signIn(): void {
    if (!this.selected()) {
      this.error.set('Choose a demo user to continue.');
      return;
    }
    this.signingIn.set(true);
    this.error.set(null);
    this.auth.login(this.selected()).subscribe({
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
      error: (err) => {
        this.signingIn.set(false);
        this.error.set(describeHttpError(err));
      },
    });
  }
}
