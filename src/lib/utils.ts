import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";
import type { Timestamp } from "firebase/firestore";
import type { LiveSession, LiveStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type DateLike = Timestamp | Date | null | undefined;

export function toDate(value: DateLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  return typeof value.toDate === "function" ? value.toDate() : null;
}

export function formatDate(value: DateLike, pattern = "MMM d, yyyy"): string {
  const d = toDate(value);
  return d ? format(d, pattern) : "—";
}

export function formatDateTime(value: DateLike): string {
  const d = toDate(value);
  if (!d) return "—";
  if (isToday(d)) return `Today, ${format(d, "h:mm a")}`;
  if (isTomorrow(d)) return `Tomorrow, ${format(d, "h:mm a")}`;
  return format(d, "MMM d, h:mm a");
}

export function timeAgo(value: DateLike): string {
  const d = toDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : "just now";
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatMinutes(total: number): string {
  if (!total) return "0m";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function liveStatus(
  session: Pick<LiveSession, "startAt" | "durationMinutes"> & { endedAt?: LiveSession["endedAt"] },
  now: number,
): LiveStatus {
  if (session.endedAt) return "ended";
  const start = toDate(session.startAt)?.getTime() ?? 0;
  const end = start + session.durationMinutes * 60_000;
  if (now < start) return "upcoming";
  if (now <= end) return "live";
  return "ended";
}

/** Only allow http(s) URLs for user-supplied links (prevents javascript: XSS). */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** Convert YouTube / Vimeo watch links to privacy-friendly embed URLs. */
export function toEmbedUrl(url: string): { kind: "embed" | "file"; src: string } | null {
  const safe = safeExternalUrl(url);
  if (!safe) return null;
  const u = new URL(safe);
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = u.searchParams.get("v") ?? u.pathname.split("/embed/")[1];
    if (id) return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0` };
  }
  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    if (id) return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0` };
  }
  if (host === "vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) return { kind: "embed", src: `https://player.vimeo.com/video/${id}` };
  }
  if (host === "player.vimeo.com" || host === "youtube-nocookie.com") return { kind: "embed", src: safe };
  return { kind: "file", src: safe };
}

export type VideoSource =
  | { kind: "youtube"; id: string }
  | { kind: "vimeo"; url: string }
  | { kind: "file"; src: string };

/** Classify a lesson video URL for the tracked player. */
export function parseVideoSource(url: string | null | undefined): VideoSource | null {
  const safe = safeExternalUrl(url);
  if (!safe) return null;
  const u = new URL(safe);
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = u.searchParams.get("v") ?? u.pathname.split("/embed/")[1]?.split("/")[0];
    if (id && /^[\w-]{6,20}$/.test(id)) return { kind: "youtube", id };
  }
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    if (id && /^[\w-]{6,20}$/.test(id)) return { kind: "youtube", id };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") return { kind: "vimeo", url: safe };
  return { kind: "file", src: safe };
}

/** 125 → "2:05", 3725 → "1:02:05" */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Sanitise a filename for storage paths. */
export function safeFileName(name: string): string {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_");
  return cleaned.slice(-120) || "file";
}

const HONORIFICS = /^(eng|dr|prof|mr|mrs|ms|miss|rev|sir)\.?$/i;

/** "Dr. Jane Smith" → "Jane" (skips honorifics). */
export function firstName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.find((p) => !HONORIFICS.test(p)) ?? parts[0] ?? "";
}
