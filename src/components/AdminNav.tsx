"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

const NAV_ITEMS = [
  { href: "/admin/qna", label: "База знаний" },
  { href: "/admin/log", label: "Журнал" },
];

type JudgeDefaults = {
  model: string;
  temperature: number;
  prompt: string;
};

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState("0");
  const [prompt, setPrompt] = useState("");
  const [teacherContactUrl, setTeacherContactUrl] = useState("");
  const [defaults, setDefaults] = useState<JudgeDefaults | null>(null);
  const [contactDefaultFromEnv, setContactDefaultFromEnv] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  useEffect(() => {
    if (!settingsOpen) return;
    let cancelled = false;
    (async () => {
      setLoadingSettings(true);
      try {
        const [judgeRes, contactRes] = await Promise.all([
          fetch("/api/settings/judge", { cache: "no-store" }),
          fetch("/api/settings/contact", { cache: "no-store" }),
        ]);
        const judgeData = await judgeRes.json();
        const contactData = await contactRes.json();
        if (!judgeRes.ok) throw new Error(judgeData.error || "Не удалось загрузить настройки «Судьи»");
        if (!contactRes.ok) {
          throw new Error(contactData.error || "Не удалось загрузить ссылку контакта");
        }
        if (!cancelled) {
          setModel(typeof judgeData.model === "string" ? judgeData.model : "mistral-small-latest");
          setTemperature(
            typeof judgeData.temperature === "number" ? String(judgeData.temperature) : "0"
          );
          setPrompt(typeof judgeData.prompt === "string" ? judgeData.prompt : "");
          if (judgeData.defaults && typeof judgeData.defaults === "object") {
            setDefaults({
              model:
                typeof judgeData.defaults.model === "string"
                  ? judgeData.defaults.model
                  : "mistral-small-latest",
              temperature:
                typeof judgeData.defaults.temperature === "number"
                  ? judgeData.defaults.temperature
                  : 0,
              prompt:
                typeof judgeData.defaults.prompt === "string" ? judgeData.defaults.prompt : "",
            });
          }
          setTeacherContactUrl(typeof contactData.url === "string" ? contactData.url : "");
          setContactDefaultFromEnv(
            typeof contactData.defaultFromEnv === "string" ? contactData.defaultFromEnv : ""
          );
        }
      } catch (err) {
        console.error("[AdminNav] settings load ERROR", err);
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Ошибка загрузки настроек");
          setSettingsOpen(false);
        }
      } finally {
        if (!cancelled) setLoadingSettings(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settingsOpen, toast]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, saving]);

  function resetToDefaults() {
    if (defaults) {
      setModel(defaults.model);
      setTemperature(String(defaults.temperature));
      setPrompt(defaults.prompt);
    }
    if (contactDefaultFromEnv) {
      setTeacherContactUrl(contactDefaultFromEnv);
    }
  }

  async function saveSettings() {
    const trimmedModel = model.trim();
    const trimmedPrompt = prompt.trim();
    const trimmedContact = teacherContactUrl.trim();
    const temp = Number(temperature.replace(",", "."));
    if (!trimmedModel) {
      toast.error("Укажите имя модели");
      return;
    }
    if (!Number.isFinite(temp) || temp < 0 || temp > 1.5) {
      toast.error("Температура — число от 0 до 1.5");
      return;
    }
    if (!trimmedPrompt) {
      toast.error("Системный промпт не может быть пустым");
      return;
    }
    if (!trimmedContact) {
      toast.error("Укажите ссылку «Связаться с преподавателем»");
      return;
    }

    setSaving(true);
    try {
      const [judgeRes, contactRes] = await Promise.all([
        fetch("/api/settings/judge", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: trimmedModel,
            temperature: temp,
            prompt: trimmedPrompt,
          }),
        }),
        fetch("/api/settings/contact", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmedContact }),
        }),
      ]);
      const judgeData = await judgeRes.json();
      const contactData = await contactRes.json();
      if (!judgeRes.ok) throw new Error(judgeData.error || "Не удалось сохранить настройки «Судьи»");
      if (!contactRes.ok) throw new Error(contactData.error || "Не удалось сохранить ссылку контакта");
      toast.success("Настройки сохранены");
      setSettingsOpen(false);
    } catch (err) {
      console.error("[AdminNav] settings save ERROR", err);
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <nav className="flex items-center gap-1 w-full">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                isActive ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="ml-auto px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          Настройки
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          Выйти
        </button>
      </nav>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => !saving && setSettingsOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h2 id="settings-title" className="text-base font-semibold text-slate-900">
                Настройки
              </h2>
              <button
                type="button"
                onClick={() => !saving && setSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Закрыть"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {loadingSettings ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-6 justify-center">
                  <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Загрузка...
                </div>
              ) : (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Судья
                  </p>
                  <div>
                    <label htmlFor="judge-model" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Модель
                    </label>
                    <input
                      id="judge-model"
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="mistral-small-latest"
                      autoFocus
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <p className="mt-1.5 text-xs text-slate-400">
                      Например: mistral-small-latest или mistral-large-latest
                    </p>
                  </div>
                  <div>
                    <label htmlFor="judge-temperature" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Температура
                    </label>
                    <input
                      id="judge-temperature"
                      type="number"
                      min={0}
                      max={1.5}
                      step={0.1}
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <p className="mt-1.5 text-xs text-slate-400">От 0 до 1.5. Для выбора ответа обычно 0.</p>
                  </div>
                  <div>
                    <label htmlFor="judge-prompt" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Системный промпт
                    </label>
                    <textarea
                      id="judge-prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono leading-relaxed focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <p className="mt-1.5 text-xs text-slate-400">
                      «Судья» должен вернуть только ID кандидата или NULL.
                    </p>
                  </div>
                  <p className="text-xs text-slate-400">
                    API-ключ Mistral задаётся на сервере (.env), не в этой форме.
                  </p>

                  <div className="border-t border-slate-200 pt-4 space-y-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Контакт преподавателя
                    </p>
                    <div>
                      <label
                        htmlFor="teacher-contact-url"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Ссылка «Связаться с преподавателем»
                      </label>
                      <input
                        id="teacher-contact-url"
                        type="url"
                        value={teacherContactUrl}
                        onChange={(e) => setTeacherContactUrl(e.target.value)}
                        placeholder="https://t.me/username"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                      <p className="mt-1.5 text-xs text-slate-400">
                        Кнопка в боте, когда ответ не найден. Обычно ссылка на Telegram.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-slate-200 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={resetToDefaults}
                disabled={(!defaults && !contactDefaultFromEnv) || saving || loadingSettings}
                className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-60"
              >
                Сбросить к умолчанию
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  disabled={saving}
                  className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-60"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={saveSettings}
                  disabled={saving || loadingSettings}
                  className="px-3.5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-60"
                >
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
