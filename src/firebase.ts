import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';

const env = import.meta.env;

/**
 * With no VITE_FB_* values present we point at the emulator suite and a `demo-` project
 * id, which the emulators accept without any real Firebase project existing.
 */
export const USE_EMULATOR = env.VITE_USE_EMULATOR === 'true' || !env.VITE_FB_API_KEY;

const projectId = env.VITE_FB_PROJECT_ID ?? 'demo-big-squiggle';

const app = initializeApp({
  apiKey: env.VITE_FB_API_KEY ?? 'demo-key',
  authDomain: env.VITE_FB_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
  databaseURL: env.VITE_FB_DATABASE_URL ?? `https://${projectId}-default-rtdb.firebaseio.com`,
  projectId,
  appId: env.VITE_FB_APP_ID ?? '1:0:web:0',
});

export const auth = getAuth(app);
export const db = getDatabase(app);

if (USE_EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
}

/**
 * Resolves with a stable anonymous uid. The SDK persists it, so a refresh — or a laptop
 * lid closed mid-round — comes back as the same player and keeps its seat.
 */
export function signIn(): Promise<string> {
  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          stop();
          resolve(user.uid);
        }
      },
      (err) => {
        stop();
        reject(err);
      },
    );
    signInAnonymously(auth).catch(reject);
  });
}
