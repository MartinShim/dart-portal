"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DisclosureInsight } from "@/types/dart";
import { Navbar } from "@/components/dashboard/navbar";

// 분석 완료된 종목 (데이터 보유) — 2023.01.01 ~ 2026.06.12
const ANALYZED = [
  { code: "005930", name: "삼성전자", market: "KOSPI", sector: "반도체", note: "264건 분석" },
  { code: "000660", name: "SK하이닉스", market: "KOSPI", sector: "반도체", note: "211건 분석" },
  { code: "005380", name: "현대자동차", market: "KOSPI", sector: "자동차", note: "265건 분석" },
  { code: "042700", name: "한미반도체", market: "KOSPI", sector: "반도체 장비", note: "66건 분석" },
  { code: "036570", name: "NC", market: "KOSPI", sector: "게임", note: "60건 분석" },
  { code: "122870", name: "와이지엔터테인먼트", market: "KOSDAQ", sector: "엔터테인먼트", note: "69건 분석" },
  { code: "247540", name: "에코프로비엠", market: "KOSDAQ", sector: "2차전지 소재", note: "171건 분석" },
];

export default function StocksPage() {
  // 종목별 최신 핵심 공시 접수일 (tagged = 핵심 공시만)
  const [latestByCode, setLatestByCode] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/dart")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, string> = {};
        for (const i of (d.insights ?? []) as DisclosureInsight[]) {
          if (!map[i.stockCode] || i.receiptDate > map[i.stockCode]) map[i.stockCode] = i.receiptDate;
        }
        setLatestByCode(map);
      })
      .catch(() => {});
  }, []);

  const fmt = (s?: string) => (s ? s.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") : "—");

  // 최신 핵심 공시 일자 내림차순(최신 상단). 날짜 미확보 종목은 뒤로.
  const sorted = [...ANALYZED].sort((a, b) => (latestByCode[b.code] ?? "").localeCompare(latestByCode[a.code] ?? ""));

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar active="stocks" />
      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">📈 종목별</h2>
          <p className="text-xs text-gray-500 mt-0.5">종목별 AI 인사이트 타임라인 조회</p>
        </div>

        {/* 분석 완료 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
          {sorted.map((s) => (
            <Link
              key={s.code}
              href={`/ticker/${s.code}`}
              className="group bg-white rounded-2xl border border-black/[0.04] p-5 shadow-[0_2px_6px_rgba(17,17,17,0.05),0_12px_26px_-14px_rgba(17,17,17,0.12)] hover:shadow-[0_6px_14px_rgba(17,17,17,0.07),0_24px_44px_-16px_rgba(17,17,17,0.22)] hover:-translate-y-1 hover:border-[var(--sam-blue)]/25 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--sam-ink)] group-hover:text-[var(--sam-blue)] transition-colors">{s.name}</span>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                  분석완료
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 tabular-nums">
                {s.code} · {s.market} · {s.sector}
              </p>
              <p className="text-[11px] text-gray-500 mt-2 tabular-nums">
                🕑 최신 핵심 공시 · <span className="font-semibold text-gray-700">{fmt(latestByCode[s.code])}</span>
              </p>
              <p className="text-xs text-[var(--sam-blue)] font-medium mt-2">{s.note} →</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
