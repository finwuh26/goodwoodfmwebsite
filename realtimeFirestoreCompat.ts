import {
  ref as dbRef,
  get,
  set,
  update,
  remove,
  push,
  onValue,
  type Database,
  type Unsubscribe,
} from 'firebase/database';

type Primitive = string | number | boolean | null;

type PlainObject = Record<string, any>;

type FieldValueSentinel =
  | { __op: 'serverTimestamp' }
  | { __op: 'increment'; amount: number }
  | { __op: 'arrayUnion'; values: any[] }
  | { __op: 'arrayRemove'; values: any[] };

export type WhereFilterOp = '==' | 'in';

interface WhereConstraint {
  type: 'where';
  fieldPath: string;
  op: WhereFilterOp;
  value: any;
}

interface OrderByConstraint {
  type: 'orderBy';
  fieldPath: string;
  direction: 'asc' | 'desc';
}

interface LimitConstraint {
  type: 'limit';
  count: number;
}

type QueryConstraint = WhereConstraint | OrderByConstraint | LimitConstraint;

interface BaseRef {
  db: Database;
  path: string;
}

export interface DocumentReference extends BaseRef {
  kind: 'document';
  id: string;
}

export interface CollectionReference extends BaseRef {
  kind: 'collection';
}

export interface QueryReference extends BaseRef {
  kind: 'query';
  constraints: QueryConstraint[];
}

export class Timestamp {
  seconds: number;
  nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static now(): Timestamp {
    return Timestamp.fromMillis(Date.now());
  }

  static fromDate(date: Date): Timestamp {
    return Timestamp.fromMillis(date.getTime());
  }

  static fromMillis(milliseconds: number): Timestamp {
    const seconds = Math.floor(milliseconds / 1000);
    const nanoseconds = Math.floor((milliseconds - seconds * 1000) * 1_000_000);
    return new Timestamp(seconds, nanoseconds);
  }

  toDate(): Date {
    return new Date(this.toMillis());
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1_000_000);
  }

  toJSON(): string {
    return this.toDate().toJSON();
  }

  isEqual(other: Timestamp): boolean {
    return this.seconds === other.seconds && this.nanoseconds === other.nanoseconds;
  }
}

interface SnapshotMetadata {
  fromCache: boolean;
}

export interface DocumentSnapshot<T = any> {
  id: string;
  ref: DocumentReference;
  metadata: SnapshotMetadata;
  exists: () => boolean;
  data: () => T | undefined;
}

export interface QueryDocumentSnapshot<T = any> {
  id: string;
  ref: DocumentReference;
  data: () => T;
}

export interface QuerySnapshot<T = any> {
  docs: QueryDocumentSnapshot<T>[];
  empty: boolean;
  size: number;
}

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Timestamp);

const pathJoin = (...parts: string[]): string =>
  parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/');

const getByPath = (obj: any, dottedPath: string): any => {
  const segments = dottedPath.split('.');
  let current = obj;
  for (const segment of segments) {
    if (current == null) return undefined;
    current = current[segment];
  }
  return current;
};

const setByPath = (obj: any, dottedPath: string, value: any): any => {
  const segments = dottedPath.split('.');
  const clone = isPlainObject(obj) ? { ...obj } : {};
  let cursor: any = clone;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const next = cursor[segment];
    cursor[segment] = isPlainObject(next) ? { ...next } : {};
    cursor = cursor[segment];
  }
  cursor[segments[segments.length - 1]] = value;
  return clone;
};

const normalizeTimestampCandidate = (value: any): any => {
  if (value instanceof Timestamp) return value;
  if (isPlainObject(value) && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
    return new Timestamp(value.seconds, value.nanoseconds);
  }
  return value;
};

const normalizeData = <T = any>(value: any): T => {
  const normalized = normalizeTimestampCandidate(value);

  if (Array.isArray(normalized)) {
    return normalized.map((item) => normalizeData(item)) as T;
  }
  if (isPlainObject(normalized)) {
    const result: Record<string, any> = {};
    Object.entries(normalized).forEach(([key, item]) => {
      result[key] = normalizeData(item);
    });
    return result as T;
  }
  return normalized as T;
};

const deepEqual = (a: any, b: any): boolean => JSON.stringify(a) === JSON.stringify(b);

const applySentinel = (value: any, currentValue: any): any => {
  if (!isPlainObject(value) || !('__op' in value)) {
    return normalizeData(value);
  }

  const sentinel = value as FieldValueSentinel;

  switch (sentinel.__op) {
    case 'serverTimestamp':
      return Timestamp.now();
    case 'increment': {
      const base = typeof currentValue === 'number' ? currentValue : 0;
      return base + sentinel.amount;
    }
    case 'arrayUnion': {
      const base = Array.isArray(currentValue) ? [...currentValue] : [];
      sentinel.values.forEach((entry) => {
        if (!base.some((existing) => deepEqual(existing, entry))) {
          base.push(normalizeData(entry));
        }
      });
      return base;
    }
    case 'arrayRemove': {
      const base = Array.isArray(currentValue) ? [...currentValue] : [];
      return base.filter((existing) => !sentinel.values.some((entry) => deepEqual(existing, entry)));
    }
    default:
      return normalizeData(value);
  }
};

