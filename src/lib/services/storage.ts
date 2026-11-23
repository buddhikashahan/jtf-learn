import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { firebaseStorage } from "@/lib/firebase/client";
import { safeFileName } from "@/lib/utils";

export interface UploadResult {
  url: string;
  path: string;
  name: string;
  size: number;
}

export function buildPath(dir: string, file: File): string {
  return `${dir}/${Date.now()}-${safeFileName(file.name)}`;
}

/** Upload a file with progress reporting (0–100). */
export function uploadFile(
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const storageRef = ref(firebaseStorage(), path);
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: { originalName: file.name.slice(0, 255) },
  });

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({ url, path, name: file.name, size: file.size });
      },
    );
  });
}

/** Storage path of a Firebase download URL (…/o/<encoded path>?alt=media…), or null for other URLs. */
export function storagePathFromUrl(url: string | null | undefined): string | null {
  const match = url ? /^https?:\/\/[^?#]+\/o\/([^?#]+)/.exec(url) : null;
  return match ? decodeURIComponent(match[1]) : null;
}

/** Delete a file we uploaded, given its download URL — only if it lives inside `folder`. */
export async function deleteUploadedUrl(url: string | null | undefined, folder: string) {
  const path = storagePathFromUrl(url);
  if (path?.startsWith(folder.endsWith("/") ? folder : `${folder}/`)) await deleteFile(path);
}

export async function deleteFile(path: string | null | undefined): Promise<void> {
  if (!path) return;
  try {
    await deleteObject(ref(firebaseStorage(), path));
  } catch {
    // Ignore missing files — deletion is best-effort cleanup.
  }
}
