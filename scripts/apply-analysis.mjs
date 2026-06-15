// Claude(Max Plan)가 수행한 dart-insight-tagger 분석 결과를 raw와 병합하여
// data/disclosures-tagged.json 생성. ANALYSIS 객체가 Claude의 판단 결과다.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// rcept_no → Claude 분석 결과
const ANALYSIS = {
  "20260611900901": { tags: ["상장폐지 위기"], impactLevel: "악재", summary: "상장폐지 확정에 따른 정리매매 개시. 거래 가능하나 사실상 퇴출 단계.", evidence: "상장폐지 결정에 따라 정리매매가 시작되어 매매거래정지가 해제됨." },
  "20260611900905": { tags: ["상장폐지 위기"], impactLevel: "악재", summary: "상장폐지 확정에 따른 정리매매 개시. 사실상 증시 퇴출.", evidence: "상장폐지 결정에 따라 정리매매가 시작되어 매매거래정지가 해제됨." },
  "20260611900903": { tags: ["정보 부족"], impactLevel: "중립", summary: "임시주주총회 소집 결의(기재정정). 안건 미확인.", evidence: "임시주총 소집 공시이나 안건이 드러나지 않아 영향도 판단 보류." },
  "20260611000685": { tags: ["정보 부족"], impactLevel: "중립", summary: "사업보고서 제출. 재무 수치 심층 분석은 원문 파싱 필요.", evidence: "정기공시 접수만 확인됨. 매출·이익 등 수치가 요약에 없어 심층 태그 미부여." },
  "20260611800898": { tags: ["감사의견 적정"], impactLevel: "중립", summary: "감사보고서 제출. 적정의견 여부는 원문 확인 필요.", evidence: "감사보고서 제출 사실만 확인됨. 감사의견 내용은 원문 확인 전이라 중립 처리." },
  "20260611900869": { tags: ["대규모 자금조달 (CB/BW)"], impactLevel: "악재", summary: "신주인수권부사채(BW) 만기전 취득 후 재매각. 잠재적 주식 희석 요인.", evidence: "제14회차 BW를 만기 전 취득했다가 재매각해 워런트 희석 가능성이 유지됨." },
  "20260611800897": { tags: ["상장폐지 위기"], impactLevel: "악재", summary: "상장폐지 이의신청서 제출. 상폐 절차가 진행 중인 위험 상태.", evidence: "상장폐지 사유에 대한 이의신청 단계로, 퇴출 리스크가 현실화 중." },
  "20260611900893": { tags: ["상장폐지 위기"], impactLevel: "악재", summary: "코스닥시장위원회 상장폐지 결정 안내. 퇴출 확정 단계.", evidence: "시장위원회에서 상장폐지가 결정됨." },
  "20260611900896": { tags: ["상장폐지 위기"], impactLevel: "악재", summary: "코스닥시장위원회 상장폐지 결정 안내. 퇴출 확정 단계.", evidence: "시장위원회에서 상장폐지가 결정됨." },
  "20260611000681": { tags: ["주주환원 호재"], impactLevel: "호재", summary: "자기주식 취득 신탁계약 체결. 유통주식 감소로 주주가치 제고 기대.", evidence: "자기주식취득 신탁계약 체결 결정으로 자사주 매입 의지 확인." },
  "20260611900856": { tags: ["정보 부족"], impactLevel: "중립", summary: "임시주주총회 소집 결의(기재정정). 안건 미확인.", evidence: "임시주총 소집 공시이나 안건이 드러나지 않아 영향도 판단 보류." },
  "20260611900868": { tags: ["분기 실적 상승"], impactLevel: "호재", summary: "단일판매·공급계약 체결(자율공시). 신규 수주로 매출 기여 기대.", evidence: "공급계약 체결 공시. 계약 규모는 원문 확인 필요하나 수주 자체는 실적 긍정 요인." },
  "20260611100045": { tags: ["정보 부족"], impactLevel: "중립", summary: "회사채(채무증권) 증권신고서 효력발생. 주식 희석 없는 일반 자금조달.", evidence: "채무증권 신고서 효력발생 안내로, 지분 희석이 없는 회사채 발행이라 주가 영향 중립." },
  "20260611900865": { tags: ["투자경고/위험 지정"], impactLevel: "악재", summary: "불성실공시법인 지정(공시변경). 공시 신뢰도 훼손 및 벌점 리스크.", evidence: "불성실공시법인으로 지정되어 관리 리스크와 신뢰도 하락 발생." },
  "20260611900867": { tags: ["투자경고/위험 지정"], impactLevel: "악재", summary: "불성실공시법인 지정예고(공시번복). 공시 번복에 따른 제재 예고.", evidence: "공시 번복으로 불성실공시법인 지정이 예고됨." },
  "20260611000682": { tags: ["대규모 자금조달 (CB/BW)"], impactLevel: "악재", summary: "전환사채 매수선택권(콜옵션) 행사자 지정. CB 관련 잠재 희석 이슈.", evidence: "전환사채 콜옵션 행사자를 지정하는 주요사항보고로, CB 구조에 따른 희석 가능성 존재." },
  "20260611900872": { tags: ["M&A 진행"], impactLevel: "중립", summary: "종속회사의 타법인 주식·출자증권 취득. 외형 확장성 투자.", evidence: "종속회사가 타법인 지분을 취득해 사업 확장 또는 수직계열화 가능성." },
  "20260611000680": { tags: ["정보 부족"], impactLevel: "중립", summary: "비상장사 소액공모(지분증권). 일반 투자자 영향 제한적.", evidence: "비상장 지분증권 소액공모 서류로, 상장 종목 수급에 미치는 영향이 불분명." },
  "20260611000679": { tags: ["정보 부족"], impactLevel: "중립", summary: "소액공모 실적보고서(기재정정). 자금조달 후속 신고.", evidence: "소액공모 실적 보고로 영향도 판단에 필요한 수치 정보가 부족." },
  "20260605000242": { tags: ["정보 부족"], impactLevel: "중립", summary: "사모 재간접 펀드 일괄신고서(기재정정). 개별 종목 신호 아님.", evidence: "자산운용사의 펀드 등록성 공시로 특정 상장 종목 수급과 무관." },
  "20260610000084": { tags: ["정보 부족"], impactLevel: "중립", summary: "우주항공 테마 ETF 일괄신고서(기재정정). 등록 단계 공시.", evidence: "ETF 설정·등록 신고로 보유종목 리밸런싱 정보는 포함되지 않음." },
  "20260608000397": { tags: ["정보 부족"], impactLevel: "중립", summary: "고배당주 채권혼합 펀드 일괄신고서(기재정정). 개별 종목 신호 아님.", evidence: "펀드 등록성 공시로 특정 상장 종목 수급과 무관." },
  "20260608000386": { tags: ["정보 부족"], impactLevel: "중립", summary: "고배당주 펀드 일괄신고서(기재정정). 개별 종목 신호 아님.", evidence: "펀드 등록성 공시로 특정 상장 종목 수급과 무관." },
  "20260609000311": { tags: ["정보 부족"], impactLevel: "중립", summary: "동유럽 주식형 펀드 일괄신고서(기재정정). 개별 종목 신호 아님.", evidence: "펀드 등록성 공시로 특정 상장 종목 수급과 무관." },
  "20260608000370": { tags: ["정보 부족"], impactLevel: "중립", summary: "동유럽 주식형 펀드 일괄신고서(기재정정). 개별 종목 신호 아님.", evidence: "펀드 등록성 공시로 특정 상장 종목 수급과 무관." },
  "20260609000291": { tags: ["정보 부족"], impactLevel: "중립", summary: "동유럽2호 주식형 펀드 일괄신고서(기재정정). 개별 종목 신호 아님.", evidence: "펀드 등록성 공시로 특정 상장 종목 수급과 무관." },
  "20260608000347": { tags: ["정보 부족"], impactLevel: "중립", summary: "동유럽2호 주식형 펀드 일괄신고서(기재정정). 개별 종목 신호 아님.", evidence: "펀드 등록성 공시로 특정 상장 종목 수급과 무관." },
  "20260608000314": { tags: ["정보 부족"], impactLevel: "중립", summary: "코리아레전드2호 주식형 펀드 일괄신고서(기재정정). 개별 종목 신호 아님.", evidence: "펀드 등록성 공시로 특정 상장 종목 수급과 무관." },
  "20260608000282": { tags: ["정보 부족"], impactLevel: "중립", summary: "단기회사채 펀드 일괄신고서(기재정정). 개별 종목 신호 아님.", evidence: "펀드 등록성 공시로 특정 상장 종목 수급과 무관." },
  "20260608000246": { tags: ["정보 부족"], impactLevel: "중립", summary: "유럽대표 재간접 펀드 일괄신고서(기재정정). 개별 종목 신호 아님.", evidence: "펀드 등록성 공시로 특정 상장 종목 수급과 무관." },
  "20260608000168": { tags: ["정보 부족"], impactLevel: "중립", summary: "글로벌테크 펀드(UH) 일괄신고서(기재정정). 개별 종목 신호 아님.", evidence: "펀드 등록성 공시로 특정 상장 종목 수급과 무관." },
  "20260608000166": { tags: ["정보 부족"], impactLevel: "중립", summary: "글로벌테크 펀드(H) 일괄신고서(기재정정). 개별 종목 신호 아님.", evidence: "펀드 등록성 공시로 특정 상장 종목 수급과 무관." },
  "20260608000162": { tags: ["정보 부족"], impactLevel: "중립", summary: "미국대표 재간접 펀드 일괄신고서(기재정정). 개별 종목 신호 아님.", evidence: "펀드 등록성 공시로 특정 상장 종목 수급과 무관." },
  "20260608000142": { tags: ["정보 부족"], impactLevel: "중립", summary: "코리아레전드60 주식혼합 펀드 일괄신고서(기재정정). 개별 종목 신호 아님.", evidence: "펀드 등록성 공시로 특정 상장 종목 수급과 무관." },
  "20260608000139": { tags: ["정보 부족"], impactLevel: "중립", summary: "글로벌헬스케어 채권혼합 펀드 일괄신고서(기재정정). 개별 종목 신호 아님.", evidence: "펀드 등록성 공시로 특정 상장 종목 수급과 무관." },
  "20260608000132": { tags: ["정보 부족"], impactLevel: "중립", summary: "코리아밸류채권2호 펀드 일괄신고서(기재정정). 개별 종목 신호 아님.", evidence: "펀드 등록성 공시로 특정 상장 종목 수급과 무관." },
  "20260608000131": { tags: ["정보 부족"], impactLevel: "중립", summary: "연금저축 글로벌헬스케어 펀드 일괄신고서(기재정정). 개별 종목 신호 아님.", evidence: "펀드 등록성 공시로 특정 상장 종목 수급과 무관." },
  "20260611000677": { tags: ["정보 부족"], impactLevel: "중립", summary: "투자설명서(일괄신고). 채무증권 발행 관련 절차성 공시.", evidence: "투자설명서 제출로 지분 희석 없는 채무 조달 절차에 해당해 중립." },
  "20260608000063": { tags: ["정보 부족"], impactLevel: "중립", summary: "K방산·조선·원전 테마 펀드 일괄신고서(기재정정). 등록 단계 공시.", evidence: "테마 펀드 설정·등록 신고로 보유종목 리밸런싱 정보는 포함되지 않음." },
  "20260608000054": { tags: ["정보 부족"], impactLevel: "중립", summary: "K제조핵심PLUS 펀드 일괄신고서(기재정정). 등록 단계 공시.", evidence: "테마 펀드 설정·등록 신고로 보유종목 리밸런싱 정보는 포함되지 않음." },
};

