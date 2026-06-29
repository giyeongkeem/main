import type { Metadata } from "next";
import "./globals.css";
import { auth } from "@/lib/auth";
import { CompareProvider } from "@/components/CompareContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CompareBar } from "@/components/CompareBar";

export const metadata: Metadata = {
  title: {
    default: "핏매치 — 서울 피트니스·필라테스 트레이너 비교",
    template: "%s | 핏매치",
  },
  description:
    "서울의 피트니스, 퍼스널 트레이너, 필라테스 트레이너·센터를 자격증 보유 여부, 실제 후기, 시설 사진으로 한눈에 비교하고 선택하세요.",
  keywords: [
    "서울 피트니스",
    "퍼스널 트레이너",
    "PT",
    "필라테스",
    "필라테스 센터",
    "트레이너 비교",
    "자격증",
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <html lang="ko">
      <body className="flex min-h-screen flex-col">
        <CompareProvider>
          <Header user={session?.user ?? null} />
          <main className="flex-1">{children}</main>
          <Footer />
          <CompareBar />
        </CompareProvider>
      </body>
    </html>
  );
}
