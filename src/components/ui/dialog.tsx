"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" } as const;

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: keyof typeof sizes;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  /** Prevent closing on outside click (e.g. while submitting). */
  dismissible?: boolean;
}

/** Accessible modal dialog (focus trap, Esc to close, aria labelling). */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  footer,
  children,
  dismissible = true,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={(o) => (dismissible || o ? onOpenChange(o) : undefined)}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <RadixDialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col",
            "rounded-2xl bg-surface shadow-elevated focus:outline-none data-[state=open]:animate-zoom-in",
            sizes[size],
          )}
          onInteractOutside={(e) => !dismissible && e.preventDefault()}
          onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
          {...(!description && { "aria-describedby": undefined })}
        >
          <div className={cn("flex items-start justify-between gap-4 px-6 py-4", children && "border-b border-slate-100")}>
            <div>
              <RadixDialog.Title className="text-lg font-semibold text-slate-900">{title}</RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="mt-1 text-sm text-slate-500">{description}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              className="-mr-2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              aria-label="Close"
              disabled={!dismissible}
            >
              <X className="size-5" />
            </RadixDialog.Close>
          </div>
          {/* Header + footer only (e.g. confirmations): no empty body band. */}
          {children && <div className="scrollbar-thin overflow-y-auto px-6 py-5">{children}</div>}
          {footer && (
            <div className={cn("flex flex-col-reverse gap-2 px-6 py-4 sm:flex-row sm:justify-end", children ? "border-t border-slate-100" : "pt-1")}>
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Off-canvas drawer used for the mobile navigation. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-fade-in" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-surface shadow-elevated focus:outline-none data-[state=open]:animate-slide-in-left"
        >
          <RadixDialog.Title className="sr-only">{title}</RadixDialog.Title>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
