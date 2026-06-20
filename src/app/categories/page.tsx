"use client";

import type { InsightTag } from "@/types/dart";
import { Navbar } from "@/components/dashboard/navbar";
import { TagBadge } from "@/components/dashboard/tag-badge";

type TagDef = { tag: InsightTag; meaning: string };

const CATEGORIES: { group: string; desc: string; basis: string; tags: TagDef[] }[] = [
  {
    group: "A-1. 회사 실적",
    desc: "정기공시(사업·반기·분기보고서) 재무 분석 — 실적 비교는 기본 직전 분기(QoQ)",
    basis: "DART 재무제표 (직전 분기 QoQ 기준, 사업보고서=Q4 vs Q3)",
    tags: [
      { tag: "분기 실적 상승", meaning: "영업이익이 직전 분기(QoQ) 대비 증가. (사업보고서는 4분기 vs 3분기 기준)" },
      { tag: "분기 실적 하락", meaning: "영업이익이 직전 분기(QoQ) 대비 감소." },
      { tag: "연간 실적 상승", meaning: "영업이익이 전년 동기(YoY) 대비 증가. (분기·반기보고서는 1년 전 같은 기간과 비교)" },
      { tag: "연간 실적 하락", meaning: "영업이익이 전년 동기(YoY) 대비 감소." },
      { tag: "영업이익 흑자전환(분기)", meaning: "연결 영업이익이 직전 분기(QoQ) 적자에서 당기 흑자로 전환. (사업보고서는 4분기 기준)" },
      { tag: "영업이익 흑자전환(연간)", meaning: "연결 영업이익이 전년 동기(YoY) 적자에서 당기 흑자로 전환. (분기보고서는 1년 전 같은 분기와 비교)" },
      { tag: "영업이익 적자전환(분기)", meaning: "연결 영업이익이 직전 분기(QoQ) 흑자에서 당기 적자로 전환." },
      { tag: "영업이익 적자전환(연간)", meaning: "연결 영업이익이 전년 동기(YoY) 흑자에서 당기 적자로 전환. (분기보고서는 1년 전 같은 분기와 비교)" },
      { tag: "질적 성장 (마진 개선)", meaning: "직전 분기(QoQ) 대비 매출 증가율보다 영업이익 증가율이 높아 수익 구조가 개선됨." },
      { tag: "외형만 성장 (내실 악화)", meaning: "직전 분기(QoQ) 대비 매출은 늘었으나 영업이익은 오히려 줄어듦." },
      { tag: "비용 통제 성공", meaning: "매출은 정체·소폭 감소했으나 고정비·판관비를 줄여 이익을 방어해 냄." },
      { tag: "무늬만 흑자 (영업현금 마이너스)", meaning: "장부상 당기순이익은 흑자이나 실제 영업활동현금흐름은 마이너스인 장부 왜곡 위험." },
      { tag: "재고 쌓이는 중", meaning: "매출 증가세 대비 재고자산이 과도하게 급증 → 향후 덤핑·재고손실 처리 위험." },
      { tag: "돈 떼일 위험 (매출채권 급증)", meaning: "물건은 팔았으나 대금 회수가 지연되어 매출채권·대손충당금 설정률이 급증." },
      { tag: "실탄 장전 (현금성자산 급증)", meaning: "영업이익·자산 매각으로 당장 동원 가능한 현금·단기금융상품이 크게 늘어남." },
      { tag: "공장 풀가동", meaning: "주요 제품 가동률이 전 분기 대비 크게 상승해 임계치(예: 85~90%↑)에 도달, 증설 시그널." },
      { tag: "공격적 시설투자 (CAPEX)", meaning: "현금흐름표 '유형자산의 취득' 금액이 전년 동기 대비 급증 → 미래 생산능력 확충 시작." },
      { tag: "미래 먹거리 집중 (R&D 강화)", meaning: "매출액 대비 연구개발비(R&D) 집행 비율이 직전 분기·전년도보다 크게 높아짐." },
      { tag: "해외 침투 가속", meaning: "전체 매출 중 내수 비중이 줄고 해외 수출 비중이 유의미하게 커짐 (환율 수혜 시그널)." },
      { tag: "체질 개선 (신사업 매출 가시화)", meaning: "신성장 동력으로 제시한 신규 사업 부문 매출 비중이 처음으로 의미 있는 수준(예: 10%↑)으로 상승." },
      { tag: "감사의견 적정", meaning: "외부감사 결과 적정의견 — 회계 신뢰성 확인." },
      { tag: "상장폐지 위기", meaning: "상장폐지 사유 발생·이의신청·정리매매 등 증시 퇴출 리스크 진행." },
      { tag: "고ROE 우량", meaning: "연간 자기자본이익률(ROE)이 15% 이상 — 자본을 효율적으로 굴려 높은 이익을 냄. (분기는 누적 부분치라 연간만 판정)" },
    ],
  },
  {
    group: "A-2. 컨센서스 & 턴어라운드",
    desc: "발표 실적 vs 컨센서스(영업이익 기준) + FnGuide 턴어라운드 — 사업보고서=(연간), 분기·반기보고서=(분기)로 구분",
    basis: "FnGuide 컨센서스 · 턴어라운드 (연간/분기 별도)",
    tags: [
      { tag: "영업이익 컨센서스 상회(연간)", meaning: "사업보고서 발표 영업이익이 연간 컨센서스(추정 평균)를 상회. (표·서술엔 매출·영업이익·순이익 모두 표시, 태그는 영업이익 기준)" },
      { tag: "영업이익 컨센서스 상회(분기)", meaning: "분기·반기 발표 영업이익이 해당 분기 컨센서스를 상회." },
      { tag: "영업이익 컨센서스 하회(연간)", meaning: "사업보고서 발표 영업이익이 연간 컨센서스에 미달." },
      { tag: "영업이익 컨센서스 하회(분기)", meaning: "분기·반기 발표 영업이익이 해당 분기 컨센서스에 미달." },
      { tag: "흑자 전환(연간)", meaning: "연간 영업이익이 적자 → 흑자로 전환 (턴어라운드 1단계, 전년 연간 대비)." },
      { tag: "흑자 전환(분기)", meaning: "분기 영업이익이 적자 → 흑자로 전환 (전년 동기 분기 대비)." },
      { tag: "흑자 전환 예상(연간)", meaning: "차기 연간 흑자 전환이 예상되는 단계 (추정)." },
      { tag: "흑자 전환 예상(분기)", meaning: "차기 분기 흑자 전환이 예상되는 단계 (추정)." },
      { tag: "적자폭 축소(연간)", meaning: "연간 적자가 지속되나 손실 규모가 축소되는 개선 국면." },
      { tag: "적자폭 축소(분기)", meaning: "분기 적자가 지속되나 손실 규모가 축소." },
      { tag: "영업이익 10% 이상 성장(연간)", meaning: "연간 영업이익 +10%~+30% 성장(전년 연간 대비)." },
      { tag: "영업이익 10% 이상 성장(분기)", meaning: "분기 영업이익 +10%~+30% 성장(전년 동기 분기 대비)." },
      { tag: "영업이익 30% 이상 성장(연간)", meaning: "연간 영업이익 +30% 이상 성장(가장 강한 단계)." },
      { tag: "영업이익 30% 이상 성장(분기)", meaning: "분기 영업이익 +30% 이상 성장(가장 강한 단계, 전년 동기 분기 대비)." },
    ],
  },
  {
    group: "A-3. 안정성·재무건전성",
    desc: "정기공시 재무 기반 — 부채·유동성·이자 부담 (사업·반기·분기 모두 부착)",
    basis: "DART 재무제표 (재무상태표·손익계산서)",
    tags: [
      { tag: "재무 안정 우량", meaning: "부채비율 100% 미만 + 유동비율 150% 이상 — 빚이 적고 단기 지급능력이 충분." },
      { tag: "차입 부담 (고부채)", meaning: "부채비율 200% 이상 — 차입 부담이 큼. (금융 자회사 보유 기업은 업종 특성상 높을 수 있어 참고)" },
      { tag: "이자 못 갚을 위험", meaning: "이자보상배율 1 미만 — 영업이익으로 이자비용도 감당하지 못하는 상태." },
    ],
  },
  {
    group: "A-4. 현금흐름",
    desc: "정기공시 현금흐름표 기반 — 실제 현금 창출력 (사업·반기·분기 모두 부착)",
    basis: "DART 현금흐름표 (영업활동현금흐름 − 유형자산 취득)",
    tags: [
      { tag: "잉여현금 창출 (FCF+)", meaning: "잉여현금흐름(FCF = 영업활동현금흐름 − 설비투자)이 플러스 — 투자 후에도 현금이 남음." },
      { tag: "현금 소진 (FCF 마이너스)", meaning: "잉여현금흐름이 마이너스 — 영업현금보다 설비투자가 커 현금이 빠져나감." },
    ],
  },
  {
    group: "A-5. 배당 (주주환원)",
    desc: "정기공시 '배당에 관한 사항' 기반 — 연간 결산배당 기준 (사업보고서)",
    basis: "DART 배당에 관한 사항 (주당현금배당금·배당성향)",
    tags: [
      { tag: "배당 확대", meaning: "주당 현금배당금(DPS)이 전년 대비 증가 — 주주환원 강화." },
      { tag: "배당 축소", meaning: "주당 현금배당금(DPS)이 전년 대비 감소 — 주주환원 둔화." },
    ],
  },
  {
    group: "B. 실시간 모멘텀",
    desc: "주요사항보고서 · 거래소 공시",
    basis: "DART 주요사항보고서 · 한국거래소",
    tags: [
      { tag: "주주환원 호재", meaning: "자기주식 취득·소각, 배당 등 직접적 주주환원 — 유통주식 감소·현금 환원." },
      { tag: "주주가치 희석 위험 (유상증자)", meaning: "신주 발행(유상증자)으로 기존 주주 지분이 희석됨." },
      { tag: "대규모 자금조달 (CB/BW)", meaning: "전환사채(CB)·신주인수권부사채(BW) 발행 → 잠재적 주식 희석 위험." },
      { tag: "M&A 진행", meaning: "합병·분할·타법인 주식 취득 등 인수합병 관련 공시." },
      { tag: "경영권 분쟁 가능성", meaning: "최대주주 변경·지분 경쟁 등으로 경영 불확실성 증가." },
      { tag: "투자경고/위험 지정", meaning: "거래소 투자주의·경고·위험 지정, 불성실공시법인 지정 등 시장 경고." },
      { tag: "단기과열", meaning: "단기 급등으로 거래소 단기과열종목 지정." },
    ],
  },
  {
    group: "C. 재무 & 구조 리스크",
    desc: "증권신고서 · 자산유동화 · 공정위 · 소송",
    basis: "DART 증권신고서 · 공정위 공시",
    tags: [
      { tag: "미래현금 담보대출 (ABS)", meaning: "자산유동화 — 미래 현금흐름을 담보로 유동성 확보(상환 부담 동반)." },
      { tag: "부동산 PF 우발채무 위험", meaning: "부동산 프로젝트파이낸싱(PF) 관련 우발채무(지급보증 등)에 노출." },
      { tag: "대규모 내부거래 리스크", meaning: "계열사·특수관계인 간 대규모 거래 — 일감 몰아주기·공정위 규제, 소수주주 가치 훼손 가능성." },
      { tag: "오너가 승계/지배구조 개편", meaning: "지배구조 개편·오너 일가 승계 관련 시그널." },
      { tag: "소송/분쟁 발생", meaning: "소송 제기·피소 — 배상·충당부채 리스크." },
    ],
  },
  {
    group: "D. 수급 주체 & 간접투자",
    desc: "지분공시 · 펀드공시",
    basis: "DART 지분공시 · 펀드공시",
    tags: [
      { tag: "내부자(임원) 대량매수", meaning: "임원이 자사주를 매수 — 내부자의 긍정적 신호." },
      { tag: "내부자(임원) 매도", meaning: "임원이 자사주를 매도 — 내부자 신호 점검 필요." },
      { tag: "5% 이상 큰손 등장", meaning: "5% 이상 대량보유 보고 — 기관·큰손의 지분 등장·변동." },
      { tag: "글로벌 ETF 편입", meaning: "글로벌 지수 ETF에 신규 편입 — 패시브 자금 유입 기대." },
      { tag: "테마 ETF 리밸런싱", meaning: "테마 ETF의 보유종목 리밸런싱에 따른 수급 변화." },
    ],
  },
];

