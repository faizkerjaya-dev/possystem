import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { COL, SETTINGS_DOC_ID } from '@/config/collections';
import { DEFAULT_SETTINGS } from '@/config/defaultSettings';
import { SAMPLE_CATEGORIES, SAMPLE_GROUPS, SAMPLE_PRODUCTS, SAMPLE_TABLES } from '@/config/sampleMenu';
import type { Staff } from '@/types/models';
import { log } from '@/lib/logger';
import { createStaffAccount, PIN_LENGTH, staffEmail } from './auth';
import { docRef, withoutId } from './db';
import { writeAudit } from './audit';

/**
 * FIRST-TIME SETUP (runs in the browser — no service account, no Terminal).
 *
 * Only works while settings/main does not exist (see "setupOpen()" in firestore.rules).
 * Order matters:
 *   1. create the owner login + staff/{uid} (allowed by the bootstrap rule)
 *   2. now the owner is an admin → optional developer login, sample menu, tables, counters
 *   3. settings/main LAST — this closes setup for good
 * Safe to run again if it stopped half-way: every step overwrites or skips what already exists.
 */
export interface SetupInput {
  businessName: string;
  ownerName: string;
  ownerUsername: string;
  ownerPin: string;
  developer: { name: string; username: string; pin: string } | null;
  sampleData: boolean;
  /** Set when an owner/admin is already signed in and setup stopped half-way: skips creating the owner. */
  resumeAs?: Staff | null;
}

/** Firestore writes wait for the server. If it never answers, fail with a clear message instead of spinning forever. */
function withTimeout<T>(p: Promise<T>, what: string, ms = 25000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `[DB_UNREACHABLE] Tiada jawapan dari Firestore semasa "${what}". Semak Firebase project di bawah skrin ini sama dengan projek anda, Firestore Database sudah dibuat, dan Rules sudah di-Publish.`,
            ),
          ),
        ms,
      ),
    ),
  ]);
}

const pinOk = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

function friendly(err: unknown): Error {
  const code = (err as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/operation-not-allowed':
      '[SETUP_AUTH_DISABLED] Hidupkan Email/Password di Firebase › Authentication › Sign-in method, kemudian cuba lagi.',
    'auth/invalid-credential':
      '[SETUP_USERNAME_TAKEN] Username owner sudah wujud dengan PIN lain. Guna PIN yang sama seperti sebelum ini, atau username lain.',
    'auth/wrong-password':
      '[SETUP_USERNAME_TAKEN] Username owner sudah wujud dengan PIN lain. Guna PIN yang sama seperti sebelum ini, atau username lain.',
    'permission-denied':
      '[SETUP_RULES] Firestore menolak. Pastikan firestore.rules TERKINI sudah di-Publish (Firebase › Firestore › Rules).',
    unavailable: '[OFFLINE] Tiada sambungan internet.',
  };
  if (map[code]) return new Error(map[code]);
  return err instanceof Error ? err : new Error(String(err));
}

export async function runFirstTimeSetup(input: SetupInput, onStep: (text: string) => void): Promise<void> {
  const resume = input.resumeAs ?? null;
  if (!input.businessName.trim()) throw new Error('Isi nama kedai.');
  if (!resume && (!input.ownerName.trim() || !input.ownerUsername.trim())) throw new Error('Isi nama owner dan username.');
  if (!resume && !pinOk(input.ownerPin)) throw new Error(`PIN mesti ${PIN_LENGTH} digit nombor.`);
  if (input.developer && !pinOk(input.developer.pin)) throw new Error(`PIN developer mesti ${PIN_LENGTH} digit nombor.`);

  try {
    // 1. Owner login (or continue as the signed-in owner/admin)
    let owner: Staff;
    if (resume) {
      onStep(`Meneruskan setup sebagai ${resume.name}…`);
      owner = resume;
    } else {
      onStep('Mencipta login owner…');
      const email = staffEmail(input.ownerUsername);
      let uid: string;
      try {
        uid = (await createUserWithEmailAndPassword(auth, email, input.ownerPin)).user.uid;
      } catch (err) {
        if ((err as { code?: string }).code !== 'auth/email-already-in-use') throw err;
        uid = (await signInWithEmailAndPassword(auth, email, input.ownerPin)).user.uid; // setup re-run
      }
      owner = { id: uid, name: input.ownerName.trim(), role: 'owner', email, active: true, station: null };
    }
    onStep('Menyimpan profil owner…');
    // Re-written on resume too: if the first try only reached this device's offline cache, this sends it to the server.
    await withTimeout(setDoc(docRef(COL.staff, owner.id), withoutId(owner)), 'menyimpan profil owner');

    // 2a. Developer login (admin)
    if (input.developer) {
      onStep('Mencipta login developer…');
      try {
        await withTimeout(createStaffAccount(owner, { ...input.developer, role: 'admin' }), 'mencipta developer');
      } catch (err) {
        if ((err as { code?: string }).code === 'auth/email-already-in-use') log.warn('setup', 'developer login already exists, skipped');
        else throw err;
      }
    }

    // 2b. Sample menu + tables
    if (input.sampleData) {
      onStep('Memasukkan menu dan meja contoh…');
      const batch = writeBatch(db);
      SAMPLE_CATEGORIES.forEach((c) => batch.set(docRef(COL.categories, c.id), withoutId(c)));
      SAMPLE_GROUPS.forEach((g) => batch.set(docRef(COL.modifierGroups, g.id), withoutId(g)));
      SAMPLE_PRODUCTS.forEach((p) => batch.set(docRef(COL.products, p.id), withoutId(p)));
      SAMPLE_TABLES.forEach((t) => batch.set(docRef(COL.tables, t.id), withoutId(t)));
      await withTimeout(batch.commit(), 'menu dan meja');
    }

    // 2c. Order / receipt counters (only if missing)
    onStep('Menyediakan nombor order dan resit…');
    for (const [id, value] of [['orders', 1000], ['receipts', 0]] as const) {
      const ref = docRef(COL.counters, id);
      if (!(await withTimeout(getDoc(ref), 'membaca kaunter')).exists()) await withTimeout(setDoc(ref, { value }), 'kaunter');
    }

    // 3. Settings — closes setup
    onStep('Menyimpan tetapan kedai…');
    await withTimeout(
      setDoc(docRef(COL.settings, SETTINGS_DOC_ID), {
        ...DEFAULT_SETTINGS,
        business: { ...DEFAULT_SETTINGS.business, name: input.businessName.trim().toUpperCase() },
        updatedAt: Date.now(),
        updatedBy: owner.name,
      }),
      'tetapan kedai',
    );
    await writeAudit(owner, 'setup.complete', { sampleData: input.sampleData, developer: !!input.developer });
    log.info('setup', 'first-time setup complete');
  } catch (err) {
    log.error('setup', 'setup failed', err);
    throw friendly(err);
  }
}
