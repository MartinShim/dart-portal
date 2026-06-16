import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DisclosureInsight } from "@/types/dart";
import { MDNA_SUMMARIES } from "@/lib/mdna-summaries";

// reportName "분기보고서 (2026.03)" → 기간 키 "2026Q1"
function periodKey(reportName: string): string | null {
  const m = reportName.match(/\((\d{4})\.(\d{2})\)/);
  if (!m) return null;
  const q = { "03": 1, "06": 2, "09": 3, "12": 4 }[m[2]];
  return q ? `${m[1]}Q${q}` : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  // 경로 조작 방지: 숫자만 허용
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "잘못된 종목코드" }, { status: 400 });
  }

  let tagged: { insights?: DisclosureInsight[] } & Record<string, unknown>;
  try {
    tagged = JSON.parse(
      await readFile(join(process.cwd(), "data", `corp-${code}-tagged.json`), "utf-8")
    );
  } catch {
    return NextResponse.json(
      { error: `${code} 분석 데이터가 없습니다. scripts/fetch-dart.mjs + analyze-corp.mjs 를 실행하세요.` },
      { status: 404 }
    );
  }

  // 사업부문별 실적(단독분기·QoQ) 병합 — 있으면 해당 기간 공시에 부착
  try {
    const seg = JSON.parse(
      await readFile(join(process.cwd(), "data", `corp-${code}-segments.json`), "utf-8")
    ) as {
      singleSegment?: boolean;
      source?: string;
      periods?: Record<string, unknown>;
    };
    tagged.segmentSingle = seg.singleSegment ?? false;
    tagged.segmentSource = seg.source ?? null;
    const periods = seg.periods ?? {};
    for (const ins of tagged.insights ?? []) {
      const key = periodKey(ins.reportName);
      if (key && periods[key]) {
        (ins as DisclosureInsight & { segmentResult?: unknown }).segmentResult = periods[key];
      }
    }
  } catch {
    // segments 파일 없음 → 부문 데이터 미부착
  }

  // 경영진단(MD&A) 요약 부착 — 기간 매칭
  const mdnaByPeriod = MDNA_SUMMARIES[code] ?? {};
  if (Object.keys(mdnaByPeriod).length) {
    for (const ins of tagged.insights ?? []) {
      const key = periodKey(ins.reportName);
      if (key && mdnaByPeriod[key]) {
        (ins as DisclosureInsight & { mdna?: unknown }).mdna = mdnaByPeriod[key];
      }
    }
  }

  return NextResponse.json(tagged);
}
