import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API 라우트가 런타임에 data/*.json 을 readFile/readdir 로 읽으므로,
  // 서버리스 함수 번들에 해당 파일들을 명시적으로 포함시킨다.
  // (동적 경로로 읽으면 Next 파일 트레이싱이 자동 감지하지 못함)
  outputFileTracingIncludes: {
    "/api/dart": ["./data/*-tagged.json"],
    "/api/ticker/\\[code\\]": ["./data/*-tagged.json"],
  },
};

export default nextConfig;
