// DART 정기공시 '배당에 관한 사항' 표에서 현금배당성향·주당현금배당금·배당수익률(당기/전기)을 추출해
// data/corp-<stock>-dividends.json 으로 저장. (배당 태그·지표용)
//
// 사용: node scripts/fetch-dividends.mjs <stock> <corp_code>
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const KEY = (readFileSync(join(ROOT, ".env.local"), "utf-8").match(/DART_API_KEY\s*=\s*(\S+)/) || [])[1];

const stock = process.argv[2];
const corp = process.argv[3];
if (!stock || !corp) {
  console.error("사용: node scripts/fetch-dividends.mjs <stock> <corp_code>");
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const raw = JSON.parse(readFileSync(join(ROOT, "data", `corp-${stock}-raw.json`), "utf-8"));
const PERIODIC = raw.list.filter(
  (it) => /사업보고서|반기보고서|분기보고서/.test(it.report_nm) && !it.report_nm.includes("[")
);

function periodInfo(nm) {
  const m = nm.match(/\((\d{4})\.(\d{2})\)/);
  if (!m) return null;
  const q = { "03": 1, "06": 2, "09": 3, "12": 4 }[m[2]];
  return q ? { key: `${m[1]}Q${q}`, label: `${m[1]} ${q}분기`, reportName: nm } : null;
}

const num = (s) => {
  if (s == null) return null;
  const cleaned = String(s).replace(/[,\s]/g, "").replace(/[^\d.-]/g, "");
  if (cleaned === "" || cleaned === "-") return null; // 숫자 없는 라벨 셀은 null (Number("")===0 방지)
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : null;
};

// 배당 표 파싱: 당기/전기의 배당성향·주당현금배당금(보통주)·배당수익률(보통주)
// "주당 현금배당금"의 모든 등장 위치를 후보로 잡고, 실제 수치가 나오는 표를 선택(목차 오인식 회피)
function parseDividend(xml) {
  const anchors = [];
  let i = -1;
  while ((i = xml.indexOf("주당 현금배당금", i + 1)) !== -1) anchors.push(i);
  for (const anchor of anchors) {
    const from = xml.lastIndexOf("<TABLE", anchor);
    const end = xml.indexOf("</TABLE>", anchor) + 8;
    if (from < 0 || end < 8) continue;
    const rows = [...xml.slice(from, end).matchAll(/<TR[^>]*>([\s\S]*?)<\/TR>/g)].map((tr) =>
      [...tr[1].matchAll(/<T[DEH][^>]*>([\s\S]*?)<\/T[DEH]>/g)].map((m) =>
        m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      )
    );
    const rowNums = (kw) => {
      const r = rows.find((row) => row.some((c) => c.replace(/\s/g, "").includes(kw)));
      if (!r) return [null, null];
      const nums = r.map(num).filter((v) => v !== null);
      return [nums[0] ?? null, nums[1] ?? null];
    };
    const [payout, prevPayout] = rowNums("현금배당성향");
    const [dps, prevDps] = rowNums("주당현금배당금");
    const [dy] = rowNums("현금배당수익률");
    if (payout != null || dps != null) {
      return { payoutRatio: payout, prevPayoutRatio: prevPayout, dps, prevDps, dividendYield: dy };
    }
  }
  return null;
}

async function fetchDoc(rcept) {
  const dir = tmpdir();
  const zip = join(dir, `div-${rcept}.zip`);
  execSync(`curl -s "https://opendart.fss.or.kr/api/document.xml?crtfc_key=${KEY}&rcept_no=${rcept}" -o "${zip}"`);
  execSync(`cd "${dir}" && unzip -o "${zip}" >/dev/null 2>&1`);
  const files = execSync(`ls -S "${dir}"/${rcept}*.xml 2>/dev/null || true`).toString().trim().split("\n").filter(Boolean);
  return files.length ? readFileSync(files[0], "utf-8") : null;
}

const periods = {};
console.log(`📄 ${stock} 정기공시 ${PERIODIC.length}건 배당 파싱...`);
for (const it of PERIODIC) {
  const info = periodInfo(it.report_nm);
  if (!info || periods[info.key]) continue;
  const xml = await fetchDoc(it.rcept_no);
  await sleep(150);
  if (!xml) continue;
  const div = parseDividend(xml);
  if (!div) continue;
  periods[info.key] = { ...info, ...div };
  console.log(`  ✓ ${info.label} — DPS ${div.dps ?? "-"}원(전기 ${div.prevDps ?? "-"}), 배당성향 ${div.payoutRatio ?? "-"}%`);
}

const out = { fetchedAt: new Date().toISOString(), stock, source: "DART 정기공시 '배당에 관한 사항'", periods };
writeFileSync(join(ROOT, "data", `corp-${stock}-dividends.json`), JSON.stringify(out, null, 2), "utf-8");
console.log(`✅ ${Object.keys(periods).length}개 기간 배당 저장 → data/corp-${stock}-dividends.json`);
