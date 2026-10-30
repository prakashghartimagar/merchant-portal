# Merchant onboarding portal

A merchant-application portal built for the senior frontend take-home. Sales users create
applications through a multi-step form that saves itself; reviewers record risk decisions; admins
assign the work. Everything runs against a local mock API.

**Stack:** Angular 21 (standalone, zoneless, signals, built-in control flow), RxJS, Reactive Forms,
Bootstrap 5 + SCSS, Vitest with Angular TestBed. The mock API is a small Express server.

## Run it

Requires Node 20.19+ or 22.12+.

```bash
npm install
npm start            # mock API on :3000 + Angular on :4200 (proxied)
```

Open http://localhost:4200 and pick a demo user. There are no passwords.

| User | Role | Sees |
| --- | --- | --- |
| Asha Gurung, Bikram Thapa | Sales | Their own applications; can create and edit drafts |
| Mira Shrestha, Nabin Rai | Reviewer | Applications assigned to them; can record decisions |
| Sujata Karki | Admin | Everything; assigns reviewers |

Other scripts:

```bash
npm test             # all unit tests, once
npm run test:watch
npm run build
npm run preview:csp  # production build served with a strict CSP (http://localhost:3000)
```

### Trying the failure paths

In development, a **Developer tools** panel sits at the bottom right:

- **Expire access token**: invalidates current tokens. Then open an application; its detail and
  history load in parallel, both get 401, and you'll see one `POST /api/auth/refresh` in the
  network tab, followed by both requests retried.
- **Fail next 3 saves**: the draft endpoint returns 503. Auto-save retries with backoff, then shows
  "Not saved" with a Retry button; what you typed stays in the form.

The access token lives for 60 seconds by default (`ACCESS_TTL_SECONDS`), so refresh also happens
naturally while you click around.

## How the requirements are met

### HTTP interceptor and token refresh
`src/app/core/auth/auth.interceptor.ts`, `auth.service.ts`

- Adds `Authorization: Bearer …` to same-origin `/api/` calls only.
- On 401, asks `AuthService.refreshAccessToken()`, which holds **one shared in-flight refresh**
  (`shareReplay` + `finalize`). However many requests fail together, one `POST /auth/refresh` is
  sent and every request is replayed with the new token.
- A request that was sent with an old token but only fails after the refresh has finished is
  retried with the current token. It doesn't start a second refresh.
- A request is retried at most once (an `HttpContextToken` flag), so a second 401 can't loop.
- If the refresh fails, the session is cleared and the user goes to the login page, which offers
  to return them where they were.

### Dashboard
`features/dashboard/`

- Server-side pagination, search, status filter and sorting. An admin-only "needs a reviewer"
  filter.
- The **URL is the source of truth** (`?status=IN_REVIEW&page=2`), so back/forward and shared links
  restore the view. Bad parameters fall back to defaults.
- `ApplicationListStore` holds the query as a signal; `switchMap` drops responses for queries the
  user has moved past. The previous page stays visible, dimmed, while the next loads. There are
  skeleton rows on first load, an error with Retry, and empty states that say what to do next.
- Columns and actions depend on role. On small screens, rows become labelled cards.

### Multi-step application
`features/application-form/`

- Four steps (business, owner and contact, settlement account, review), each a typed `FormGroup`
  in one form.
- Custom validators: Nepal PAN, mobile number, account number, ID and registration formats.
  Cross-field rules: average ticket ≤ monthly volume, confirm account number, and the account holder
  must match the legal name or owner, which spans two steps and so is validated at the form level.
- "Continue" marks the step touched and moves focus to the first invalid field. Steps ahead can only
  be opened once the earlier ones are valid. Submit jumps to the first step that needs attention.
- Errors are linked with `aria-describedby`, inputs get `aria-invalid`, and focus moves to the step
  heading on step change.

### Auto-save
`features/application-form/autosave.ts` (pure RxJS, unit-tested on its own)

- `debounceTime` turns typing into one save.
- `concatMap`, not `switchMap`: an in-flight save is never cancelled, so a create can't be aborted
  halfway and saves land in order.
