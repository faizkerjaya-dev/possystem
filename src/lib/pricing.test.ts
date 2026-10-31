import { describe, expect, it } from 'vitest';
import { computeTotals, splitEqually } from './pricing';
import { roundTo5Sen } from './money';
import { DEFAULT_SETTINGS } from '@/config/defaultSettings';

const tax = DEFAULT_SETTINGS.tax; // SST 6%, service 10%, cash rounding on
const line = (unitCents: number, qty: number, extra = 0) => ({
  unitCents,
  qty,
  voided: false,
  modifiers: extra ? [{ group: 'Add-ons', option: 'Egg', priceCents: extra }] : [],
});

describe('computeTotals', () => {
  // ORD-1001: 2 Sirloin 49.90, 1 Chicken Chop 22.90, 2 Iced Lemon Tea 6.50, 1 Milkshake 12.90 = RM 148.60
  const lines = [line(4990, 2), line(2290, 1), line(650, 2), line(1290, 1)];

  it('calculates dine-in card total with service charge and SST', () => {
    const t = computeTotals({ lines, tax, orderType: 'dine_in' });
    expect(t.subtotalCents).toBe(14860);
    expect(t.serviceCents).toBe(1486);
    expect(t.sstCents).toBe(981); // 6% of 163.46
    expect(t.totalCents).toBe(17327);
    expect(t.roundingCents).toBe(0);
  });

  it('rounds cash to the nearest 5 sen', () => {
    const t = computeTotals({ lines, tax, orderType: 'dine_in', cash: true });
    expect(t.totalCents).toBe(17325);
    expect(t.roundingCents).toBe(-2);
  });

  it('skips service charge on takeaway by default', () => {
    const t = computeTotals({ lines: [line(2190, 1), line(990, 1)], tax, orderType: 'takeaway' });
    expect(t.serviceCents).toBe(0);
    expect(t.totalCents).toBe(3371);
  });

  it('applies discount before service and SST', () => {
    const t = computeTotals({ lines: [line(10000, 1)], tax, orderType: 'dine_in', discountPercent: 10 });
    expect(t.discountCents).toBe(1000);
    expect(t.serviceCents).toBe(900);
    expect(t.sstCents).toBe(594);
    expect(t.totalCents).toBe(10494);
  });

  it('adds modifier extras and ignores voided lines', () => {
    const t = computeTotals({
      lines: [line(4990, 1, 250), { ...line(2490, 1), voided: true }],
      tax: { ...tax, serviceEnabled: false, sstEnabled: false },
      orderType: 'dine_in',
    });
    expect(t.totalCents).toBe(5240);
  });
});

describe('helpers', () => {
  it('roundTo5Sen', () => {
    expect(roundTo5Sen(17327)).toBe(17325);
    expect(roundTo5Sen(17328)).toBe(17330);
    expect(roundTo5Sen(9689)).toBe(9690);
  });
  it('splitEqually keeps the total exact', () => {
    const parts = splitEqually(17327, 4);
    expect(parts).toEqual([4331, 4331, 4331, 4334]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(17327);
  });
});
