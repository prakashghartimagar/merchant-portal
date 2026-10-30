import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel narrow-page">
      <h1 class="h3">You don’t have access to this page</h1>
      <p>
        Your role doesn’t include this action. If you think it should, ask an admin to check your
        access.
      </p>
      <a class="btn btn-primary" routerLink="/applications">Go to applications</a>
    </section>
  `,
})
export class ForbiddenPage {}
