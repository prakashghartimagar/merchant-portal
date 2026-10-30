import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { canCreateApplication } from '../core/auth/permissions';

const ROLE_LABELS = { SALES: 'Sales', REVIEWER: 'Reviewer', ADMIN: 'Admin' } as const;

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);

  protected readonly user = this.auth.user;
  protected readonly roleLabel = computed(() => {
    const role = this.auth.role();
    return role ? ROLE_LABELS[role] : '';
  });
  protected readonly canCreate = computed(() => canCreateApplication(this.user()));
  protected readonly devMode = isDevMode();
  protected readonly devMessage = signal('');

  signOut(): void {
    this.auth.logout();
  }

  /** Developer aids for demonstrating token refresh and save failures. */
  expireTokens(): void {
    this.http
      .post('/api/dev/expire-access-tokens', {})
      .subscribe(() =>
        this.devMessage.set(
          'Access tokens expired. The next requests will refresh once and retry.',
        ),
      );
  }

  failNextSaves(): void {
    this.http
      .post('/api/dev/fail-next-saves', { count: 3 })
      .subscribe(() => this.devMessage.set('The next 3 draft saves will fail with 503.'));
  }
}
