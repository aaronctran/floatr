import type { Settings } from '../types';

const DEFAULT_SETTINGS: Settings = {
  enabled: false,
  apiKey: '',
  pollIntervalMinutes: 3,
  watchlist: [],
  stickerRatioThreshold: 0.5,
  stickerRealizationRate: 0.5,
  minFloat: 0.00,
  maxFloat: 0.15,
  maxListingsPerPoll: 30,
  sensitivity: 'balanced',
};

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export async function setSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ settings: next });
  return next;
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

export async function clearDealLog(): Promise<void> {
  await chrome.storage.local.set({ [DEALS_KEY]: [] });
}

export async function updateBadge(count: number): Promise<void> {
  const text = count > 0 ? String(count) : '';
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: '#FF5722' });
}
