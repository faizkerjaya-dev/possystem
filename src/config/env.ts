/**
 * Reads the Vite environment variables. Kept separate from firebase.ts so the app can
 * show a friendly "missing configuration" screen instead of crashing on start-up.
 */
export const firebaseEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const STAFF_EMAIL_DOMAIN =
  (import.meta.env.VITE_STAFF_EMAIL_DOMAIN as string | undefined) || 'staff.pos.local';

/** Names of env vars that are empty. Shown on the ConfigError screen. */
export const missingEnv: string[] = Object.entries(firebaseEnv)
  .filter(([, value]) => !value)
  .map(([key]) => 'VITE_FIREBASE_' + key.replace(/[A-Z]/g, (c) => '_' + c).toUpperCase());
