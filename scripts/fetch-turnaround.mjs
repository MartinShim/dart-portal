// FnGuide 턴어라운드 분류를 받아 data/corp-<stock>-turnaround.json 저장.
// 5단계(흑자전환/흑자전환예상/적자폭축소/30%성장/10%성장)를 영업이익·순이익, 분기·연간으로 조회.
// 출처: comp.fnguide.com 정적 JSON (비상업적 용도 한정).
// 사용: node scripts/fetch-turnaround.mjs <stock_code>
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const stock = process.argv[2];
if (!stock) {
  console.error("사용: node scripts/fetch-turnaround.mjs <stock_code>");
  process.exit(1);
}

const BASE = "https://comp.fnguide.com/SVO2/json/data/03_04";
const UA = { "User-Agent": "Mozilla/5.0", Referer: "https://comp.fnguide.com/SVO2/ASP/SVD_Turn_Around.asp" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (s) => { const v = Number(String(s ?? "").replace(/,/g, "")); return Number.isFinite(v) ? v : null; };

// 강한 신호 우선
const PRIORITY = [
  ["1", "흑자전환"],
  ["2", "흑자전환 예상"],
  ["3", "적자폭 축소"],
  ["5", "30% 이상 성장"],
  ["4", "10% 이상 성장"],
];
const DATATYPES = { OPER: "영업이익", NET: "순이익" };

async function getJson(url) {
  const res = await fetch(url, { headers: UA });
  const txt = (await res.text()).replace(/^﻿/, "");
  if (txt.trimStart().startsWith("<")) return null;
  try { return JSON.parse(txt); } catch { return null; }
}

async function classify(gsGb, dataType) {
  const gicode = `A${stock}`;
  for (const [code, name] of PRIORITY) {
    const data = await getJson(`${BASE}/${code}_D_${dataType}_${gsGb}.json`);
    await sleep(60);
    const row = data?.comp?.find((x) => x.GICODE === gicode);
    if (row) {
      return {
        category: name,
        gsNm: row.GS_NM,
        dataGb: row.DATA_GB,
        cur: num(row.CUR_DATA) != null ? num(row.CUR_DATA) * 1e8 : null,
        prev: num(row.PREV_DATA) != null ? num(row.PREV_DATA) * 1e8 : null,
        growth: num(row.GROWTH_DATA),
      };
    }
  }
  return null;
}

async function main() {
  const result = { Q: {}, A: {} };
  for (const gsGb of ["Q", "A"]) {
    for (const dt of Object.keys(DATATYPES)) {
      const c = await classify(gsGb, dt);
      if (c) result[gsGb][dt] = c;
    }
  }

  const out = { fetchedAt: new Date().toISOString(), source: "FnGuide 턴어라운드", stock, ...result };
  writeFileSync(join(ROOT, "data", `corp-${stock}-turnaround.json`), JSON.stringify(out, null, 2), "utf-8");

  console.log(`✅ 턴어라운드 저장 → data/corp-${stock}-turnaround.json`);
  for (const gsGb of ["Q", "A"]) {
    for (const [dt, label] of Object.entries(DATATYPES)) {
      const c = result[gsGb][dt];
      if (c) console.log(`   ${gsGb === "Q" ? "분기" : "연간"} ${label}: ${c.category} (${c.gsNm}, ${c.growth >= 0 ? "+" : ""}${c.growth}%)`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