const applyWriteValue = (value: any, currentValue: any): any => {
  if (Array.isArray(value)) {
    return value.map((entry) => applyWriteValue(entry, undefined));
  }
  if (isPlainObject(value) && '__op' in value) {
    return applySentinel(value, currentValue);
  }
  if (isPlainObject(value)) {
    const next: Record<string, any> = {};
    Object.entries(value).forEach(([key, entry]) => {
      next[key] = applyWriteValue(entry, currentValue?.[key]);
    });
    return next;
  }
  return normalizeData(value);
};

const compareValues = (a: any, b: any): number => {
  const normalize = (value: any): Primitive => {
    const normalized = normalizeTimestampCandidate(value);
    if (normalized instanceof Timestamp) return normalized.toMillis();
    if (normalized instanceof Date) return normalized.getTime();
    if (normalized == null) return null;
    if (typeof normalized === 'string' || typeof normalized === 'number' || typeof normalized === 'boolean') {
      return normalized;
    }
    return JSON.stringify(normalized);
  };

  const aValue = normalize(a);
  const bValue = normalize(b);

  if (aValue === bValue) return 0;
  if (aValue === null) return -1;
  if (bValue === null) return 1;
  return aValue < bValue ? -1 : 1;
};

const resolveRefPath = (basePath: string, segments: string[]): string => pathJoin(basePath, ...segments);

export const collection = (db: Database, ...segments: string[]): CollectionReference => {
  const path = pathJoin(...segments);
  return { kind: 'collection', db, path };
};

export const doc = (
  dbOrRef: Database | CollectionReference | DocumentReference,
  ...segments: string[]
): DocumentReference => {
  if ('kind' in dbOrRef) {
    const path = resolveRefPath(dbOrRef.path, segments);
    const id = path.split('/').pop() || '';
    return { kind: 'document', db: dbOrRef.db, path, id };
  }

  const path = pathJoin(...segments);
  const id = path.split('/').pop() || '';
  return { kind: 'document', db: dbOrRef, path, id };
};

export const where = (fieldPath: string, op: WhereFilterOp, value: any): WhereConstraint => ({
  type: 'where',
  fieldPath,
  op,
  value,
});

export const orderBy = (fieldPath: string, direction: 'asc' | 'desc' = 'asc'): OrderByConstraint => ({
  type: 'orderBy',
  fieldPath,
  direction,
});

export const limit = (count: number): LimitConstraint => ({
  type: 'limit',
  count,
});

export const query = (base: CollectionReference | QueryReference, ...constraints: QueryConstraint[]): QueryReference => {
  const baseConstraints = base.kind === 'query' ? base.constraints : [];
  return {
    kind: 'query',
    db: base.db,
    path: base.path,
    constraints: [...baseConstraints, ...constraints],
  };
};

const toDocEntries = (path: string, value: any): [string, any][] => {
  if (value == null) return [];
  if (!isPlainObject(value)) return [];
  return Object.entries(value).map(([id, docData]) => [id, normalizeData(docData)]);
};

const applyConstraints = (docs: Array<{ id: string; data: any }>, constraints: QueryConstraint[]) => {
  let next = [...docs];

  constraints.forEach((constraint) => {
    if (constraint.type === 'where') {
      if (constraint.op === '==') {
        next = next.filter((docEntry) => deepEqual(getByPath(docEntry.data, constraint.fieldPath), constraint.value));
      } else if (constraint.op === 'in') {
        const expected = Array.isArray(constraint.value) ? constraint.value : [];
        next = next.filter((docEntry) =>
          expected.some((candidate) => deepEqual(getByPath(docEntry.data, constraint.fieldPath), candidate))
        );
      }
    }
  });

  const orderConstraints = constraints.filter((constraint): constraint is OrderByConstraint => constraint.type === 'orderBy');
  if (orderConstraints.length > 0) {
    next.sort((a, b) => {
      for (const order of orderConstraints) {
        const directionFactor = order.direction === 'desc' ? -1 : 1;
        const comparison = compareValues(getByPath(a.data, order.fieldPath), getByPath(b.data, order.fieldPath));
        if (comparison !== 0) return comparison * directionFactor;
      }
      return 0;
    });
  }

  const limitConstraint = constraints.find((constraint): constraint is LimitConstraint => constraint.type === 'limit');
  if (limitConstraint) {
    next = next.slice(0, Math.max(0, limitConstraint.count));
  }

  return next;
};

const toQuerySnapshot = (db: Database, path: string, rawData: any, constraints: QueryConstraint[]): QuerySnapshot => {
  const docs = applyConstraints(
    toDocEntries(path, rawData).map(([id, data]) => ({ id, data })),
    constraints
  ).map(({ id, data }) => ({
    id,
    ref: doc(db, path, id),
    data: () => normalizeData(data),
  }));

  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
  };
};

