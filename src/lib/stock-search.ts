// 종목 검색 공용 로직 — 검색창(자동완성)과 검색 결과 페이지(/search)가 공유.

export type Stock = {
  name: string;
  code: string;
  ready: boolean;
  market?: string;
  sector?: string;
  aliases?: string[];
};

export const STOCKS: Stock[] = [
  { name: "삼성전자", code: "005930", ready: true, market: "KOSPI", sector: "반도체" },
  { name: "SK하이닉스", code: "000660", ready: true, market: "KOSPI", sector: "반도체", aliases: ["하이닉스", "sk"] },
  { name: "현대자동차", code: "005380", ready: true, market: "KOSPI", sector: "자동차", aliases: ["현대차", "현차"] },
  { name: "한미반도체", code: "042700", ready: true, market: "KOSPI", sector: "반도체 장비", aliases: ["한미"] },
  { name: "NC", code: "036570", ready: true, market: "KOSPI", sector: "게임", aliases: ["엔씨소프트", "엔씨", "ncsoft"] },
  { name: "와이지엔터테인먼트", code: "122870", ready: true, market: "KOSDAQ", sector: "엔터테인먼트", aliases: ["YG", "와이지", "와이지엔터", "yg엔터"] },
  { name: "에코프로비엠", code: "247540", ready: true, market: "KOSDAQ", sector: "2차전지 소재", aliases: ["에코프로", "에코프로bm"] },
  // 분석 대기
  { name: "LG에너지솔루션", code: "373220", ready: false, market: "KOSPI", sector: "2차전지", aliases: ["엘지엔솔", "lg엔솔"] },
  { name: "삼성바이오로직스", code: "207940", ready: false, market: "KOSPI", sector: "바이오", aliases: ["삼바"] },
  { name: "기아", code: "000270", ready: false, market: "KOSPI", sector: "자동차" },
  { name: "NAVER", code: "035420", ready: false, market: "KOSPI", sector: "인터넷", aliases: ["네이버"] },
  { name: "카카오", code: "035720", ready: false, market: "KOSPI", sector: "인터넷" },
  { name: "LG화학", code: "051910", ready: false, market: "KOSPI", sector: "화학" },
];

const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
export function toInitials(str: string): string {
  let out = "";
  for (const ch of str) {
    const c = ch.charCodeAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) out += CHO[Math.floor((c - 0xac00) / 588)];
    else out += ch.toLowerCase();
  }
  return out;
}

function isSubsequence(q: string, target: string): boolean {
  let i = 0;
  for (const ch of target) {
    if (ch === q[i]) i++;
    if (i === q.length) return true;
  }
  return false;
}

// 매칭 점수(낮을수록 우선). null=미일치
export function scoreOf(s: Stock, raw: string): number | null {
  const q = raw.toLowerCase().replace(/\s/g, "");
  if (!q) return null;
  const fields = [s.name, ...(s.aliases ?? [])].map((f) => f.toLowerCase());
  let best: number | null = null;
  const consider = (v: number) => { if (best === null || v < best) best = v; };

  if (s.code.includes(q)) consider(q === s.code ? 0 : 1);
  for (const f of fields) {
    if (f === q) consider(0);
    else if (f.startsWith(q)) consider(2);
    else if (f.includes(q)) consider(3);
    else if (isSubsequence(q, f)) consider(5);
    const ini = toInitials(f);
    if (ini.startsWith(q)) consider(4);
    else if (ini.includes(q)) consider(5);
    else if (isSubsequence(q, ini)) consider(6);
  }
  if (best === null) return null;
  return best - (s.ready ? 0.5 : 0);
}

// 검색 결과 (점수순 정렬)
export function searchStocks(query: string, limit = 50): Stock[] {
  const t = query.trim();
  if (!t) return [];
  return STOCKS.map((s) => ({ s, score: scoreOf(s, t) }))
    .filter((x) => x.score !== null)
    .sort((a, b) => (a.score as number) - (b.score as number))
    .slice(0, limit)
    .map((x) => x.s);
}
