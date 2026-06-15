"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";

// 주요 종목 이름 → 종목코드 (검색 편의용). 코드 직접 입력도 지원.
const STOCKS: { name: string; code: string }[] = [
  { name: "삼성전자", code: "005930" },
  { name: "SK하이닉스", code: "000660" },
  { name: "LG에너지솔루션", code: "373220" },
  { name: "삼성바이오로직스", code: "207940" },
  { name: "현대차", code: "005380" },
  { name: "기아", code: "000270" },
  { name: "셀트리온", code: "068270" },
  { name: "NAVER", code: "035420" },
  { name: "카카오", code: "035720" },
  { name: "POSCO홀딩스", code: "005490" },
  { name: "LG화학", code: "051910" },
  { name: "삼성SDI", code: "006400" },
  { name: "현대모비스", code: "012330" },
  { name: "KB금융", code: "105560" },
  { name: "신한지주", code: "055550" },
  { name: "삼성물산", code: "028260" },
  { name: "SK이노베이션", code: "096770" },
  { name: "한화에어로스페이스", code: "012450" },
  { name: "HD현대중공업", code: "329180" },
  { name: "두산에너빌리티", code: "034020" },
];

// 분석 데이터가 이미 있는 종목 (있으면 바로 열림)
const READY = new Set(["005930"]);

export function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const t = q.trim();
    if (!t) return [];
    return STOCKS.filter(
      (s) => s.name.toLowerCase().includes(t.toLowerCase()) || s.code.includes(t)
    ).slice(0, 6);
  }, [q]);

  function go(code: string) {
    setOpen(false);
    setNotice(null);
    if (!READY.has(code)) {
      setNotice(`해당 종목은 아직 분석 데이터가 없습니다. (현재 삼성전자만 제공)`);
      return;
    }
    router.push(`/ticker/${code}`);
  }

  function submit() {
    const t = q.trim();
    if (/^\d{6}$/.test(t)) return go(t);
    if (matches.length > 0) return go(matches[0].code);
    setNotice("종목을 찾을 수 없습니다. 종목명 또는 6자리 코드를 입력하세요.");
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 focus-within:border-gray-500 transition-colors">
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setNotice(null); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          onFocus={() => setOpen(true)}
          placeholder="종목명 또는 종목코드 검색 (예: 삼성전자, 005930)"
          className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
        />
      </div>

      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {matches.map((s) => (
            <li key={s.code}>
              <button
                onMouseDown={(e) => { e.preventDefault(); go(s.code); }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left"
              >
                <span className="text-gray-800">{s.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{s.code}</span>
                  {READY.has(s.code) && (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                      분석완료
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {notice && (
        <p className="absolute z-20 mt-1 w-full text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}
    </div>
  );
}
