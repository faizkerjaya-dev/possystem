import type { OrderLine, OrderType, TaxSettings, Totals } from '@/types/models';
import { roundTo5Sen } from './money';

/**
 * Bill calculation. Pure functions (no Firebase) so they are easy to unit test — see pricing.test.ts.
 *
 * Order of calculation:
 *   subtotal  = sum of (unit price + modifier extras) x qty, voided lines excluded
 *   discount  = subtotal x discount%
 *   service   = (subtotal - discount) x service%   (dine-in only unless serviceOnTakeaway)
 *   SST       = (subtotal - discount + service) x SST%
 *   total     = subtotal - discount + service + SST, cash rounded to 5 sen if enabled
 */

export function unitWithModifiers(line: Pick<OrderLine, 'unitCents' | 'modifiers'>): number {
  return line.unitCents + line.modifiers.reduce((sum, m) => sum + m.priceCents, 0);
}

export function lineTotalCents(line: Pick<OrderLine, 'unitCents' | 'modifiers' | 'qty'>): number {
  return unitWithModifiers(line) * line.qty;
}

export function activeLines<T extends Pick<OrderLine, 'voided'>>(lines: T[]): T[] {
  return lines.filter((l) => !l.voided);
}

export interface TotalsInput {
  lines: Pick<OrderLine, 'unitCents' | 'modifiers' | 'qty' | 'voided'>[];
  tax: TaxSettings;
  orderType: OrderType;
  discountPercent?: number;
  /** true = apply cash rounding (if enabled in settings) */
  cash?: boolean;
}

export function computeTotals({ lines, tax, orderType, discountPercent = 0, cash = false }: TotalsInput): Totals {
  const subtotal = activeLines(lines).reduce((sum, l) => sum + lineTotalCents(l), 0);
  const discount = Math.round((subtotal * discountPercent) / 100);
  const base = subtotal - discount;
  const serviceApplies = tax.serviceEnabled && (orderType === 'dine_in' || tax.serviceOnTakeaway);
  const service = serviceApplies ? Math.round((base * tax.serviceRate) / 100) : 0;
  const sst = tax.sstEnabled ? Math.round(((base + service) * tax.sstRate) / 100) : 0;
  const beforeRounding = base + service + sst;
  const total = cash && tax.cashRounding ? roundTo5Sen(beforeRounding) : beforeRounding;
  return {
    subtotalCents: subtotal,
    discountCents: discount,
    serviceCents: service,
    sstCents: sst,
    roundingCents: total - beforeRounding,
    totalCents: total,
    beforeRoundingCents: beforeRounding,
  };
}

/** Equal split: every share is the same except the last one, which absorbs the leftover sen. */
export function splitEqually(totalCents: number, ways: number): number[] {
  const n = Math.max(1, Math.floor(ways));
  const share = Math.floor(totalCents / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? totalCents - share * (n - 1) : share));
}
