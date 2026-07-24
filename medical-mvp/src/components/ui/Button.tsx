import { cn } from "@/lib/utils";
import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";
  const variants: Record<string, string> = {
    primary:
      "bg-gradient-to-l from-primary-700 to-primary-600 text-primary-foreground shadow-soft hover:from-primary-800 hover:to-primary-700 hover:shadow-soft-lg focus-visible:ring-primary-600",
    secondary:
      "bg-secondary text-secondary-foreground shadow-sm hover:bg-slate-300 hover:shadow-soft focus-visible:ring-slate-500",
    danger:
      "bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-soft focus-visible:ring-red-600",
    ghost:
      "bg-transparent text-foreground hover:bg-muted focus-visible:ring-slate-400",
  };
  return <button className={cn(base, variants[variant], className)} {...props} />;
}
