// DART 정기공시에서 'IV. 이사의 경영진단 및 분석의견(MD&A)' 본문 텍스트를 추출해
// data/corp-<stock>-mdna.json 으로 저장. (AI 요약의 입력 원문)
//
// 사용: node scripts/fetch-mdna.mjs <stock> <corp_code>
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
  console.error("사용: node scripts/fetch-mdna.mjs <stock> <corp_code>");
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

const START = ["이사의 경영진단 및 분석의견", "이사의 경영진단", "경영진단 및 분석의견"];
const END = [
  "회계감사인의 감사의견", "감사인의 감사의견", "독립된 감사인",
  "회사의 기관에 관한 사항", "이사회에 관한 사항", "주주에 관한 사항",
];

function clean(slice) {
  return slice
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function extractMdna(xml) {
  // START 마커의 '모든' 등장 위치를 후보로 잡고, 본문이 가장 긴 것을 선택
  // (목차(TOC)의 동일 제목은 뒤따르는 본문이 짧아 자동 배제됨)
  const starts = [];
  for (const k of START) {
    let i = -1;
    while ((i = xml.indexOf(k, i + 1)) !== -1) starts.push(i);
  }
  let bestText = null;
  for (const start of starts) {
    let end = xml.length;
    for (const k of END) {
      const i = xml.indexOf(k, start + 20);
      if (i > 0 && i < end) end = i;
    }
    const text = clean(xml.slice(start, end));
    if (text.length > (bestText?.length ?? 300)) bestText = text;
  }
  return bestText;
}

async function fetchDoc(rcept) {
  const dir = tmpdir();
  const zip = join(dir, `mdna-${rcept}.zip`);
  execSync(`curl -s "https://opendart.fss.or.kr/api/document.xml?crtfc_key=${KEY}&rcept_no=${rcept}" -o "${zip}"`);
  execSync(`cd "${dir}" && unzip -o "${zip}" >/dev/null 2>&1`);
  const files = execSync(`ls -S "${dir}"/${rcept}*.xml 2>/dev/null || true`).toString().trim().split("\n").filter(Boolean);
  return files.length ? readFileSync(files[0], "utf-8") : null;
}

const periods = {};
console.log(`📄 ${stock} 정기공시 ${PERIODIC.length}건 MD&A 추출...`);
for (const it of PERIODIC) {
  const info = periodInfo(it.report_nm);
  if (!info || periods[info.key]) continue;
  const xml = await fetchDoc(it.rcept_no);
  await sleep(150);
  if (!xml) continue;
  const text = extractMdna(xml);
  if (!text) continue;
  periods[info.key] = { ...info, rcept_no: it.rcept_no, text };
  console.log(`  ✓ ${info.label} (${it.report_nm}) — ${text.length}자`);
}

const out = { fetchedAt: new Date().toISOString(), stock, source: "DART 정기공시 'IV. 이사의 경영진단 및 분석의견'", periods };
writeFileSync(join(ROOT, "data", `corp-${stock}-mdna.json`), JSON.stringify(out, null, 2), "utf-8");
console.log(`✅ ${Object.keys(periods).length}개 기간 MD&A 저장 → data/corp-${stock}-mdna.json`);
