import { cn } from "@/lib/utils";
import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  const variants: Record<string, string> = {
    primary: "bg-primary text-primary-foreground hover:bg-teal-700 focus-visible:ring-teal-600",
    secondary: "bg-secondary text-secondary-foreground hover:bg-slate-300 focus-visible:ring-slate-600",
    danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
    ghost: "bg-transparent hover:bg-muted text-foreground",
  };
  return <button className={cn(base, variants[variant], className)} {...props} />;
}
