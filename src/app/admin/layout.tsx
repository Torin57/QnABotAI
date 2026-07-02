export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center">
          <span className="font-bold text-gray-900 text-lg">🤖 Бот «Вопрос–Ответ»</span>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
