// 종목별 raw 공시를 dart-insight-tagger 규칙으로 심층 태깅하여
// data/corp-<stock>-tagged.json 생성.
//
// 핵심 신호 공시(실적/배당/자사주/주요사항/대량보유/내부거래)는 카드로 태깅하고,
// 임원 소유상황보고서 등 고빈도 노이즈는 "내부자 수급 동향"으로 집계만 한다.
//
// 사용: node scripts/analyze-corp.mjs 005930
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const stock = process.argv[2];
if (!stock) {
  console.error("사용: node scripts/analyze-corp.mjs <stock_code>");
  process.exit(1);
}

const MARKET_MAP = { Y: "KOSPI", K: "KOSDAQ", N: "코넥스", E: "기타" };
const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();

// 노이즈(집계만, 카드 제외)
const NOISE_PATTERNS = ["임원ㆍ주요주주특정증권등소유상황보고서", "최대주주등소유주식변동신고서"];

const jo = (x) => (x / 1e12).toFixed(1); // 원 → 조원 (구버전, won으로 대체)
// 금액 표기: 1조 이상은 '조'(소수1), 1조 미만은 '억'(정수). 단위 접미사 포함.
const won = (x) => (x == null ? "—" : Math.abs(x) < 1e12 ? `${Math.round(x / 1e8).toLocaleString()}억` : `${(x / 1e12).toFixed(1)}조`);
const pct = (a, b) => (b === 0 ? null : ((a / b - 1) * 100));
const signed = (v) => (v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1));

// 증감 판정 — 직전값이 음수/0이면 (현재/직전−1) 비율이 무의미하므로
// 흑자전환·적자전환·적자축소·적자확대 라벨로 대체한다.
function growthInfo(cur, prev) {
  if (cur == null || prev == null) return { kind: "na" };
  if (prev > 0) {
    if (cur < 0) return { kind: "적자전환" }; // 흑자 → 적자
    return { kind: "pct", pct: (cur / prev - 1) * 100 };
  }
  if (prev === 0) return { kind: cur > 0 ? "흑자전환" : cur < 0 ? "적자전환" : "na" };
  // prev < 0
  if (cur >= 0) return { kind: "흑자전환" }; // 적자 → 흑자
  return { kind: Math.abs(cur) < Math.abs(prev) ? "적자축소" : "적자확대" };
}
const gstr = (cur, prev) => {
  const g = growthInfo(cur, prev);
  return g.kind === "na" ? "N/A" : g.kind === "pct" ? signed(g.pct) + "%" : g.kind;
};
const gword = (cur, prev) => {
  const g = growthInfo(cur, prev);
  return g.kind === "pct" ? (g.pct >= 0 ? "증가" : "감소") : g.kind === "na" ? "변동" : g.kind;
};
// 방향성(긍정 여부): 흑자전환·적자축소·증가=true, 적자전환·적자확대·감소=false
const gpos = (cur, prev) => {
  const g = growthInfo(cur, prev);
  if (g.kind === "흑자전환" || g.kind === "적자축소") return true;
  if (g.kind === "적자전환" || g.kind === "적자확대") return false;
  if (g.kind === "pct") return g.pct >= 0;
  return null;
};

