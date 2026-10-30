import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { errorMessage } from '../features/application-form/validators';

/** True when a field should be shown as invalid: touched, and failing either its own or a related group rule. */
export function showInvalid(
  control: AbstractControl,
  group?: AbstractControl | null,
  groupKeys: string[] = [],
): boolean {
  if (!control.touched) return false;
  return control.invalid || groupKeys.some((k) => group?.hasError(k));
}

/**
 * The first error for a field, linked to the input through aria-describedby.
 * Reactive-form state isn't signal-based, so this reads it during change
 * detection; it stays cheap because it only looks at one control.
 */
@Component({
  selector: 'app-field-errors',
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div class="invalid-feedback d-block" [id]="id()" aria-live="polite">{{ message() }}</div>
  `,
})
export class FieldErrors {
  readonly control = input.required<AbstractControl>();
  readonly id = input.required<string>();
  /** A parent group whose errors (listed in groupKeys) belong to this field. */
  readonly group = input<AbstractControl | null>(null);
  readonly groupKeys = input<string[]>([]);

  protected message(): string {
    const control = this.control();
    if (!control.touched) return '';
    const own = control.errors ? Object.entries(control.errors)[0] : undefined;
    if (own) return errorMessage(own[0], own[1]);
    const groupKey = this.groupKeys().find((k) => this.group()?.hasError(k));
    return groupKey ? errorMessage(groupKey, null) : '';
  }
}
