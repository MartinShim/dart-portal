import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  // 경로 조작 방지: 숫자만 허용
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "잘못된 종목코드" }, { status: 400 });
  }

  try {
    const file = await readFile(
      join(process.cwd(), "data", `corp-${code}-tagged.json`),
      "utf-8"
    );
    return NextResponse.json(JSON.parse(file));
  } catch {
    return NextResponse.json(
      {
        error: `${code} 분석 데이터가 없습니다. scripts/fetch-dart.mjs + analyze-corp.mjs 를 실행하세요.`,
      },
      { status: 404 }
    );
  }
}