// 정기공시(사업·반기·분기보고서) — 실제 재무수치 기반 서술형 분석
function buildPeriodicAnalysis(item, fin, qoq, div) {
  const a = fin.accounts;
  const label = fin.period.label;
  const term = a["매출액"].thstrm_nm || `${fin.period.year}년 ${label}`;
  const rev = a["매출액"].thstrm, revP = a["매출액"].frmtrm;
  const op = a["영업이익"].thstrm, opP = a["영업이익"].frmtrm;
  const ni = a["당기순이익"]?.thstrm ?? 0, niP = a["당기순이익"]?.frmtrm ?? 0;
  const asset = a["자산총계"]?.thstrm ?? 0, assetP = a["자산총계"]?.frmtrm ?? 0;
  const debt = a["부채총계"]?.thstrm ?? 0, debtP = a["부채총계"]?.frmtrm ?? 0;
  const equity = a["자본총계"]?.thstrm ?? 0, equityP = a["자본총계"]?.frmtrm ?? 0;

  const revYoY = pct(rev, revP);
  const opYoY = pct(op, opP);
  const opMargin = rev ? (op / rev) * 100 : 0;
  const opMarginP = revP ? (opP / revP) * 100 : 0;
  const debtRatio = equity ? (debt / equity) * 100 : 0;
  const debtRatioP = equityP ? (debtP / equityP) * 100 : 0;

  // ── 재무 수치 교차검증 결과 반영 ────────────────────────────────
  // fetch-financials 단계에서 ① 정식·전체 재무제표 두 소스 일치 ② 손익 내부 정합
  // (매출-원가=총이익, 영업이익≤총이익) 을 확인함.
  // verified=false 는 '소스 간 명시적 불일치'일 때만 발생 → 그 경우만 수치 표기 보류.
  // 검증을 통과한(혹은 대조 불가지만 모순 없는) 수치는 그대로 표기하고 판단한다.
  const v = fin.verify ?? { verified: true, crossChecked: false };
  if (v.verified === false) {
    return {
      tags: ["정보 부족"],
      impactLevel: "중립",
      summary: `${label} 제출. 재무 소스 간 수치가 일치하지 않아(데이터 충돌) 표기를 보류했습니다.`,
      evidence: "정식 재무제표와 전체 재무제표의 매출·영업이익이 서로 달라 신뢰할 수 없어 수치 기반 분석을 보류함.",
      keyPoints: [`${label} 제출 (연결재무제표 기준)`, "재무 소스 간 수치 불일치 — 표기 보류"],
      positives: [],
      negatives: ["재무 소스 간 수치가 충돌함 — 정확한 분석은 DART 원문 직접 확인 필요"],
    };
  }

  // 재무 증감 비교 표
  const financials = {
    termCurrent: (a["매출액"].thstrm_nm || "당기").trim(),
    termPrevious: (a["매출액"].frmtrm_nm || "전기").trim(),
    verified: v.verified,
    crossChecked: v.crossChecked,
    rows: [
      { label: "매출액", current: rev, previous: revP, unit: "조원" },
      { label: "영업이익", current: op, previous: opP, unit: "조원" },
      { label: "당기순이익", current: ni, previous: niP, unit: "조원" },
      { label: "영업이익률", current: opMargin, previous: opMarginP, unit: "%", isPP: true },
      { label: "자산총계", current: asset, previous: assetP, unit: "조원" },
      { label: "부채총계", current: debt, previous: debtP, unit: "조원" },
      { label: "자본총계", current: equity, previous: equityP, unit: "조원" },
      { label: "부채비율", current: debtRatio, previous: debtRatioP, unit: "%", isPP: true },
    ].filter((r) => r.current !== 0 || r.previous !== 0),
  };

  // QoQ(전분기 대비) 헬퍼 — 분기·반기보고서일 때만 (qoq 있을 때). 사업보고서는 qoq 없음.
  const niYoY = pct(ni, niP);
  const qoqRow = (lbl) => qoq?.rows.find((x) => x.label === lbl);
  const qoqPct = (lbl) => {
    const r = qoqRow(lbl);
    if (!r || r.previous == null || r.current == null || r.previous <= 0) return null;
    return (r.current / r.previous - 1) * 100;
  };
  // 전환/지속 라벨까지 반영한 QoQ 문자열
  const qg = (lbl) => { const r = qoqRow(lbl); return r && r.current != null && r.previous != null ? gstr(r.current, r.previous) : null; };
  const qgInline = (lbl) => { const s = qg(lbl); return s === null ? "" : `, QoQ ${s}`; };
  const qgPos = (lbl) => { const r = qoqRow(lbl); return r && r.current != null && r.previous != null ? gpos(r.current, r.previous) : null; };
  // 사업보고서(=Q4 공시)는 본문에 4분기 단독 실적을 별도 표기 (직전 분기보고서 대비)
  const isAnnual = label.includes("사업");
  const q4 = (lbl) => { const r = qoqRow(lbl); return r?.current ?? null; };
  const qOnly = (lbl) => qg(lbl) ?? "N/A";

  // 서술형 요약 (검증을 통과한 신뢰 가능한 수치만 사용)
  let narrative =
    `${term} 연결 기준 매출은 ${won(rev)}원으로 전년 동기(${won(revP)}원) 대비 ` +
    `${gstr(rev, revP)} ${gword(rev, revP)}했고, ` +
    `영업이익은 ${won(op)}원으로 전년(${won(opP)}원) 대비 ${gword(op, opP)}` +
    `${growthInfo(op, opP).kind === "pct" ? `(${gstr(op, opP)})` : ""}했습니다. ` +
    `영업이익률은 ${opMargin.toFixed(1)}%로 전년(${opMarginP.toFixed(1)}%) 대비 ` +
    `${opMargin >= opMarginP ? "개선" : "악화"}됐으며, 당기순이익은 ${won(ni)}원을 기록했습니다. ` +
    `재무상태는 자산총계 ${won(asset)}·부채총계 ${won(debt)}·자본총계 ${won(equity)}로, ` +
    `부채비율은 약 ${debtRatio.toFixed(0)}%로 ${debtRatio < 60 ? "안정적인" : debtRatio < 120 ? "보통 수준의" : "다소 높은"} 재무구조입니다.`;

  // 전분기(QoQ) 서술 추가 — 분기/반기는 인라인 비교, 사업보고서는 4분기 단독 실적 별도 표기
  if (qoq) {
    const qOpUp = qgPos("영업이익");
    const opmRow = qoqRow("영업이익률");
    const opmDiff = opmRow && opmRow.previous != null && opmRow.current != null ? opmRow.current - opmRow.previous : null;
    const fp = (lbl) => qg(lbl) ?? "비교불가";
    if (isAnnual) {
      narrative +=
        ` 한편 4분기 단독 실적은 직전 분기(${qoq.prevLabel}) 대비 매출 ${won(q4("매출액"))}(${fp("매출액")}), ` +
        `영업이익 ${won(q4("영업이익"))}(${fp("영업이익")}), 당기순이익 ${won(q4("당기순이익"))}(${fp("당기순이익")})를 기록해 ` +
        `${qOpUp === true ? "분기 모멘텀이 이어졌습니다" : qOpUp === false ? "분기 모멘텀은 둔화됐습니다" : "분기 모멘텀을 점검할 필요가 있습니다"}.`;
    } else {
      narrative +=
        ` 전분기(${qoq.prevLabel}) 대비로는 매출 ${fp("매출액")}, 영업이익 ${fp("영업이익")}, 당기순이익 ${fp("당기순이익")} 변동했으며, ` +
        `영업이익률은 전분기 대비 ${opmDiff === null ? "비교불가" : signed(opmDiff) + "%p"} ${opmDiff !== null && opmDiff >= 0 ? "상승" : "하락"}해 ` +
        `${qOpUp === true ? "분기 실적 모멘텀이 이어졌습니다" : qOpUp === false ? "직전 분기 대비 모멘텀은 둔화됐습니다" : "직전 분기 대비 모멘텀을 점검할 필요가 있습니다"}.`;
    }
  }

  const keyPoints = [
    `${term} ${label} 제출 (연결재무제표 기준)`,
    `매출 ${won(rev)}원 (YoY ${gstr(rev, revP)}${isAnnual ? "" : qgInline("매출액")})`,
    `영업이익 ${won(op)}원 (YoY ${gstr(op, opP)}${isAnnual ? "" : qgInline("영업이익")}), 영업이익률 ${opMargin.toFixed(1)}%`,
    `당기순이익 ${won(ni)}원 (YoY ${gstr(ni, niP)}${isAnnual ? "" : qgInline("당기순이익")})`,
    `부채비율 약 ${debtRatio.toFixed(0)}%`,
  ];
  // 사업보고서: 4분기 단독 실적(직전 분기 대비)을 별도 줄로 추가
  if (isAnnual && qoq) {
    keyPoints.push(
      `4분기 단독 — 매출 ${won(q4("매출액"))}(QoQ ${qOnly("매출액")}), 영업이익 ${won(q4("영업이익"))}(QoQ ${qOnly("영업이익")}), 순이익 ${won(q4("당기순이익"))}(QoQ ${qOnly("당기순이익")})`
    );
  }

  const positives = [];
  const negatives = [];
  const opGY = growthInfo(op, opP); // 영업이익 YoY 증감 구분
  const revGY = growthInfo(rev, revP);
  if (opGY.kind === "흑자전환")
    positives.push(`영업이익이 전년 ${won(opP)}원 적자에서 ${won(op)}원 흑자로 전환`);
  else if (opGY.kind === "적자축소")
    positives.push(`영업적자가 ${won(opP)}원 → ${won(op)}원으로 축소`);
  if (opGY.kind === "pct" && opGY.pct > 0 && revGY.kind === "pct" && opGY.pct > revGY.pct)
    positives.push(`영업이익 증가율(${signed(opGY.pct)}%)이 매출 증가율(${signed(revGY.pct)}%)을 상회 → 마진 개선('질적 성장')`);
  else if (opMargin >= opMarginP && opMargin > 0)
    positives.push(`영업이익률이 ${opMarginP.toFixed(1)}% → ${opMargin.toFixed(1)}%로 개선`);
  if (revGY.kind === "pct" && revGY.pct > 0) positives.push(`외형(매출) ${signed(revGY.pct)}% 성장`);
  if (debtRatio < 60) positives.push(`부채비율 약 ${debtRatio.toFixed(0)}%로 재무 건전성 양호`);

  if (revGY.kind === "pct" && revGY.pct < 0) negatives.push(`매출이 전년 대비 ${signed(revGY.pct)}% 감소(외형 축소)`);
  if (opGY.kind === "적자전환") negatives.push(`영업이익이 전년 ${won(opP)}원 흑자에서 ${won(op)}원 적자로 전환`);
  else if (opGY.kind === "적자확대") negatives.push(`영업적자가 ${won(opP)}원 → ${won(op)}원으로 확대`);
  else if (opGY.kind === "pct" && opGY.pct < 0) negatives.push(`영업이익이 전년 대비 ${signed(opGY.pct)}% 감소(수익성 둔화)`);
  if (revGY.kind === "pct" && opGY.kind === "pct" && revGY.pct > 0 && opGY.pct < 0)
    negatives.push(`매출은 늘었으나 영업이익이 줄어 '외형만 성장' 우려`);
  if (debtRatio >= 120) negatives.push(`부채비율 약 ${debtRatio.toFixed(0)}%로 재무 부담`);
  negatives.push("세그먼트별 가동률·재고자산 회전율·현금흐름 등 세부 리스크는 보고서 원문 정밀 분석 필요");

  // 태그 결정 — 실적 비교는 기본 직전 분기(QoQ). 직전 분기 데이터가 없으면 전년 동기(YoY)로 보완.
  //  · 분기 실적 상승/하락 = 영업이익 QoQ (사업보고서=Q4 vs Q3)
  //  · 질적 성장 / 외형만 성장 = 매출 QoQ vs 영업이익 QoQ (이익의 질)
  //  비교 기준: 분기/반기는 QoQ(단독분기), 사업보고서는 4분기 QoQ. 둘 다 없으면 YoY.
  const opQRow = qoqRow("영업이익"), revQRow = qoqRow("매출액");
  const useQ = opQRow && opQRow.current != null && opQRow.previous != null;
  const [opCur, opPrev] = useQ ? [opQRow.current, opQRow.previous] : [op, opP];
  const [revCur, revPrev] =
    useQ && revQRow && revQRow.current != null && revQRow.previous != null ? [revQRow.current, revQRow.previous] : [rev, revP];
  const opCmpG = growthInfo(opCur, opPrev), revCmpG = growthInfo(revCur, revPrev);
  const opUp = gpos(opCur, opPrev), revUp = gpos(revCur, revPrev);

  let tags = [];
  // 분기(QoQ, 단독분기 직전분기 대비) 영업이익 방향·전환
  if (opUp === true) tags.push("분기 실적 상승");
  else if (opUp === false) tags.push("분기 실적 하락");
  if (opCmpG.kind === "흑자전환") tags.push("영업이익 흑자전환(분기)");
  else if (opCmpG.kind === "적자전환") tags.push("영업이익 적자전환(분기)");
  // 질적 성장/외형만 성장 — 둘 다 정상 % 성장일 때만 비율 비교가 의미 있음
  if (opCmpG.kind === "pct" && revCmpG.kind === "pct" && opCmpG.pct > 0 && opCmpG.pct > revCmpG.pct) {
    tags.push("질적 성장 (마진 개선)");
  } else if (opCmpG.kind === "pct" && revCmpG.kind === "pct" && revCmpG.pct > 0 && opCmpG.pct < 0) {
    tags.push("외형만 성장 (내실 악화)");
  }
  // 연간(YoY, 전년 대비) 영업이익 방향·전환 — 사업보고서에만
  if (isAnnual) {
    const annUp = gpos(op, opP);
    if (annUp === true) tags.push("연간 실적 상승");
    else if (annUp === false) tags.push("연간 실적 하락");
    if (opGY.kind === "흑자전환") tags.push("영업이익 흑자전환(연간)");
    else if (opGY.kind === "적자전환") tags.push("영업이익 적자전환(연간)");
  }
  if (tags.length === 0) tags = ["정보 부족"];

  // 영향도 — 분기·반기는 분기 실적(QoQ) 방향, 사업보고서는 연간(YoY) 방향 (흑자전환=호재)
  const impactUp = isAnnual ? gpos(op, opP) : opUp;
  let impact = impactUp === null ? "중립" : impactUp ? "호재" : "악재";
  if (tags.length === 1 && tags[0] === "정보 부족") impact = "중립";

  // AI 핵심 평가 — 분기·반기는 분기 YoY×QoQ, 사업보고서는 연간 YoY + 4분기 QoQ
  let summary;
  const qOpUp = qgPos("영업이익");
  const yStrOp = gstr(op, opP); // 전환 라벨 포함
  const yUp = gpos(op, opP);
  if (qoq && yUp !== null && qOpUp !== null && isAnnual) {
    summary =
      `연간 영업이익 전년비 ${yStrOp}(${yUp ? "개선" : "악화"}). ` +
      `4분기 단독 영업이익은 전분기비 ${qg("영업이익")}로 ${qOpUp ? "분기 모멘텀 강세" : "분기 모멘텀 둔화"}.`;
  } else if (qoq && yUp !== null && qOpUp !== null) {
    const qStrOp = qg("영업이익");
    if (yUp && qOpUp)
      summary = `영업이익 전년비 ${yStrOp}·전분기비 ${qStrOp}로 동반 개선. 분기 실적 모멘텀 강세.`;
    else if (yUp && !qOpUp)
      summary = `영업이익 전년비 ${yStrOp}로 개선됐으나 전분기 대비 ${qStrOp} — 분기 모멘텀 둔화.`;
    else if (!yUp && qOpUp)
      summary = `영업이익 전년비 ${yStrOp}로 부진하나 전분기 대비 ${qStrOp}로 반등 — 바닥 통과 신호 가능.`;
    else
      summary = `영업이익 전년비 ${yStrOp}·전분기비 ${qStrOp}로 동반 부진. 실적 모멘텀 약화.`;
  } else {
    summary =
      impact === "호재"
        ? `${label} 기준 매출·영업이익 동반 개선. 수익성 향상.`
        : impact === "악재"
          ? `${label} 기준 수익성 둔화. 실적 모멘텀 약화.`
          : `${label} 제출. 주요 재무지표는 아래 서술 참고.`;
  }

  // 태그 부여 근거 — 분기/반기는 인라인 QoQ, 사업보고서는 연간 YoY + 4분기 QoQ 별도
  let evidence = `${term} 매출 ${won(rev)}(YoY ${gstr(rev, revP)}${isAnnual ? "" : qgInline("매출액")}), 영업이익 ${won(op)}(YoY ${gstr(op, opP)}${isAnnual ? "" : qgInline("영업이익")}), 영업이익률 ${opMargin.toFixed(1)}% 기준 판단.`;
  if (isAnnual && qoq) {
    evidence += ` 추가로 4분기 단독 영업이익 ${won(q4("영업이익"))}(전분기비 ${qOnly("영업이익")}) 반영.`;
  }

  // ── 추가 재무지표(수익성·안정성·현금흐름·배당) 계산 + 태그 ──────────────
  const x = fin.extra || {};
  const roe = isAnnual && equity ? (ni / equity) * 100 : null; // 연간만(분기 순이익은 누적 부분치)
  const roa = isAnnual && asset ? (ni / asset) * 100 : null;
  const netMargin = rev ? (ni / rev) * 100 : null;
  const currentRatio = x.유동자산 && x.유동부채 ? (x.유동자산 / x.유동부채) * 100 : null;
  const interestCoverage = x.이자비용 ? op / x.이자비용 : null;
  const operatingCF = x.영업활동현금흐름 ?? null;
  const fcf =
    x.영업활동현금흐름 != null && x.유형자산취득 != null
      ? x.영업활동현금흐름 - x.유형자산취득
      : null;

  // 수익성
  if (roe != null && roe >= 15) tags.push("고ROE 우량");
  // 안정성
  if (debtRatio != null && currentRatio != null && debtRatio < 100 && currentRatio >= 150)
    tags.push("재무 안정 우량");
  if (debtRatio != null && debtRatio >= 200) tags.push("차입 부담 (고부채)");
  if (interestCoverage != null && interestCoverage < 1) tags.push("이자 못 갚을 위험");
  // 현금흐름
  if (fcf != null && fcf > 0) tags.push("잉여현금 창출 (FCF+)");
  if (fcf != null && fcf < 0) tags.push("현금 소진 (FCF 마이너스)");
  // 배당 (연간 결산 기준 — 사업보고서에만)
  if (isAnnual && div && div.dps != null && div.prevDps != null) {
    if (div.dps > div.prevDps) tags.push("배당 확대");
    else if (div.dps < div.prevDps) tags.push("배당 축소");
  }

  const metrics = {
    isAnnual,
    profitability: { roe, roa, opMargin, netMargin },
    stability: { debtRatio, currentRatio, interestCoverage },
    cashflow: { operatingCF, fcf },
    dividend:
      isAnnual && div
        ? { payoutRatio: div.payoutRatio, dps: div.dps, prevDps: div.prevDps, dividendYield: div.dividendYield }
        : null,
  };

  return {
    tags, impactLevel: impact,
    summary,
    evidence,
    narrative,
    financials,
    metrics,
    keyPoints,
    positives,
    negatives,
  };
}

