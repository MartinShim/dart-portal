"use client";

import Link from "next/link";
import { Navbar } from "@/components/dashboard/navbar";

// 분석 완료된 종목 (데이터 보유) — 2023.01.01 ~ 2026.06.12
const ANALYZED = [
  { code: "005930", name: "삼성전자", market: "KOSPI", sector: "반도체", note: "264건 분석" },
  { code: "000660", name: "SK하이닉스", market: "KOSPI", sector: "반도체", note: "211건 분석" },
  { code: "005380", name: "현대자동차", market: "KOSPI", sector: "자동차", note: "265건 분석" },
  { code: "042700", name: "한미반도체", market: "KOSPI", sector: "반도체 장비", note: "66건 분석" },
];

// 분석 대기 (검색·요청 시 수집 예정)
const PENDING = [
  { code: "373220", name: "LG에너지솔루션" },
  { code: "207940", name: "삼성바이오로직스" },
  { code: "000270", name: "기아" },
  { code: "035420", name: "NAVER" },
  { code: "035720", name: "카카오" },
  { code: "051910", name: "LG화학" },
];

export default function StocksPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar active="stocks" />
      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">📈 종목별</h2>
          <p className="text-xs text-gray-500 mt-0.5">종목별 AI 인사이트 타임라인 조회</p>
        </div>

        {/* 분석 완료 */}
        <h3 className="text-sm font-semibold text-gray-700 mb-2">분석 완료</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {ANALYZED.map((s) => (
            <Link
              key={s.code}
              href={`/ticker/${s.code}`}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">{s.name}</span>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                  분석완료
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {s.code} · {s.market} · {s.sector}
              </p>
              <p className="text-xs text-blue-600 mt-2">{s.note} →</p>
            </Link>
          ))}
        </div>

        {/* 분석 대기 */}
        <h3 className="text-sm font-semibold text-gray-700 mb-2">분석 대기</h3>
        <div className="flex flex-wrap gap-2">
          {PENDING.map((s) => (
            <span
              key={s.code}
              className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-500"
            >
              {s.name}
              <span className="text-xs text-gray-300">{s.code}</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          ※ 현재 4개 종목(삼성전자·SK하이닉스·현대자동차·한미반도체)을 2023.01.01~2026.06.12 기간으로 분석했습니다. 다른 종목은 수집·분석 후 제공됩니다.
        </p>
      </div>
    </div>
  );
}
