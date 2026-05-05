import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FAQ Bot Admin",
  description: "Admin panel for the FAQ Bot",
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
