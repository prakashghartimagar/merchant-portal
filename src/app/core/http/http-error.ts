import { HttpErrorResponse } from '@angular/common/http';

/** Turns any HTTP failure into a sentence a user can act on. */
export function describeHttpError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const serverMessage = typeof err.error?.message === 'string' ? err.error.message : null;
    if (err.status === 0) return 'Cannot reach the server. Check your connection and try again.';
    if (serverMessage) return serverMessage;
    if (err.status === 403) return 'You do not have permission to do this.';
    if (err.status === 404) return 'This item was not found or is not available to you.';
    if (err.status >= 500) return 'The server had a problem. Try again in a moment.';
  }
  return 'Something went wrong. Try again.';
}

/** Network failures and 5xx are worth retrying; 4xx are not. */
export function isRetryable(err: unknown): boolean {
  return err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 500);
}
