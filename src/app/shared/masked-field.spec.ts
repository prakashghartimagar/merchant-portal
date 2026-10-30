import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApplicationsApi } from '../core/api/applications.api';
import { MaskedField, REVEAL_DURATION_MS } from './masked-field';

async function render(canReveal: boolean) {
  const api = { reveal: vi.fn(() => of({ field: 'accountNumber', value: '12345678901234' })) };
  TestBed.configureTestingModule({ providers: [{ provide: ApplicationsApi, useValue: api }] });
  const fixture = TestBed.createComponent(MaskedField);
  fixture.componentRef.setInput('applicationId', 'app_1');
  fixture.componentRef.setInput('field', 'accountNumber');
  fixture.componentRef.setInput('label', 'Account number');
  fixture.componentRef.setInput('maskedValue', '••••••••••1234');
  fixture.componentRef.setInput('canReveal', canReveal);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, api };
}

describe('MaskedField', () => {
  afterEach(() => vi.useRealTimers());

  it('shows the masked value and no reveal control without permission', async () => {
    const { el } = await render(false);
    expect(el.textContent).toContain('••••••••••1234');
    expect(el.querySelector('button')).toBeNull();
  });

  it('reveals on request, then masks again after 30 seconds', async () => {
    vi.useFakeTimers();
    const { fixture, el, api } = await render(true);

    el.querySelector('button')!.click();
    fixture.detectChanges();
    expect(api.reveal).toHaveBeenCalledWith('app_1', 'accountNumber');
    expect(el.textContent).toContain('12345678901234');

    vi.advanceTimersByTime(REVEAL_DURATION_MS);
    fixture.detectChanges();
    expect(el.textContent).not.toContain('12345678901234');
    expect(el.textContent).toContain('••••••••••1234');
  });

  it('can be hidden again straight away', async () => {
    const { fixture, el } = await render(true);
    el.querySelector('button')!.click();
    fixture.detectChanges();
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Hide'))!
      .click();
    fixture.detectChanges();
    expect(el.textContent).not.toContain('12345678901234');
  });
});
