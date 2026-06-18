export type ImpactLevel = "호재" | "악재" | "중립";

export type InsightTag =
  // G1 기초 체력
  | "분기 실적 상승"
  | "분기 실적 하락"
  | "흑자 전환"
  | "질적 성장 (마진 개선)"
  | "외형만 성장 (내실 악화)"
  | "무늬만 흑자 (영업현금 마이너스)"
  | "재고 쌓이는 중"
  | "공장 풀가동"
  | "공격적 시설투자 (CAPEX)"
  | "감사의견 적정"
  | "상장폐지 위기"
  | "비용 통제 성공"
  | "실탄 장전 (현금성자산 급증)"
  | "돈 떼일 위험 (매출채권 급증)"
  | "미래 먹거리 집중 (R&D 강화)"
  | "해외 침투 가속"
  | "체질 개선 (신사업 매출 가시화)"
  // G2 모멘텀
  | "대규모 자금조달 (CB/BW)"
  | "주주가치 희석 위험 (유상증자)"
  | "주주환원 호재"
  | "M&A 진행"
  | "경영권 분쟁 가능성"
  | "투자경고/위험 지정"
  | "단기과열"
  // G3 구조 리스크
  | "미래현금 담보대출 (ABS)"
  | "부동산 PF 우발채무 위험"
  | "대규모 내부거래 리스크"
  | "오너가 승계/지배구조 개편"
  | "소송/분쟁 발생"
  // G4 수급 주체
  | "내부자(임원) 대량매수"
  | "내부자(임원) 매도"
  | "5% 이상 큰손 등장"
  | "글로벌 ETF 편입"
  | "테마 ETF 리밸런싱"
  // 컨센서스 대비 (영업이익 기준)
  | "영업이익 컨센서스 상회"
  | "영업이익 컨센서스 하회"
  // 턴어라운드 (FnGuide 분류)
  | "흑자 전환 예상"
  | "적자폭 축소"
  | "영업이익 10% 이상 성장"
  | "영업이익 30% 이상 성장"
  // 수익성 / 안정성 / 현금흐름 / 배당 (재무지표 기반)
  | "고ROE 우량"
  | "재무 안정 우량"
  | "차입 부담 (고부채)"
  | "이자 못 갚을 위험"
  | "잉여현금 창출 (FCF+)"
  | "현금 소진 (FCF 마이너스)"
  | "배당 확대"
  | "배당 축소"
  | "정보 부족";

export interface TagGroup {
  id: "G1" | "G2" | "G3" | "G4";
  label: string;
  tags: InsightTag[];
}

export interface FinancialRow {
  label: string;
  current: number; // 당기 값 (조원 항목은 원 단위, % 항목은 퍼센트)
  previous: number; // 전기 값
  unit: "조원" | "%";
  isPP?: boolean; // true면 증감을 %포인트(차이)로 표시
}

export interface FinancialComparison {
  termCurrent: string; // 예: "제 57 기"
  termPrevious: string; // 예: "제 56 기"
  rows: FinancialRow[];
  verified?: boolean; // 교차검증 통과 여부
  crossChecked?: boolean; // 2차 소스(전체 재무제표)와 대조했는지
}

export interface ConsensusMetric {
  actual: number | null; // 발표(실제)
  consensus: number | null; // 컨센서스
  beatPct: number | null; // 상회율(%)
  beat: boolean; // 상회 여부
}

export interface ConsensusBeat {
  gsGb: string; // 1Q/3Q/4Q/D(연간) 등
  gsYm: string; // 결산년월
  dataGb: string; // 확정/잠정
  beatCount: number; // 상회한 지표 수
  total: number; // 비교 지표 수
  metrics: {
    매출액?: ConsensusMetric;
    영업이익?: ConsensusMetric;
    순이익?: ConsensusMetric;
  };
}

export interface CompareRow {
  label: string;
  previous: number | null; // 비교 대상 (조원 항목은 원, % 항목은 퍼센트)
  current: number | null;
  unit: "조원" | "%";
  isPP?: boolean; // 비율 항목 → 증감을 %포인트로
}

export interface QuarterOverQuarter {
  prevLabel: string; // 예: "2025 4분기"
  currentLabel: string; // 예: "2026 1분기"
  prevDerived: boolean; // 전분기가 연간−3개분기로 도출된 값인지(Q4)
  currentDerived: boolean; // 당분기가 연간−3개분기로 도출된 값인지(사업보고서 Q4)
  verified?: boolean; // 단독분기 수치 교차검증 통과 여부
  crossChecked?: boolean; // 네이버(FnGuide) 단독분기와 실제 대조했는지
  rows: CompareRow[];
}

// 수익성·안정성·현금흐름·배당 지표 (정기공시 재무 기반). 값 없으면 null → 화면 미표시.
export interface FinancialMetrics {
  isAnnual: boolean;
  profitability: { roe: number | null; roa: number | null; opMargin: number | null; netMargin: number | null };
  stability: { debtRatio: number | null; currentRatio: number | null; interestCoverage: number | null };
  cashflow: { operatingCF: number | null; fcf: number | null }; // 원
  dividend: { payoutRatio: number | null; dps: number | null; prevDps: number | null; dividendYield: number | null } | null;
}

export interface DisclosureInsight {
  id: string;
  companyName: string;
  stockCode: string;
  market: string; // KOSPI / KOSDAQ
  receiptDate: string; // YYYY-MM-DD
  reportName: string;
  disclosureType: string;
  tags: InsightTag[];
  impactLevel: ImpactLevel;
  summary: string; // AI 3줄 요약
  evidence: string; // 태그 부여 근거
  narrative?: string; // 정기공시 등 내용이 많은 공시의 서술형 요약
  financials?: FinancialComparison; // 재무 증감 비교 표 (전년 동기 YoY)
  metrics?: FinancialMetrics; // 수익성·안정성·현금흐름·배당 지표
  qoq?: QuarterOverQuarter; // 분기보고서 전분기 대비 (QoQ)
  consensusBeat?: ConsensusBeat; // 컨센서스 상회/하회 비교
  keyPoints?: string[]; // 공시 주요 내용 간추림
  positives?: string[]; // 긍정적으로 판단되는 부분
  negatives?: string[]; // 부정적으로 판단되는 부분
  dartUrl?: string;
}

export interface DartApiItem {
  corp_name: string;
  corp_code: string;
  stock_code: string;
  corp_cls: string; // Y=KOSPI, K=KOSDAQ, N=코넥스, E=기타
  report_nm: string;
  rcept_no: string;
  flr_nm: string;
  rcept_dt: string;
  rm: string;
}

export interface DartListResponse {
  status: string;
  message: string;
  page_no: number;
  page_count: number;
  total_count: number;
  total_page: number;
  list: DartApiItem[];
}
