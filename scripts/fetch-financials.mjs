// 정기공시(사업·반기·분기보고서) 각 기간의 주요 재무계정을 DART에서 받아
// data/corp-<stock>-financials.json 으로 저장. analyze-corp.mjs가 서술형 요약 생성에 사용.
//
// 사용: node scripts/fetch-financials.mjs <stock> <corp_code>
import { readFileSync, writeFileSync } from "node:fs";
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

const stock = process.argv[2];
const corp = process.argv[3];
if (!stock || !corp) {
  console.error("사용: node scripts/fetch-financials.mjs <stock> <corp_code>");
  process.exit(1);
}

const env = loadEnv();
const KEY = process.env.DART_API_KEY || env.DART_API_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 보고서명 "(YYYY.MM)" → {year, reprt_code, label}
function parsePeriod(name) {
  const m = name.match(/\((\d{4})\.(\d{2})\)/);
  if (!m) return null;
  const year = m[1];
  const mm = m[2];
  const map = {
    "03": { reprt: "11013", label: "1분기보고서" },
    "06": { reprt: "11012", label: "반기보고서" },
    "09": { reprt: "11014", label: "3분기보고서" },
    "12": { reprt: "11011", label: "사업보고서" },
  };
  const t = map[mm];
  return t ? { year, reprt_code: t.reprt, label: t.label, periodMonth: mm } : null;
}

const WANT = ["매출액", "영업이익", "당기순이익", "자산총계", "부채총계", "자본총계"];
const toNum = (s) => Number(String(s ?? "").replace(/[,\s]/g, "")) || 0;

async function fetchAccounts(year, reprt) {
  const url = new URL("https://opendart.fss.or.kr/api/fnlttSinglAcnt.json");
  url.searchParams.set("crtfc_key", KEY);
  url.searchParams.set("corp_code", corp);
  url.searchParams.set("bsns_year", year);
  url.searchParams.set("reprt_code", reprt);
  const res = await fetch(url);
  const d = await res.json();
  if (d.status !== "000") return null;
  // 연결(CFS) 우선
  const div = d.list.some((x) => x.fs_div === "CFS") ? "CFS" : "OFS";
  const out = {};
  for (const x of d.list) {
    if (x.fs_div !== div) continue;
    // "당기순이익(손실)" 등 표기 변형 흡수: 원하는 계정명으로 시작하면 매칭
    const key = WANT.find((w) => x.account_nm.replace(/\s/g, "").startsWith(w));
    if (key && !(key in out)) {
      out[key] = {
        thstrm: toNum(x.thstrm_amount),
        thstrm_nm: (x.thstrm_nm ?? "").trim(),
        frmtrm: toNum(x.frmtrm_amount),
        frmtrm_nm: (x.frmtrm_nm ?? "").trim(),
      };
    }
  }
  return { fs_div: div, accounts: out };
}

// 교차검증용: 전체재무제표(fnlttSinglAcntAll)에서 매출/영업이익/원가/총이익 추출
async function fetchAll(year, reprt) {
  const url = new URL("https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json");
  url.searchParams.set("crtfc_key", KEY);
  url.searchParams.set("corp_code", corp);
  url.searchParams.set("bsns_year", year);
  url.searchParams.set("reprt_code", reprt);
  url.searchParams.set("fs_div", "CFS");
  const res = await fetch(url);
  const d = await res.json();
  if (d.status !== "000") return null;
  const pick = (nm) => {
    const row = d.list.find((x) => x.sj_div === "IS" && x.account_nm === nm);
    return row ? toNum(row.thstrm_amount) : null;
  };
  return { 매출액: pick("매출액"), 영업이익: pick("영업이익"), 매출원가: pick("매출원가"), 매출총이익: pick("매출총이익") };
}

