"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

type SearchBarProps = {
  initialQuery?: string;
  className?: string;
  /** Compact layout for sidebar */
  compact?: boolean;
};

function buildSearchHref(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return "/search";
  const params = new URLSearchParams({ q: trimmed });
  return `/search?${params.toString()}`;
}

export function SearchBar({
  initialQuery = "",
  className,
  compact = false,
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (query.trim() === initialQuery.trim()) return;
      startTransition(() => {
        router.push(buildSearchHref(query));
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [query, initialQuery, router]);

  return (
    <form
      className={cn("relative", className)}
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(() => {
          router.push(buildSearchHref(query));
        });
      }}
      role="search"
    >
      <Search
        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        strokeWidth={2}
        aria-hidden
      />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={
          compact
            ? "جستجوی مفهومی…"
            : "علائم، تشخیص‌ها یا یافته‌های بالینی را جستجو کنید…"
        }
        aria-label="جستجوی مفهومی کیس‌ها"
        className={cn("ps-9", compact && "py-2 text-xs")}
        disabled={isPending}
      />
    </form>
  );
}