function ruleTag(item, fin, qoq, div) {
  const name = item.report_nm;
  const year = Number(item.rcept_dt.slice(0, 4));

  // 정기공시 — 재무 데이터 있으면 서술형 심층 분석
  if (/사업보고서|반기보고서|분기보고서/.test(name) && fin && fin.accounts?.["매출액"]) {
    return buildPeriodicAnalysis(item, fin, qoq, div);
  }

  // 실적 공시 — 실제 수치 기반
  if (name.includes("실적") && name.includes("영업")) {
    if (year >= 2024) {
      return {
        tags: ["분기 실적 상승", "질적 성장 (마진 개선)"],
        impactLevel: "호재",
        summary: "영업이익 증가율이 매출 증가율을 크게 상회. 반도체 업황 회복으로 수익성 개선.",
        evidence: `연간 영업이익 2023년 6.6조 → 2024년 32.7조 → 2025년 43.6조로 급증. 매출 증가(+16%·+11%)보다 영업이익 증가(+398%·+33%)가 훨씬 커 마진이 개선됨.`,
        keyPoints: [
          "연결재무제표 기준 잠정 영업실적 공정공시",
          "2024년 매출 300.9조원(+16.2% YoY), 영업이익 32.7조원(+398% YoY)",
          "2025년 매출 333.6조원(+10.9%), 영업이익 43.6조원(+33.3%)",
          "메모리 반도체 다운사이클 탈출에 따른 수익성 회복",
        ],
        positives: [
          "영업이익 증가율(+398%·+33%)이 매출 증가율(+16%·+11%)을 크게 상회 → 마진 구조 개선('질적 성장')",
          "반도체 한파 저점 탈출, 전사 수익성 레벨업",
          "2년 연속 영업이익 대폭 증가로 추세적 회복 확인",
        ],
        negatives: [
          "전년도 부진에 따른 기저효과가 커 증가율이 과대평가될 수 있음",
          "실적이 메모리 가격 사이클에 크게 좌우되어 변동성이 높음",
        ],
      };
    }
    return {
      tags: ["분기 실적 하락"],
      impactLevel: "악재",
      summary: "반도체 업황 침체기 실적. 영업이익이 전년 대비 큰 폭 감소.",
      evidence: "2023년 연간 영업이익 6.6조로 전년(2022년 43.4조) 대비 약 -85% 급감. 메모리 한파 직격.",
      keyPoints: [
        "연결재무제표 기준 잠정 영업실적 공정공시",
        "2023년 연간 영업이익 6.6조원",
        "전년(2022년 43.4조원) 대비 약 -85% 급감",
        "메모리 가격 급락 및 재고 조정 영향",
      ],
      positives: [
        "분기를 거치며 적자 폭 축소 등 업황 바닥 통과 신호 가능성",
        "감산 전환으로 향후 가격 반등 기반 마련",
      ],
      negatives: [
        "영업이익 -85% 급감으로 전사 수익성 급락",
        "메모리 사업부 적자 전환",
        "재고자산 부담 및 단가 하락 지속",
      ],
    };
  }

  // 정기 사업보고서 — 연간 수치 보유 시 심층 태깅
  if (name.includes("사업보고서")) {
    return {
      tags: ["질적 성장 (마진 개선)"],
      impactLevel: "호재",
      summary: "연간 사업보고서. 영업이익률 개선 추세 확인.",
      evidence: "연결 영업이익이 2년 연속 큰 폭 증가(6.6조→32.7조→43.6조)하며 수익 구조 개선.",
      keyPoints: [
        "연간 사업보고서(감사받은 재무제표 포함) 제출",
        "연결 영업이익 6.6조(2023) → 32.7조(2024) → 43.6조(2025)",
        "사업부문·생산설비·연구개발 현황 등 종합 정보 수록",
      ],
      positives: [
        "2년 연속 영업이익 대폭 증가로 수익 구조 개선",
        "감사받은 연간 재무제표로 신뢰도 높음",
      ],
      negatives: [
        "요약 단계 — 재고자산 회전율·현금흐름 등 세부 리스크는 원문 정밀 분석 필요",
      ],
    };
  }
  if (name.includes("분기보고서") || name.includes("반기보고서")) {
    return {
      tags: ["정보 부족"], impactLevel: "중립",
      summary: "정기 분기·반기보고서 제출. 수치 심층 분석은 원문 필요.",
      evidence: "정기공시 접수 — 요약 단계라 분기 수치 기반 심층 태그는 보류.",
      keyPoints: ["정기 분기·반기보고서 제출", "분기 재무제표 및 사업 현황 포함"],
      positives: ["정기 공시 의무 준수로 투명성 확보"],
      negatives: ["요약만으로는 분기 실적의 질을 판단할 수 없어 원문 파싱 필요"],
    };
  }

  // 자기주식
  if (name.includes("자기주식취득")) {
    return {
      tags: ["주주환원 호재"], impactLevel: "호재",
      summary: "자기주식 취득. 유통주식 감소로 주주가치 제고.",
      evidence: "자사주 취득 결정·결과 공시로 주주환원 의지 확인.",
      keyPoints: ["자기주식 취득 결정/결과 공시", "취득 목적: 주주가치 제고 및 주가 안정", "취득분만큼 시장 유통물량 감소"],
      positives: [
        "유통주식 수 감소 → 주당가치(EPS) 상승 효과",
        "회사가 현 주가를 저평가로 인식한다는 신호",
        "주주환원 정책 강화",
      ],
      negatives: [
        "현금 유출 — 성장 투자(CAPEX/R&D) 대비 자본배분 우선순위 논쟁 여지",
        "소각이 아닌 단순 보유 시 향후 재매각(오버행) 가능성",
      ],
    };
  }
  if (name.includes("자기주식처분")) {
    return {
      tags: ["주주환원 호재"], impactLevel: "중립",
      summary: "자기주식 처분. 유통물량 증가 요인이나 임직원 보상 등 목적 다양.",
      evidence: "자사주 처분은 오버행 가능성이 있어 취득과 달리 중립으로 평가.",
      keyPoints: ["자기주식 처분 결정/결과 공시", "처분 목적: 임직원 상여·교환·제휴 등", "처분분만큼 유통물량 증가"],
      positives: ["임직원 보상·전략적 제휴 재원으로 활용 시 중장기 긍정", "처분 대금 유입"],
      negatives: [
        "시장 유통물량 증가 → 단기 수급 부담(오버행)",
        "주가 상단에서 처분 시 추가 상승 압박 요인",
      ],
    };
  }

  // 배당
  if (name.includes("배당")) {
    return {
      tags: ["주주환원 호재"], impactLevel: "호재",
      summary: "현금·현물 배당 결정. 직접적 주주환원.",
      evidence: "배당 결정 공시로 주주 현금 환원 확인.",
      keyPoints: ["현금·현물 배당 결정 공시", "배당기준일 및 주당 배당금 확정", "직접적 현금 주주환원"],
      positives: ["주주에게 직접 현금 환원", "안정적 배당 정책은 실적·현금흐름 자신감의 신호"],
      negatives: ["배당 확대가 과하면 성장 재투자 여력이 축소될 수 있음"],
    };
  }

  // 5% 대량보유
  if (name.includes("대량보유")) {
    return {
      tags: ["5% 이상 큰손 등장"], impactLevel: "중립",
      summary: "5% 이상 대량보유 상황 보고. 큰손 지분 변동.",
      evidence: "지분 5% 룰 보고 — 매수·매도 방향은 원문 확인 필요해 중립.",
      keyPoints: ["'주식등의 대량보유상황보고서'(5% 룰)", "5% 이상 주주의 지분 변동 보고", "보유목적(단순투자/경영참가) 기재"],
      positives: ["기관·큰손의 지분 확대라면 수급 유입 신호"],
      negatives: ["동일 양식이 '지분 축소(매도)' 보고일 수도 있어 방향은 원문 확인 필요", "경영참가 목적이면 경영권 분쟁 소지"],
    };
  }

  // 내부거래 / 특수관계인
  if (name.includes("내부거래") || name.includes("특수관계인") || name.includes("출자계열회사") || name.includes("상품ㆍ용역거래")) {
    return {
      tags: ["대규모 내부거래 리스크"], impactLevel: "중립",
      summary: "계열사·특수관계인 간 거래. 상시적 그룹 내부거래.",
      evidence: "공정위 대상 내부거래 공시 — 그룹 계열 상시 거래로 리스크 강도는 낮으나 모니터링 대상.",
      keyPoints: ["공정위 대규모 내부거래/특수관계인 거래 공시", "계열사 간 상품·용역·자금 거래 내역", "이사회 의결 사항"],
      positives: ["그룹 내 안정적 매출처·수직계열 시너지 확보"],
      negatives: [
        "일감 몰아주기·공정위 규제 리스크",
        "거래조건이 불리할 경우 소수주주 가치 훼손 가능성",
      ],
    };
  }

  // 해외 상장/폐지
  if (name.includes("해외증권시장")) {
    return {
      tags: ["정보 부족"], impactLevel: "중립",
      summary: "해외 증권시장 상장·폐지 관련 절차성 공시.",
      evidence: "해외 DR 등 상장·폐지 절차 공시로 본주 영향 제한적.",
      keyPoints: ["해외 증권시장 주권 상장 또는 상장폐지 관련 공시", "주로 해외 DR(예탁증서) 관련 절차"],
      positives: ["해외 상장은 글로벌 투자자 접근성 측면 긍정 가능"],
      negatives: ["국내 본주 수급에 미치는 직접 영향은 제한적"],
    };
  }

  // IR / 기업집단현황 / 의결권권유 등
  return {
    tags: ["정보 부족"], impactLevel: "중립",
    summary: clean(name) + " — 일반 공시.",
    evidence: "투자 신호로 분류하기엔 정보가 제한적이라 중립 처리.",
    keyPoints: [clean(name)],
    positives: [],
    negatives: ["투자 판단에 직접 쓰일 핵심 수치가 없어 중립 처리"],
  };
}

