import type { Settings } from '../types';

const DEFAULT_SETTINGS: Settings = {
  enabled: false,
  apiKey: '',
  pollIntervalMinutes: 3,
  watchlist: [],
  stickerFilter: 'all',
  stickerRatioThreshold: 0.5,
  stickerRealizationRate: 0.5,
  minFloat: 0.00,
  maxFloat: 0.15,
  maxListingsPerPoll: 30,
  sensitivity: 'balanced',
};

async function readSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

// Serialize rapid edits so an older write cannot replace the latest watchlist.
let settingsWrites: Promise<unknown> = Promise.resolve();

export async function getSettings(): Promise<Settings> {
  await settingsWrites;
  return readSettings();
}

export function setSettings(partial: Partial<Settings>): Promise<Settings> {
  const write = settingsWrites.then(async () => {
    const current = await readSettings();
    const next = { ...current, ...partial };
    await chrome.storage.local.set({ settings: next });
    return next;
  });
  settingsWrites = write.catch(() => undefined);
  return write;
}

// --- Seen listing IDs (de-dupe across polls) ---
const SEEN_KEY = 'seenListingIds';
const MAX_SEEN = 2000;

export async function hasSeen(listingId: string): Promise<boolean> {
  const { [SEEN_KEY]: seen = [] } = await chrome.storage.local.get(SEEN_KEY);
  return (seen as string[]).includes(listingId);
}

export async function markSeen(listingId: string): Promise<void> {
  const { [SEEN_KEY]: seen = [] } = await chrome.storage.local.get(SEEN_KEY);
  const arr = seen as string[];
  arr.push(listingId);
  const trimmed = arr.length > MAX_SEEN ? arr.slice(arr.length - MAX_SEEN) : arr;
  await chrome.storage.local.set({ [SEEN_KEY]: trimmed });
}

// --- Deal log for the popup ---
const DEALS_KEY = 'dealLog';
const MAX_DEALS = 50;

export async function logDeal(deal: import('../types').Deal): Promise<void> {
  const { [DEALS_KEY]: deals = [] } = await chrome.storage.local.get(DEALS_KEY);
  const arr = deals as import('../types').Deal[];
  arr.unshift(deal);
  const trimmed = arr.slice(0, MAX_DEALS);
  await chrome.storage.local.set({ [DEALS_KEY]: trimmed });
}

export async function getDealLog(): Promise<import('../types').Deal[]> {
  const { [DEALS_KEY]: deals = [] } = await chrome.storage.local.get(DEALS_KEY);
  return deals as import('../types').Deal[];
}

export async function saveTestDeals(deals: import('../types').Deal[]): Promise<void> {
  const { [DEALS_KEY]: existing = [] } = await chrome.storage.local.get(DEALS_KEY);
  const arr = [...deals, ...(existing as import('../types').Deal[])];
  const trimmed = arr.slice(0, MAX_DEALS);
  await chrome.storage.local.set({ [DEALS_KEY]: trimmed });
}

export interface DismissedDeals { ids: string[] }
let dismissalWrites: Promise<unknown> = Promise.resolve();

export async function getDismissedDeals(): Promise<DismissedDeals> {
  await dismissalWrites;
  const { dismissedDeals } = await chrome.storage.session.get('dismissedDeals');
  return { ids: dismissedDeals?.ids ?? [] };
}

/** Session storage survives popup and worker restarts, but resets with the browser session. */
export function dismissDeal(target: { id?: string; reset?: boolean }) {
  const write = dismissalWrites.then(async () => {
    const { dismissedDeals } = await chrome.storage.session.get('dismissedDeals');
    const current: DismissedDeals = dismissedDeals ?? { ids: [] };
    const next = target.reset ? { ids: [] } : {
      ids: [...new Set([...current.ids, ...(target.id ? [target.id] : [])])],
    };
    await chrome.storage.session.set({ dismissedDeals: next });
  });
  dismissalWrites = write.catch(() => undefined);
  return write;
}

/** Publish one complete scan, replacing stale cards from previous scans. */
export async function replaceDealLog(deals: import('../types').Deal[]): Promise<void> {
  // Each query already has a listing limit; a global slice hides later skins.
  await chrome.storage.local.set({ [DEALS_KEY]: deals });
}

let scanStatusWrites: Promise<unknown> = Promise.resolve();
export function setScanStatus(partial: Partial<import('../types').ScanStatus>): Promise<void> {
  const write = scanStatusWrites.then(async () => {
    const { scanStatus } = await chrome.storage.local.get('scanStatus');
    await chrome.storage.local.set({ scanStatus: { running: false, ...scanStatus, ...partial } });
  });
  scanStatusWrites = write.catch(() => undefined);
  return write;
}

export async function clearDealLog(): Promise<void> {
  await chrome.storage.local.set({ [DEALS_KEY]: [] });
}

export async function updateBadge(count: number): Promise<void> {
  const text = count > 0 ? String(count) : '';
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: '#FF5722' });
}
