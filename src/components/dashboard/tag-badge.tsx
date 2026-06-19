"use client";

import type { InsightTag, ImpactLevel } from "@/types/dart";

const riskTags = new Set<InsightTag>([
  "분기 실적 하락",
  "외형만 성장 (내실 악화)",
  "무늬만 흑자 (영업현금 마이너스)",
  "재고 쌓이는 중",
  "돈 떼일 위험 (매출채권 급증)",
  "주주가치 희석 위험 (유상증자)",
  "대규모 자금조달 (CB/BW)",
  "경영권 분쟁 가능성",
  "투자경고/위험 지정",
  "소송/분쟁 발생",
  "상장폐지 위기",
  "내부자(임원) 매도",
  "부동산 PF 우발채무 위험",
  "영업이익 컨센서스 하회(연간)",
  "영업이익 컨센서스 하회(분기)",
  "차입 부담 (고부채)",
  "이자 못 갚을 위험",
  "현금 소진 (FCF 마이너스)",
  "배당 축소",
  "영업이익 적자전환",
]);

const goodTags = new Set<InsightTag>([
  "분기 실적 상승",
  "흑자 전환(연간)",
  "흑자 전환(분기)",
  "질적 성장 (마진 개선)",
  "공장 풀가동",
  "공격적 시설투자 (CAPEX)",
  "감사의견 적정",
  "실탄 장전 (현금성자산 급증)",
  "주주환원 호재",
  "내부자(임원) 대량매수",
  "5% 이상 큰손 등장",
  "글로벌 ETF 편입",
  "미래 먹거리 집중 (R&D 강화)",
  "해외 침투 가속",
  "체질 개선 (신사업 매출 가시화)",
  "비용 통제 성공",
  "영업이익 컨센서스 상회(연간)",
  "영업이익 컨센서스 상회(분기)",
  "흑자 전환 예상(연간)",
  "흑자 전환 예상(분기)",
  "적자폭 축소(연간)",
  "적자폭 축소(분기)",
  "영업이익 10% 이상 성장(연간)",
  "영업이익 10% 이상 성장(분기)",
  "영업이익 30% 이상 성장(연간)",
  "영업이익 30% 이상 성장(분기)",
  "고ROE 우량",
  "재무 안정 우량",
  "잉여현금 창출 (FCF+)",
  "배당 확대",
  "영업이익 흑자전환",
]);

function getTagStyle(tag: InsightTag): string {
  if (riskTags.has(tag)) return "bg-red-50 text-red-700 border-red-200 font-semibold";
  if (goodTags.has(tag)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (tag === "정보 부족") return "bg-gray-100 text-gray-500 border-gray-200 italic";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

export function TagBadge({ tag }: { tag: InsightTag }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border whitespace-nowrap ${getTagStyle(tag)}`}>
      {riskTags.has(tag) && <span className="mr-1">⚠</span>}
      {tag}
    </span>
  );
}