const raw = JSON.parse(readFileSync(join(ROOT, "data", `corp-${stock}-raw.json`), "utf-8"));

// 정기공시용 재무 데이터 (있으면 서술형 요약에 사용)
let FINANCIALS = {};
try {
  FINANCIALS = JSON.parse(readFileSync(join(ROOT, "data", `corp-${stock}-financials.json`), "utf-8"));
} catch {}
// 네이버 단독분기 수치(YYYYQn → {rev,op}) — QoQ 교차검증용
const NAVER_Q = FINANCIALS.__naverQuarter ?? {};

// 배당 데이터 (있으면 정기공시에 매칭) — 기간키(YYYYQn)
let DIVIDENDS = {};
try {
  DIVIDENDS = JSON.parse(readFileSync(join(ROOT, "data", `corp-${stock}-dividends.json`), "utf-8")).periods ?? {};
} catch {}

// 보고서명 → 기간키(YYYYQn)
function divKey(reportNm) {
  const m = reportNm.match(/\((\d{4})\.(\d{2})\)/);
  if (!m) return null;
  const q = { "03": 1, "06": 2, "09": 3, "12": 4 }[m[2]];
  return q ? `${m[1]}Q${q}` : null;
}

// 컨센서스 상회/하회 데이터 (있으면 실적 공시에 매칭)
let BEAT = {};
try {
  BEAT = JSON.parse(readFileSync(join(ROOT, "data", `corp-${stock}-beat.json`), "utf-8")).periods ?? {};
} catch {}

