"use client";
import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

/** Global record search. Submits on Enter; query is URL-encoded. */
const FulltextSearch = () => {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    router.push(`/fulltext-search?q=${encodeURIComponent(q)}`);
    setSearch("");
  };

  return (
    <form role="search" onSubmit={handleSubmit} className="relative w-full max-w-xs sm:w-72">
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="search"
        aria-label="Search records"
        placeholder="Search contacts, companies, deals…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm placeholder:text-muted-foreground transition-colors hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </form>
  );
};

export default FulltextSearch;
