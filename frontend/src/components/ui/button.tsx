"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ComponentProps<typeof BaseButton>;

const variants = {
  primary: "bg-foreground text-background hover:bg-foreground/90",
  secondary: "border border-border bg-surface text-foreground hover:border-foreground",
  ghost: "text-muted hover:text-foreground",
  danger: "bg-danger text-foreground hover:bg-danger/90",
};

const sizes = {
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-6 text-base",
  lg: "h-14 px-8 text-lg",
  icon: "h-10 w-10 px-0 text-base",
};

export function AppButton({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}) {
  return (
    <BaseButton
      {...props}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold transition-[background-color,border-color,color,opacity,transform] focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 disabled:pointer-events-none disabled:opacity-45 data-[pressed]:scale-[0.97]",
        variants[variant],
        sizes[size],
        className
      )}
    />
  );
}
