import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApplicationsApi } from '../../core/api/applications.api';
import { makeDetail } from '../../../testing/test-helpers';
import { DecisionForm } from './decision-form';

async function render() {
  const api = { recordDecision: vi.fn(() => of(makeDetail({ status: 'APPROVED' }))) };
  TestBed.configureTestingModule({ providers: [{ provide: ApplicationsApi, useValue: api }] });
  const fixture = TestBed.createComponent(DecisionForm);
  fixture.componentRef.setInput('applicationId', 'app_1');
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const set = async (selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(selector)!;
    if (input.type === 'radio') input.click();
    else {
      input.value = value;
      input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input'));
    }
    await fixture.whenStable();
  };
  const submit = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  return { el, api, set, submit, fixture };
}

describe('DecisionForm', () => {
  it('blocks submission until every field is valid', async () => {
    const { el, api, submit } = await render();
    await submit();
    expect(api.recordDecision).not.toHaveBeenCalled();
    expect(el.textContent).toContain('This field is required.');
  });

  it('refuses to approve a high-risk application', async () => {
    const { el, api, set, submit } = await render();
    await set('input[value="APPROVE"]', '');
    await set('#riskLevel', 'HIGH');
    await set('#note', 'Everything checks out fine.');
    await submit();
    expect(api.recordDecision).not.toHaveBeenCalled();
    expect(el.textContent).toContain('High-risk applications can’t be approved');
  });

  it('records a valid decision and emits the updated application', async () => {
    const { api, set, submit, fixture } = await render();
    const decided = vi.fn();
    fixture.componentInstance.decided.subscribe(decided);
    await set('input[value="APPROVE"]', '');
    await set('#riskLevel', 'LOW');
    await set('#note', 'Documents verified in full.');
    await submit();
    expect(api.recordDecision).toHaveBeenCalledWith('app_1', {
      decision: 'APPROVE',
      riskLevel: 'LOW',
      note: 'Documents verified in full.',
    });
    expect(decided).toHaveBeenCalled();
  });
});
