"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { applyTheme, persistTheme, readStoredTheme, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const stored = readStoredTheme();
    setTheme(stored);
    applyTheme(stored);
  }, []);

  const onToggle = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    persistTheme(next);
  };

  const isLight = theme === "light";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-8 w-14 items-center rounded-full border border-border bg-bg-main px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        isLight ? "justify-end bg-primary/20" : "justify-start",
        className
      )}
    >
      <span className="absolute left-2 text-textsub">
        <Moon className="h-3.5 w-3.5" />
      </span>
      <span className="absolute right-2 text-textsub">
        <Sun className="h-3.5 w-3.5" />
      </span>
      <span className="z-[1] flex h-6 w-6 items-center justify-center rounded-full bg-surface shadow-sm">
        {isLight ? <Sun className="h-3.5 w-3.5 text-primary" /> : <Moon className="h-3.5 w-3.5 text-primary" />}
      </span>
    </button>
  );
}
