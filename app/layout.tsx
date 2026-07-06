import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "抖音评价评分-用户体验平台",
  description: "面向抖音生活服务评价评分新人的用户体验报告生成工具"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