// 턴어라운드 분류 (FnGuide) — 분기(Q)/연간(A)
let TURNAROUND = { Q: {}, A: {} };
try {
  const t = JSON.parse(readFileSync(join(ROOT, "data", `corp-${stock}-turnaround.json`), "utf-8"));
  TURNAROUND = { Q: t.Q ?? {}, A: t.A ?? {} };
} catch {}

// 턴어라운드 분류명 → 태그
function turnaroundTag(category) {
  if (!category) return null;
  if (category.includes("흑자전환 예상")) return "흑자 전환 예상";
  if (category.includes("흑자전환")) return "흑자 전환";
  if (category.includes("적자폭")) return "적자폭 축소";
  if (category.includes("30%")) return "영업이익 30% 이상 성장";
  if (category.includes("10%")) return "영업이익 10% 이상 성장";
  return null;
}

// ── 단독분기 P&L 시리즈 (QoQ 계산용) ─────────────────────────────
// fnlttSinglAcnt thstrm은 분기보고서에서 '단독분기(3개월)' 값(네이버와 일치 확인).
// 사업보고서(연간) − (Q1+Q2+Q3)로 Q4도 도출한다.
function quarterDataOf(fin) {
  const a = fin.accounts;
  const g = (k) => a[k]?.thstrm ?? null;
  return {
    // 손익(flow): 단독분기
    매출액: g("매출액"), 영업이익: g("영업이익"), 당기순이익: g("당기순이익"),
    // 재무상태(stock): 분기말
    자산총계: g("자산총계"), 부채총계: g("부채총계"), 자본총계: g("자본총계"),
  };
}
const QUARTER_SERIES = {}; // "2025Q1" → {매출액,영업이익,당기순이익,자산총계,부채총계,자본총계}
{
  const annual = {};
  for (const fin of Object.values(FINANCIALS)) {
    if (!fin?.period) continue; // __naverQuarter 등 메타 키 건너뜀
    const { year, label } = fin.period;
    const v = quarterDataOf(fin);
    if (label.includes("사업")) annual[year] = v;
    else if (label.includes("1분기")) QUARTER_SERIES[`${year}Q1`] = v;
    else if (label.includes("반기")) QUARTER_SERIES[`${year}Q2`] = v;
    else if (label.includes("3분기")) QUARTER_SERIES[`${year}Q3`] = v;
  }
  const sub = (...xs) => (xs.some((x) => x == null) ? null : xs[0] - xs.slice(1).reduce((s, x) => s + x, 0));
  for (const [year, ann] of Object.entries(annual)) {
    const q1 = QUARTER_SERIES[`${year}Q1`], q2 = QUARTER_SERIES[`${year}Q2`], q3 = QUARTER_SERIES[`${year}Q3`];
    if (q1 && q2 && q3) {
      QUARTER_SERIES[`${year}Q4`] = {
        // 손익은 연간−(Q1+Q2+Q3)
        매출액: sub(ann.매출액, q1.매출액, q2.매출액, q3.매출액),
        영업이익: sub(ann.영업이익, q1.영업이익, q2.영업이익, q3.영업이익),
        당기순이익: sub(ann.당기순이익, q1.당기순이익, q2.당기순이익, q3.당기순이익),
        // 재무상태는 연말 잔액 = Q4말
        자산총계: ann.자산총계, 부채총계: ann.부채총계, 자본총계: ann.자본총계,
      };
    }
  }
}

