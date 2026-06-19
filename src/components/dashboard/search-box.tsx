"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";

type Stock = { name: string; code: string; ready: boolean; aliases?: string[] };

// 분석 완료(데이터 보유) 종목 — 검색 시 우선 노출
const STOCKS: Stock[] = [
  { name: "삼성전자", code: "005930", ready: true },
  { name: "SK하이닉스", code: "000660", ready: true, aliases: ["하이닉스", "sk"] },
  { name: "현대자동차", code: "005380", ready: true, aliases: ["현대차", "현차"] },
  { name: "한미반도체", code: "042700", ready: true, aliases: ["한미"] },
  { name: "NC", code: "036570", ready: true, aliases: ["엔씨소프트", "엔씨", "ncsoft"] },
  { name: "와이지엔터테인먼트", code: "122870", ready: true, aliases: ["YG", "와이지", "와이지엔터", "yg엔터"] },
  { name: "에코프로비엠", code: "247540", ready: true, aliases: ["에코프로", "에코프로bm"] },
  // 분석 대기 (자동완성엔 보이되, 선택 시 안내)
  { name: "LG에너지솔루션", code: "373220", ready: false, aliases: ["엘지엔솔", "lg엔솔"] },
  { name: "삼성바이오로직스", code: "207940", ready: false, aliases: ["삼바"] },
  { name: "기아", code: "000270", ready: false },
  { name: "NAVER", code: "035420", ready: false, aliases: ["네이버"] },
  { name: "카카오", code: "035720", ready: false },
  { name: "LG화학", code: "051910", ready: false },
];

// 한글 초성 추출
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
function toInitials(str: string): string {
  let out = "";
  for (const ch of str) {
    const c = ch.charCodeAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) out += CHO[Math.floor((c - 0xac00) / 588)];
    else out += ch.toLowerCase();
  }
  return out;
}
// 부분 일치(순서 유지·건너뛰기 허용) — "삼전" → 삼성전자
function isSubsequence(q: string, target: string): boolean {
  let i = 0;
  for (const ch of target) {
    if (ch === q[i]) i++;
    if (i === q.length) return true;
  }
  return false;
}

// 종목-쿼리 매칭 점수(낮을수록 우선). null=미일치
function scoreOf(s: Stock, raw: string): number | null {
  const q = raw.toLowerCase().replace(/\s/g, "");
  if (!q) return null;
  const fields = [s.name, ...(s.aliases ?? [])].map((f) => f.toLowerCase());
  let best: number | null = null;
  const consider = (v: number) => { if (best === null || v < best) best = v; };

  if (s.code.includes(q)) consider(q === s.code ? 0 : 1);
  for (const f of fields) {
    if (f === q) consider(0);
    else if (f.startsWith(q)) consider(2);
    else if (f.includes(q)) consider(3);
    else if (isSubsequence(q, f)) consider(5);
    const ini = toInitials(f); // 초성 검색 (ㅅㅅㅈㅈ → 삼성전자)
    if (ini.startsWith(q)) consider(4);
    else if (ini.includes(q)) consider(5);
    else if (isSubsequence(q, ini)) consider(6);
  }
  if (best === null) return null;
  return best - (s.ready ? 0.5 : 0); // 분석완료 우선
}

export function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const t = q.trim();
    if (!t) return [];
    return STOCKS.map((s) => ({ s, score: scoreOf(s, t) }))
      .filter((x) => x.score !== null)
      .sort((a, b) => (a.score as number) - (b.score as number))
      .slice(0, 7)
      .map((x) => x.s);
  }, [q]);

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function go(s: Stock) {
    setOpen(false);
    setNotice(null);
    if (!s.ready) {
      setNotice(`${s.name}은(는) 아직 분석 데이터가 없습니다. (현재 7개 종목 제공)`);
      return;
    }
    setQ("");
    router.push(`/ticker/${s.code}`);
  }

  function submit() {
    const t = q.trim();
    if (/^\d{6}$/.test(t)) {
      const exact = STOCKS.find((s) => s.code === t);
      if (exact) return go(exact);
      setNotice("해당 코드의 분석 데이터가 없습니다.");
      return;
    }
    if (matches.length > 0) return go(matches[active] ?? matches[0]);
    setNotice("조건에 맞는 종목을 찾을 수 없습니다.");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") submit();
    else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 focus-within:border-gray-500 focus-within:ring-2 focus-within:ring-gray-100 transition-colors">
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setNotice(null); }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          placeholder="종목 검색 — 이름·코드·초성 (예: 삼성, ㅅㅅ, 005930)"
          className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
          aria-autocomplete="list"
        />
        {q && (
          <button onMouseDown={(e) => { e.preventDefault(); setQ(""); setNotice(null); }} className="text-gray-300 hover:text-gray-500 text-sm shrink-0" aria-label="지우기">✕</button>
        )}
      </div>

      {open && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {matches.map((s, i) => (
            <li key={s.code}>
              <button
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); go(s); }}
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
        </ul>
      )}

      {notice && (
        <p className="absolute z-30 mt-1 w-full text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}
    </div>
  );
}
