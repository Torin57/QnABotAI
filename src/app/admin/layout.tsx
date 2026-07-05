"use client";

import { usePathname } from "next/navigation";
import { ToastProvider } from "@/components/Toast";
import { AdminNav } from "@/components/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  return (
    <ToastProvider>
      <div className="min-h-screen bg-page">
        {!isLoginPage && (
          <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="px-6 h-14 flex items-center gap-6">
              <span className="shrink-0 whitespace-nowrap font-bold text-gray-900 text-lg">🤖 Бот «Вопрос–Ответ»</span>
              <AdminNav />
            </div>
          </nav>
        )}
        <main>{children}</main>
      </div>
    </ToastProvider>
  );
}
