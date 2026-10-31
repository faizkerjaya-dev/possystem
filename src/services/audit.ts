import { addDoc } from 'firebase/firestore';
import { COL } from '@/config/collections';
import type { Staff } from '@/types/models';
import { colRef } from './db';
import { log } from '@/lib/logger';

/**
 * Append-only log of sensitive actions (voids, discounts, reprints, settings changes).
 * Read it in Firebase console › Firestore › auditLogs. Never blocks the main action.
 */
export async function writeAudit(staff: Staff | null, action: string, details: Record<string, unknown> = {}) {
  try {
    await addDoc(colRef(COL.auditLogs), {
      action,
      details,
      staffId: staff?.id ?? null,
      staffName: staff?.name ?? 'unknown',
      role: staff?.role ?? null,
      at: Date.now(),
    });
  } catch (err) {
    log.warn('audit', `could not write audit "${action}"`, err);
  }
}