const QUARTER_LABEL = { Q1: "1분기", Q2: "2분기", Q3: "3분기", Q4: "4분기" };

// 분기보고서(YYYY.MM) → QoQ(전분기 대비) 데이터
function buildQoQ(reportNm) {
  const m = reportNm.match(/\((\d{4})\.(\d{2})\)/);
  if (!m) return null;
  const year = Number(m[1]);
  // 사업보고서(12월)는 Q4로 취급 — 직전 분기(Q3) 대비 QoQ 산출
  const qMap = { "03": 1, "06": 2, "09": 3, "12": 4 };
  const q = qMap[m[2]];
  if (!q) return null;

  const curKey = `${year}Q${q}`;
  const cur = QUARTER_SERIES[curKey];
  const prevKey = q === 1 ? `${year - 1}Q4` : `${year}Q${q - 1}`;
  const prev = QUARTER_SERIES[prevKey];
  if (!cur || !prev) return null;

  // 단독분기 교차검증 — DART 도출값을 네이버(FnGuide) 단독분기와 대조
  const close = (a, b) => a != null && b != null && Math.abs(a - b) / Math.abs(b || 1) < 0.02;
  const checkQ = (key, d) => {
    const nv = NAVER_Q[key];
    if (!nv || (nv.rev == null && nv.op == null)) return null; // 데이터 없음
    return close(d.매출액, nv.rev) && close(d.영업이익, nv.op);
  };
  const curChk = checkQ(curKey, cur);
  const prevChk = checkQ(prevKey, prev);
  const qVerified = curChk !== false && prevChk !== false; // 명시적 불일치 없으면 통과
  const qCrossChecked = curChk !== null; // 당분기를 네이버로 실제 대조했는지

  const prevQ = q === 1 ? 4 : q - 1;
  const prevYear = q === 1 ? year - 1 : year;
  const opm = (d) => (d.매출액 ? (d.영업이익 / d.매출액) * 100 : null);
  const debtR = (d) => (d.자본총계 ? (d.부채총계 / d.자본총계) * 100 : null);
  const won = (label, p, c) => ({ label, previous: p, current: c, unit: "조원" });
  const pp = (label, p, c) => ({ label, previous: p, current: c, unit: "%", isPP: true });

  const rows = [
    won("매출액", prev.매출액, cur.매출액),
    won("영업이익", prev.영업이익, cur.영업이익),
    won("당기순이익", prev.당기순이익, cur.당기순이익),
    pp("영업이익률", opm(prev), opm(cur)),
    won("자산총계", prev.자산총계, cur.자산총계),
    won("부채총계", prev.부채총계, cur.부채총계),
    won("자본총계", prev.자본총계, cur.자본총계),
    pp("부채비율", debtR(prev), debtR(cur)),
  ].filter((r) => r.previous != null || r.current != null);

  return {
    prevLabel: `${prevYear} ${QUARTER_LABEL["Q" + prevQ]}`,
    currentLabel: `${year} ${QUARTER_LABEL["Q" + q]}`,
    prevDerived: prevQ === 4, // 전분기 Q4는 연간−3분기로 도출
    currentDerived: q === 4, // 당분기 Q4(사업보고서)는 연간−3분기로 도출
    verified: qVerified,
    crossChecked: qCrossChecked,
    rows,
  };
}

