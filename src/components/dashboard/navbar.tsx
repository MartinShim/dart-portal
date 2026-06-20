"use client";

import Link from "next/link";
import { SearchBox } from "@/components/dashboard/search-box";

const NAV = [
  { key: "latest", label: "최신", href: "/" },
  { key: "stocks", label: "종목별", href: "/stocks" },
  { key: "categories", label: "분류기준", href: "/categories" },
] as const;

export function Navbar({ active }: { active?: (typeof NAV)[number]["key"] }) {
  return (
    <header className="bg-white/85 backdrop-blur-xl border-b border-[var(--sam-line)] sticky top-0 z-20">
      <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center gap-8 relative">
        {/* 브랜드 */}
        <Link href="/" className="shrink-0">
          <span className="text-lg font-bold tracking-tight text-[var(--sam-ink)]">
            DART 공시 <span className="text-[var(--sam-blue)]">Portal</span>
          </span>
        </Link>

        {/* 가운데 검색창 */}
        <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-md px-4">
          <SearchBox className="w-full" />
        </div>

        {/* 네비게이션 (검색창 왼쪽) */}
        <nav className="flex items-center gap-1.5">
          {NAV.map((item) => {
            const isActive = active === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`px-4 py-2 rounded-[10px] text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-[var(--sam-blue)] text-white"
                    : "text-[var(--sam-sub)] hover:text-[var(--sam-ink)] hover:bg-[var(--sam-bg)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
