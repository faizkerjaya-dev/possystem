const pad = (n: number) => String(n).padStart(2, '0');

/** 20:52 */
export function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 30/10/2026 20:52 */
export function dateTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${hhmm(ms)}`;
}

/** 20261030 — used in receipt numbers */
export function ymd(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** "1h 10m", "24m" */
export function duration(fromMs: number, nowMs: number): string {
  const mins = Math.max(0, Math.floor((nowMs - fromMs) / 60000));
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

/** "24:10" (mm:ss, minutes can go past 60) */
export function timer(fromMs: number, nowMs: number): string {
  const secs = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  return `${Math.floor(secs / 60)}:${pad(secs % 60)}`;
}

export function startOfDay(ms = Date.now()): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
