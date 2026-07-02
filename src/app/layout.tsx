import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Бот «Вопрос–Ответ» — админка",
  description: "Панель администратора бота «Вопрос–Ответ»",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
