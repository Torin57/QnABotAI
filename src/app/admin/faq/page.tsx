"use client";

import { useState, useEffect, useCallback, useId, useRef } from "react";

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  sourceDocument: string;
  status: "pending" | "active" | "deleted";
  createdAt: string;
}

const STATUS_LABEL: Record<FaqItem["status"], string> = {
  pending: "Ожидание",
  active: "Активен",
  deleted: "Удалён",
};
const STATUS_CLASS: Record<FaqItem["status"], string> = {
  pending: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  deleted: "bg-red-100 text-red-800",
};

export default function FaqPage() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
  const [saving, setSaving] = useState(false);
  const excelInputId = useId();
  const docInputId = useId();
  const abortRef = useRef<AbortController | null>(null);

  const fetchItems = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/faq?${params}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      const raw = await res.json();
      const data: FaqItem[] = Array.isArray(raw) ? raw : [];
      setItems(data);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[FAQ] fetchItems ERROR", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchItems();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchItems]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/faq/upload", { method: "POST", body });
      const data = await res.json();
      e.target.value = "";
      setUploading(false);
      if (res.ok) {
        await fetchItems();
        alert(`Загружено ${data.imported} пар Q&A`);
      } else {
        alert(`Ошибка: ${data.error}`);
      }
    } catch (err) {
      console.error("[FAQ] Upload ERROR", err);
      setUploading(false);
      alert("Ошибка при загрузке файла");
    }
  };

  const publish = async (id: number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, status: "active" as const } : item));
    await fetch(`/api/faq/${id}/publish`, { method: "POST" });
  };

  const remove = async (id: number) => {
    if (!confirm("Удалить эту запись?")) return;
    setItems(prev => prev.filter(item => item.id !== id));
    await fetch(`/api/faq/${id}`, { method: "DELETE" });
  };

  const startEdit = (item: FaqItem) => {
    setEditingId(item.id);
    setEditQ(item.question);
    setEditA(item.answer);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    await fetch(`/api/faq/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: editQ, answer: editA }),
    });
    setSaving(false);
    setItems(prev => prev.map(item =>
      item.id === editingId ? { ...item, question: editQ, answer: editA } : item
    ));
    setEditingId(null);
  };

  const exportUrl = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return `/api/faq/export?${params}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">База знаний (FAQ)</h1>

      {/* Action bar */}
      <div className="flex flex-wrap gap-3 mb-5">
        <label
          htmlFor={excelInputId}
          className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors ${uploading ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
        >
          📊 {uploading ? "Загрузка..." : "Загрузить Excel"}
        </label>
        <input id={excelInputId} type="file" accept=".xlsx" onChange={handleUpload} className="sr-only" />

        <label
          htmlFor={docInputId}
          className={`inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors ${uploading ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
        >
          📄 {uploading ? "Загрузка..." : "Загрузить документ"}
        </label>
        <input id={docInputId} type="file" accept=".pdf,.docx" onChange={handleUpload} className="sr-only" />

        <a
          href={exportUrl()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
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
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-400">—</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Вопрос</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ответ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Источник</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Дата</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                    <div className="flex justify-center items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Загрузка...
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                    Нет данных. Загрузите Excel или документ.
                  </td>
                </tr>
              ) : (
                items.map((item, i) =>
                  editingId === item.id ? (
                    <tr key={item.id} className="bg-blue-50">
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3">
                        <textarea
                          value={editQ}
                          onChange={(e) => setEditQ(e.target.value)}
                          rows={3}
                          className="w-full px-2 py-1 border border-blue-400 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <textarea
                          value={editA}
                          onChange={(e) => setEditA(e.target.value)}
                          rows={3}
                          className="w-full px-2 py-1 border border-blue-400 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[112px]">{item.sourceDocument}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[item.status]}`}>
                          {STATUS_LABEL[item.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(item.createdAt).toLocaleDateString("ru-RU")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                          >
                            {saving ? "..." : "Сохранить"}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                          >
                            Отмена
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3 text-gray-900 max-w-xs">
                        <p className="line-clamp-2" title={item.question}>{item.question}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-sm">
                        <p className="line-clamp-2" title={item.answer}>{item.answer}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[112px]" title={item.sourceDocument}>
                        {item.sourceDocument}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[item.status]}`}>
                          {STATUS_LABEL[item.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(item.createdAt).toLocaleDateString("ru-RU")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => publish(item.id)}
                            className="px-3 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
                          >
                            ОК
                          </button>
                          <button
                            onClick={() => remove(item.id)}
                            className="px-3 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600"
                          >
                            Удалить
                          </button>
                          <button
                            onClick={() => startEdit(item)}
                            className="px-3 py-1 text-xs bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                          >
                            Редактировать
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
