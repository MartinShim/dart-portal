"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchStocks, STOCKS, type Stock } from "@/lib/stock-search";

export function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => searchStocks(q, 7), [q]);

  useEffect(() => setActive(-1), [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // 특정 종목 선택(자동완성 항목 클릭) → 분석완료면 종목 페이지, 아니면 검색결과
  function pick(s: Stock) {
    setOpen(false);
    if (s.ready) {
      setQ("");
      router.push(`/ticker/${s.code}`);
    } else {
      router.push(`/search?q=${encodeURIComponent(s.name)}`);
    }
  }

  // 검색 실행(Enter/아이콘) → 검색 결과 페이지
  function runSearch() {
    const t = q.trim();
    if (!t) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(t)}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    else if (e.key === "Enter") {
      if (active >= 0 && matches[active]) pick(matches[active]); // 항목 선택 상태면 그 종목으로
      else runSearch(); // 아니면 검색 결과 페이지
    } else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 focus-within:border-gray-500 focus-within:ring-2 focus-within:ring-gray-100 transition-colors">
        <button onMouseDown={(e) => { e.preventDefault(); runSearch(); }} className="shrink-0" aria-label="검색">
          <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
        </button>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          placeholder="종목 검색 — 이름·코드·초성 (예: 삼성, ㅅㅅ, 005930)"
          className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
          aria-autocomplete="list"
        />
        {q && (
          <button onMouseDown={(e) => { e.preventDefault(); setQ(""); }} className="text-gray-300 hover:text-gray-500 text-sm shrink-0" aria-label="지우기">✕</button>
        )}
      </div>

      {open && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {matches.map((s, i) => (
            <li key={s.code}>
              <button
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left ${i === active ? "bg-blue-50" : "hover:bg-gray-50"}`}
              >
                <span className="text-gray-800">{s.name}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-400">{s.code}</span>
                  {s.ready ? (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">분석완료</span>
                  ) : (
                    <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">대기</span>
                  )}
                </span>
              </button>
            </li>
          ))}
          <li className="border-t border-gray-100">
            <button
              onMouseDown={(e) => { e.preventDefault(); runSearch(); }}
              className="w-full px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 text-left"
            >
              🔍 “{q.trim()}” 검색 결과 모두 보기
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

export { STOCKS };
