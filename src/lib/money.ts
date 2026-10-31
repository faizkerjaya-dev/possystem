/** All money is integer cents (sen). These helpers are the ONLY place that converts to/from RM. */

export function toCents(rm: number | string): number {
  const n = typeof rm === 'string' ? parseFloat(rm.replace(/[^0-9.\-]/g, '')) : rm;
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** 2290 -> "RM 22.90" */
export function fmtRM(cents: number): string {
  return (
    (cents < 0 ? '−RM ' : 'RM ') +
    (Math.abs(cents) / 100).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

/** 2290 -> "22.90" (receipts) */
export function fmtPlain(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Malaysian cash rounding: nearest 5 sen. 17327 -> 17325, 17328 -> 17330 */
export function roundTo5Sen(cents: number): number {
  return Math.round(cents / 5) * 5;
}