// 3차 교차검증 소스: 네이버 증권(FnGuide 기반). 억원 단위 → 원으로 변환.
async function fetchNaver(stockCode) {
  const headers = { "User-Agent": "Mozilla/5.0" };
  const out = { quarter: {}, annual: {} };
  for (const [type, key] of [["quarter", "quarter"], ["annual", "annual"]]) {
    try {
      const res = await fetch(`https://m.stock.naver.com/api/stock/${stockCode}/finance/${key}`, { headers });
      const d = await res.json();
      const fi = d.financeInfo;
      const consensus = new Set(fi.trTitleList.filter((c) => c.isConsensus === "Y").map((c) => c.key));
      const grab = (title) => {
        const row = fi.rowList.find((r) => r.title === title);
        return row ? row.columns : {};
      };
      const rev = grab("매출액"), op = grab("영업이익");
      for (const c of fi.trTitleList) {
        if (consensus.has(c.key)) continue; // 컨센서스(추정치) 제외, 실제 실적만
        const ym = c.key.slice(0, 6); // "202603"
        out[type][ym] = {
          rev: rev[c.key] ? toNum(rev[c.key].value) * 1e8 : null,
          op: op[c.key] ? toNum(op[c.key].value) * 1e8 : null,
        };
      }
    } catch {}
  }
  return out;
}

// 교차검증: ① DART 두 소스 일치 ② 손익 내부 정합 ③ 네이버(FnGuide)와 일치
function verify(acnt, all, naver, period) {
  const rev = acnt["매출액"].thstrm, op = acnt["영업이익"].thstrm;
  const close = (a, b) => a != null && b != null && Math.abs(a - b) / Math.abs(b) < 0.015;

  // ② DART 내부: 정식 vs 전체 재무제표
  const dartAgree = all ? (close(rev, all.매출액) && close(op, all.영업이익)) : null;
  let arithmeticOk = true;
  if (all && all.매출원가 != null && all.매출총이익 != null) {
    arithmeticOk =
      Math.abs(rev - all.매출원가 - all.매출총이익) / Math.abs(rev) < 0.02 &&
      op <= all.매출총이익 * 1.02;
  }

  // ③ 네이버: 사업보고서(연간)는 annual, 분기·반기는 quarter 맵에서 같은 기간 조회
  const ym = `${period.year}${period.periodMonth}`;
  const nav = (period.periodMonth === "12" ? naver?.annual : naver?.quarter)?.[ym];
  const naverAgree = nav ? (close(rev, nav.rev) && close(op, nav.op)) : null;

  // 판정 원칙:
  //  · 독립 외부 소스(네이버/FnGuide)가 명시적으로 불일치하면 → 검증 실패(소스 충돌)
  //  · 손익 내부 정합이 깨지면 → 검증 실패
  //  · fnlttSinglAcntAll(dartAgree)은 과거연도 불안정 → 참고용, 판정에서 제외
  const verified = naverAgree !== false && arithmeticOk;
  const crossChecked = naverAgree !== null; // 네이버로 실제 대조했는지
  return { verified, dartAgree, arithmeticOk, naverAgree, crossChecked };
}

async function main() {
  const raw = JSON.parse(readFileSync(join(ROOT, "data", `corp-${stock}-raw.json`), "utf-8"));
  const periodics = raw.list.filter((x) =>
    /사업보고서|반기보고서|분기보고서/.test(x.report_nm)
  );

  const naver = await fetchNaver(stock); // 3차 소스 1회 조회
  const nq = Object.keys(naver.quarter).length, na = Object.keys(naver.annual).length;
  console.log(`  · 네이버 교차검증 데이터: 분기 ${nq}개 / 연간 ${na}개 기간`);

  const result = {};
  for (const it of periodics) {
    const p = parsePeriod(it.report_nm);
    if (!p) continue;
    const fin = await fetchAccounts(p.year, p.reprt_code);
    await sleep(120);
    if (!fin || !fin.accounts["매출액"]) {
      console.log(`  - ${it.report_nm.trim()} : 재무 없음`);
      continue;
    }
    const all = await fetchAll(p.year, p.reprt_code);
    await sleep(120);
    const v = verify(fin.accounts, all, naver, p);
    result[it.rcept_no] = { period: p, ...fin, verify: v };
    const rev = (fin.accounts["매출액"].thstrm / 1e12).toFixed(1);
    const op = (fin.accounts["영업이익"].thstrm / 1e12).toFixed(1);
    const badge = v.verified ? "✓검증" : "⚠불일치";
    const nv = v.naverAgree === true ? "일치" : v.naverAgree === false ? "충돌" : "데이터없음";
    console.log(`  ${badge} ${it.report_nm.trim()} : 매출 ${rev}조/영업이익 ${op}조 | 내부정합=${v.arithmeticOk} 네이버=${nv}`);
  }

  const outPath = join(ROOT, "data", `corp-${stock}-financials.json`);
  writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`✅ ${Object.keys(result).length}개 기간 재무 저장 → data/corp-${stock}-financials.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
