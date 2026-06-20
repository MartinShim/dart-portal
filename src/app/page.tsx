"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { DisclosureInsight, InsightTag } from "@/types/dart";
import { DisclosureCard } from "@/components/dashboard/disclosure-card";
import { FilterSidebar, RISK_TAGS, GOOD_TAGS } from "@/components/dashboard/filter-sidebar";
import { Navbar } from "@/components/dashboard/navbar";

export default function Home() {
  const router = useRouter();
  const [insights, setInsights] = useState<DisclosureInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<InsightTag[]>([]);
  const [riskOnly, setRiskOnly] = useState(false);
  const [goodOnly, setGoodOnly] = useState(false);
  const [from, setFrom] = useState(""); // YYYY-MM-DD (빈값=전체기간)
  const [to, setTo] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dart");
        if (!res.ok) throw new Error((await res.json()).error ?? "API 오류");
        const data = await res.json();
        // 최신순 정렬
        const list = (data.insights ?? []) as DisclosureInsight[];
        list.sort((a, b) => b.receiptDate.localeCompare(a.receiptDate));
        setInsights(list);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "알 수 없는 오류");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const openDetail = useCallback(
    (ins: DisclosureInsight) => {
      if (ins.stockCode) router.push(`/ticker/${ins.stockCode}/${ins.id}`);
    },
    [router]
  );

  const toggleTag = useCallback((tag: InsightTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setRiskOnly(false);
    setGoodOnly(false);
  }, []);

  const toggleRiskOnly = useCallback(() => {
    setRiskOnly((prev) => !prev);
    setGoodOnly(false);
    setSelectedTags([]);
  }, []);

  const toggleGoodOnly = useCallback(() => {
    setGoodOnly((prev) => !prev);
    setRiskOnly(false);
    setSelectedTags([]);
  }, []);

  // 데이터 전체 날짜 범위 (정렬상 [0]=최신, [last]=최초)
  const maxYmd = insights[0]?.receiptDate ?? "";
  const minYmd = insights[insights.length - 1]?.receiptDate ?? "";
  const toInput = (ymd: string) => ymd.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  const toYmd = (input: string) => input.replaceAll("-", "");
  const fromYmd = from ? toYmd(from) : minYmd;
  const toYmdVal = to ? toYmd(to) : maxYmd;

  const filtered = insights.filter((ins) => {
    if (ins.receiptDate < fromYmd || ins.receiptDate > toYmdVal) return false;
    if (riskOnly) return ins.tags.some((t) => RISK_TAGS.includes(t));
    if (goodOnly) return ins.tags.some((t) => GOOD_TAGS.includes(t));
    if (selectedTags.length === 0) return true;
    return selectedTags.some((st) => ins.tags.includes(st));
  });

  const fmtDate = (s: string) => s.replace(/(\d{4})(\d{2})(\d{2})/, "$1.$2.$3");
  const latestDate = insights[0]?.receiptDate;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar active="latest" />

      <div className="max-w-screen-2xl mx-auto px-6 py-6 flex gap-6">
        {/* 사이드바 */}
        <FilterSidebar
          selectedTags={selectedTags}
          onTagToggle={toggleTag}
          riskOnly={riskOnly}
          onRiskOnlyToggle={toggleRiskOnly}
          goodOnly={goodOnly}
          onGoodOnlyToggle={toggleGoodOnly}
        />

        {/* 메인 피드 */}
        <main className="flex-1 min-w-0">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                📢 최신 공시
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                실시간 접수 공시를 AI 투자 분석 태그로 재번역
                {latestDate && ` · 최신 ${fmtDate(latestDate)}`}
              </p>
            </div>
            {!loading && (
              <span className="text-xs text-gray-400 shrink-0">
                {filtered.length}건{selectedTags.length || riskOnly || goodOnly || from || to ? ` / 전체 ${insights.length}건` : ""}
              </span>
            )}
          </div>

          {/* 조회 기간 */}
          {!loading && insights.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-[10px] px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-gray-500">📅 조회 기간</span>
              <input
                type="date"
                value={from || toInput(minYmd)}
                min={toInput(minYmd)}
                max={to || toInput(maxYmd)}
                onChange={(e) => setFrom(e.target.value)}
                className="text-sm border border-gray-300 rounded-[10px] px-2 py-1 outline-none focus:border-gray-500"
              />
              <span className="text-gray-400 text-sm">~</span>
              <input
                type="date"
                value={to || toInput(maxYmd)}
                min={from || toInput(minYmd)}
                max={toInput(maxYmd)}
                onChange={(e) => setTo(e.target.value)}
                className="text-sm border border-gray-300 rounded-[10px] px-2 py-1 outline-none focus:border-gray-500"
              />
              {(from || to) && (
                <button
                  onClick={() => { setFrom(""); setTo(""); }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  전체 기간
                </button>
              )}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              공시 불러오는 중...
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              오류: {error}
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              선택한 조건에 해당하는 공시가 없습니다.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((ins) => (
              <DisclosureCard key={ins.id} insight={ins} onClick={openDetail} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