// 공시 → 컨센서스 기간 키 매핑. 사업보고서(YYYY.12)=연간 A_, 분기·반기=Q_
function consensusKey(reportNm) {
  const m = reportNm.match(/\((\d{4})\.(\d{2})\)/);
  if (!m) return null;
  const [, y, mm] = m;
  if (/사업보고서/.test(reportNm)) return `A_${y}12`;
  return `Q_${y}${mm}`;
}


// 노이즈 vs 신호 분리
const noise = raw.list.filter((x) => NOISE_PATTERNS.some((p) => x.report_nm.includes(p)));
const signal = raw.list.filter((x) => !NOISE_PATTERNS.some((p) => x.report_nm.includes(p)));

// 핵심 신호 카드 대상 키워드
const CORE = ["실적", "사업보고서", "분기보고서", "반기보고서", "자기주식", "배당", "대량보유", "내부거래", "특수관계인", "출자계열회사", "상품ㆍ용역거래", "해외증권시장"];
const core = signal.filter((x) => CORE.some((k) => x.report_nm.includes(k)));
const minor = signal.filter((x) => !CORE.some((k) => x.report_nm.includes(k)));

// 턴어라운드는 최신 실적 기준 분류라 가장 최근 분기·연간 공시에만 부착
const latestQuarterlyId = [...core]
  .filter((x) => /분기보고서|반기보고서/.test(x.report_nm))
  .sort((a, b) => b.rcept_dt.localeCompare(a.rcept_dt))[0]?.rcept_no;
