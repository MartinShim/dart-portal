import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DART 공시 Portal",
  description: "DART 전자공시를 투자 분석 태그로 재번역하는 AI 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
