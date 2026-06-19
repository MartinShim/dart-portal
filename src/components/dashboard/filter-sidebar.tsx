"use client";

import { useState } from "react";
import type { InsightTag } from "@/types/dart";

// 분류기준 페이지와 동일한 카테고리 체계 (A~E)
const TAG_GROUPS = [
  {
    label: "A-1. 회사 실적",
    tags: [
      "분기 실적 상승", "분기 실적 하락", "영업이익 흑자전환", "영업이익 적자전환", "질적 성장 (마진 개선)",
      "외형만 성장 (내실 악화)", "비용 통제 성공", "무늬만 흑자 (영업현금 마이너스)",
      "재고 쌓이는 중", "돈 떼일 위험 (매출채권 급증)", "실탄 장전 (현금성자산 급증)",
      "공장 풀가동", "공격적 시설투자 (CAPEX)", "미래 먹거리 집중 (R&D 강화)",
      "해외 침투 가속", "체질 개선 (신사업 매출 가시화)", "감사의견 적정", "상장폐지 위기", "고ROE 우량",
    ] as InsightTag[],
  },
  {
    label: "A-2. 컨센서스 & 턴어라운드",
    tags: [
      "영업이익 컨센서스 상회(연간)", "영업이익 컨센서스 상회(분기)",
      "영업이익 컨센서스 하회(연간)", "영업이익 컨센서스 하회(분기)",
      "흑자 전환(연간)", "흑자 전환(분기)",
      "흑자 전환 예상(연간)", "흑자 전환 예상(분기)",
      "적자폭 축소(연간)", "적자폭 축소(분기)",
      "영업이익 10% 이상 성장(연간)", "영업이익 10% 이상 성장(분기)",
      "영업이익 30% 이상 성장(연간)", "영업이익 30% 이상 성장(분기)",
    ] as InsightTag[],
  },
  {
    label: "A-3. 안정성·재무건전성",
    tags: ["재무 안정 우량", "차입 부담 (고부채)", "이자 못 갚을 위험"] as InsightTag[],
  },
  {
    label: "A-4. 현금흐름",
    tags: ["잉여현금 창출 (FCF+)", "현금 소진 (FCF 마이너스)"] as InsightTag[],
  },
  {
    label: "A-5. 배당 (주주환원)",
    tags: ["배당 확대", "배당 축소"] as InsightTag[],
  },
  {
    label: "B. 실시간 모멘텀",
    tags: ["주주환원 호재", "주주가치 희석 위험 (유상증자)", "대규모 자금조달 (CB/BW)", "M&A 진행", "경영권 분쟁 가능성", "투자경고/위험 지정", "단기과열"] as InsightTag[],
  },
  {
    label: "C. 재무 & 구조 리스크",
    tags: ["미래현금 담보대출 (ABS)", "부동산 PF 우발채무 위험", "대규모 내부거래 리스크", "오너가 승계/지배구조 개편", "소송/분쟁 발생"] as InsightTag[],
  },
  {
    label: "D. 수급 주체 & 간접투자",
    tags: ["내부자(임원) 대량매수", "내부자(임원) 매도", "5% 이상 큰손 등장", "글로벌 ETF 편입", "테마 ETF 리밸런싱"] as InsightTag[],
  },
];

// tag-badge.tsx의 riskTags / goodTags와 동일하게 유지
const RISK_TAGS: InsightTag[] = [
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
];

const GOOD_TAGS: InsightTag[] = [
  "분기 실적 상승",
  "흑자 전환",
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
  "흑자 전환(연간)",
  "흑자 전환(분기)",
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
];

interface Props {
  selectedTags: InsightTag[];
  onTagToggle: (tag: InsightTag) => void;
  riskOnly: boolean;
  onRiskOnlyToggle: () => void;
  goodOnly: boolean;
  onGoodOnlyToggle: () => void;
}

export function FilterSidebar({
  selectedTags,
  onTagToggle,
  riskOnly,
  onRiskOnlyToggle,
  goodOnly,
  onGoodOnlyToggle,
}: Props) {
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  const toggleCollapse = (label: string) =>
    setCollapsedGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );

  // 그룹 전체 선택/해제 (이미 전부 선택돼 있으면 해제, 아니면 미선택분만 선택)
  const toggleGroup = (tags: InsightTag[]) => {
    const allSelected = tags.every((t) => selectedTags.includes(t));
    tags.forEach((t) => {
      const isSelected = selectedTags.includes(t);
      if (allSelected ? isSelected : !isSelected) onTagToggle(t);
    });
  };

  return (
    <aside className="w-64 shrink-0 space-y-4 pr-4 border-r border-gray-200 overflow-y-auto max-h-[calc(100vh-80px)] sticky top-4">
      {/* 호재/위험 빠른 토글 */}
      <div className="space-y-2">
        <button
          onClick={onGoodOnlyToggle}
          className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold border transition-colors ${
            goodOnly
              ? "bg-emerald-600 text-white border-emerald-600"
              : "bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          }`}
        >
          🟢 호재 태그만 보기
        </button>
        <button
          onClick={onRiskOnlyToggle}
          className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold border transition-colors ${
            riskOnly
              ? "bg-red-600 text-white border-red-600"
              : "bg-white text-red-600 border-red-300 hover:bg-red-50"
          }`}
        >
          ⚠ 위험 태그만 보기
        </button>
      </div>

      {selectedTags.length > 0 && (
        <button
          onClick={() => selectedTags.forEach((t) => onTagToggle(t))}
          className="w-full text-xs text-gray-400 hover:text-gray-600 underline"
        >
          필터 초기화
        </button>
      )}

      {TAG_GROUPS.map((group) => {
        const collapsed = collapsedGroups.includes(group.label);
        const allSelected = group.tags.every((t) => selectedTags.includes(t));
        const someSelected = group.tags.some((t) => selectedTags.includes(t));
        return (
          <div key={group.label}>
            <div className="flex items-center justify-between mb-1.5">
              <button
                onClick={() => toggleCollapse(group.label)}
                className="flex items-center gap-1 text-xs font-bold text-gray-500 tracking-wide hover:text-gray-700"
              >
                <span className="inline-block w-7 text-3xl leading-none text-gray-500">{collapsed ? "▸" : "▾"}</span>
                {group.label}
              </button>
              <button
                onClick={() => toggleGroup(group.tags)}
                className={`text-[11px] px-1.5 py-0.5 rounded border transition-colors ${
                  allSelected
                    ? "bg-blue-600 text-white border-blue-600"
                    : someSelected
                    ? "bg-blue-50 text-blue-600 border-blue-200"
                    : "text-gray-400 border-gray-200 hover:bg-gray-100"
                }`}
              >
                전체
              </button>
            </div>
            {!collapsed && (
              <div className="space-y-1">
                {group.tags.map((tag) => {
                  const selected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => onTagToggle(tag)}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${
                        selected
                          ? "bg-blue-600 text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}

export { RISK_TAGS, GOOD_TAGS };
