import { collection, doc, type DocumentSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';

/** Tiny helpers so services read the same way everywhere. */
export const colRef = (name: string) => collection(db, name);
export const docRef = (name: string, id: string) => doc(db, name, id);

export function fromSnap<T extends { id: string }>(snap: DocumentSnapshot): T {
  return { id: snap.id, ...(snap.data() as Omit<T, 'id'>) } as T;
}

/** Removes `id` before writing (the id is the document key, not a field). */
export function withoutId<T extends { id?: string }>(obj: T): Omit<T, 'id'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...rest } = obj;
  return rest;
}
