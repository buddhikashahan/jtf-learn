"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, VideoOff } from "lucide-react";
import Player from "@vimeo/player";
import { cn, parseVideoSource } from "@/lib/utils";

export interface WatchState {
  position: number;
  maxWatched: number;
  duration: number;
  playing: boolean;
}

export interface TrackedVideoPlayerProps {
  url: string | null | undefined;
  title: string;
  /** Resume point & furthest point previously watched. */
  initial?: { position: number; maxWatched: number } | null;
  /** Authoritative duration (used when the media can't report one). */
  knownDuration?: number;
  /** Block seeking past the furthest point watched. */
  preventSkip?: boolean;
  onUpdate?: (state: WatchState) => void;
  onPause?: (state: WatchState) => void;
  onEnded?: (state: WatchState) => void;
  onDuration?: (seconds: number) => void;
}

const SEEK_TOLERANCE = 2; // seconds of free scrubbing ahead of the watched point
const MAX_RATE = 2;

/**
 * Shared anti-skip bookkeeping. `maxWatched` only grows through continuous
 * playback; any jump beyond it is reported back so the adapter can snap the
 * playhead to the furthest point watched.
 */
function useWatchTracker(props: TrackedVideoPlayerProps) {
  const max = useRef(props.initial?.maxWatched ?? 0);
  const last = useRef(props.initial?.position ?? 0);
  const duration = useRef(props.knownDuration ?? 0);
  const playing = useRef(false);
  const cb = useRef(props);
  const [blocked, setBlocked] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    cb.current = props;
  });
  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const state = (position: number): WatchState => ({
    position,
    maxWatched: max.current,
    duration: duration.current,
    playing: playing.current,
  });

  return {
    blocked,
    setDuration(seconds: number) {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      if (Math.abs(seconds - duration.current) > 0.5) {
        duration.current = seconds;
        cb.current.onDuration?.(seconds);
      }
    },
    /** Returns a position to snap back to when the move is not allowed. */
    tick(position: number): number | null {
      const prevent = cb.current.preventSkip ?? true;
      if (prevent && position > max.current + SEEK_TOLERANCE) {
        setBlocked(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setBlocked(false), 2500);
        last.current = max.current;
        return max.current;
      }
      // Count only small, forward, continuous steps as "watched".
      if (playing.current && position > max.current && position - last.current <= 3) {
        max.current = Math.min(position, duration.current || position);
      } else if (!prevent && position > max.current && position - last.current <= 3) {
        max.current = position;
      }
      last.current = position;
      cb.current.onUpdate?.(state(position));
      return null;
    },
    setPlaying(p: boolean, position: number) {
      playing.current = p;
      if (!p) cb.current.onPause?.(state(position));
    },
    ended(position: number) {
      playing.current = false;
      if (position >= max.current - SEEK_TOLERANCE) max.current = Math.max(max.current, duration.current || position);
      cb.current.onEnded?.(state(position));
    },
    resumeAt(): number {
      const p = cb.current.initial?.position ?? 0;
      const d = duration.current;
      return d && p > d - 5 ? 0 : p;
    },
  };
}

type Tracker = ReturnType<typeof useWatchTracker>;

// ── HTML5 (uploaded files / direct links) ────────────────────────────────────
function Html5Player({ src, title, tracker }: { src: string; title: string; tracker: Tracker }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let fixingDuration = false;
    const reportDuration = () => {
      if (Number.isFinite(v.duration)) tracker.setDuration(v.duration);
      else if (!fixingDuration) {
        // MediaRecorder WebM files report Infinity until fully scanned.
        fixingDuration = true;
        const resume = v.currentTime;
        const onFixed = () => {
          v.removeEventListener("durationchange", onFixed);
          if (Number.isFinite(v.duration)) {
            tracker.setDuration(v.duration);
            v.currentTime = resume;
          }
        };
        v.addEventListener("durationchange", onFixed);
        v.currentTime = 1e101;
      }
    };
    const onLoaded = () => {
      reportDuration();
      const at = tracker.resumeAt();
      if (at > 1) v.currentTime = at;
    };
    const onTime = () => {
      const snap = tracker.tick(v.currentTime);
      if (snap !== null) v.currentTime = snap;
    };
    const onSeeking = () => {
      if (fixingDuration && !Number.isFinite(v.duration)) return;
      const snap = tracker.tick(v.currentTime);
      if (snap !== null) v.currentTime = snap;
    };
    const onPlay = () => tracker.setPlaying(true, v.currentTime);
    const onPause = () => tracker.setPlaying(false, v.currentTime);
    const onEnded = () => tracker.ended(v.currentTime);
    const onRate = () => {
      if (v.playbackRate > MAX_RATE) v.playbackRate = MAX_RATE;
    };
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("durationchange", reportDuration);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeking", onSeeking);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    v.addEventListener("ratechange", onRate);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("durationchange", reportDuration);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeking", onSeeking);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("ratechange", onRate);
      if (!v.paused) tracker.setPlaying(false, v.currentTime);
    };
    // tracker methods are stable for the lifetime of this player instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      title={title}
      controls
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
      preload="metadata"
      playsInline
      className="absolute inset-0 size-full"
      onContextMenu={(e) => e.preventDefault()}
    >
      <track kind="captions" />
    </video>
  );
}

