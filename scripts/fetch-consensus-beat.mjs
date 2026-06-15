// FnGuide 어닝(컨센서스 상회/하회) 데이터를 받아 data/corp-<stock>-beat.json 저장.
// 같은 기간의 발표(실제) vs 컨센서스 + 상회율을 매출·영업이익·순이익 3개 계정으로 수집.
//
// 출처: comp.fnguide.com 정적 JSON (비상업적 용도 한정).
// 사용: node scripts/fetch-consensus-beat.mjs <stock_code>
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const stock = process.argv[2];
if (!stock) {
  console.error("사용: node scripts/fetch-consensus-beat.mjs <stock_code>");
  process.exit(1);
}

const BASE = "https://comp.fnguide.com/SVO2/json/data/03_03";
const REFERER = "https://comp.fnguide.com/SVO2/ASP/SVD_EarSurprise.asp";
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", Referer: REFERER };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ACCOUNTS = { 0: "매출액", 1: "영업이익", 2: "순이익" };
const EOK = 1e8; // 억원 → 원
const num = (s) => {
  const v = Number(String(s ?? "").replace(/,/g, ""));
  return Number.isFinite(v) ? v : null;
};

async function getJson(url) {
  const res = await fetch(url, { headers: UA });
  const txt = (await res.text()).replace(/^﻿/, "");
  if (txt.trimStart().startsWith("<")) return null; // 404 HTML
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

async function main() {
  // 사용 가능한 기간 목록 (연결 D 기준)
  const gsym = await getJson(`${BASE}/gs_ym.json`);
  if (!gsym) {
    console.error("❌ gs_ym.json 조회 실패");
    process.exit(1);
  }
  const periods = [];
  const seen = new Set();
  for (const r of gsym.comp) {
    if (r.REPORT_GB !== "D") continue; // 연결만
    const k = `${r.AQ_GB}_${r.FY_GB}`;
    if (seen.has(k)) continue;
    seen.add(k);
    periods.push({ aq: r.AQ_GB, fy: r.FY_GB, gsYm: r.GS_YM });
  }

  const gicode = `A${stock}`;
  const result = {}; // key: `${aq}_${gsYm}` → { gsGb, dataGb, metrics: {...} }

  for (const p of periods) {
    const periodKey = `${p.aq}_${p.gsYm}`;
    for (const [acc, accName] of Object.entries(ACCOUNTS)) {
      // 상회(U) → 하회(D) 순으로 탐색, 발견되는 파일이 곧 상회/하회 여부
      for (const nd of ["U", "D"]) {
        const data = await getJson(`${BASE}/D_${p.aq}_${nd}_${acc}_${p.fy}.json`);
        await sleep(60);
        if (!data?.comp) continue;
        const row = data.comp.find((x) => x.GICODE === gicode);
        if (!row) continue;
        result[periodKey] ??= { gsGb: row.GS_GB, gsYm: row.GS_YM, dataGb: row.DATA_GB, metrics: {} };
        const actual = num(row.BALPYO);
        const con = num(row.CON);
        result[periodKey].metrics[accName] = {
          actual: actual != null ? actual * EOK : null,
          consensus: con != null ? con * EOK : null,
          beatPct: num(row.SUR), // 상회율(%)
          beat: nd === "U", // 상회 파일에서 발견 → 상회
        };
        break; // 해당 계정은 한 파일에서만 나옴
      }
    }
  }

  const out = { fetchedAt: new Date().toISOString(), source: "FnGuide 어닝 (컨센서스 상회/하회)", stock, periods: result };
  writeFileSync(join(ROOT, "data", `corp-${stock}-beat.json`), JSON.stringify(out, null, 2), "utf-8");

  const n = Object.keys(result).length;
  console.log(`✅ ${n}개 기간 컨센서스 비교 저장 → data/corp-${stock}-beat.json`);
  for (const [k, v] of Object.entries(result)) {
    const m = v.metrics;
    const beats = Object.values(m).filter((x) => x.beat).length;
    const op = m["영업이익"];
    console.log(
      `   ${k} (${v.gsGb}) 상회 ${beats}/${Object.keys(m).length}` +
        (op ? ` | 영업이익 발표 ${(op.actual / 1e12).toFixed(1)}조 vs 컨센 ${(op.consensus / 1e12).toFixed(1)}조 (${op.beatPct >= 0 ? "+" : ""}${op.beatPct}%)` : "")
    );
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
