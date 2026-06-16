// DART 정기공시(사업·반기·분기보고서) 원문에서 '사업부문별 요약 재무 현황' 표를 파싱해
// 부문별 매출·영업이익(누적)을 추출 → 단독분기 환산 + 직전분기(QoQ) 비교까지 만들어
// data/corp-<stock>-segments.json 으로 저장.
//
// 사용: node scripts/fetch-segments.mjs <stock> <corp_code>
//
// ※ 단일 영업부문 기업(부문 표가 없는 경우)은 singleSegment=true 로 표기.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadKey() {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf-8");
  return (raw.match(/DART_API_KEY\s*=\s*(\S+)/) || [])[1];
}

const stock = process.argv[2];
const corp = process.argv[3];
if (!stock || !corp) {
  console.error("사용: node scripts/fetch-segments.mjs <stock> <corp_code>");
  process.exit(1);
}
const KEY = loadKey();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 정기공시만 추림
const raw = JSON.parse(readFileSync(join(ROOT, "data", `corp-${stock}-raw.json`), "utf-8"));
const PERIODIC = raw.list.filter(
  (it) => /사업보고서|반기보고서|분기보고서/.test(it.report_nm) && !it.report_nm.includes("[")
);

// reportName → 기간/분기 라벨
function periodInfo(nm) {
  const m = nm.match(/\((\d{4})\.(\d{2})\)/);
  if (!m) return null;
  const year = Number(m[1]);
  const mm = m[2];
  const q = { "03": 1, "06": 2, "09": 3, "12": 4 }[mm];
  const kind = nm.includes("사업") ? "annual" : nm.includes("반기") ? "half" : "quarter";
  return { year, q, kind, key: `${year}Q${q}`, label: `${year} ${q}분기` };
}

const num = (s) => {
  if (s == null) return null;
  const neg = /△|-/.test(s);
  const v = Number(String(s).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(v) || s.trim() === "") return null;
  return neg ? -v : v;
};

// 원문에서 부문 표 파싱 → { unit, segments: [{name, revenue, op}] } (누적, 억원→원)
function parseSegments(xml) {
  const HEAD = "사업부문별 요약 재무 현황";
  let idx = xml.indexOf(HEAD);
  // 목차(TOC) 중복 회피: '매출액'+'영업이익'+'총자산' 이 모두 들어있는 표를 찾을 때까지 진행
  while (idx !== -1) {
    // 헤딩 이후 가장 가까운, 세 라벨을 모두 포함하는 TABLE 탐색
    let p = idx;
    for (let scan = 0; scan < 4; scan++) {
      p = xml.indexOf("<TABLE", p + 1);
      if (p < 0) break;
      const end = xml.indexOf("</TABLE>", p) + 8;
      const tbl = xml.slice(p, end);
      if (tbl.includes("매출액") && tbl.includes("영업이익") && tbl.includes("총자산")) {
        const rows = [...tbl.matchAll(/<TR[^>]*>([\s\S]*?)<\/TR>/g)].map((tr) =>
          [...tr[1].matchAll(/<T[DE][^>]*>([\s\S]*?)<\/T[DE]>/g)].map((m) =>
            m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
          )
        );
        const segs = [];
        let curName = null;
        for (const r of rows) {
          // 매출액 행: [부문명, "매출액", 당기값, %, 전기값, ...]
          const mIdx = r.indexOf("매출액");
          const oIdx = r.indexOf("영업이익");
          if (mIdx === 1 && r[0]) {
            curName = r[0];
            const rev = num(r[2]);
            segs.push({ name: curName, revenue: rev != null ? rev * 1e8 : null, op: null });
          } else if (oIdx === 0 && segs.length) {
            const op = num(r[1]);
            segs[segs.length - 1].op = op != null ? op * 1e8 : null;
          }
        }
        // 내부거래/연결조정 부문 제외 후 유효성 확인
        const clean = segs.filter((s) => s.name && !/^기타$|내부거래|연결|조정|합계|계$/.test(s.name) || s.revenue);
        if (segs.length >= 2) return { segments: segs };
      }
    }
    idx = xml.indexOf(HEAD, idx + 1);
  }
  return null; // 표 없음 → 단일 영업부문 등
}

