"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none disabled:opacity-50 disabled:pointer-events-none";
    const variants = {
      default: "bg-black text-white hover:gold",
      secondary: "bg-black text-white border border-black/10 hover:border-white",
      outline: "bg-transparent border border-black/20 hover:border-black/60",
    } as const;

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