export default function CategoriesPage() {
  const total = new Set(CATEGORIES.flatMap((c) => c.tags.map((t) => t.tag))).size;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar active="categories" />
      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">🏷️ 분류기준</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            AI 투자 분석 태그 체계 — 총 {total}종, {CATEGORIES.length}개 카테고리. 각 태그의 부여 기준·상세 의미를 함께 제공합니다.
          </p>
        </div>

        {/* 색상 범례 */}
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-xs font-semibold text-gray-500">태그 색상</span>
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300" />
            초록 — 호재성 (긍정 신호)
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300" />
            빨강 — 위험·악재 (Red Flag, ⚠ 표시)
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-300" />
            회색 — 중립·일반 (정보성)
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200" />
            연회색(이탤릭) — 정보 부족
          </span>
        </div>

        <div className="space-y-5">
          {CATEGORIES.map((c) => (
            <section key={c.group} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-gray-900">{c.group}</h3>
                  <span className="text-[11px] text-gray-400 shrink-0">{c.tags.length}종</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{c.desc}</p>
                <p className="text-[11px] text-gray-400 mt-1">📊 기준 데이터: {c.basis}</p>
              </div>
              <ul className="divide-y divide-gray-50">
                {c.tags.map(({ tag, meaning }) => (
                  <li key={tag} className="px-4 py-2.5 flex gap-4 items-center hover:bg-gray-50/50">
                    <div className="w-64 shrink-0 flex justify-center">
                      <TagBadge tag={tag} />
                    </div>
                    <p className="flex-1 text-sm text-gray-600 leading-relaxed text-left border-l border-gray-100 pl-4">
                      {meaning}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
