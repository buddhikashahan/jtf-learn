"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as RadixDialog from "@radix-ui/react-dialog";
import {
  BookOpen,
  CalendarPlus,
  ClipboardPlus,
  CornerDownLeft,
  LogOut,
  Moon,
  Plus,
  Search,
  Sun,
} from "lucide-react";
import { useAuth, useProfile } from "@/components/providers/auth-provider";
import { useAccessibleCourses } from "@/hooks/use-lms";
import { useTheme } from "@/components/providers/theme";
import { navFor } from "@/config/site";
import { signOut } from "@/lib/services/auth";

/** Global ⌘K / Ctrl+K command palette: jump to pages, courses and actions. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const profile = useProfile();
  const { isStaff } = useAuth();
  const { courses } = useAccessibleCourses();
  const { resolved, setPreference } = useTheme();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const itemCls =
    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 select-none [&_svg]:size-4 [&_svg]:text-slate-400";
  const groupCls =
    "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-slate-400 [&_[cmdk-group-heading]]:uppercase";

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-elevated data-[state=open]:animate-pop-in"
        >
          <RadixDialog.Title className="sr-only">Command palette</RadixDialog.Title>
          <Command label="Command palette" loop>
            <div className="flex items-center gap-3 border-b border-slate-100 px-4">
              <Search className="size-5 text-slate-400" />
              <Command.Input
                autoFocus
                placeholder="Search courses, pages and actions…"
                className="h-14 w-full bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <kbd className="hidden rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:block">
                ESC
              </kbd>
            </div>
            <Command.List className="scrollbar-thin max-h-[min(60vh,26rem)] overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-sm text-slate-500">No results found.</Command.Empty>

              <Command.Group heading="Go to" className={groupCls}>
                {navFor(profile.role).map((item) => (
                  <Command.Item key={item.href} value={`go ${item.label}`} onSelect={() => go(item.href)} className={itemCls}>
                    <item.icon /> {item.label}
                  </Command.Item>
                ))}
              </Command.Group>

              {courses.length > 0 && (
                <Command.Group heading={isStaff ? "Courses" : "My courses"} className={groupCls}>
                  {courses.slice(0, 20).map((c) => (
                    <Command.Item
                      key={c.id}
                      value={`course ${c.title} ${c.code}`}
                      onSelect={() => go(isStaff ? `/courses/${c.id}/manage` : `/learn/${c.id}`)}
                      className={itemCls}
                    >
                      <BookOpen />
                      <span className="flex-1 truncate">{c.title}</span>
                      {c.code && <span className="font-mono text-[11px] text-slate-400">{c.code}</span>}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              <Command.Group heading="Actions" className={groupCls}>
                {isStaff && (
                  <>
                    <Command.Item value="new course create" onSelect={() => go("/courses?new=1")} className={itemCls}>
                      <Plus /> Create a course
                    </Command.Item>
                    <Command.Item value="new assignment" onSelect={() => go("/assignments?new=1")} className={itemCls}>
                      <ClipboardPlus /> New assignment
                    </Command.Item>
                    <Command.Item value="schedule live class session" onSelect={() => go("/live?new=1")} className={itemCls}>
                      <CalendarPlus /> Schedule a live class
                    </Command.Item>
                  </>
                )}
                {!isStaff && (
                  <Command.Item value="browse catalog courses" onSelect={() => go("/courses?tab=browse")} className={itemCls}>
                    <Search /> Browse the course catalog
                  </Command.Item>
                )}
                <Command.Item
                  value="toggle theme dark light mode"
                  onSelect={() => {
                    setPreference(resolved === "dark" ? "light" : "dark");
                    onOpenChange(false);
                  }}
                  className={itemCls}
                >
                  {resolved === "dark" ? <Sun /> : <Moon />} Switch to {resolved === "dark" ? "light" : "dark"} mode
                </Command.Item>
                <Command.Item
                  value="sign out logout"
                  onSelect={async () => {
                    onOpenChange(false);
                    await signOut();
                    router.replace("/login");
                  }}
                  className={itemCls}
                >
                  <LogOut /> Sign out
                </Command.Item>
              </Command.Group>
            </Command.List>
            <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <CornerDownLeft className="size-3" /> to select
              </span>
              <span>↑↓ to navigate</span>
              <span className="ml-auto">
                <kbd className="font-sans">⌘K</kbd> anywhere
              </span>
            </div>
          </Command>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Topbar button that looks like a search field and opens the palette. */
export function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  const [isMac] = useState(() => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform));
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 transition hover:border-slate-300 hover:bg-surface"
      aria-label="Search (Ctrl+K)"
    >
      <Search className="size-4" />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="rounded border border-slate-200 bg-surface px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
        {isMac ? "⌘" : "Ctrl"} K
      </kbd>
    </button>
  );
}
