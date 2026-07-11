"use client";

import { useEffect, useState } from "react";

type Verdict = "answered" | "null" | "error" | "not_helpful";

interface LogCandidate {
  id: number;
  question: string;
  score: number;
  answer: string | null;
}

interface LogEntry {
  id: number;
  question: string;
  candidates: LogCandidate[] | null;
  verdict: Verdict;
  answer: string | null;
  error: string | null;
  createdAt: string;
}

const VERDICT_LABEL: Record<Verdict, string> = {
  answered: "Отвечен",
  null: "Не найден",
  error: "Ошибка",
  not_helpful: "Не помогло",
};

const VERDICT_CLASS: Record<Verdict, string> = {
  answered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  null: "bg-amber-50 text-amber-700 ring-amber-200",
  error: "bg-red-50 text-red-700 ring-red-200",
  not_helpful: "bg-orange-50 text-orange-700 ring-orange-200",
};

const VERDICT_DOT: Record<Verdict, string> = {
  answered: "bg-emerald-500",
  null: "bg-amber-500",
  error: "bg-red-500",
  not_helpful: "bg-orange-500",
};

function formatScore(score: number): string {
  return score.toFixed(3);
}

/** Выбранный кандидат: совпадение снапшота выданного ответа с актуальным ответом из базы. */
function isChosenCandidate(entry: LogEntry, candidate: LogCandidate): boolean {
  if (
    (entry.verdict !== "answered" && entry.verdict !== "not_helpful") ||
    !entry.answer ||
    !candidate.answer
  ) {
    return false;
  }
  return entry.answer.trim() === candidate.answer.trim();
}

function LogPage() {
  const [items, setItems] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<LogEntry | null>(null);

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

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

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
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-28"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-20 text-center text-slate-400">
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
                    <td colSpan={6} className="px-4 py-20 text-center">
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
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setDetail(item)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          Подробнее
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDetail(null)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-detail-title"
            className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h2 id="log-detail-title" className="text-base font-semibold text-slate-900">
                Разбор обращения
              </h2>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Закрыть"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Вопрос
                </div>
                <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-wrap">{detail.question}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Вердикт
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${VERDICT_CLASS[detail.verdict]}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${VERDICT_DOT[detail.verdict]}`} />
                    {VERDICT_LABEL[detail.verdict]}
                  </span>
                </div>
                <div className="text-xs text-slate-500 self-end pb-1">
                  {new Date(detail.createdAt).toLocaleString("ru-RU")}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Выданный ответ
                </div>
                {detail.verdict === "error" && detail.error ? (
                  <p className="text-sm text-red-600 leading-relaxed whitespace-pre-wrap">{detail.error}</p>
                ) : detail.answer ? (
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{detail.answer}</p>
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )}
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Похожие вопросы из базы знаний
                </div>
                {!detail.candidates || detail.candidates.length === 0 ? (
                  <p className="text-sm text-slate-400">Похожих вопросов не нашлось (пустой поиск или ошибка до поиска)</p>
                ) : (
                  <ol className="space-y-2">
                    {detail.candidates.map((c, i) => {
                      const chosen = isChosenCandidate(detail, c);
                      return (
                        <li
                          key={`${c.id}-${i}`}
                          className={
                            chosen
                              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5"
                              : "rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5"
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-medium text-slate-500 mb-0.5">
                                #{i + 1}
                                <span className="text-slate-400 font-normal"> · id {c.id}</span>
                                {chosen && (
                                  <span className="ml-2 text-emerald-700 font-medium">выбран</span>
                                )}
                              </div>
                              <p className="text-sm text-slate-900 leading-relaxed">{c.question}</p>
                              {c.answer ? (
                                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Ответ:{" "}
                                  </span>
                                  {c.answer}
                                </p>
                              ) : (
                                <p className="mt-1.5 text-xs text-slate-400">Ответ в базе не найден</p>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-[10px] uppercase tracking-wider text-slate-400">score</div>
                              <div className="text-sm font-semibold tabular-nums text-slate-800">
                                {formatScore(c.score)}
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  «Судья» при выборе видит только тексты вопросов, не ответы. Ответы ниже — из текущей базы знаний.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end px-5 py-4 border-t border-slate-200 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LogPage;
