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
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
      <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center gap-8">
        {/* 브랜드 */}
        <Link href="/" className="shrink-0">
          <span className="text-lg font-bold text-gray-900 tracking-tight">
            DART 공시 <span className="text-blue-600">Portal</span>
          </span>
        </Link>

        {/* 네비게이션 */}
        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const isActive = active === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* 검색 */}
        <SearchBox className="ml-auto w-full max-w-xs" />
      </div>
    </header>
  );
}
