import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Card News Studio — 인스타 카드뉴스 제작",
  description: "주제 선정 → 뉴스 요약 → 아티클 작성 → 카드 디자인 → PNG 패키징까지, 혼자서 끝내는 카드뉴스 워크플로",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="min-h-screen bg-ink font-sans antialiased">{children}</body>
    </html>
  );
}
