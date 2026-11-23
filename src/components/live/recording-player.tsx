"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Film } from "lucide-react";
import { cn, formatBytes, formatClock, safeExternalUrl } from "@/lib/utils";
import type { RecordingPart } from "@/types";

/**
 * Plays a class recording made of sequential WebM parts, advancing to the
 * next part automatically.
 */
export function RecordingPlayer({ parts, title }: { parts: RecordingPart[]; title: string }) {
  const sorted = [...parts].sort((a, b) => a.startedAt - b.startedAt);
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const current = sorted[Math.min(index, sorted.length - 1)];
  const total = sorted.reduce((s, p) => s + (p.seconds || 0), 0);
  const src = safeExternalUrl(current?.url);

  // Recorder-made WebM files report an unknown duration until fully scanned.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let fixing = false;
    const onMeta = () => {
      if (!Number.isFinite(v.duration) && !fixing) {
        fixing = true;
        const restore = () => {
          if (!Number.isFinite(v.duration)) return;
          v.removeEventListener("durationchange", restore);
          v.currentTime = 0;
          if (autoplay) void v.play().catch(() => undefined);
        };
        v.addEventListener("durationchange", restore);
        v.currentTime = 1e101;
      } else if (autoplay) {
        void v.play().catch(() => undefined);
      }
    };
    v.addEventListener("loadedmetadata", onMeta);
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [src, autoplay]);

  if (!current || !src) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-card">
      <div className="relative aspect-video bg-black">
        <video
          key={src}
          ref={ref}
          src={src}
          controls
          playsInline
          preload="metadata"
          title={`${title} — recording part ${index + 1}`}
          className="absolute inset-0 size-full"
          onEnded={() => {
            if (index < sorted.length - 1) {
              setAutoplay(true);
              setIndex(index + 1);
            }
          }}
        >
          <track kind="captions" />
        </video>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="mr-auto inline-flex items-center gap-2 text-sm font-medium text-slate-800">
          <Film className="size-4 text-slate-400" /> Class recording · {formatClock(total)}
        </span>
        {sorted.length > 1 &&
          sorted.map((p, i) => (
            <button
              key={p.path}
              type="button"
              onClick={() => {
                setAutoplay(true);
                setIndex(i);
              }}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition",
                i === index ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              Part {i + 1} · {formatClock(p.seconds)}
            </button>
          ))}
        <a
          href={src}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          title={`Download part ${index + 1} (${formatBytes(current.size)})`}
        >
          <Download className="size-3.5" /> Download
        </a>
      </div>
    </div>
  );
}