// 2차 파서: '보고부문' 손익 주석 (부문=열, 예: 현대차 차량/금융/기타). 단위 자동 감지.
// 여러 후보 표 중 '매출액 행 최대값'이 가장 큰(=진짜 손익표) 표를 선택.
function parseSegmentsNote(xml) {
  const STOP = /합계|^계$|조정|연결|^부문$|보고부문|구분|기업|전체|총계|중요한|사항|제거|금액|누적|당기|전기|주석|기초|기말|^$/;
  const tables = [...xml.matchAll(/<TABLE[\s\S]*?<\/TABLE>/g)];
  let bestCand = null;
  for (const tm of tables) {
    const tbl = tm[0];
    if (!/매출액/.test(tbl) || !/영업(이익|손익)/.test(tbl)) continue;
    // 단위: 표 안 또는 표 앞 1500자 캡션에서 감지 (DART 주석은 보통 백만원)
    const ctx = xml.slice(Math.max(0, tm.index - 1500), tm.index) + tbl;
    const unit = /백만원/.test(ctx) ? 1e6 : /억원/.test(ctx) ? 1e8 : /천원/.test(ctx) ? 1e3 : 1e6;
    const rows = [...tbl.matchAll(/<TR[^>]*>([\s\S]*?)<\/TR>/g)].map((tr) =>
      [...tr[1].matchAll(/<T[DEH][^>]*>([\s\S]*?)<\/T[DEH]>/g)].map((m) =>
        m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      )
    );
    const revRowIdx = rows.findIndex((r) => r[0] === "매출액" && r.length >= 5);
    const opRowIdx = rows.findIndex((r) => /^영업(이익|손익)$/.test(r[0]) && r.length >= 5);
    if (revRowIdx < 0 || opRowIdx < 0) continue;
    // 부문명 행: 매출액 행 이전, 짧은 텍스트 라벨이 가장 많은 행
    let names = null, best = 0;
    for (let i = 0; i < revRowIdx; i++) {
      const labels = rows[i].filter((c) => c && !/\d/.test(c) && !STOP.test(c));
      if (labels.length >= 2 && labels.length > best) {
        best = labels.length;
        names = labels;
      }
    }
    if (!names) continue;
    const revVals = rows[revRowIdx].slice(1).map(num);
    const opVals = rows[opRowIdx].slice(1).map(num);
    const maxRev = Math.max(...revVals.filter((v) => v != null).map(Math.abs), 0);
    // 부문 수만큼만 매핑 (앞에서부터)
    const segments = names.map((name, i) => ({
      name,
      revenue: revVals[i] != null ? revVals[i] * unit : null,
      op: opVals[i] != null ? opVals[i] * unit : null,
    })).filter((s) => s.revenue != null);
    if (segments.length >= 2 && maxRev > (bestCand?.maxRev ?? 0)) {
      bestCand = { segments, maxRev };
    }
  }
  return bestCand ? { segments: bestCand.segments } : null;
}

async function fetchDoc(rcept) {
  const dir = tmpdir();
  const zip = join(dir, `seg-${rcept}.zip`);
  execSync(
    `curl -s "https://opendart.fss.or.kr/api/document.xml?crtfc_key=${KEY}&rcept_no=${rcept}" -o "${zip}"`
  );
  // 가장 큰 xml(본문) 추출
  execSync(`cd "${dir}" && unzip -o "${zip}" >/dev/null 2>&1`);
  const files = execSync(`ls -S "${dir}"/${rcept}*.xml 2>/dev/null || true`).toString().trim().split("\n").filter(Boolean);
  if (!files.length) return null;
  return readFileSync(files[0], "utf-8");
}

const cumulative = {}; // key(YYYYQn) -> { label, kind, segments(누적) }
let singleSegment = false;

