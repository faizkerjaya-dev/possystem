import { setDoc } from 'firebase/firestore';
import { COL, SETTINGS_DOC_ID } from '@/config/collections';
import type { Settings, Staff } from '@/types/models';
import { docRef } from './db';
import { writeAudit } from './audit';

export const settingsRef = () => docRef(COL.settings, SETTINGS_DOC_ID);

/** Saves the whole settings object (admin only — enforced by firestore.rules). */
export async function saveSettings(staff: Staff, settings: Settings) {
  await setDoc(settingsRef(), { ...settings, updatedAt: Date.now(), updatedBy: staff.name });
  await writeAudit(staff, 'settings.save', {});
}
