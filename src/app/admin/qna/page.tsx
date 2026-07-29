"use client";

import { useState, useEffect, useCallback, useId, useRef, useMemo } from "react";
import { useToast } from "@/components/Toast";

type Status = "unanswered" | "not_helpful" | "draft" | "active" | "deleted";

interface QnaItem {
  id: number;
  question: string;
  answer: string | null;
  rejectedAnswer: string | null;
  sourceDocument: string | null;
  status: Status;
  createdAt: string;
}

const STATUS_LABEL: Record<Status, string> = {
  unanswered: "Не отвечен",
  not_helpful: "Не помогло",
  draft: "Черновик",
  active: "Активен",
  deleted: "Удалён",
};

const STATUS_CLASS: Record<Status, string> = {
  unanswered: "bg-amber-50 text-amber-700 ring-amber-200",
  not_helpful: "bg-orange-50 text-orange-700 ring-orange-200",
  draft: "bg-sky-50 text-sky-700 ring-sky-200",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  deleted: "bg-rose-50 text-rose-700 ring-rose-200",
};

const STATUS_DOT: Record<Status, string> = {
  unanswered: "bg-amber-500",
  not_helpful: "bg-orange-500",
  draft: "bg-sky-500",
  active: "bg-emerald-500",
  deleted: "bg-rose-500",
};

type Filter = "all" | "unanswered" | "not_helpful" | "draft" | "active" | "deleted";
type SortKey = "question" | "answer" | "createdAt";
type SortDirection = "asc" | "desc";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "unanswered", label: "Неотвеченные" },
  { key: "not_helpful", label: "Не помогло" },
  { key: "draft", label: "Черновики" },
  { key: "active", label: "Активные" },
  { key: "deleted", label: "Удалённые" },
];

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = activeKey === sortKey;
  return (
    <th className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-slate-900 transition-colors cursor-pointer ${
          isActive ? "text-slate-900" : "text-slate-500"
        }`}
      >
        {label}
        <svg
          className={`w-3 h-3 transition-transform ${isActive ? "opacity-100" : "opacity-30"} ${
            isActive && direction === "desc" ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>
    </th>
  );
}