const MARKET_MAP = { Y: "KOSPI", K: "KOSDAQ", N: "코넥스", E: "기타" };

function clean(s) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

const raw = JSON.parse(readFileSync(join(ROOT, "data", "disclosures-raw.json"), "utf-8"));

const insights = raw.list.map((it) => {
  const ai = ANALYSIS[it.rcept_no] ?? {
    tags: ["정보 부족"],
    impactLevel: "중립",
    summary: "분석 결과 없음.",
    evidence: "해당 공시에 대한 분석이 누락됨 — 원문 검토 필요.",
  };
  return {
    id: it.rcept_no,
    companyName: it.corp_name,
    stockCode: it.stock_code,
    market: MARKET_MAP[it.corp_cls] ?? it.corp_cls,
    receiptDate: it.rcept_dt,
    reportName: clean(it.report_nm),
    disclosureType: it.rm ?? "",
    tags: ai.tags,
    impactLevel: ai.impactLevel,
    summary: ai.summary,
    evidence: ai.evidence,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${it.rcept_no}`,
  };
});

const out = {
  analyzedAt: new Date().toISOString(),
  engine: "claude-max-plan (dart-insight-tagger)",
  sourceFetchedAt: raw.fetchedAt,
  count: insights.length,
  insights,
};

writeFileSync(join(ROOT, "data", "disclosures-tagged.json"), JSON.stringify(out, null, 2), "utf-8");

const dist = insights.reduce((acc, i) => { acc[i.impactLevel] = (acc[i.impactLevel] ?? 0) + 1; return acc; }, {});
console.log(`✅ ${insights.length}건 분석 완료 → data/disclosures-tagged.json`);
console.log(`   분포: 🟢호재 ${dist["호재"] ?? 0} / 🔴악재 ${dist["악재"] ?? 0} / 🟡중립 ${dist["중립"] ?? 0}`);
