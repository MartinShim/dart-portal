import { NextResponse } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { DartApiItem, DisclosureInsight } from "@/types/dart";
import { mapDartItemToInsight } from "@/lib/tag-mapper";

const DATA_DIR = join(process.cwd(), "data");

async function readInsights(file: string): Promise<DisclosureInsight[]> {
  try {
    const raw = await readFile(join(DATA_DIR, file), "utf-8");
    const parsed = JSON.parse(raw) as { insights?: DisclosureInsight[] };
    return parsed.insights ?? [];
  } catch {
    return [];
  }
}

export async function GET() {
  // 1순위: AI(Max Plan)가 분석해 둔 tagged.json (샘플 + 종목별 corp-*-tagged.json 병합)
  try {
    const files = await readdir(DATA_DIR);
    const sources = [
      "disclosures-tagged.json",
      ...files.filter((f) => /^corp-\d+-tagged\.json$/.test(f)),
    ];

    const byId = new Map<string, DisclosureInsight>();
    for (const f of sources) {
      for (const ins of await readInsights(f)) {
        // 종목별 분석(corp-*)이 샘플보다 우선 — 나중에 덮어씀
        byId.set(ins.id, ins);
      }
    }

    if (byId.size > 0) {
      return NextResponse.json({
        engine: "ai",
        analyzedAt: null,
        insights: [...byId.values()],
      });
    }
  } catch {
    // tagged 없음 → raw 키워드 폴백
  }

  // 2순위: raw.json 키워드 분석 폴백
  try {
    const raw = await readFile(join(DATA_DIR, "disclosures-raw.json"), "utf-8");
    const parsed = JSON.parse(raw) as { list: DartApiItem[] };
    const insights = parsed.list.map(mapDartItemToInsight);
    return NextResponse.json({ engine: "keyword", analyzedAt: null, insights });
  } catch {
    // raw 도 없음
  }

  return NextResponse.json(
    {
      error: "분석 데이터가 없습니다. `node scripts/fetch-dart.mjs` 로 공시를 먼저 수집하세요.",
      insights: [],
    },
    { status: 404 }
  );
}
