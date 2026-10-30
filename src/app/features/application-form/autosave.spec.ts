import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AutoSaveState, autoSave } from './autosave';

const serverError = () => new HttpErrorResponse({ status: 503, statusText: 'Unavailable' });
const forbidden = () => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' });

describe('autoSave', () => {
  let changes: Subject<string>;
  let states: AutoSaveState[];
  const last = () => states[states.length - 1];

  beforeEach(() => {
    vi.useFakeTimers();
    changes = new Subject<string>();
    states = [];
  });
  afterEach(() => vi.useRealTimers());

  function start(
    save: (v: string) => Observable<unknown>,
    extra: Partial<Parameters<typeof autoSave<string>>[1]> = {},
  ) {
    return autoSave(changes, { save, debounceMs: 1000, retryDelayMs: 100, ...extra }).subscribe(
      (s) => states.push(s),
    );
  }

  it('turns a burst of edits into a single save of the latest value', () => {
    const save = vi.fn((_: string) => of(true));
    start(save);

    changes.next('a');
    changes.next('ab');
    changes.next('abc');
    expect(last().status).toBe('pending');

    vi.advanceTimersByTime(999);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('abc');
    expect(last().status).toBe('saved');
    expect(last().lastSavedAt).toBeInstanceOf(Date);
  });

  it('runs saves one at a time and in order, never cancelling one in flight', () => {
    const inFlight: Subject<void>[] = [];
    const save = vi.fn((_: string) => {
      const s = new Subject<void>();
      inFlight.push(s);
      return s;
    });
    start(save);

    changes.next('first');
    vi.advanceTimersByTime(1000);
    changes.next('second');
    vi.advanceTimersByTime(1000);

    // The first save is still running; the newer edit waits its turn.
    expect(save).toHaveBeenCalledTimes(1);
    expect(last().status).toBe('pending');

    inFlight[0].next();
    inFlight[0].complete();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('second');
  });

  it('says "pending", not "saved", when the value changed while a save was in flight', () => {
    const inFlight = new Subject<void>();
    start(() => inFlight);

    changes.next('one');
    vi.advanceTimersByTime(1000);
    changes.next('two');
    inFlight.next();
    inFlight.complete();

    expect(last().status).toBe('pending');
  });

  it('retries network and server errors with backoff, then succeeds', () => {
    let attempts = 0;
    start(() => {
      attempts++;
      return attempts < 3 ? throwError(serverError) : of(true);
    });

    changes.next('value');
    vi.advanceTimersByTime(1000);
    expect(attempts).toBe(1);
    vi.advanceTimersByTime(100); // first retry
    expect(attempts).toBe(2);
    vi.advanceTimersByTime(200); // second retry, doubled delay
    expect(attempts).toBe(3);
    expect(last().status).toBe('saved');
  });

  it('reports an error without ending the stream, and recovers on the next change', () => {
    let fail = true;
    const save = vi.fn(() => (fail ? throwError(forbidden) : of(true)));
    start(save, { retries: 0 });

    changes.next('v1');
    vi.advanceTimersByTime(1000);
    expect(last()).toMatchObject({
      status: 'error',
      error: 'You do not have permission to do this.',
    });

    fail = false;
    changes.next('v2');
    vi.advanceTimersByTime(1000);
    expect(last().status).toBe('saved');
  });

  it('does not retry client errors such as 403', () => {
    const save = vi.fn(() => throwError(forbidden));
    start(save);
    changes.next('x');
    vi.advanceTimersByTime(5000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('saves immediately on demand, bypassing the debounce (Retry / Save now)', () => {
    const saveNow$ = new Subject<string>();
    const save = vi.fn((_: string) => of(true));
    start(save, { saveNow$ });
    saveNow$.next('now');
    expect(save).toHaveBeenCalledWith('now');
  });

  it('skips values identical to what is already saved', () => {
    const save = vi.fn((_: string) => of(true));
    start(save, { initialValue: 'loaded' });
    changes.next('loaded');
    vi.advanceTimersByTime(1000);
    expect(save).not.toHaveBeenCalled();
  });
});
