/**
 * Reads the Vite environment variables. Kept separate from firebase.ts so the app can
 * show a friendly "missing configuration" screen instead of crashing on start-up.
 *
 * Values are cleaned: pasting into Vercel often adds spaces, quotes or a trailing comma
 * (e.g. `"pos-system-ae22b",`). A dirty project ID makes Firestore answer "400 Bad Request".
 */
function clean(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const out = v
    .trim()
    .replace(/,$/, '')
    .replace(/^["']|["']$/g, '')
    .trim();
  return out || undefined;
}

export const firebaseEnv = {
  apiKey: clean(import.meta.env.VITE_FIREBASE_API_KEY as string | undefined),
  authDomain: clean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined),
  projectId: clean(import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined),
  storageBucket: clean(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined),
  messagingSenderId: clean(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined),
  appId: clean(import.meta.env.VITE_FIREBASE_APP_ID as string | undefined),
};

export const STAFF_EMAIL_DOMAIN = clean(import.meta.env.VITE_STAFF_EMAIL_DOMAIN as string | undefined) || 'staff.pos.local';

/** Names of env vars that are empty. Shown on the ConfigError screen. */
export const missingEnv: string[] = Object.entries(firebaseEnv)
  .filter(([, value]) => !value)
  .map(([key]) => 'VITE_FIREBASE_' + key.replace(/[A-Z]/g, (c) => '_' + c).toUpperCase());

/** The project ID must look like "my-project-123". Anything else = wrong paste in Vercel. */
export const projectIdLooksWrong = !!firebaseEnv.projectId && !/^[a-z0-9-]{4,40}$/.test(firebaseEnv.projectId);
