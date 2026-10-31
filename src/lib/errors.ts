/**
 * Every error the app shows has a CODE. Search docs/TROUBLESHOOTING.md for the code to find
 * the cause and the fix. Add new codes here AND in that document.
 */
export const ERROR_MESSAGES = {
  TABLE_BUSY: 'This table already has an open order. Open it from the floor plan instead.',
  ORDER_NOT_FOUND: 'Order not found. It may have been cancelled or paid on another device.',
  ORDER_CLOSED: 'This order is already paid or cancelled.',
  NOTHING_TO_SEND: 'There are no new items to send.',
  PAYMENT_SHORT: 'Cash received is less than the amount due.',
  NOT_ALLOWED: 'Your role is not allowed to do this. Ask an admin.',
  OFFLINE: 'No internet connection. Check the Wi-Fi and try again.',
  LOGIN_FAILED: 'Wrong PIN. Try again.',
  STAFF_INACTIVE: 'This staff account is not active. Ask an admin.',
  SETTINGS_MISSING: 'Settings are missing. Run the seed script (see docs/DEPLOY.md).',
  UNKNOWN: 'Something went wrong. Try again.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export class AppError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, detail?: string) {
    super(detail ? `${ERROR_MESSAGES[code]} (${detail})` : ERROR_MESSAGES[code]);
    this.code = code;
    this.name = 'AppError';
  }
}

/** Turns any thrown value (AppError, FirebaseError, string…) into "[CODE] message" for the screen. */
export function describeError(err: unknown): { code: string; message: string } {
  if (err instanceof AppError) return { code: err.code, message: err.message };
  const fb = err as { code?: string; message?: string };
  if (fb?.code === 'permission-denied') return { code: 'NOT_ALLOWED', message: ERROR_MESSAGES.NOT_ALLOWED };
  if (fb?.code === 'unavailable') return { code: 'OFFLINE', message: ERROR_MESSAGES.OFFLINE };
  if (fb?.code === 'auth/invalid-credential' || fb?.code === 'auth/wrong-password')
    return { code: 'LOGIN_FAILED', message: ERROR_MESSAGES.LOGIN_FAILED };
  if (fb?.code) return { code: fb.code, message: fb.message ?? ERROR_MESSAGES.UNKNOWN };
  return { code: 'UNKNOWN', message: err instanceof Error ? err.message : String(err) };
}
