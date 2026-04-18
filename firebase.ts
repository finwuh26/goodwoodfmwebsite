import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Allow overriding the Firestore database via an env variable so a persistent
// production database (set in Vercel environment settings) is used instead of
// the AI Studio database that gets reset whenever the AI Studio project rebuilds.
const normalizeFirestoreDatabaseId = (databaseId?: string): string | undefined => {
  const trimmedDatabaseId = databaseId?.trim();
  return trimmedDatabaseId && trimmedDatabaseId.length > 0
    ? trimmedDatabaseId
    : undefined;
};

const envFirestoreDatabaseId = normalizeFirestoreDatabaseId(import.meta.env.VITE_FIRESTORE_DATABASE_ID);
const configFirestoreDatabaseId = normalizeFirestoreDatabaseId(firebaseConfig.firestoreDatabaseId);
const hasNamedConfigDatabase =
  Boolean(configFirestoreDatabaseId) && configFirestoreDatabaseId !== '(default)';
const isUnsafeDefaultOverride =
  envFirestoreDatabaseId === '(default)' && hasNamedConfigDatabase;

if (isUnsafeDefaultOverride) {
  console.warn(
    'Ignoring VITE_FIRESTORE_DATABASE_ID=(default) because firebase-applet-config.json defines a named Firestore database. Remove the override or set the correct database ID.'
  );
}

const firestoreDatabaseId = isUnsafeDefaultOverride
  ? configFirestoreDatabaseId
  : envFirestoreDatabaseId ?? configFirestoreDatabaseId;

export const db = firestoreDatabaseId
  ? getFirestore(app, firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