function QnaPage() {
  const toast = useToast();
  const [items, setItems] = useState<QnaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
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
      setSelectedIds(new Set());
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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedItems = useMemo(() => {
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      if (sortKey === "createdAt") {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      }
      const aVal = (sortKey === "question" ? a.question : a.answer) ?? "";
      const bVal = (sortKey === "question" ? b.question : b.answer) ?? "";
      return aVal.localeCompare(bVal, "ru") * dir;
    });
  }, [items, sortKey, sortDirection]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadingFileName(file.name);
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
      setUploadingFileName(null);
      if (res.ok) {
        await fetchItems();
        if (file.name.toLowerCase().endsWith(".xlsx")) {
          toast.success(`Загружено ${data.imported} пар вопрос-ответ`);
        } else {
          toast.success(
            `Извлечено ${data.imported} пар — они во вкладке «Черновики», проверьте и опубликуйте`
          );
        }
      } else {
        toast.error(`Ошибка: ${data.error}`);
      }
    } catch (err) {
      console.error("[QnA] Upload ERROR", err);
      setUploading(false);
      setUploadingFileName(null);
      toast.error("Ошибка при загрузке файла");
    }
  };

  const openAdd = () => {
    setNewQ("");
    setNewA("");
    setAdding(true);
  };

  const createItem = async () => {
    const question = newQ.trim();
    const answer = newA.trim();
    if (!question || !answer) {
      toast.error("Заполните вопрос и ответ");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/qna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer }),
      });
      if (res.ok) {
        setAdding(false);
        await fetchItems();
        toast.success("Пара добавлена");
      } else {
        const data: { error?: string } = await res.json().catch(() => ({}));
        toast.error(`Ошибка: ${data.error ?? "не удалось добавить запись"}`);
      }
    } catch (err) {
      console.error("[QnA] createItem ERROR", err);
      toast.error("Ошибка при добавлении записи");
    } finally {
      setCreating(false);
    }
  };

  const publish = async (id: number) => {
    try {
      const res = await fetch(`/api/qna/${id}/publish`, { method: "POST" });
      await fetchItems();
      if (res.ok) {
        toast.success("Запись опубликована");
      } else {
        const data: { error?: string } = await res.json().catch(() => ({}));
        toast.error(`Ошибка: ${data.error ?? "не удалось опубликовать"}`);
      }
    } catch (err) {
      console.error("[QnA] publish ERROR", err);
      toast.error("Ошибка при публикации");
    }
  };

  const restore = async (id: number) => {
    try {
      const res = await fetch(`/api/qna/${id}/restore`, { method: "POST" });
      await fetchItems();
      if (res.ok) {
        toast.success("Запись восстановлена");
      } else {
        const data: { error?: string } = await res.json().catch(() => ({}));
        toast.error(`Ошибка: ${data.error ?? "не удалось восстановить"}`);
      }
    } catch (err) {
      console.error("[QnA] restore ERROR", err);
      toast.error("Ошибка при восстановлении");
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Удалить эту запись?")) return;
    try {
      const res = await fetch(`/api/qna/${id}`, { method: "DELETE" });
      await fetchItems();
      if (res.ok) {
        toast.success("Запись удалена");
      } else {
        const data: { error?: string } = await res.json().catch(() => ({}));
        toast.error(`Ошибка: ${data.error ?? "не удалось удалить"}`);
      }
    } catch (err) {
      console.error("[QnA] remove ERROR", err);
      toast.error("Ошибка при удалении");
    }
  };

  const selectableItems = items.filter((i) => i.status !== "deleted");
  const allSelected =
    selectableItems.length > 0 && selectableItems.every((i) => selectedIds.has(i.id));

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allSelected) return new Set();
      return new Set(selectableItems.map((i) => i.id));
    });
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Удалить выбранные записи (${ids.length})?`)) return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/qna/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data: { deleted?: number; error?: string } = await res.json().catch(() => ({}));
      if (res.ok) {
        await fetchItems();
        toast.success(`Удалено записей: ${data.deleted ?? ids.length}`);
      } else {
        toast.error(`Ошибка: ${data.error ?? "не удалось удалить"}`);
      }
    } catch (err) {
      console.error("[QnA] bulkDelete ERROR", err);
      toast.error("Ошибка при массовом удалении");
    } finally {
      setBulkDeleting(false);
    }
  };

  const bulkPublish = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkPublishing(true);
    try {
      const res = await fetch("/api/qna/bulk-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data: { published?: number; skipped?: number; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (res.ok) {
        await fetchItems();
        const skippedNote = data.skipped ? `, пропущено без ответа: ${data.skipped}` : "";
        toast.success(`Опубликовано записей: ${data.published ?? ids.length}${skippedNote}`);
      } else {
        toast.error(`Ошибка: ${data.error ?? "не удалось опубликовать"}`);
      }
    } catch (err) {
      console.error("[QnA] bulkPublish ERROR", err);
      toast.error("Ошибка при массовой публикации");
    } finally {
      setBulkPublishing(false);
    }
  };

  const startEdit = (item: QnaItem) => {
    setEditingId(item.id);
    setEditQ(item.question);
    setEditA(item.answer ?? "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/qna/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: editQ, answer: editA }),
      });
      setEditingId(null);
      await fetchItems();
      if (res.ok) {
        toast.success("Изменения сохранены");
      } else {
        const data: { error?: string } = await res.json().catch(() => ({}));
        toast.error(`Ошибка: ${data.error ?? "не удалось сохранить"}`);
      }
    } catch (err) {
      console.error("[QnA] saveEdit ERROR", err);
      toast.error("Ошибка при сохранении");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full px-6 py-10">
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
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Добавить пару
            </button>

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
              className={`inline-flex items-center gap-2 px-3.5 py-2 bg-white text-emerald-700 text-sm font-medium rounded-lg border border-emerald-600 hover:bg-emerald-50 transition-colors ${
                uploading ? "pointer-events-none opacity-60" : "cursor-pointer"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
              </svg>
              {uploading ? "Загрузка..." : "Загрузить документ"}
            </label>
            <input id={docInputId} type="file" accept=".pdf,.docx,.txt,.srt,.vtt" onChange={handleUpload} className="sr-only" />
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

        {/* Подсказка по форматам загрузки */}
        <p className="mb-4 text-xs text-slate-500 leading-relaxed">
          <span className="font-medium text-slate-600">«Загрузить Excel»</span> — файл .xlsx с готовыми
          парами: колонка <code className="px-1 py-0.5 bg-slate-100 rounded">question</code> (вопрос) и{" "}
          <code className="px-1 py-0.5 bg-slate-100 rounded">answer</code> (ответ), каждая пара — отдельная строка.{" "}
          <span className="font-medium text-slate-600">«Загрузить документ»</span> — учебный материал в свободной
          форме: PDF, DOCX, TXT (в том числе транскрипты уроков) или субтитры SRT/VTT; ИИ извлечёт из текста
          пары вопрос-ответ и положит их во вкладку «Черновики» — проверьте их и опубликуйте.
        </p>

        {/* Bulk actions bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between gap-3 mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-sm text-blue-900">
              Выбрано: <span className="font-medium">{selectedIds.size}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                disabled={bulkDeleting || bulkPublishing}
                className="px-3 py-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors disabled:opacity-60"
              >
                Снять выделение
              </button>
              <button
                type="button"
                onClick={bulkPublish}
                disabled={bulkDeleting || bulkPublishing}
                className="px-3.5 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                {bulkPublishing ? "Публикация..." : "Опубликовать выбранное"}
              </button>
              <button
                type="button"
                onClick={bulkDelete}
                disabled={bulkDeleting || bulkPublishing}
                className="px-3.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {bulkDeleting ? "Удаление..." : "Удалить выбранное"}
              </button>
            </div>
          </div>
        )}

        {/* Processing banner */}
        {uploading && (
          <div className="flex items-center gap-2.5 mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>
              Обрабатывается: <span className="font-medium">{uploadingFileName}</span>…
            </span>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/70 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      disabled={selectableItems.length === 0}
                      aria-label="Выбрать все"
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/40 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                  <SortableHeader label="Вопрос" sortKey="question" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Ответ" sortKey="answer" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-28">Статус</th>
                  <SortableHeader label="Дата" sortKey="createdAt" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} className="w-24" />
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
                  sortedItems.map((item, idx) => {
                    const isEditing = editingId === item.id;
                    return (
                      <tr
                        key={item.id}
                        className={`align-top transition-colors ${
                          isEditing ? "bg-blue-50/40" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-4 py-4">
                          {item.status !== "deleted" && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(item.id)}
                              onChange={() => toggleSelect(item.id)}
                              aria-label={`Выбрать запись ${item.id}`}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/40 cursor-pointer"
                            />
                          )}
                        </td>
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
                          {item.status === "not_helpful" && item.rejectedAnswer ? (
                            <div className="mb-2 rounded-md border border-orange-200 bg-orange-50 px-2.5 py-2">
                              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-orange-700">
                                Ответ, который не помог
                              </div>
                              <p
                                className="line-clamp-3 text-sm leading-relaxed text-orange-900"
                                title={item.rejectedAnswer}
                              >
                                {item.rejectedAnswer}
                              </p>
                            </div>
                          ) : null}
                          {isEditing ? (
                            <textarea
                              value={editA}
                              onChange={(e) => setEditA(e.target.value)}
                              rows={3}
                              placeholder={
                                item.status === "not_helpful"
                                  ? "Введите исправленный ответ"
                                  : undefined
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            />
                          ) : item.answer ? (
                            <p className="line-clamp-2 leading-relaxed" title={item.answer}>
                              {item.answer}
                            </p>
                          ) : item.status !== "not_helpful" ? (
                            <span className="text-slate-300">—</span>
                          ) : null}
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
                              <button
                                onClick={() => restore(item.id)}
                                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                              >
                                Восстановить
                              </button>
                            ) : (
                              <>
                                {(item.status === "unanswered" ||
                                  item.status === "not_helpful" ||
                                  item.status === "draft") && (
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

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => !creating && setAdding(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Новая пара вопрос–ответ</h2>
              <button
                type="button"
                onClick={() => !creating && setAdding(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Закрыть"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Вопрос</label>
                <textarea
                  value={newQ}
                  onChange={(e) => setNewQ(e.target.value)}
                  rows={2}
                  autoFocus
                  placeholder="Например: Как записаться на пересдачу?"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Ответ</label>
                <textarea
                  value={newA}
                  onChange={(e) => setNewA(e.target.value)}
                  rows={4}
                  placeholder="Текст ответа, который увидит студент"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setAdding(false)}
                disabled={creating}
                className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={createItem}
                disabled={creating}
                className="px-3.5 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60"
              >
                {creating ? "Добавление..." : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QnaPage;
