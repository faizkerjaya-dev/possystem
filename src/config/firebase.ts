import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { firebaseEnv } from './env';

/**
 * Single place where Firebase is initialised. Every service imports `db` and `auth` from here.
 *
 * Offline cache is on so screens keep showing data when restaurant Wi-Fi drops.
 * Note: transactions (send order, take payment) still need a connection and will show an error offline.
 */
export const app: FirebaseApp = initializeApp(firebaseEnv as Record<string, string>);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true, // an optional field left undefined never crashes a save
});
