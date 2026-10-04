// Shared by all CSFloat requests in the background worker, including previews.
export const REQUEST_SPACING_MS = 2000;
export const REQUEST_STATE_KEY = 'csfloatRequestState';
interface RequestState {
  nextRequestAt: number;
  cooldownUntil: number;
  rateLimitCount: number;
}

export class CSFloatRateLimitError extends Error {
  constructor(public readonly retryAt: number) {
    super(`CSFloat rate limit (429). Requests paused until ${new Date(retryAt).toLocaleTimeString()}.`);
    this.name = 'CSFloatRateLimitError';
  }
}

async function readState(): Promise<RequestState> {
  const stored = (await chrome.storage.local.get(REQUEST_STATE_KEY))[REQUEST_STATE_KEY];
  const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
  return {
    nextRequestAt: number(stored?.nextRequestAt),
    cooldownUntil: number(stored?.cooldownUntil),
    rateLimitCount: number(stored?.rateLimitCount),
  };
}

export async function getRequestCooldown(): Promise<number> {
  return (await readState()).cooldownUntil;
}

/** Retry-After can be a number of seconds or an HTTP date. */
export function retryAfterTime(value: string | null | undefined, now: number): number {
  if (!value?.trim()) return 0;
  if (/^\d+(\.\d+)?$/.test(value.trim())) {
    const date = now + Number(value) * 1000;
    return Number.isFinite(date) ? date : 0;
  }
  const date = Date.parse(value);
  return Number.isFinite(date) && date > now ? date : 0;
}

export async function recordRateLimit(retryAfter: string | null | undefined): Promise<CSFloatRateLimitError> {
  const state = await readState();
  const rateLimitCount = Math.min(state.rateLimitCount + 1, 5);
  const fallback = Math.min(60_000 * 2 ** (rateLimitCount - 1), 15 * 60_000);
  const cooldownUntil = Math.max(state.cooldownUntil, Date.now() + fallback, retryAfterTime(retryAfter, Date.now()));
  await chrome.storage.local.set({ [REQUEST_STATE_KEY]: { ...state, rateLimitCount, cooldownUntil } });
  return new CSFloatRateLimitError(cooldownUntil);
}

let queue: Promise<unknown> = Promise.resolve();

export function withRequestPacing<T>(request: () => Promise<T>): Promise<T> {
  const result = queue.then(async () => {
    const state = await readState();
    // Do not keep a sleeping worker or pending network queue alive for a cooldown.
    if (state.cooldownUntil > Date.now()) throw new CSFloatRateLimitError(state.cooldownUntil);
    const wait = state.nextRequestAt - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(wait, REQUEST_SPACING_MS)));
    await chrome.storage.local.set({ [REQUEST_STATE_KEY]: { ...state, nextRequestAt: Date.now() + REQUEST_SPACING_MS } });
    const value = await request();
    if (state.rateLimitCount || state.cooldownUntil) {
      const latest = await readState();
      await chrome.storage.local.set({ [REQUEST_STATE_KEY]: { ...latest, cooldownUntil: 0, rateLimitCount: 0 } });
    }
    return value;
  });
  queue = result.catch(() => undefined);
  return result;
}
