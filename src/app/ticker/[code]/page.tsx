"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import type { DisclosureInsight, ImpactLevel } from "@/types/dart";
import { ImpactChip } from "@/components/dashboard/impact-chip";
import { TagBadge } from "@/components/dashboard/tag-badge";
import { Navbar } from "@/components/dashboard/navbar";
import { COMPANY_PROFILES } from "@/lib/company-profiles";

interface TickerData {
  companyName: string;
  stockCode: string;
  range: { bgn_de: string; end_de: string };
  stats: {
    total: number;
    insiderHoldingNoise: number;
    signalTotal: number;
    coreTagged: number;
  };
  allDates?: string[];
  insights: DisclosureInsight[];
}

// YYYYMMDD ↔ YYYY-MM-DD
const toInput = (ymd: string) => ymd.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
const toYmd = (input: string) => input.replaceAll("-", "");

const FILTERS: { key: ImpactLevel | "전체"; label: string }[] = [
  { key: "전체", label: "전체" },
  { key: "호재", label: "🟢 호재" },
  { key: "악재", label: "🔴 악재" },
  { key: "중립", label: "🟡 중립" },
];

export default function TickerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [data, setData] = useState<TickerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ImpactLevel | "전체">("전체");
  const [from, setFrom] = useState(""); // YYYY-MM-DD (빈값=전체기간 시작)
  const [to, setTo] = useState("");

  useEffect(() => {
    fetch(`/api/ticker/${code}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "조회 실패");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [code]);

  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-red-600">
        {error}
      </div>
    );
  if (!data)
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
        불러오는 중...
      </div>
    );

  const profile = COMPANY_PROFILES[code];

  const fmtDate = (s: string) =>
    s.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");

  // 조회 기간 (빈값이면 데이터 전체 범위)
  const fromYmd = from ? toYmd(from) : data.range.bgn_de;
  const toYmdVal = to ? toYmd(to) : data.range.end_de;
  const inRange = (ymd: string) => ymd >= fromYmd && ymd <= toYmdVal;

  // 날짜 필터 적용한 핵심 신호
  const dateScoped = data.insights.filter((i) => inRange(i.receiptDate));

  // 카운트 (날짜 필터 반영)
  const totalCount = (data.allDates ?? data.insights.map((i) => i.receiptDate)).filter(inRange).length;
  const goodCount = dateScoped.filter((i) => i.impactLevel === "호재").length;
  const badCount = dateScoped.filter((i) => i.impactLevel === "악재").length;
  const neutralCount = dateScoped.filter((i) => i.impactLevel === "중립").length;
  const nonCoreCount = Math.max(0, totalCount - dateScoped.length); // 핵심신호가 아닌 공시

  // 영향도 칩 필터까지 적용한 타임라인
  const filtered =
    filter === "전체" ? dateScoped : dateScoped.filter((i) => i.impactLevel === filter);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar active="stocks" />
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/stocks" className="text-xs text-blue-600 hover:underline">
            ← 종목별
          </Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">
            {data.companyName}
            <span className="ml-2 text-sm text-gray-400">{data.stockCode}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {fmtDate(data.range.bgn_de)} ~ {fmtDate(data.range.end_de)} · AI 인사이트 타임라인
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* 회사 소개 */}
        {profile && (
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-bold text-gray-900">🏢 회사 소개</h2>
              <span className="text-[11px] text-gray-400">{profile.source}</span>
            </div>
            <p className="text-sm font-semibold text-gray-800">{profile.tagline}</p>
            <p className="text-sm text-gray-600 leading-relaxed mt-1.5">{profile.overview}</p>
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-500 mb-2">영위 사업 부문</p>
              <ul className="space-y-1.5">
                {profile.segments.map((seg) => (
                  <li key={seg.name} className="flex gap-2 text-sm">
                    <span className="shrink-0 font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 text-xs h-fit">
                      {seg.name}
                    </span>
                    <span className="text-gray-600">{seg.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* 조회 기간 */}
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-gray-500">📅 조회 기간</span>
          <input
            type="date"
            value={from || toInput(data.range.bgn_de)}
            min={toInput(data.range.bgn_de)}
            max={to || toInput(data.range.end_de)}
            onChange={(e) => setFrom(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 outline-none focus:border-gray-500"
          />
          <span className="text-gray-400 text-sm">~</span>
          <input
            type="date"
            value={to || toInput(data.range.end_de)}
            min={from || toInput(data.range.bgn_de)}
            max={toInput(data.range.end_de)}
            onChange={(e) => setTo(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 outline-none focus:border-gray-500"
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

        {/* 건수 통계 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <CountCard label="전체 공시 / 비핵심" value={totalCount} secondary={nonCoreCount} tone="gray" />
          <CountCard label="핵심신호 긍정" value={goodCount} tone="emerald" emoji="🟢" />
          <CountCard label="핵심신호 부정" value={badCount} tone="red" emoji="🔴" />
          <CountCard label="핵심신호 중립" value={neutralCount} tone="amber" emoji="🟡" />
        </div>

        {/* 필터 */}
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === f.key
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-400 self-center">
            {filtered.length}건
          </span>
        </div>

        {/* 타임라인 */}
        <div className="relative border-l-2 border-gray-200 ml-2 space-y-4">
          {filtered.map((ins) => (
            <div key={ins.id} className="relative pl-6">
              <span
                className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-2 border-white ${
                  ins.impactLevel === "호재"
                    ? "bg-emerald-500"
                    : ins.impactLevel === "악재"
                    ? "bg-red-500"
                    : "bg-amber-400"
                }`}
              />
              <Link
                href={`/ticker/${code}/${ins.id}`}
                className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-mono text-gray-400">
                    {fmtDate(ins.receiptDate)}
                  </span>
                  <ImpactChip level={ins.impactLevel} />
                </div>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {ins.tags.map((t) => (
                    <TagBadge key={t} tag={t} />
                  ))}
                </div>
                <p className="text-sm text-gray-800">{ins.summary}</p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-xs text-gray-500 truncate">{ins.reportName}</p>
                  <span className="text-xs text-blue-600 shrink-0">상세 →</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CountCard({
  label,
  value,
  secondary,
  tone,
  emoji,
}: {
  label: string;
  value: number;
  secondary?: number;
  tone: "gray" | "emerald" | "red" | "amber";
  emoji?: string;
}) {
  const text =
    tone === "emerald" ? "text-emerald-600"
    : tone === "red" ? "text-red-600"
    : tone === "amber" ? "text-amber-600"
    : "text-gray-900";
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <p className="text-xs text-gray-500 flex items-center gap-1">
        {emoji && <span>{emoji}</span>}
        {label}
      </p>
      <p className={`text-2xl font-bold ${text}`}>
        {value.toLocaleString()}
        {secondary !== undefined && (
          <>
            <span className="text-gray-300 font-medium mx-1">/</span>
            <span className="text-gray-400">{secondary.toLocaleString()}</span>
          </>
        )}
        <span className="text-sm font-medium text-gray-400 ml-0.5">건</span>
      </p>
    </div>
  );
}
