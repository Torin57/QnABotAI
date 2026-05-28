import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QnA Bot Admin",
  description: "Admin panel for the QnA Bot",
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