- Network and 5xx errors are retried twice with exponential backoff; 4xx are not. Errors are caught
  per save, so the stream survives and the form is never touched.
- Identical values aren't re-sent. Status is only "Saved" if nothing changed during the save.
- The first save creates the draft and swaps the URL to `/applications/:id/edit` with
  `Location.replaceState`, so the component isn't recreated. If Submit is pressed while that create is
  still running, it waits for the id instead of creating a duplicate.
- Leaving with unsaved changes asks for confirmation (route guard + `beforeunload`).

### Detail and review
`features/application-detail/`

- Sections for business, owner, settlement account, and a risk and activity timeline.
- The decision form (approve/reject, risk level, note) renders only for the **assigned reviewer**
  while the application is under review. Rules: high risk can't be approved, and rejections need a
  reason of at least 20 characters. The admin assignment panel renders only for admins. SALES never
  sees either.

### Sensitive data and CSP
See [docs/SECURITY.md](docs/SECURITY.md): masking at the API, audited role-based reveals that re-mask
after 30 seconds, token storage, and the CSP and how the build is made compatible with it.

## Project layout

```
mock-api/                  Express mock: auth, role scoping, masking, pagination, dev helpers
src/app/core/api           Models and typed API client
src/app/core/auth          AuthService, interceptor, guards, permission rules
src/app/core/http          Error-to-message and retry helpers
src/app/layout             App shell (header, nav, developer tools)
src/app/shared             Status badge, masked field, field errors, NPR pipe
src/app/features/          Lazy-loaded pages: login, dashboard, application form, detail
src/testing                Test helpers and fixtures
```

## Decisions and trade-offs

- **Signals for state, RxJS for time.** Component and store state are signals. Anything involving
  time, cancellation or ordering (debounce, `switchMap`, `concatMap`, retry, shared refresh) is RxJS,
  bridged with `toObservable` and `toSignal`.
- **No NgRx.** The state is per-page and small. A signal-based store per feature keeps it testable
  without the boilerplate; NgRx SignalStore would be the next step if state became shared across pages.
- **Form step components use default change detection.** Reactive-form validity isn't signal-based
  yet, and these components re-check when the wizard does. Every other component is `OnPush`.
- **Bootstrap, trimmed.** Only the Bootstrap modules in use are compiled, keeping the initial CSS at
  about 15 kB transferred.

## Not done (optional items)

The brief marks these as optional, so I left them out to keep the core solid:
- Dashboard counts by status.
- Real-time status updates (Socket.IO). The detail page already reloads through a single
  `reload$` stream, so a socket event would plug in there.

## Tests

61 tests across 10 files. Highlights:

- **Interceptor:** one refresh for three concurrent 401s, a late 401 after refresh, no retry loop,
  refresh failure ending the session, no token sent to other hosts.
- **Auto-save** (fake timers): debounce, ordering, "pending" during in-flight saves, retry with
  backoff, recovery after an error, no duplicate saves.
- **Wizard:** step gating, create-once-then-update, Submit racing an in-flight create, keeping input
  when a save fails.
- **Permission-aware UI:** decision controls hidden from sales and from unassigned reviewers, reveal
  controls only for allowed roles, admin-only assignment.
- Validators, guards, the dashboard (URL-driven queries, retry, paging, role-specific controls),
  and the masked field (reveal, then re-mask after 30 seconds).

## AI assistance

I used Claude Code (Anthropic) as a coding assistant: for parts of the implementation and tests,
for reviewing the code against the brief, and for setting up this repository.

I'm responsible for every line here. How I verified it:

- Read through and understood each change before keeping it, especially the interceptor's single
  shared refresh, the auto-save pipeline and the permission rules.
- Ran the full test suite (`npm test`, 61 tests) and the production build (`npm run build`), and
  checked that a fresh clone of this repository installs, tests and builds cleanly.
- Exercised the app by hand as each demo role, including the failure paths through the Developer
  tools panel (expired token with concurrent requests, failing draft saves).
- Checked that the server enforces every permission the UI hides, and that the repository holds no
  secrets or real personal data.
