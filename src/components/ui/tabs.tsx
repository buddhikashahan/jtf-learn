"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = RadixTabs.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn("scrollbar-thin flex gap-1 overflow-x-auto border-b border-slate-200", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-slate-500 transition",
        "hover:text-slate-800 data-[state=active]:border-brand-600 data-[state=active]:text-brand-700",
        "[&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof RadixTabs.Content>) {
  return <RadixTabs.Content className={cn("pt-5 focus-visible:outline-none", className)} {...props} />;
}

/** Pill-style segmented control, for compact filters. */
export function SegmentedTabsList({ className, ...props }: React.ComponentProps<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn("inline-flex rounded-lg bg-slate-100 p-1", className)}
      {...props}
    />
  );
}

export function SegmentedTabsTrigger({ className, ...props }: React.ComponentProps<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition",
        "hover:text-slate-900 data-[state=active]:bg-surface data-[state=active]:text-slate-900 data-[state=active]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
