"use client";

import { useState, useEffect, useCallback } from "react";

interface UnansweredItem {
  id: number;
  userId: string;
  questionText: string;
  timestamp: string;
}

export default function UnansweredPage() {
  const [items, setItems] = useState<UnansweredItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const res = await fetch(`/api/unanswered?${params}`);
    setItems(await res.json());
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const exportUrl = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return `/api/unanswered/export?${params}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Неотвеченные вопросы</h1>

      {/* Action bar */}
      <div className="flex flex-wrap gap-3 mb-5">
        <a
          href={exportUrl()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
        >
          ⬇ Выгрузить в Excel
        </a>
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-white rounded-xl border border-gray-200">
        <span className="text-sm text-gray-500 font-medium">Период:</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-focus"
        />
        <span className="text-gray-400">—</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-focus"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); }}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            ✕ сбросить
          </button>
        )}
        <span className="ml-auto text-sm text-gray-400">{items.length} записей</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Пользователь</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Вопрос</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Дата и время</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center text-gray-400">
                    <div className="flex justify-center items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Загрузка...
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center text-gray-400">
                    Неотвеченных вопросов нет
                  </td>
                </tr>
              ) : (
                items.map((item, i) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{item.userId}</td>
                    <td className="px-4 py-3 text-gray-900">{item.questionText}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(item.timestamp).toLocaleString("ru-RU")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
