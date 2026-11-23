"use client";

import * as RadixSwitch from "@radix-ui/react-switch";
import { useId } from "react";
import { cn } from "@/lib/utils";

export function Switch({
  label,
  description,
  className,
  ...props
}: React.ComponentProps<typeof RadixSwitch.Root> & { label: string; description?: string }) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      <RadixSwitch.Root
        id={id}
        className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full bg-slate-200 transition data-[state=checked]:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      >
        <RadixSwitch.Thumb className="pointer-events-none m-0.5 block size-5 rounded-full bg-surface shadow transition-transform data-[state=checked]:translate-x-5" />
      </RadixSwitch.Root>
    </div>
  );
}
