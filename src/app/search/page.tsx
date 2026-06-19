"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/dashboard/navbar";
import { searchStocks } from "@/lib/stock-search";

function Results() {
  const sp = useSearchParams();
  const q = (sp.get("q") ?? "").trim();
  const results = searchStocks(q, 50);

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900">🔍 검색 결과</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {q ? <>“<span className="font-semibold text-gray-700">{q}</span>” · {results.length}건</> : "검색어를 입력하세요."}
        </p>
      </div>

      {q && results.length === 0 && (
        <div className="text-sm text-gray-400 h-40 flex items-center justify-center">
          조건에 맞는 종목이 없습니다. 종목명·코드·초성으로 다시 검색해 보세요.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((s) =>
          s.ready ? (
            <Link
              key={s.code}
              href={`/ticker/${s.code}`}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">{s.name}</span>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">분석완료</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {s.code}
                {s.market && ` · ${s.market}`}
                {s.sector && ` · ${s.sector}`}
              </p>
              <p className="text-xs text-blue-600 mt-2">AI 인사이트 보기 →</p>
            </Link>
          ) : (
            <div key={s.code} className="bg-white rounded-lg border border-gray-200 p-4 opacity-70">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700">{s.name}</span>
                <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">분석 대기</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {s.code}
                {s.market && ` · ${s.market}`}
                {s.sector && ` · ${s.sector}`}
              </p>
              <p className="text-xs text-gray-400 mt-2">아직 분석 데이터가 없습니다.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-gray-400">불러오는 중...</div>}>
        <Results />
      </Suspense>
    </div>
  );
}
