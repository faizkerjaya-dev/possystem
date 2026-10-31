import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { setDoc, updateDoc } from 'firebase/firestore';
import { auth } from '@/config/firebase';
import { firebaseEnv, STAFF_EMAIL_DOMAIN } from '@/config/env';
import { COL } from '@/config/collections';
import type { Role, Staff, StationId } from '@/types/models';
import { AppError } from '@/lib/errors';
import { docRef } from './db';
import { writeAudit } from './audit';

/**
 * Staff log in with a 6-digit PIN. Each staff member is a normal Firebase Auth
 * email/password user: email = <username>@<VITE_STAFF_EMAIL_DOMAIN>, password = PIN.
 */
export const PIN_LENGTH = 6;

export function staffEmail(username: string): string {
  return `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')}@${STAFF_EMAIL_DOMAIN}`;
}

export async function signInWithPin(email: string, pin: string) {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) throw new AppError('LOGIN_FAILED');
  await signInWithEmailAndPassword(auth, email, pin);
}

export async function signOut() {
  await firebaseSignOut(auth);
}

/**
 * Creates a staff login WITHOUT logging the admin out. Works on the free Spark plan:
 * we use a temporary second Firebase app instance for the new account.
 */
export async function createStaffAccount(
  admin: Staff,
  input: { name: string; username: string; role: Role; pin: string; station?: StationId | null },
): Promise<string> {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(input.pin)) throw new AppError('LOGIN_FAILED', 'PIN must be 6 digits');
  const email = staffEmail(input.username);
  const secondary = initializeApp(firebaseEnv as Record<string, string>, `staff-creator-${Date.now()}`);
  try {
    const cred = await createUserWithEmailAndPassword(getAuth(secondary), email, input.pin);
    const staff: Omit<Staff, 'id'> = {
      name: input.name.trim(),
      role: input.role,
      email,
      active: true,
      station: input.role === 'kitchen' ? (input.station ?? null) : null,
    };
    await setDoc(docRef(COL.staff, cred.user.uid), staff);
    await writeAudit(admin, 'staff.create', { uid: cred.user.uid, name: staff.name, role: staff.role });
    return cred.user.uid;
  } finally {
    await deleteApp(secondary);
  }
}

export async function setStaffActive(admin: Staff, staffId: string, active: boolean) {
  await updateDoc(docRef(COL.staff, staffId), { active });
  await writeAudit(admin, active ? 'staff.activate' : 'staff.deactivate', { staffId });
}
