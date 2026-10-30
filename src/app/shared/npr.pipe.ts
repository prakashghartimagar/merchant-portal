import { Pipe, PipeTransform } from '@angular/core';

const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'NPR',
  maximumFractionDigits: 0,
});

/** Nepalese rupees with lakh/crore grouping, e.g. NPR 12,50,000. */
@Pipe({ name: 'npr' })
export class NprPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : formatter.format(value);
  }
}