const toDocumentSnapshot = <T = any>(reference: DocumentReference, rawData: any): DocumentSnapshot<T> => {
  const normalized = rawData == null ? undefined : normalizeData<T>(rawData);

  return {
    id: reference.id,
    ref: reference,
    metadata: { fromCache: false },
    exists: () => normalized !== undefined,
    data: () => normalized,
  };
};

export const getDoc = async <T = any>(reference: DocumentReference): Promise<DocumentSnapshot<T>> => {
  const snapshot = await get(dbRef(reference.db, reference.path));
  return toDocumentSnapshot<T>(reference, snapshot.val());
};

export const getDocs = async <T = any>(reference: CollectionReference | QueryReference): Promise<QuerySnapshot<T>> => {
  const snapshot = await get(dbRef(reference.db, reference.path));
  const constraints = reference.kind === 'query' ? reference.constraints : [];
  return toQuerySnapshot(reference.db, reference.path, snapshot.val(), constraints);
};

export const addDoc = async (reference: CollectionReference, value: any): Promise<DocumentReference> => {
  const newRef = push(dbRef(reference.db, reference.path));
  const id = newRef.key;
  if (!id) throw new Error(`Unable to generate key for path "${reference.path}"`);
  await set(newRef, applyWriteValue(value, undefined));
  return doc(reference.db, reference.path, id);
};

export const setDoc = async (
  reference: DocumentReference,
  value: any,
  options?: { merge?: boolean }
): Promise<void> => {
  const nodeRef = dbRef(reference.db, reference.path);

  if (options?.merge) {
    const currentSnapshot = await get(nodeRef);
    const currentData = normalizeData(currentSnapshot.val() ?? {});
    const writeData = applyWriteValue(value, currentData);
    const merged = { ...(isPlainObject(currentData) ? currentData : {}), ...(isPlainObject(writeData) ? writeData : {}) };
    await set(nodeRef, merged);
    return;
  }

  await set(nodeRef, applyWriteValue(value, undefined));
};

export const updateDoc = async (reference: DocumentReference, value: Record<string, any>): Promise<void> => {
  const nodeRef = dbRef(reference.db, reference.path);
  const currentSnapshot = await get(nodeRef);
  const currentData = normalizeData(currentSnapshot.val() ?? {});

  const updates: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    const currentValue = getByPath(currentData, key);
    updates[key.replaceAll('.', '/')] = applyWriteValue(entry, currentValue);
  });

  await update(nodeRef, updates);
};

export const deleteDoc = async (reference: DocumentReference): Promise<void> => {
  await remove(dbRef(reference.db, reference.path));
};

export const onSnapshot = (
  reference: DocumentReference | CollectionReference | QueryReference,
  onNext: (snapshot: any) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  return onValue(
    dbRef(reference.db, reference.path),
    (snapshot) => {
      try {
        if (reference.kind === 'document') {
          onNext(toDocumentSnapshot(reference, snapshot.val()));
        } else {
          const constraints = reference.kind === 'query' ? reference.constraints : [];
          onNext(toQuerySnapshot(reference.db, reference.path, snapshot.val(), constraints));
        }
      } catch (error) {
        onError?.(error as Error);
      }
    },
    (error) => {
      onError?.(error as Error);
    }
  );
};

export const serverTimestamp = (): FieldValueSentinel => ({ __op: 'serverTimestamp' });
export const increment = (amount: number): FieldValueSentinel => ({ __op: 'increment', amount });
export const arrayUnion = (...values: any[]): FieldValueSentinel => ({ __op: 'arrayUnion', values });
export const arrayRemove = (...values: any[]): FieldValueSentinel => ({ __op: 'arrayRemove', values });

export const runTransaction = async <T>(
  _db: Database,
  updateFunction: (transaction: {
    get: (reference: DocumentReference) => Promise<DocumentSnapshot>;
    update: (reference: DocumentReference, data: Record<string, any>) => void;
  }) => Promise<T> | T
): Promise<T> => {
  const pendingUpdates: Array<{ reference: DocumentReference; data: Record<string, any> }> = [];

  const transaction = {
    get: (reference: DocumentReference) => getDoc(reference),
    update: (reference: DocumentReference, data: Record<string, any>) => {
      pendingUpdates.push({ reference, data });
    },
  };

  const result = await updateFunction(transaction);

  for (const op of pendingUpdates) {
    await updateDoc(op.reference, op.data);
  }

  return result;
};

export const writeBatch = (_db: Database) => {
  const operations: Array<() => Promise<void>> = [];

  return {
    set(reference: DocumentReference, data: any, options?: { merge?: boolean }) {
      operations.push(() => setDoc(reference, data, options));
      return this;
    },
    update(reference: DocumentReference, data: Record<string, any>) {
      operations.push(() => updateDoc(reference, data));
      return this;
    },
    delete(reference: DocumentReference) {
      operations.push(() => deleteDoc(reference));
      return this;
    },
    async commit() {
      for (const execute of operations) {
        await execute();
      }
    },
  };
};
