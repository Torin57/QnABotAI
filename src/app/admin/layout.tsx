import { ToastProvider } from "@/components/Toast";
import { AdminNav } from "@/components/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-page">
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-6 h-14 flex items-center gap-6">
            <span className="font-bold text-gray-900 text-lg">🤖 Бот «Вопрос–Ответ»</span>
            <AdminNav />
          </div>
        </nav>
        <main>{children}</main>
      </div>
    </ToastProvider>
  );
}