console.log(`📄 ${stock} 정기공시 ${PERIODIC.length}건 부문 표 파싱...`);
for (const it of PERIODIC) {
  const info = periodInfo(it.report_nm);
  if (!info) continue;
  if (cumulative[info.key]) continue; // 정정 중복 방지(최초만)
  const xml = await fetchDoc(it.rcept_no);
  await sleep(150);
  if (!xml) continue;
  const parsed = parseSegments(xml) ?? parseSegmentsNote(xml);
  if (!parsed) continue;
  cumulative[info.key] = { ...info, segments: parsed.segments };
  console.log(`  ✓ ${info.label} (${it.report_nm}) — ${parsed.segments.length}개 부문`);
}

if (Object.keys(cumulative).length === 0) {
  singleSegment = true;
  console.log(`  ⓘ 부문 표 없음 → 단일 영업부문으로 표기`);
}

// ── 누적 → 단독분기 환산 ─────────────────────────────────────────
// 같은 연도: Q1=Q1누적, Q2=반기−Q1, Q3=9M−반기, Q4=연간−9M
function segMap(key) {
  const e = cumulative[key];
  if (!e) return null;
  const m = {};
  for (const s of e.segments) m[s.name] = s;
  return m;
}
function subtract(curKey, prevKey) {
  const cur = segMap(curKey), prev = segMap(prevKey);
  if (!cur) return null;
  if (!prev) return Object.values(cur); // 직전 누적 없으면 그대로
  return Object.keys(cur).map((name) => {
    const c = cur[name], p = prev[name];
    const d = (a, b) => (a == null ? null : b == null ? a : a - b);
    return { name, revenue: d(c.revenue, p?.revenue), op: d(c.op, p?.op) };
  });
}

// 단독분기 환산 — 환산이 '확실한' 기간만 채움(잘못된 누적값 노출 방지)
//  Q1: 그 자체가 단독분기 → 항상 신뢰
//  Q2~Q4: 같은 연도 직전 누적이 동일 부문 구성으로 존재할 때만 환산
const standalone = {}; // key -> [{name,revenue,op}]
function namesOf(key) {
  return (cumulative[key]?.segments ?? []).map((s) => s.name).sort().join(",");
}
for (const key of Object.keys(cumulative)) {
  const { year, q } = cumulative[key];
  if (q === 1) {
    standalone[key] = cumulative[key].segments;
  } else {
    const prevCumKey = `${year}Q${q - 1}`;
    if (cumulative[prevCumKey] && namesOf(prevCumKey) === namesOf(key)) {
      standalone[key] = subtract(key, prevCumKey);
    } // 직전 누적 없거나 부문 구성 다르면 환산 보류 → 미수록
  }
}

// ── 직전 분기(QoQ) 비교 부착 ────────────────────────────────────
function prevQuarterKey(year, q) {
  return q === 1 ? `${year - 1}Q4` : `${year}Q${q - 1}`;
}
const out = {}; // reportPeriodKey -> { label, rows:[{name,revenue,op,prevRevenue,prevOp}], prevLabel }
for (const key of Object.keys(cumulative)) {
  const { year, q, label } = cumulative[key];
  const cur = standalone[key];
  if (!cur) continue; // 단독분기 환산 불가 기간은 수록하지 않음
  const pk = prevQuarterKey(year, q);
  const prev = standalone[pk];
  const prevMap = {};
  (prev ?? []).forEach((s) => (prevMap[s.name] = s));
  out[key] = {
    label,
    prevKey: pk,
    prevLabel: cumulative[pk]?.label ?? null,
    rows: cur.map((s) => ({
      name: s.name,
      revenue: s.revenue,
      op: s.op,
      prevRevenue: prevMap[s.name]?.revenue ?? null,
      prevOp: prevMap[s.name]?.op ?? null,
    })),
  };
}

const result = {
  fetchedAt: new Date().toISOString(),
  stock,
  source: "DART 정기공시 '사업부문별 요약 재무 현황' (단독분기 환산·QoQ)",
  singleSegment,
  periods: out,
};
writeFileSync(join(ROOT, "data", `corp-${stock}-segments.json`), JSON.stringify(result, null, 2), "utf-8");
console.log(`✅ ${Object.keys(out).length}개 기간 부문 실적 저장 → data/corp-${stock}-segments.json`);
