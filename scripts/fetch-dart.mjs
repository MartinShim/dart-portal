// DART 공시 원문을 받아 JSON으로 저장하는 배치 스크립트.
//
// 전체 시장(최근 N일):
//   node scripts/fetch-dart.mjs --days 7 --pages 1
// 특정 종목(최근 N년, 전체 페이지):
//   node scripts/fetch-dart.mjs --corp 00126380 --stock 005930 --years 3
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(join(ROOT, ".env.local"), "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {}
  return env;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[key] = val;
    }
  }
  return args;
}

const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(apiKey, { corp, bgn, end, pageNo, pageCount }) {
  const url = new URL("https://opendart.fss.or.kr/api/list.json");
  url.searchParams.set("crtfc_key", apiKey);
  if (corp) url.searchParams.set("corp_code", corp);
  url.searchParams.set("bgn_de", bgn);
  url.searchParams.set("end_de", end);
  url.searchParams.set("page_no", String(pageNo));
  url.searchParams.set("page_count", String(pageCount));
  const res = await fetch(url);
  return res.json();
}

async function main() {
  const env = loadEnv();
  const apiKey = process.env.DART_API_KEY || env.DART_API_KEY;
  if (!apiKey || apiKey.includes("여기에")) {
    console.error("❌ DART_API_KEY가 .env.local에 설정되지 않았습니다.");
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const corp = args.corp || null;
  const stock = args.stock || null;
  const years = args.years ? Number(args.years) : null;
  const days = args.days ? Number(args.days) : 7;
  const maxPages = args.pages ? Number(args.pages) : (corp ? 100 : 1);
  const pageCount = 100;

  // 절대 날짜(--bgn/--end, YYYY-MM-DD 또는 YYYYMMDD) 우선, 없으면 years/days 상대 계산
  const normYmd = (s) => s.replaceAll("-", "");
  let bgn, endd;
  if (args.bgn || args.end) {
    endd = args.end ? normYmd(args.end) : ymd(new Date());
    bgn = args.bgn ? normYmd(args.bgn) : "20230101";
  } else {
    const end = new Date();
    const begin = new Date();
    if (years) begin.setFullYear(begin.getFullYear() - years);
    else begin.setDate(begin.getDate() - days);
    bgn = ymd(begin);
    endd = ymd(end);
  }
  const label = corp ? `종목 ${stock ?? corp}` : `전체 시장`;
  console.log(`📡 DART 공시 조회: ${label} | ${bgn} ~ ${endd}`);

  // 1페이지로 total 파악
  const first = await fetchPage(apiKey, { corp, bgn, end: endd, pageNo: 1, pageCount });
  if (first.status !== "000") {
    console.error(`❌ DART API 오류 [${first.status}]: ${first.message}`);
    process.exit(1);
  }
  const totalPage = Math.min(first.total_page ?? 1, maxPages);
  let all = [...first.list];
  console.log(`   전체 ${first.total_count}건 / ${first.total_page}페이지 (최대 ${totalPage}페이지 수집)`);

  for (let p = 2; p <= totalPage; p++) {
    await sleep(120); // 레이트리밋 배려
    const page = await fetchPage(apiKey, { corp, bgn, end: endd, pageNo: p, pageCount });
    if (page.status === "000" && page.list) all = all.concat(page.list);
    if (p % 10 === 0) console.log(`   ...${p}/${totalPage}페이지 (${all.length}건)`);
  }

  const out = {
    fetchedAt: new Date().toISOString(),
    corp_code: corp,
    stock_code: stock,
    range: { bgn_de: bgn, end_de: endd },
    totalCount: first.total_count,
    collected: all.length,
    list: all,
  };

  mkdirSync(join(ROOT, "data"), { recursive: true });
  const fileName = corp
    ? `corp-${stock ?? corp}-raw.json`
    : "disclosures-raw.json";
  const outPath = join(ROOT, "data", fileName);
  writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
  console.log(`✅ ${all.length}건 저장 → data/${fileName}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
