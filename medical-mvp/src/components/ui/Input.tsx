import { cn } from "@/lib/utils";
import React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-sm text-foreground outline-none transition-all duration-300 placeholder:text-slate-400 ring-offset-2 focus-visible:border-primary-400 focus-visible:ring-2 focus-visible:ring-primary/60",
        className
      )}
      {...props}
    />
  );
}
