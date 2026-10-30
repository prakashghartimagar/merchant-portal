import {
  EMPTY,
  Observable,
  catchError,
  concat,
  concatMap,
  debounceTime,
  defer,
  map,
  merge,
  of,
  retry,
  startWith,
  tap,
  throwError,
  timer,
} from 'rxjs';
import { describeHttpError, isRetryable } from '../../core/http/http-error';

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface AutoSaveState {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
  error: string | null;
}

export interface AutoSaveOptions<T> {
  /** Persists one value. Called strictly one at a time, in order. */
  save: (value: T) => Observable<unknown>;
  debounceMs: number;
  /** Values to save straight away, skipping the debounce ("Save now", "Retry"). */
  saveNow$?: Observable<T>;
  /** Value already stored on the server; an identical value is not re-sent. */
  initialValue?: T;
  /** Automatic retries for network/5xx failures, with exponential backoff. */
  retries?: number;
  retryDelayMs?: number;
}

export const INITIAL_AUTOSAVE_STATE: AutoSaveState = {
  status: 'idle',
  lastSavedAt: null,
  error: null,
};

/**
 * Turns a stream of form values into a stream of save states.
 *
 * - Debounces typing so a burst of keystrokes becomes one request.
 * - Uses concatMap, not switchMap: an in-flight save is never cancelled, so
 *   a "create" can't be aborted halfway and saves land in order.
 * - Skips values identical to the last successful save.
 * - Catches errors per save, so one failure doesn't end the stream; the form
 *   is never touched here, so no user input is lost.
 * - Only reports "saved" when nothing changed while the save was in flight.
 */
export function autoSave<T>(
  changes$: Observable<T>,
  options: AutoSaveOptions<T>,
): Observable<AutoSaveState> {
  return defer(() => {
    let lastSaved =
      options.initialValue === undefined ? null : JSON.stringify(options.initialValue);
    let lastSavedAt: Date | null = null;
    let changeCount = 0;
    const state = (status: AutoSaveStatus, error: string | null = null): AutoSaveState => ({
      status,
      lastSavedAt,
      error,
    });

    const pending$ = changes$.pipe(
      tap(() => changeCount++),
      map(() => state('pending')),
    );

    const toSave$ = merge(
      changes$.pipe(debounceTime(options.debounceMs)),
      options.saveNow$ ?? EMPTY,
    );

    const saves$ = toSave$.pipe(
      concatMap((value) => {
        const snapshot = JSON.stringify(value);
        const changesAtStart = changeCount;
        const settled = () =>
          changeCount === changesAtStart ? state(lastSavedAt ? 'saved' : 'idle') : state('pending');

        if (snapshot === lastSaved) return of(settled());

        return concat(
          of(state('saving')),
          defer(() => options.save(value)).pipe(
            retry({
              count: options.retries ?? 2,
              delay: (err, attempt) =>
                isRetryable(err)
                  ? timer((options.retryDelayMs ?? 1000) * 2 ** (attempt - 1))
                  : throwError(() => err),
            }),
            map(() => {
              lastSaved = snapshot;
              lastSavedAt = new Date();
              return settled();
            }),
            catchError((err) => of(state('error', describeHttpError(err)))),
          ),
        );
      }),
    );

    return merge(pending$, saves$).pipe(startWith(state('idle')));
  });
}
