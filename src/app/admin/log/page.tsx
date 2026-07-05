"use client";

import { useEffect, useState } from "react";

type Verdict = "answered" | "null" | "error";

interface LogEntry {
  id: number;
  question: string;
  verdict: Verdict;
  answer: string | null;
  error: string | null;
  createdAt: string;
}

const VERDICT_LABEL: Record<Verdict, string> = {
  answered: "Отвечен",
  null: "Не найден",
  error: "Ошибка",
};

const VERDICT_CLASS: Record<Verdict, string> = {
  answered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  null: "bg-amber-50 text-amber-700 ring-amber-200",
  error: "bg-red-50 text-red-700 ring-red-200",
};

const VERDICT_DOT: Record<Verdict, string> = {
  answered: "bg-emerald-500",
  null: "bg-amber-500",
  error: "bg-red-500",
};

function LogPage() {
  const [items, setItems] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/log", { cache: "no-store" });
        const raw = await res.json();
        if (!cancelled) setItems(Array.isArray(raw) ? raw : []);
      } catch (err) {
        console.error("[Log] fetch ERROR", err);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full px-6 py-10">
        <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Журнал</h1>
            <p className="mt-1 text-sm text-slate-500">
              История обращений к боту — что спросили и что ответили
            </p>
          </div>
          <div className="text-sm text-slate-500">
            Записей: <span className="font-medium text-slate-900">{items.length}</span>
          </div>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/70 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Вопрос</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-28">Вердикт</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Выданный ответ</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-40">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-20 text-center text-slate-400">
                      <div className="flex justify-center items-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span className="text-sm">Загрузка...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.045 0-2.047-.16-2.978-.454L3 21l1.5-4.5C3.55 15.152 3 13.62 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <div>
                          <div className="text-sm font-medium text-slate-700">Журнал пуст</div>
                          <div className="text-xs text-slate-500 mt-0.5">Записи появятся после первых обращений к боту</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={item.id} className="align-top hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 text-slate-400 text-xs">{idx + 1}</td>
                      <td className="px-4 py-4 text-slate-900 max-w-md">
                        <p className="line-clamp-2 leading-relaxed" title={item.question}>
                          {item.question}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${VERDICT_CLASS[item.verdict]}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${VERDICT_DOT[item.verdict]}`} />
                          {VERDICT_LABEL[item.verdict]}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-700 max-w-md">
                        {item.verdict === "error" && item.error ? (
                          <p className="line-clamp-2 leading-relaxed text-red-600" title={item.error}>
                            {item.error}
                          </p>
                        ) : item.answer ? (
                          <p className="line-clamp-2 leading-relaxed" title={item.answer}>
                            {item.answer}
                          </p>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleString("ru-RU")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LogPage;
