import type { DartApiItem, InsightTag, ImpactLevel, DisclosureInsight } from "@/types/dart";

interface TagResult {
  tags: InsightTag[];
  impactLevel: ImpactLevel;
  evidence: string;
}

function mapDisclosureType(reportNm: string, rm: string): TagResult {
  const text = `${reportNm} ${rm}`.toLowerCase();

  // G2 모멘텀 — 키워드 우선 매핑
  if (text.includes("유상증자")) {
    return { tags: ["주주가치 희석 위험 (유상증자)"], impactLevel: "악재", evidence: "유상증자 결정으로 기존 주주 지분 희석 우려" };
  }
  if (text.includes("전환사채") || text.includes("신주인수권")) {
    return { tags: ["대규모 자금조달 (CB/BW)"], impactLevel: "악재", evidence: "CB/BW 발행으로 잠재적 주식 희석 위험" };
  }
  if (text.includes("자기주식취득") || text.includes("자기주식 취득")) {
    return { tags: ["주주환원 호재"], impactLevel: "호재", evidence: "자기주식 취득 결정, 유통주수 감소 기대" };
  }
  if (text.includes("자기주식소각") || text.includes("자기주식 소각")) {
    return { tags: ["주주환원 호재"], impactLevel: "호재", evidence: "자기주식 소각으로 주주가치 제고" };
  }
  if (text.includes("합병") || text.includes("분할")) {
    return { tags: ["M&A 진행"], impactLevel: "중립", evidence: "합병/분할 결정, 합병비율 및 대상사 확인 필요" };
  }
  if (text.includes("최대주주변경")) {
    return { tags: ["경영권 분쟁 가능성"], impactLevel: "악재", evidence: "최대주주 변경으로 경영 불확실성 증가" };
  }
  if (text.includes("투자주의") || text.includes("투자경고") || text.includes("투자위험")) {
    return { tags: ["투자경고/위험 지정"], impactLevel: "악재", evidence: "거래소 투자경고 지정, 단기 투기적 거래 위험" };
  }

  // G3 구조 리스크
  if (text.includes("소송")) {
    return { tags: ["소송/분쟁 발생"], impactLevel: "악재", evidence: "소송 제기 또는 피소, 배상 리스크 존재" };
  }
  if (text.includes("자산유동화")) {
    return { tags: ["미래현금 담보대출 (ABS)"], impactLevel: "중립", evidence: "ABS 발행으로 유동성 확보, 미래 현금흐름 담보" };
  }

  // G4 수급 주체
  if (text.includes("임원") && (text.includes("취득") || text.includes("매수"))) {
    return { tags: ["내부자(임원) 대량매수"], impactLevel: "호재", evidence: "임원 자사주 매수, 내부자 긍정 신호" };
  }
  if (text.includes("임원") && (text.includes("처분") || text.includes("매도"))) {
    return { tags: ["내부자(임원) 매도"], impactLevel: "악재", evidence: "임원 자사주 매도, 내부자 신호 점검 필요" };
  }
  if (text.includes("5%") || text.includes("주요주주")) {
    return { tags: ["5% 이상 큰손 등장"], impactLevel: "호재", evidence: "5% 이상 신규 대량주주 등장" };
  }

  // G1 정기공시 — 수치 없으면 정보 부족
  if (text.includes("사업보고서") || text.includes("반기보고서") || text.includes("분기보고서")) {
    return { tags: ["정보 부족"], impactLevel: "중립", evidence: "정기공시 요약에 재무 수치 없음, 원문 파싱 필요" };
  }
  if (text.includes("감사보고서")) {
    return { tags: ["감사의견 적정"], impactLevel: "호재", evidence: "외부감사 적정의견 (rm 필드 미기재 시 추정)" };
  }

  return { tags: ["정보 부족"], impactLevel: "중립", evidence: "태그 매핑 불가, 원문 검토 필요" };
}

export function mapDartItemToInsight(item: DartApiItem): DisclosureInsight {
  const { tags, impactLevel, evidence } = mapDisclosureType(item.report_nm, item.rm ?? "");

  const marketMap: Record<string, string> = { Y: "KOSPI", K: "KOSDAQ", N: "코넥스", E: "기타" };

  return {
    id: item.rcept_no,
    companyName: item.corp_name,
    stockCode: item.stock_code,
    market: marketMap[item.corp_cls] ?? item.corp_cls,
    receiptDate: item.rcept_dt,
    reportName: item.report_nm,
    disclosureType: item.rm ?? "",
    tags,
    impactLevel,
    summary: evidence,
    evidence,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`,
  };
}
