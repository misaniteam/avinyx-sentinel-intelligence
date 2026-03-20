import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';

let db: Database | null = null;

export function getFirebaseDb(): Database | null {
  if (typeof window === 'undefined') return null;

  const configStr = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (!configStr) return null;

  try {
    if (!getApps().length) {
      const config = JSON.parse(configStr);
      initializeApp(config);
    }
    if (!db) {
      db = getDatabase(getApp());
    }
    return db;
  } catch {
    console.warn('Firebase initialization failed');
    return null;
  }
}