// ── YouTube (IFrame Player API) ──────────────────────────────────────────────
let youTubeApi: Promise<typeof YT> | null = null;
function loadYouTubeApi(): Promise<typeof YT> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  youTubeApi ??= new Promise((resolve) => {
    const w = window as Window & { onYouTubeIframeAPIReady?: () => void };
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
  return youTubeApi;
}

function YouTubePlayer({ id, title, tracker, preventSkip }: { id: string; title: string; tracker: Tracker; preventSkip: boolean }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let player: YT.Player | null = null;
    let poll: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    loadYouTubeApi().then((YTApi) => {
      if (cancelled || !host.current) return;
      const mount = document.createElement("div");
      host.current.appendChild(mount);
      player = new YTApi.Player(mount, {
        host: "https://www.youtube-nocookie.com",
        videoId: id,
        width: "100%",
        height: "100%",
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          disablekb: preventSkip ? 1 : 0,
          start: Math.floor(tracker.resumeAt()),
        },
        events: {
          onReady: (e) => {
            e.target.getIframe().title = title;
            tracker.setDuration(e.target.getDuration());
            poll = setInterval(() => {
              if (!player) return;
              const t = player.getCurrentTime();
              tracker.setDuration(player.getDuration());
              const snap = tracker.tick(t);
              if (snap !== null) player.seekTo(snap, true);
              if (player.getPlaybackRate() > MAX_RATE) player.setPlaybackRate(MAX_RATE);
            }, 500);
          },
          onStateChange: (e) => {
            const t = e.target.getCurrentTime();
            if (e.data === YTApi.PlayerState.PLAYING) tracker.setPlaying(true, t);
            else if (e.data === YTApi.PlayerState.PAUSED) tracker.setPlaying(false, t);
            else if (e.data === YTApi.PlayerState.ENDED) tracker.ended(t);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      try {
        if (player) tracker.setPlaying(false, player.getCurrentTime());
        player?.destroy();
      } catch {
        /* player already gone */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return <div ref={host} className="absolute inset-0 [&_iframe]:size-full" />;
}

// ── Vimeo (Player SDK) ───────────────────────────────────────────────────────
function VimeoPlayer({ url, title, tracker }: { url: string; title: string; tracker: Tracker }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const player = new Player(host.current, { url: url as `https://vimeo.com/${string}`, dnt: true, responsive: false, title: false, byline: false });
    let current = 0;
    player.ready().then(async () => {
      const iframe = host.current?.querySelector("iframe");
      if (iframe) {
        iframe.title = title;
        iframe.className = "absolute inset-0 size-full";
      }
      tracker.setDuration(await player.getDuration());
      const at = tracker.resumeAt();
      if (at > 1) await player.setCurrentTime(at);
    }).catch(() => undefined);
    player.on("timeupdate", (d: { seconds: number; duration: number }) => {
      current = d.seconds;
      tracker.setDuration(d.duration);
      const snap = tracker.tick(d.seconds);
      if (snap !== null) void player.setCurrentTime(snap);
    });
    player.on("seeked", (d: { seconds: number }) => {
      const snap = tracker.tick(d.seconds);
      if (snap !== null) void player.setCurrentTime(snap);
    });
    player.on("play", () => tracker.setPlaying(true, current));
    player.on("pause", () => tracker.setPlaying(false, current));
    player.on("ended", () => tracker.ended(current));
    player.on("playbackratechange", (d: { playbackRate: number }) => {
      if (d.playbackRate > MAX_RATE) void player.setPlaybackRate(MAX_RATE);
    });
    return () => {
      tracker.setPlaying(false, current);
      void player.destroy().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return <div ref={host} className="absolute inset-0" />;
}

// ── Public component ─────────────────────────────────────────────────────────
export function TrackedVideoPlayer(props: TrackedVideoPlayerProps) {
  const source = parseVideoSource(props.url);
  const tracker = useWatchTracker(props);
  const preventSkip = props.preventSkip ?? true;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-elevated">
      {!source ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
          <VideoOff className="size-8" />
          <p className="text-sm">Video not available yet</p>
        </div>
      ) : source.kind === "youtube" ? (
        <YouTubePlayer id={source.id} title={props.title} tracker={tracker} preventSkip={preventSkip} />
      ) : source.kind === "vimeo" ? (
        <VimeoPlayer url={source.url} title={props.title} tracker={tracker} />
      ) : (
        <Html5Player src={source.src} title={props.title} tracker={tracker} />
      )}

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/80 px-4 py-2 text-sm font-medium text-white shadow-lg transition-opacity duration-300",
          tracker.blocked ? "opacity-100" : "opacity-0",
        )}
      >
        <Lock className="size-4" /> Skipping ahead is disabled — keep watching to unlock
      </div>
    </div>
  );
}
