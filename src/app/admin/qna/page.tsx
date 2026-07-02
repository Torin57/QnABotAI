"use client";

import { useState, useEffect, useCallback, useId, useRef } from "react";

type Status = "unanswered" | "active" | "deleted";

interface QnaItem {
  id: number;
  question: string;
  answer: string | null;
  sourceDocument: string | null;
  status: Status;
  createdAt: string;
}

const STATUS_LABEL: Record<Status, string> = {
  unanswered: "Неотвечен",
  active: "Активен",
  deleted: "Удалён",
};

const STATUS_CLASS: Record<Status, string> = {
  unanswered: "bg-amber-50 text-amber-700 ring-amber-200",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  deleted: "bg-rose-50 text-rose-700 ring-rose-200",
};

const STATUS_DOT: Record<Status, string> = {
  unanswered: "bg-amber-500",
  active: "bg-emerald-500",
  deleted: "bg-rose-500",
};

type Filter = "all" | "unanswered" | "active" | "deleted";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "unanswered", label: "Неотвеченные" },
  { key: "active", label: "Активные" },
  { key: "deleted", label: "Удалённые" },
];

function QnaPage() {
  const [items, setItems] = useState<QnaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const excelInputId = useId();
  const docInputId = useId();

  const abortRef = useRef<AbortController | null>(null);

  const fetchItems = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const query = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/qna${query}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      const raw = await res.json();
      const data: QnaItem[] = Array.isArray(raw) ? raw : [];
      setItems(data);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[QnA] fetchItems ERROR", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchItems();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchItems]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/qna/upload", { method: "POST", body });
      const bodyText = await res.text();
      const data: { imported?: number; error?: string } = bodyText
        ? (() => {
            try {
              return JSON.parse(bodyText);
            } catch {
              return { error: "Некорректный ответ сервера" };
            }
          })()
        : { error: "Пустой ответ сервера" };
      e.target.value = "";
      setUploading(false);
      if (res.ok) {
        await fetchItems();
        alert(`Загружено ${data.imported} пар вопрос-ответ`);
      } else {
        alert(`Ошибка: ${data.error}`);
      }
    } catch (err) {
      console.error("[QnA] Upload ERROR", err);
      setUploading(false);
      alert("Ошибка при загрузке файла");
    }
  };

  const publish = async (id: number) => {
    await fetch(`/api/qna/${id}/publish`, { method: "POST" });
    await fetchItems();
  };

  const remove = async (id: number) => {
    if (!confirm("Удалить эту запись?")) return;
    await fetch(`/api/qna/${id}`, { method: "DELETE" });
    await fetchItems();
  };

  const startEdit = (item: QnaItem) => {
    setEditingId(item.id);
    setEditQ(item.question);
    setEditA(item.answer ?? "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    await fetch(`/api/qna/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: editQ, answer: editA }),
    });
    setSaving(false);
    setEditingId(null);
    await fetchItems();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">База знаний</h1>
            <p className="mt-1 text-sm text-slate-500">Управление базой вопросов и ответов</p>
          </div>
          <div className="text-sm text-slate-500">
            Записей:{" "}
            <span className="font-medium text-slate-900">{items.length}</span>
          </div>
        </header>

        {/* Status filter */}
        <div className="mb-5">
          <nav className="inline-flex gap-1 p-1 bg-slate-100 rounded-lg" role="tablist">
            {FILTERS.map((f) => {
              const isActive = filter === f.key;
              return (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setFilter(f.key)}
                  className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            <label
              htmlFor={excelInputId}
              className={`inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm ${
                uploading ? "pointer-events-none opacity-60" : "cursor-pointer"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5 5 5M12 5v12" />
              </svg>
              {uploading ? "Загрузка..." : "Загрузить Excel"}
            </label>
            <input id={excelInputId} type="file" accept=".xlsx" onChange={handleUpload} className="sr-only" />

            <label
              htmlFor={docInputId}
              className={`inline-flex items-center gap-2 px-3.5 py-2 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors ${
                uploading ? "pointer-events-none opacity-60" : "cursor-pointer"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
              </svg>
              {uploading ? "Загрузка..." : "Загрузить документ"}
            </label>
            <input id={docInputId} type="file" accept=".pdf,.docx" onChange={handleUpload} className="sr-only" />
          </div>

          <a
            href="/api/qna/export"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M17 10l-5 5-5-5M12 15V3" />
            </svg>
            Экспорт в Excel
          </a>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/70 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Вопрос</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ответ</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-32">Источник</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-28">Статус</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-24">Дата</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-64">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-20 text-center text-slate-400">
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
                    <td colSpan={7} className="px-4 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                          <div className="text-sm font-medium text-slate-700">Нет записей</div>
                          <div className="text-xs text-slate-500 mt-0.5">Загрузите Excel или документ, чтобы начать</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const isEditing = editingId === item.id;
                    return (
                      <tr
                        key={item.id}
                        className={`align-top transition-colors ${
                          isEditing ? "bg-blue-50/40" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-4 py-4 text-slate-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-4 text-slate-900 max-w-xs">
                          {isEditing ? (
                            <textarea
                              value={editQ}
                              onChange={(e) => setEditQ(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            />
                          ) : (
                            <p className="line-clamp-2 leading-relaxed" title={item.question}>
                              {item.question}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-700 max-w-md">
                          {isEditing ? (
                            <textarea
                              value={editA}
                              onChange={(e) => setEditA(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            />
                          ) : item.answer ? (
                            <p className="line-clamp-2 leading-relaxed" title={item.answer}>
                              {item.answer}
                            </p>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500 truncate max-w-[8rem]" title={item.sourceDocument ?? ""}>
                          {item.sourceDocument || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${STATUS_CLASS[item.status]}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[item.status]}`} />
                            {STATUS_LABEL[item.status]}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleDateString("ru-RU")}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={saveEdit}
                                  disabled={saving}
                                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-60"
                                >
                                  {saving ? "Сохранение..." : "Сохранить"}
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                                >
                                  Отмена
                                </button>
                              </>
                            ) : item.status === "deleted" ? (
                              <span className="text-xs text-slate-400">В корзине</span>
                            ) : (
                              <>
                                {item.status === "unanswered" && (
                                  <button
                                    onClick={() => publish(item.id)}
                                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                  >
                                    Опубликовать
                                  </button>
                                )}
                                <button
                                  onClick={() => startEdit(item)}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                                >
                                  Изменить
                                </button>
                                <button
                                  onClick={() => remove(item.id)}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                >
                                  Удалить
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QnaPage;
