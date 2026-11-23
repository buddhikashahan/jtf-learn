import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export function Logo({ href = "/", className, compact = false }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)} aria-label={`${siteConfig.name} home`}>
      <span className="theme-light flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
        <GraduationCap className="size-5" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-slate-900">{siteConfig.shortName}</span>
          <span className="text-[11px] text-slate-500">Training Platform</span>
        </span>
      )}
    </Link>
  );
}
