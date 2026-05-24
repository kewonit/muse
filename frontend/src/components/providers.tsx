"use client";

import { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { ThemeToggle } from "@/components/theme-toggle";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
    >
      {children}
      <ThemeToggle />
    </MotionConfig>
  );
}
