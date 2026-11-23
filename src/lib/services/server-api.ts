import { firebaseAuth } from "@/lib/firebase/client";

/** POST to one of our /api/* route handlers with the user's Firebase ID token. */
export async function serverApi<T = { ok: true }>(path: string, body: Record<string, unknown>): Promise<T> {
  const user = firebaseAuth().currentUser;
  if (!user) throw new Error("Please sign in again.");
  const res = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

type DeleteKind = "module" | "lesson" | "assignment" | "session" | "enrollment" | "discussion" | "announcement";

/**
 * Delete a record and everything that belongs to it (subcollections, related
 * records and Storage files). Runs on the server — see /api/delete.
 */
export function deleteOnServer(kind: "course", courseId: string): Promise<{ ok: true; files?: number }>;
export function deleteOnServer(kind: DeleteKind, courseId: string, id: string): Promise<{ ok: true; files?: number }>;
export function deleteOnServer(kind: DeleteKind | "course", courseId: string, id?: string) {
  return serverApi<{ ok: true; files?: number }>("delete", { kind, courseId, ...(id ? { id } : {}) });
}
