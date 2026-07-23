"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type LibrarySearchBarProps = {
  initialQuery?: string;
  categoryId?: string;
};

function buildLibraryHref(query: string, categoryId?: string) {
  const params = new URLSearchParams();
  const trimmed = query.trim();
  if (trimmed) params.set("q", trimmed);
  if (categoryId) params.set("categoryId", categoryId);
  const qs = params.toString();
  return qs ? `/library?${qs}` : "/library";
}

export function LibrarySearchBar({ initialQuery = "", categoryId }: LibrarySearchBarProps) {
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
        router.push(buildLibraryHref(query, categoryId));
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [query, initialQuery, categoryId, router]);

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(() => {
          router.push(buildLibraryHref(query, categoryId));
        });
      }}
    >
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="جستجو در کیس‌ها، نکات آموزشی و استدلال‌ها…"
        aria-label="جستجوی پایگاه دانش"
        className="flex-1"
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? "در حال جستجو…" : "جستجو"}
      </Button>
    </form>
  );
}
