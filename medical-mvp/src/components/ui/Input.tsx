import { cn } from "@/lib/utils";
import React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-teal-600",
        className
      )}
      {...props}
    />
  );
}
