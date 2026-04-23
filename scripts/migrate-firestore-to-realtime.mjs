#!/usr/bin/env node
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';

const projectId = process.env.FIREBASE_PROJECT_ID;
const databaseURL = process.env.FIREBASE_DATABASE_URL;
const firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID;
const overwrite = process.argv.includes('--overwrite');

if (!projectId) {
  throw new Error('Missing FIREBASE_PROJECT_ID env var.');
}
if (!databaseURL) {
  throw new Error('Missing FIREBASE_DATABASE_URL env var.');
}

initializeApp({
  credential: applicationDefault(),
  projectId,
  databaseURL,
});

const firestore = firestoreDatabaseId
  ? getFirestore(undefined, firestoreDatabaseId)
  : getFirestore();
const realtimeDb = getDatabase();

const toSerializable = (value) => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Timestamp) {
    return { seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (value instanceof Date) {
    return { seconds: Math.floor(value.getTime() / 1000), nanoseconds: 0 };
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toSerializable(entry));
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) continue;
      out[key] = toSerializable(entry);
    }
    return out;
  }
  return value;
};

const migrateCollection = async (collectionRef, targetPath) => {
  const snapshot = await collectionRef.get();
  console.log(`Migrating ${collectionRef.path} (${snapshot.size} docs) -> ${targetPath}`);

  for (const docSnapshot of snapshot.docs) {
    const docPath = `${targetPath}/${docSnapshot.id}`;
    const docData = toSerializable(docSnapshot.data());
    await realtimeDb.ref(docPath).set(docData);

    const subCollections = await docSnapshot.ref.listCollections();
    for (const subCollection of subCollections) {
      await migrateCollection(subCollection, `${docPath}/${subCollection.id}`);
    }
  }
};

const run = async () => {
  if (overwrite) {
    console.log('Clearing existing Realtime Database root...');
    await realtimeDb.ref('/').set(null);
  }

  const collections = await firestore.listCollections();
  for (const collectionRef of collections) {
    await migrateCollection(collectionRef, collectionRef.id);
  }

  console.log('Firestore to Realtime Database migration complete.');
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
