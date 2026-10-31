/**
 * Small logger. Open the browser console (F12) and filter by "[POS]" to follow what happened.
 * Example: [POS][orders] sendBatch ok {orderId: "...", batch: 2}
 */
type Level = 'info' | 'warn' | 'error';

function write(level: Level, scope: string, message: string, data?: unknown) {
  const prefix = `[POS][${scope}]`;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  if (data === undefined) fn(prefix, message);
  else fn(prefix, message, data);
}

export const log = {
  info: (scope: string, message: string, data?: unknown) => write('info', scope, message, data),
  warn: (scope: string, message: string, data?: unknown) => write('warn', scope, message, data),
  error: (scope: string, message: string, data?: unknown) => write('error', scope, message, data),
};
