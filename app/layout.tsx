import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "生活服务新人闯关训练",
  description: "面向生活服务业务新人的游戏化产品体验训练工具"
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
