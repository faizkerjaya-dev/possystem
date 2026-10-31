import { useEffect, useState, type DependencyList } from 'react';
import { onSnapshot, type DocumentReference, type Query } from 'firebase/firestore';
import { describeError } from '@/lib/errors';
import { log } from '@/lib/logger';

/**
 * Realtime Firestore hooks. Every screen reads data through these two hooks, so loading
 * and error handling look the same everywhere.
 *
 *   const { data, loading, error } = useLiveQuery<Table>(() => query(colRef('tables')), []);
 *
 * `loading` is true until the first snapshot for the CURRENT deps arrives, so a screen never
 * shows data (or "missing") that belongs to the previous deps.
 */
const keyOf = (deps: DependencyList) => JSON.stringify(deps);

export function useLiveQuery<T extends { id: string }>(build: () => Query | null, deps: DependencyList) {
  const key = keyOf(deps);
  const [state, setState] = useState<{ key: string | null; data: T[]; loading: boolean; error: string | null }>({
    key: null,
    data: [],
    loading: true,
    error: null,
  });
  useEffect(() => {
    const q = build();
    if (!q) {
      setState({ key, data: [], loading: false, error: null });
      return;
    }
    return onSnapshot(
      q,
      (snap) => setState({ key, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T), loading: false, error: null }),
      (err) => {
        log.error('live', 'query failed', err);
        const e = describeError(err);
        setState({ key, data: [], loading: false, error: `[${e.code}] ${e.message}` });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const fresh = state.key === key;
  return { data: fresh ? state.data : [], loading: !fresh || state.loading, error: fresh ? state.error : null };
}

export function useLiveDoc<T extends { id: string }>(build: () => DocumentReference | null, deps: DependencyList) {
  const key = keyOf(deps);
  const [state, setState] = useState<{ key: string | null; data: T | null; loading: boolean; error: string | null }>({
    key: null,
    data: null,
    loading: true,
    error: null,
  });
  useEffect(() => {
    const ref = build();
    if (!ref) {
      setState({ key, data: null, loading: false, error: null });
      return;
    }
    return onSnapshot(
      ref,
      (snap) => setState({ key, data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null, loading: false, error: null }),
      (err) => {
        log.error('live', 'doc failed', err);
        const e = describeError(err);
        setState({ key, data: null, loading: false, error: `[${e.code}] ${e.message}` });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const fresh = state.key === key;
  return { data: fresh ? state.data : null, loading: !fresh || state.loading, error: fresh ? state.error : null };
}
