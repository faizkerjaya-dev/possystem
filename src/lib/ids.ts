/** Random id used as an idempotency key: a double tap re-uses the same id, so nothing is created twice. */
export function newId(prefix = ''): string {
  const raw =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix + raw.replace(/-/g, '').slice(0, 20);
}
