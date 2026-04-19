import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

const FALLBACK_FIRESTORE_DATABASE_ID = 'radio';

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
const selectedFirestoreDatabaseId =
  envFirestoreDatabaseId ?? configFirestoreDatabaseId ?? FALLBACK_FIRESTORE_DATABASE_ID;
const firestoreDatabaseId = isAiStudioDatabaseId(selectedFirestoreDatabaseId)
  ? FALLBACK_FIRESTORE_DATABASE_ID
  : selectedFirestoreDatabaseId;

if (isAiStudioDatabaseId(selectedFirestoreDatabaseId)) {
  console.warn(
    `Ignoring AI Studio Firestore database ID "${selectedFirestoreDatabaseId}" and using "${FALLBACK_FIRESTORE_DATABASE_ID}" instead.`
  );
}

export const db = getFirestore(app, firestoreDatabaseId);
export const realtimeDb = getDatabase(app);
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
