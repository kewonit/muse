"use client";

import { useEffect, useState } from "react";
import type { SVGProps } from "react";
import { Moon, Sun } from "lucide-react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "muse-theme";
const GITHUB_URL = "https://github.com/kewonit/muse";

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const nextMode: ThemeMode = stored === "light" || stored === "dark" ? stored : "dark";
    applyTheme(nextMode);

    if (nextMode !== "dark") {
      const frameId = window.requestAnimationFrame(() => setMode(nextMode));
      return () => window.cancelAnimationFrame(frameId);
    }
  }, []);

  const toggle = () => {
    const nextMode = mode === "dark" ? "light" : "dark";
    setMode(nextMode);
    window.localStorage.setItem(STORAGE_KEY, nextMode);
    applyTheme(nextMode);
  };

  const Icon = mode === "dark" ? Sun : Moon;
  const label = mode === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <div className="fixed bottom-4 right-4 z-50 inline-flex h-11 items-center overflow-hidden rounded-full border border-border/70 bg-surface/82 text-foreground shadow-[0_16px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:bottom-5 sm:right-5">
      <a
        href={GITHUB_URL}
        aria-label="Open Muse on GitHub"
        title="GitHub"
        target="_blank"
        rel="noreferrer"
        className="grid h-11 w-11 place-items-center transition-colors hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
      >
        <GitHubMark aria-hidden="true" className="h-4 w-4" />
      </a>
      <span aria-hidden="true" className="h-5 w-px bg-border/80" />
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={toggle}
        className="grid h-11 w-11 place-items-center transition-colors hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
}

function GitHubMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
      <path d="M8 0.2a7.9 7.9 0 0 0-2.5 15.4c0.4 0.1 0.5-0.2 0.5-0.4v-1.5c-2.2 0.5-2.7-0.9-2.7-0.9-0.4-0.9-0.9-1.1-0.9-1.1-0.7-0.5 0.1-0.5 0.1-0.5 0.8 0.1 1.2 0.8 1.2 0.8 0.7 1.2 1.9 0.9 2.3 0.7 0.1-0.5 0.3-0.9 0.5-1.1-1.8-0.2-3.6-0.9-3.6-3.9 0-0.9 0.3-1.6 0.8-2.1-0.1-0.2-0.4-1 0.1-2.1 0 0 0.7-0.2 2.2 0.8a7.5 7.5 0 0 1 4 0c1.5-1 2.2-0.8 2.2-0.8 0.4 1.1 0.2 1.9 0.1 2.1 0.5 0.6 0.8 1.3 0.8 2.1 0 3-1.8 3.7-3.6 3.9 0.3 0.3 0.5 0.8 0.5 1.5v2.2c0 0.2 0.2 0.5 0.6 0.4A7.9 7.9 0 0 0 8 0.2Z" />
    </svg>
  );
}
