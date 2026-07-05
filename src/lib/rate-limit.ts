/**
 * In-memory rate limiter (sliding window).
 *
 * Держит счётчики только в памяти процесса — ничего не пишется в БД,
 * поэтому инвариант анонимности (нет userId в хранилище) не нарушается.
 * Для пилота на одном сервере этого достаточно; при рестарте счётчики
 * сбрасываются, что приемлемо.
 */

interface WindowState {
  /** Timestamps (ms) успешно пропущенных запросов внутри окна */
  hits: number[];
  /** Было ли уже отправлено уведомление о блокировке в текущем окне */
  notified: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  /**
   * true ровно один раз за «эпизод» блокировки — чтобы уведомить
   * пользователя однажды, а не отвечать на каждый заблокированный запрос.
   */
  shouldNotify: boolean;
}

export function createRateLimiter(options: {
  /** Максимум запросов в окне */
  limit: number;
  /** Длина окна в миллисекундах */
  windowMs: number;
}) {
  const { limit, windowMs } = options;
  const states = new Map<string, WindowState>();

  // Периодическая уборка устаревших ключей, чтобы Map не рос бесконечно
  const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
  let lastCleanup = Date.now();

  function cleanup(now: number) {
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;

    for (const [key, state] of states) {
      if (state.hits.every((t) => now - t >= windowMs)) {
        states.delete(key);
      }
    }
  }

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      cleanup(now);

      let state = states.get(key);
      if (!state) {
        state = { hits: [], notified: false };
        states.set(key, state);
      }

      state.hits = state.hits.filter((t) => now - t < windowMs);

      if (state.hits.length >= limit) {
        const shouldNotify = !state.notified;
        state.notified = true;
        return { allowed: false, shouldNotify };
      }

      state.hits.push(now);
      state.notified = false;
      return { allowed: true, shouldNotify: false };
    },
  };
}

/**
 * Защита от перебора пароля: считаются только НЕУДАЧНЫЕ попытки.
 * После `maxFailures` неудач ключ блокируется, пока с момента последней
 * неудачи не пройдёт `lockoutMs`. Успешный вход сбрасывает счётчик.
 */
export function createFailedAttemptGuard(options: {
  maxFailures: number;
  lockoutMs: number;
}) {
  const { maxFailures, lockoutMs } = options;
  const failures = new Map<string, number[]>();

  function recentFailures(key: string, now: number): number[] {
    const recent = (failures.get(key) ?? []).filter(
      (t) => now - t < lockoutMs
    );

    if (recent.length === 0) {
      failures.delete(key);
    } else {
      failures.set(key, recent);
    }

    return recent;
  }

  return {
    isBlocked(key: string): boolean {
      return recentFailures(key, Date.now()).length >= maxFailures;
    },

    recordFailure(key: string) {
      const now = Date.now();
      const recent = recentFailures(key, now);
      recent.push(now);
      failures.set(key, recent);
    },

    reset(key: string) {
      failures.delete(key);
    },
  };
}
