"use client";

import { useEffect, useMemo, useState } from "react";
import {
  onSnapshot,
  type DocumentReference,
  type DocumentSnapshot,
  type FirestoreError,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import type { WithId } from "@/types";

interface Result<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

/**
 * Optimistic local writes can surface a document (e.g. a just-created course)
 * before the server has committed it. Dependent listeners started in that
 * window are rejected by security rules, so `permission-denied` is retried a
 * few times with backoff before being treated as a real denial.
 */
const MAX_RETRIES = 3;
function shouldRetry(error: FirestoreError, attempt: number) {
  return error.code === "permission-denied" && attempt < MAX_RETRIES;
}
function retryDelay(attempt: number) {
  return 600 * 2 ** attempt;
}

function fromDoc<T>(snap: QueryDocumentSnapshot | DocumentSnapshot): WithId<T> {
  // "estimate" avoids null timestamps for pending local writes.
  return { id: snap.id, ...(snap.data({ serverTimestamps: "estimate" }) as T) };
}

/**
 * Subscribe to several queries and merge their results. Pass a memoised
 * array (or null to skip). State is keyed by the input so stale results from
 * a previous input are never returned.
 */
export function useQueries<T>(queries: Query[] | null): Result<WithId<T>[]> {
  const [state, setState] = useState<{
    key: Query[] | null;
    results: (WithId<T>[] | undefined)[];
    error: Error | null;
  }>({ key: null, results: [], error: null });

  useEffect(() => {
    if (!queries || queries.length === 0) return;
    const unsubs: (() => void)[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    const subscribe = (q: Query, index: number, attempt: number) => {
      unsubs[index] = onSnapshot(
        q,
        (snap) => {
          const docs = snap.docs.map((d) => fromDoc<T>(d));
          setState((prev) => {
            const results = prev.key === queries ? [...prev.results] : new Array(queries.length).fill(undefined);
            results[index] = docs;
            return { key: queries, results, error: prev.key === queries ? prev.error : null };
          });
        },
        (error) => {
          if (shouldRetry(error, attempt)) {
            timers.push(setTimeout(() => subscribe(q, index, attempt + 1), retryDelay(attempt)));
            return;
          }
          if (process.env.NODE_ENV !== "production") console.error("Query failed", error);
          setState((prev) => {
            const results = prev.key === queries ? [...prev.results] : new Array(queries.length).fill(undefined);
            results[index] = [];
            return { key: queries, results, error };
          });
        },
      );
    };

    queries.forEach((q, index) => subscribe(q, index, 0));
    return () => {
      timers.forEach(clearTimeout);
      unsubs.forEach((u) => u?.());
    };
  }, [queries]);

  return useMemo(() => {
    if (!queries) return { data: [], loading: true, error: null };
    if (queries.length === 0) return { data: [], loading: false, error: null };
    const current = state.key === queries;
    const loading = !current || state.results.length !== queries.length || state.results.some((r) => r === undefined);
    const data = current ? state.results.flatMap((r) => r ?? []) : [];
    return { data, loading, error: current ? state.error : null };
  }, [queries, state]);
}

/** Subscribe to a single query. Pass a memoised query (or null to skip). */
export function useCollection<T>(q: Query | null): Result<WithId<T>[]> {
  const queries = useMemo(() => (q ? [q] : null), [q]);
  return useQueries<T>(queries);
}

/** Subscribe to several documents (missing docs are omitted). */
export function useDocuments<T>(docRefs: DocumentReference[] | null): Result<WithId<T>[]> {
  const [state, setState] = useState<{
    key: DocumentReference[] | null;
    results: (WithId<T> | null | undefined)[];
    error: Error | null;
  }>({ key: null, results: [], error: null });

  useEffect(() => {
    if (!docRefs || docRefs.length === 0) return;
    const unsubs: (() => void)[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    const subscribe = (ref: DocumentReference, index: number, attempt: number) => {
      unsubs[index] = onSnapshot(
        ref,
        (snap) =>
          setState((prev) => {
            const results = prev.key === docRefs ? [...prev.results] : new Array(docRefs.length).fill(undefined);
            results[index] = snap.exists() ? fromDoc<T>(snap) : null;
            return { key: docRefs, results, error: prev.key === docRefs ? prev.error : null };
          }),
        (error) => {
          if (shouldRetry(error, attempt)) {
            timers.push(setTimeout(() => subscribe(ref, index, attempt + 1), retryDelay(attempt)));
            return;
          }
          setState((prev) => {
            const results = prev.key === docRefs ? [...prev.results] : new Array(docRefs.length).fill(undefined);
            results[index] = null;
            return { key: docRefs, results, error };
          });
        },
      );
    };

    docRefs.forEach((ref, index) => subscribe(ref, index, 0));
    return () => {
      timers.forEach(clearTimeout);
      unsubs.forEach((u) => u?.());
    };
  }, [docRefs]);

  return useMemo(() => {
    if (!docRefs) return { data: [], loading: true, error: null };
    if (docRefs.length === 0) return { data: [], loading: false, error: null };
    const current = state.key === docRefs;
    const loading = !current || state.results.some((r) => r === undefined);
    const data = current ? (state.results.filter(Boolean) as WithId<T>[]) : [];
    return { data, loading, error: current ? state.error : null };
  }, [docRefs, state]);
}

/** Subscribe to a single document. Pass a memoised ref (or null to skip). */
export function useDocument<T>(ref: DocumentReference | null): Result<WithId<T> | null> {
  const refsArr = useMemo(() => (ref ? [ref] : null), [ref]);
  const { data, loading, error } = useDocuments<T>(refsArr);
  return { data: data[0] ?? null, loading, error };
}
