import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Allow overriding the Firestore database via an env variable so a persistent
// production database (set in Vercel environment settings) is used instead of
// AI Studio temporary databases.
const normalizeFirestoreDatabaseId = (databaseId?: string): string | undefined => {
  const trimmedDatabaseId = databaseId?.trim();
  return trimmedDatabaseId && trimmedDatabaseId.length > 0
    ? trimmedDatabaseId
    : undefined;
};

const isAiStudioDatabaseId = (databaseId?: string) =>
  Boolean(databaseId && /^ai-studio-/i.test(databaseId));

const envFirestoreDatabaseId = normalizeFirestoreDatabaseId(import.meta.env.VITE_FIRESTORE_DATABASE_ID);
const configFirestoreDatabaseId = normalizeFirestoreDatabaseId(firebaseConfig.firestoreDatabaseId);
const shouldIgnoreConfigDatabase =
  !envFirestoreDatabaseId && isAiStudioDatabaseId(configFirestoreDatabaseId);

if (shouldIgnoreConfigDatabase) {
  console.warn(
    'Ignoring firebase-applet-config.json Firestore database because it points to an AI Studio temporary database. Set VITE_FIRESTORE_DATABASE_ID to force a specific Firestore database.'
  );
}

let firestoreDatabaseId = envFirestoreDatabaseId;

if (!firestoreDatabaseId && !shouldIgnoreConfigDatabase) {
  firestoreDatabaseId = configFirestoreDatabaseId;
}

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
