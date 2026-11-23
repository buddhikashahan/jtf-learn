import { VideoOff } from "lucide-react";
import { toEmbedUrl } from "@/lib/utils";

export function VideoPlayer({ url, title }: { url: string | null | undefined; title: string }) {
  const source = url ? toEmbedUrl(url) : null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-elevated">
      {!source ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
          <VideoOff className="size-8" />
          <p className="text-sm">Video not available yet</p>
        </div>
      ) : source.kind === "embed" ? (
        <iframe
          src={source.src}
          title={title}
          className="absolute inset-0 size-full"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        />
      ) : (
        <video
          key={source.src}
          src={source.src}
          controls
          controlsList="nodownload"
          preload="metadata"
          className="absolute inset-0 size-full"
          onContextMenu={(e) => e.preventDefault()}
        >
          <track kind="captions" />
        </video>
      )}
    </div>
  );
}
