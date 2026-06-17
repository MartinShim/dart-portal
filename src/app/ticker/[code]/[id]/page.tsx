"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import type { DisclosureInsight } from "@/types/dart";
import type { ConsensusBeat, CompareRow } from "@/types/dart";
import type { ReactNode } from "react";
import { ImpactChip } from "@/components/dashboard/impact-chip";
import { TagBadge } from "@/components/dashboard/tag-badge";
import { Navbar } from "@/components/dashboard/navbar";

interface SegRow {
  name: string;
  revenue: number | null;
  op: number | null;
  prevRevenue: number | null;
  prevOp: number | null;
}
interface SegResult {
  label: string;
  prevLabel: string | null;
  rows: SegRow[];
}
interface Mdna {
  summary: string;
  positives: string[];
  risks: string[];
  outlook: string;
}

// 금액 표기: 1조 이상은 '조'(소수1), 1조 미만은 '억'(정수, 천단위 구분)
function fmtWon(v: number | null): string {
  if (v == null) return "—";
  return Math.abs(v) < 1e12
    ? `${Math.round(v / 1e8).toLocaleString()}억`
    : `${(v / 1e12).toFixed(1)}조`;
}

function CompareTable({
  heading,
  subtitle,
  prevLabel,
  curLabel,
  diffLabel,
  rows,
  badge,
  note,
}: {
  heading: string;
  subtitle: string;
  prevLabel: string;
  curLabel: string;
  diffLabel: string;
  rows: CompareRow[];
  badge?: ReactNode;
  note?: string;
}) {
  const fmt = (v: number | null, unit: "조원" | "%") =>
    v == null ? "—" : unit === "조원" ? fmtWon(v) : `${v.toFixed(1)}%`;

  const diffCell = (prev: number | null, cur: number | null, isPP?: boolean) => {
    const diff =
      prev == null || cur == null ? null : isPP ? cur - prev : prev === 0 ? null : (cur / prev - 1) * 100;
    const up = diff !== null && diff > 0;
    const down = diff !== null && diff < 0;
    const color = up ? "text-emerald-600" : down ? "text-red-600" : "text-gray-400";
    const arrow = up ? "▲" : down ? "▼" : "–";
    const txt = diff === null ? "—" : `${arrow} ${diff >= 0 ? "+" : ""}${diff.toFixed(1)}${isPP ? "%p" : "%"}`;
    return <span className={`tabular-nums font-semibold ${color}`}>{txt}</span>;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {heading} <span className="text-gray-400">{subtitle}</span>
        </p>
        {badge}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-200">
              <th className="text-left font-medium py-1.5 pr-2">항목</th>
              <th className="text-right font-medium py-1.5 px-2">{prevLabel}</th>
              <th className="text-right font-medium py-1.5 px-2">{curLabel}</th>
              <th className="text-right font-medium py-1.5 pl-2">{diffLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-2 text-gray-700">{r.label}</td>
                <td className="py-2 px-2 text-right tabular-nums text-gray-500">{fmt(r.previous, r.unit)}</td>
                <td className="py-2 px-2 text-right tabular-nums font-semibold text-gray-900">{fmt(r.current, r.unit)}</td>
                <td className="py-2 pl-2 text-right">{diffCell(r.previous, r.current, r.isPP)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <p className="text-xs text-gray-400 mt-2">{note}</p>}
    </div>
  );
}

function ConsensusBeatTable({ data }: { data: ConsensusBeat }) {
  const jo = (v: number | null) => fmtWon(v);
  const order: ("매출액" | "영업이익" | "순이익")[] = ["매출액", "영업이익", "순이익"];
  const rows = order
    .map((k) => ({ label: k, m: data.metrics[k] }))
    .filter((r) => r.m);

  // 헤드라인은 영업이익 기준 (한국 시장 관행)
  const opBeat = data.metrics["영업이익"]?.beat;
  const summary =
    opBeat === undefined
      ? null
      : opBeat
      ? { text: "영업이익 컨센서스 상회", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }
      : { text: "영업이익 컨센서스 하회", cls: "bg-red-50 text-red-700 border-red-200" };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          🎯 컨센서스 대비 <span className="text-gray-400">(영업이익 기준 · {data.beatCount}/{data.total} 상회)</span>
        </p>
        {summary && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${summary.cls}`}>
            {summary.text}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-200">
              <th className="text-left font-medium py-1.5 pr-2">항목</th>
              <th className="text-right font-medium py-1.5 px-2">컨센서스</th>
              <th className="text-right font-medium py-1.5 px-2">발표(실제)</th>
              <th className="text-right font-medium py-1.5 pl-2">상회율</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, m }) => {
              const beat = m!.beat;
              const pct = m!.beatPct;
              const isOp = label === "영업이익";
              return (
                <tr key={label} className={`border-b border-gray-100 last:border-0 ${isOp ? "bg-gray-50/70" : ""}`}>
                  <td className="py-2 pr-2 text-gray-700">
                    {label}
                    {isOp && <span className="ml-1.5 text-[10px] font-semibold text-gray-400">태깅 기준</span>}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-gray-500">{jo(m!.consensus)}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold text-gray-900">{jo(m!.actual)}</td>
                  <td className={`py-2 pl-2 text-right tabular-nums font-semibold ${beat ? "text-emerald-600" : "text-red-600"}`}>
                    {pct == null ? "—" : `${beat ? "▲ 상회" : "▼ 하회"} ${pct >= 0 ? "+" : ""}${pct}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        ※ {data.gsYm.slice(0, 4)}.{data.gsYm.slice(4)} {data.dataGb} 기준. 발표 실적 vs 증권사 컨센서스(추정 평균). 출처 FnGuide.
      </p>
    </div>
  );
}

export default function DisclosureDetailPage({
  params,
}: {
  params: Promise<{ code: string; id: string }>;
}) {
  const { code, id } = use(params);
  const [insight, setInsight] = useState<DisclosureInsight | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [segSource, setSegSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/ticker/${code}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "조회 실패");
        return r.json();
      })
      .then((data) => {
        setCompanyName(data.companyName);
        setSegSource(data.segmentSource ?? null);
        const found = (data.insights as DisclosureInsight[]).find((i) => i.id === id);
        if (!found) throw new Error("해당 공시를 찾을 수 없습니다.");
        setInsight(found);
      })
      .catch((e) => setError(e.message));
  }, [code, id]);

  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-red-600">
        {error}
      </div>
    );
  if (!insight)
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
        불러오는 중...
      </div>
    );

  const fmtDate = (s: string) => s.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  const positives = insight.positives ?? [];
  const negatives = insight.negatives ?? [];
  const keyPoints = insight.keyPoints ?? [];
  const narrative = insight.narrative ?? "";
  const financials = insight.financials;
  const qoq = insight.qoq;
  const consensusBeat = insight.consensusBeat;
  const metrics = insight.metrics;
  const pct1 = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
  // 사업부문별 실적 (단독분기·QoQ) — ticker API가 기간 매칭해 부착
  const segmentResult = (insight as DisclosureInsight & { segmentResult?: SegResult }).segmentResult;
  const mdna = (insight as DisclosureInsight & { mdna?: Mdna }).mdna;
  const joFmt = (v: number | null) => fmtWon(v);
  const qoqCell = (cur: number | null, prev: number | null) => {
    if (cur == null || prev == null || prev === 0) return <span className="text-gray-300">—</span>;
    const d = (cur / prev - 1) * 100;
    const up = d > 0;
    return (
      <span className={`tabular-nums ${up ? "text-emerald-600" : d < 0 ? "text-red-600" : "text-gray-400"}`}>
        {up ? "▲" : d < 0 ? "▼" : "–"} {d >= 0 ? "+" : ""}{d.toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar active="stocks" />
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <Link href={`/ticker/${code}`} className="text-xs text-blue-600 hover:underline">
            ← {companyName} 타임라인
          </Link>
          <div className="flex items-start justify-between gap-3 mt-1">
            <h1 className="text-lg font-bold text-gray-900">{insight.reportName}</h1>
            <ImpactChip level={insight.impactLevel} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {companyName} {insight.stockCode} · {fmtDate(insight.receiptDate)} · {insight.market}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        {/* 1. 주요 내용 간추림 */}
        {keyPoints.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              📋 공시 주요 내용
            </p>
            <ul className="space-y-1.5">
              {keyPoints.map((p, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2">
                  <span className="text-gray-300 mt-0.5">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>

            {/* 경영진단(MD&A) — 회사가 직접 쓴 서술 요약 */}
            {mdna && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-600 mb-1.5">
                  📝 경영진단(MD&amp;A) 요약 <span className="text-gray-400 font-normal">— 회사가 직접 쓴 서술</span>
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">{mdna.summary}</p>
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  {mdna.positives.length > 0 && (
                    <div className="bg-emerald-50/60 border border-emerald-100 rounded-md p-2.5">
                      <p className="text-[11px] font-bold text-emerald-700 mb-1">🟢 회사가 말하는 긍정</p>
                      <ul className="space-y-1">
                        {mdna.positives.map((p, i) => (
                          <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                            <span className="text-emerald-400 mt-0.5">▲</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {mdna.risks.length > 0 && (
                    <div className="bg-red-50/60 border border-red-100 rounded-md p-2.5">
                      <p className="text-[11px] font-bold text-red-700 mb-1">🔴 회사가 말하는 리스크</p>
                      <ul className="space-y-1">
                        {mdna.risks.map((r, i) => (
                          <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                            <span className="text-red-400 mt-0.5">▼</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {mdna.outlook && (
                  <p className="text-xs text-gray-600 mt-3">
                    <span className="font-semibold text-gray-500">🔭 전망 </span>
                    {mdna.outlook}
                  </p>
                )}
                <p className="text-[11px] text-gray-400 mt-2">※ DART 정기공시 'IV. 이사의 경영진단 및 분석의견' 요약.</p>
              </div>
            )}
          </div>
        )}

        {/* 2. 긍정 / 부정 2열 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
            <p className="text-sm font-bold text-emerald-700 mb-2 flex items-center gap-1">
              🟢 긍정적 요인
            </p>
            {positives.length > 0 ? (
              <ul className="space-y-2">
                {positives.map((p, i) => (
                  <li key={i} className="text-sm text-emerald-900 flex gap-2">
                    <span className="text-emerald-400 mt-0.5">▲</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-emerald-600/60 italic">
                두드러진 긍정 요인 없음
              </p>
            )}
          </div>

          <div className="bg-red-50 rounded-lg border border-red-200 p-4">
            <p className="text-sm font-bold text-red-700 mb-2 flex items-center gap-1">
              🔴 부정적 요인
            </p>
            {negatives.length > 0 ? (
              <ul className="space-y-2">
                {negatives.map((n, i) => (
                  <li key={i} className="text-sm text-red-900 flex gap-2">
                    <span className="text-red-400 mt-0.5">▼</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-red-600/60 italic">두드러진 부정 요인 없음</p>
            )}
          </div>
        </div>

        {/* 3. 태그 부여 근거 + 결과 */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-amber-700 mb-2">AI 태그 부여 근거 & 결과</p>
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {insight.tags.map((t) => (
              <TagBadge key={t} tag={t} />
            ))}
            <ImpactChip level={insight.impactLevel} />
          </div>
          <p className="text-sm text-amber-900">{insight.evidence}</p>
        </div>

        {/* 4. 전년 동기 대비 (YoY) */}
        {financials && financials.rows.length > 0 && (
          <CompareTable
            heading="📊 YoY"
            subtitle="(전년 동기 대비 · 연결 기준)"
            prevLabel={financials.termPrevious}
            curLabel={financials.termCurrent}
            diffLabel="YoY"
            rows={financials.rows}
            badge={
              financials.verified ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                  ✓ {financials.crossChecked ? "DART·네이버 교차검증" : "DART 내부 정합 확인"}
                </span>
              ) : null
            }
            note={`※ YoY=전년 동기 대비(${financials.termPrevious}), 비율 항목은 %p. 출처 DART 재무제표 API.`}
          />
        )}

        {/* 4-1. 전분기 대비 (QoQ) — 분기·반기·사업보고서(Q4) */}
        {qoq && qoq.rows.length > 0 && (
          <CompareTable
            heading="🔄 QoQ"
            subtitle="(전분기 대비 · 연결 단독분기)"
            prevLabel={`${qoq.prevLabel}${qoq.prevDerived ? "*" : ""}`}
            curLabel={`${qoq.currentLabel}${qoq.currentDerived ? "*" : ""}`}
            diffLabel="QoQ"
            rows={qoq.rows}
            note={`※ 직전 분기 대비. 손익은 단독분기(3개월), 재무상태는 분기말 잔액.${
              qoq.prevDerived || qoq.currentDerived
                ? " * 표시 분기는 연간−(1~3분기)로 도출한 4분기(사업보고서=Q4)."
                : ""
            } 출처 DART.`}
          />
        )}

        {/* 4-1-1. 사업부문별 실적 (단독분기 · 직전분기 QoQ) — QoQ 아래, 컨센서스 위 */}
        {segmentResult && segmentResult.rows.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              🏭 사업부문별 실적{" "}
              <span className="text-gray-400 normal-case">
                (단독분기{segmentResult.prevLabel ? ` · 직전 ${segmentResult.prevLabel} 대비 QoQ` : ""})
              </span>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-200">
                    <th className="text-left font-medium py-1.5 pr-2" rowSpan={2}>부문</th>
                    <th className="text-center font-medium py-1.5 px-2 border-l border-gray-100" colSpan={3}>매출</th>
                    <th className="text-center font-medium py-1.5 px-2 border-l border-gray-100" colSpan={3}>영업이익</th>
                  </tr>
                  <tr className="text-[11px] text-gray-400 border-b border-gray-200">
                    <th className="text-right font-medium py-1 px-2 border-l border-gray-100">{segmentResult.prevLabel ?? "직전분기"}</th>
                    <th className="text-right font-medium py-1 px-2">당분기</th>
                    <th className="text-right font-medium py-1 px-2">QoQ</th>
                    <th className="text-right font-medium py-1 px-2 border-l border-gray-100">{segmentResult.prevLabel ?? "직전분기"}</th>
                    <th className="text-right font-medium py-1 px-2">당분기</th>
                    <th className="text-right font-medium py-1 px-2">QoQ</th>
                  </tr>
                </thead>
                <tbody>
                  {segmentResult.rows.map((r) => (
                    <tr key={r.name} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-2 text-gray-700 font-medium">{r.name}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-gray-500 whitespace-nowrap border-l border-gray-100">
                        {joFmt(r.prevRevenue)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">
                        {joFmt(r.revenue)}
                      </td>
                      <td className="py-2 px-2 text-right text-xs whitespace-nowrap">{qoqCell(r.revenue, r.prevRevenue)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-gray-500 whitespace-nowrap border-l border-gray-100">
                        {joFmt(r.prevOp)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">
                        {joFmt(r.op)}
                      </td>
                      <td className="py-2 px-2 text-right text-xs whitespace-nowrap">{qoqCell(r.op, r.prevOp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              ※ 단독분기 기준(누적−직전누적 환산). {segSource ?? "DART 정기공시 영업부문 정보"}.
            </p>
          </div>
        )}

        {/* 4-2. 컨센서스 상회/하회 (실적 공시) */}
        {consensusBeat && (
          <ConsensusBeatTable data={consensusBeat} />
        )}


        {/* 4-3. 재무 지표 (수익성·안정성·현금흐름·배당) — 상세 분석 위 */}
        {metrics && (() => {
          const p = metrics.profitability, s = metrics.stability, c = metrics.cashflow, d = metrics.dividend;
          const prof = [
            metrics.isAnnual && p.roe != null ? { label: "ROE", value: pct1(p.roe) } : null,
            metrics.isAnnual && p.roa != null ? { label: "ROA", value: pct1(p.roa) } : null,
            p.opMargin != null ? { label: "영업이익률", value: pct1(p.opMargin) } : null,
            p.netMargin != null ? { label: "순이익률", value: pct1(p.netMargin) } : null,
          ].filter(Boolean) as { label: string; value: string }[];
          const stab = [
            s.debtRatio != null ? { label: "부채비율", value: pct1(s.debtRatio) } : null,
            s.currentRatio != null ? { label: "유동비율", value: pct1(s.currentRatio) } : null,
            s.interestCoverage != null ? { label: "이자보상배율", value: `${s.interestCoverage.toFixed(1)}배` } : null,
          ].filter(Boolean) as { label: string; value: string }[];
          const cash = [
            c.operatingCF != null ? { label: "영업활동현금흐름", value: fmtWon(c.operatingCF) } : null,
            c.fcf != null ? { label: "잉여현금흐름(FCF)", value: fmtWon(c.fcf) } : null,
          ].filter(Boolean) as { label: string; value: string }[];
          const div = d
            ? ([
                d.dps != null ? { label: "주당배당금(DPS)", value: `${d.dps.toLocaleString()}원${d.prevDps != null ? ` (전년 ${d.prevDps.toLocaleString()})` : ""}` } : null,
                d.payoutRatio != null ? { label: "배당성향", value: pct1(d.payoutRatio) } : null,
                d.dividendYield != null ? { label: "배당수익률", value: pct1(d.dividendYield) } : null,
              ].filter(Boolean) as { label: string; value: string }[])
            : [];
          const groups = [
            { name: "수익성", rows: prof },
            { name: "안정성·재무건전성", rows: stab },
            { name: "현금흐름", rows: cash },
            { name: "배당 (주주환원)", rows: div },
          ].filter((g) => g.rows.length > 0);
          if (groups.length === 0) return null;
          return (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                📐 재무 지표 <span className="text-gray-400 normal-case">(수익성·안정성·현금흐름·배당)</span>
              </p>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                {groups.map((g) => (
                  <div key={g.name}>
                    <p className="text-[11px] font-bold text-gray-500 mb-1.5">{g.name}</p>
                    <dl className="space-y-1">
                      {g.rows.map((r) => (
                        <div key={r.label} className="flex items-center justify-between text-sm border-b border-gray-50 pb-1">
                          <dt className="text-gray-500">{r.label}</dt>
                          <dd className="tabular-nums font-semibold text-gray-900">{r.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-3">
                ※ DART 재무제표 기반 산출. ROE/ROA·배당은 연간(사업보고서) 기준, 그 외는 해당 보고서 기준.
              </p>
            </div>
          );
        })()}

        {/* 5. 상세 분석 (서술형) */}
        {narrative && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              📝 상세 분석
            </p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {narrative}
            </p>
          </div>
        )}

        {/* 6. AI 핵심 평가 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            AI 핵심 평가
          </p>
          <p className="text-sm text-gray-800">{insight.summary}</p>
        </div>

        {/* DART 원문 */}
        {insight.dartUrl && (
          <a
            href={insight.dartUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-blue-600 hover:underline"
          >
            DART 원문 전체 보기 →
          </a>
        )}

        <p className="text-xs text-gray-400 pt-2 border-t border-gray-200">
          ※ AI(Claude Max Plan)가 공시 유형·재무 데이터를 기반으로 분석한 결과로, 투자 판단의 보조 참고용입니다.
        </p>
      </div>
    </div>
  );
}
