# Security notes

## Where the UI stops and the server starts

Hiding a button is a convenience, not a control. Every rule the UI applies in
`src/app/core/auth/permissions.ts` is enforced again by the API
(`mock-api/server.mjs`), which is the authority:

| Rule | UI | API |
| --- | --- | --- |
| Sales see only their own applications; reviewers only those assigned to them | List is whatever the API returns | List and detail are filtered per user; other records return 404 (not 403) so ids can't be probed |
| Only the creator edits, and only drafts | "Continue" and edit route hidden; `roleGuard('SALES')` on the route | `PUT /draft`, `GET /edit`, `POST /submit` check owner + `DRAFT` |
| Only the assigned reviewer records decisions | Decision form not rendered for anyone else | `POST /decisions` checks role + assignment + status |
| High-risk applications can't be approved | Cross-field validator | 422 from the API |
| Only admins assign reviewers | Panel not rendered | `PUT /assignment` checks role |

## Tokens

- **Access token**: short-lived (60 s in the mock so refresh is easy to see), held only in a
  signal in memory. Not in `localStorage` or `sessionStorage`, so an injected script can't read it
  out of storage, and it disappears when the tab closes.
- **Refresh token**: an `HttpOnly`, `SameSite=Strict` cookie scoped to `/api/auth`. JavaScript can't
  read it at all, and it is only sent to the auth endpoints. It is rotated on every use, and reusing
  an old one is rejected.
- **Bearer header**: attached only to same-origin `/api/` requests, never to other hosts.
- **Reload**: on start-up the app calls `POST /api/auth/refresh`; the cookie restores the session.

## Sensitive fields

PAN, owner ID number and bank account number:

- are **masked by the API** in every list and detail response, so a plain value never reaches the
  browser unless someone asks for it;
- can be revealed one field at a time through `POST /applications/:id/reveal`, which only admins,
  the owning sales user and the assigned reviewer may call; each reveal is logged server-side;
- are kept in component memory only while shown, and masked again after 30 seconds;
- are never written to browser storage. Drafts are saved to the server, not to `localStorage`.
- In the wizard, the confirm-account field has paste disabled, and the confirmation value is never
  sent to the API.

## Content Security Policy

CSP tells the browser which sources it may load and run code from. Its main job here is to make
cross-site scripting much harder to exploit: even if an attacker manages to inject markup, the browser
refuses to run inline scripts or load scripts from other origins, and can't send data to a server
that isn't on the list.

`npm run preview:csp` builds the app and serves it from the mock server with this header:

```
default-src 'self';
script-src 'self' 'nonce-<random>';
style-src 'self' 'nonce-<random>';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none'
```

How the app is made compatible with it:

- **No inline scripts.** The production build emits only external module scripts. Critical-CSS
  inlining is turned off (`inlineCritical: false`) because it adds an inline `onload` handler.
- **Nonce for Angular's component styles.** Angular injects component CSS as `<style>` tags. The
  server generates a fresh nonce per request and writes it into `<app-root ngCspNonce="…">`;
  Angular then stamps it on every style tag it creates. No `'unsafe-inline'` is needed.
- **Fonts are self-hosted** (`@fontsource-variable/public-sans`), so `font-src 'self'` is enough and
  there's no third-party request on page load.
- **`connect-src 'self'`** means that even a successful injection can't send data to another host
  with `fetch`/XHR.
- **`frame-ancestors 'none'`** blocks click-jacking by refusing to be framed.
- Angular's own protections still apply underneath: template binding escapes values, and
  `[innerHTML]` is sanitised. The app never uses `bypassSecurityTrust*`.

In a real deployment the same header would be set by the web server or CDN, with a `report-to`
endpoint, and HSTS would be enabled.

## What this demo deliberately doesn't do

- **No real authentication.** You sign in by choosing a demo user; production would use the
  organisation's identity provider (OIDC).
- **No secrets in the repo.** There are no passwords or keys; tokens are random values created at
  runtime.
- **All seed data is fictitious.** Names, ID numbers, PANs and account numbers are generated, and
  emails use `example.com`.
