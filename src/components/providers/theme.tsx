"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_STORAGE_KEY as KEY } from "@/lib/theme-script";

export type ThemePreference = "light" | "dark" | "system";
const listeners = new Set<() => void>();


function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme() {
  const pref = readPreference();
  const dark = pref === "dark" || (pref === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

function emit() {
  applyTheme();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onStorage = (e: StorageEvent) => e.key === KEY && emit();
  media.addEventListener("change", emit);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", emit);
    window.removeEventListener("storage", onStorage);
  };
}

export function setThemePreference(pref: ThemePreference) {
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* storage unavailable — still apply for this session */
  }
  emit();
}

/** Current preference + resolved theme. Server snapshot is "system"/light. */
export function useTheme() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as ThemePreference);
  const resolved = useSyncExternalStore(
    subscribe,
    (): "light" | "dark" => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    (): "light" | "dark" => "light",
  );
  return { preference, resolved, setPreference: setThemePreference };
}

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Segmented light / dark / system picker. */
export function ThemePicker({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("inline-flex rounded-lg bg-slate-100 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={preference === o.value}
          onClick={() => setPreference(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
            preference === o.value ? "bg-surface text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
          )}
        >
          <o.icon className="size-4" /> {o.label}
        </button>
      ))}
    </div>
  );
}

/** Compact icon button that flips between light and dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setPreference } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={cn("rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800", className)}
    >
      {resolved === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
