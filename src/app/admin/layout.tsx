"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navLink = (href: string, label: string) => {
    const active = pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          active
            ? "bg-blue-600 text-white"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
          <span className="font-bold text-gray-900 text-lg">🤖 FAQ Bot</span>
          <div className="flex items-center gap-2">
            {navLink("/admin/faq", "База знаний")}
            {navLink("/admin/unanswered", "Неотвеченные")}
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