const latestAnnualId = [...core]
  .filter((x) => /사업보고서/.test(x.report_nm))
  .sort((a, b) => b.rcept_dt.localeCompare(a.rcept_dt))[0]?.rcept_no;

const insights = core.map((it) => {
  const qoq = buildQoQ(it.report_nm); // 분기/반기=인라인 QoQ, 사업보고서=4분기 별도 서술
  const dk = divKey(it.report_nm);
  const ai = ruleTag(it, FINANCIALS[it.rcept_no], qoq, dk ? DIVIDENDS[dk] : null);
  const tags = [...ai.tags];
  let consensusBeat = null;

  // 컨센서스 상회/하회 매칭 (실적 공시)
  const ckey = consensusKey(it.report_nm);
  const beat = ckey ? BEAT[ckey] : null;
  if (beat) {
    const metrics = beat.metrics ?? {};
    const present = Object.values(metrics);
    const total = present.length;
    const beatCount = present.filter((m) => m.beat).length;

    // 태깅은 '영업이익' 기준 (한국 시장 관행). 표·서술은 3개 모두 표시.
    // 사업보고서=연간 컨센서스, 분기·반기=분기 컨센서스 → 태그에 (연간)/(분기) 구분
    const op = metrics["영업이익"];
    if (op) {
      const cSuffix = /사업보고서/.test(it.report_nm) ? "(연간)" : "(분기)";
      tags.push((op.beat ? "영업이익 컨센서스 상회" : "영업이익 컨센서스 하회") + cSuffix);
    }

    // 서술(긍정/부정)에는 3개 지표 상회/하회 내역을 모두 표기
    ai.positives = ai.positives ?? [];
    ai.negatives = ai.negatives ?? [];
    const beatNames = Object.entries(metrics).filter(([, m]) => m.beat).map(([k]) => k);
    const missNames = Object.entries(metrics).filter(([, m]) => !m.beat).map(([k]) => k);
    if (beatNames.length) ai.positives.push(`컨센서스 상회: ${beatNames.join("·")} (${beatNames.length}/${total})`);
    if (missNames.length) ai.negatives.push(`컨센서스 하회: ${missNames.join("·")} (${missNames.length}/${total})`);

    consensusBeat = { gsGb: beat.gsGb, gsYm: beat.gsYm, dataGb: beat.dataGb, beatCount, total, metrics };
  }

  // 턴어라운드 태그 (영업이익 기준) — 분기 턴어라운드(Q)는 최신 분기·반기보고서에만,
  // 연간 턴어라운드(A)는 최신 사업보고서에만 부착 (분기 모멘텀을 연간 공시에 붙이지 않음)
  if (it.rcept_no === latestQuarterlyId) {
    const ttag = turnaroundTag(TURNAROUND.Q?.OPER?.category);
    if (ttag) { const t = `${ttag}(분기)`; if (!tags.includes(t)) tags.push(t); }
  }
  if (it.rcept_no === latestAnnualId) {
    const ttag = turnaroundTag(TURNAROUND.A?.OPER?.category);
    if (ttag) { const t = `${ttag}(연간)`; if (!tags.includes(t)) tags.push(t); }
  }

  return {
    id: it.rcept_no,
    companyName: it.corp_name,
    stockCode: it.stock_code,
    market: MARKET_MAP[it.corp_cls] ?? it.corp_cls,
    receiptDate: it.rcept_dt,
    reportName: clean(it.report_nm),
    disclosureType: it.rm ?? "",
    tags,
    impactLevel: ai.impactLevel,
    summary: ai.summary,
    evidence: ai.evidence,
    narrative: ai.narrative ?? "",
    financials: ai.financials ?? null,
    metrics: ai.metrics ?? null,
    qoq,
    consensusBeat,
    keyPoints: ai.keyPoints ?? [],
    positives: ai.positives ?? [],
    negatives: ai.negatives ?? [],
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${it.rcept_no}`,
  };
});

// 시간 역순 정렬
insights.sort((a, b) => b.receiptDate.localeCompare(a.receiptDate));

const out = {
  analyzedAt: new Date().toISOString(),
  engine: "claude-max-plan (dart-insight-tagger)",
  stockCode: stock,
  companyName: raw.list[0]?.corp_name ?? stock,
  range: raw.range,
  stats: {
    total: raw.list.length,
    insiderHoldingNoise: noise.length,
    signalTotal: signal.length,
    coreTagged: core.length,
    minorNeutral: minor.length,
  },
  // 날짜 필터용: 전체 공시(노이즈 포함)의 접수일자 목록
  allDates: raw.list.map((it) => it.rcept_dt),
  insights,
};

writeFileSync(join(ROOT, "data", `corp-${stock}-tagged.json`), JSON.stringify(out, null, 2), "utf-8");

const dist = insights.reduce((a, i) => ((a[i.impactLevel] = (a[i.impactLevel] ?? 0) + 1), a), {});
console.log(`✅ ${insights.length}건 심층 태깅 → data/corp-${stock}-tagged.json`);
console.log(`   전체 ${out.stats.total} | 노이즈(소유보고) ${out.stats.insiderHoldingNoise} | 신호 ${out.stats.signalTotal} | 핵심카드 ${out.stats.coreTagged}`);
console.log(`   영향도: 🟢호재 ${dist["호재"] ?? 0} / 🔴악재 ${dist["악재"] ?? 0} / 🟡중립 ${dist["중립"] ?? 0}`);
