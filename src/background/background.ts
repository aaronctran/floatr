// background.ts — Floatr polling engine (Manifest V3 service worker)

import type { Deal } from '../types';
import { fetchRecentListings, fetchWatchedItemListings } from '../services/csfloatApi';
import { evaluateListing } from '../services/scoring';
import {
  getSettings,
  hasSeen,
  markSeen,
  logDeal,
  getDealLog,
  clearDealLog,
  updateBadge,
} from '../services/storage';

const ALARM_NAME = 'floatr-poll';
const MIN_POLL_INTERVAL_MINUTES = 1;
const MAX_POLL_INTERVAL_MINUTES = 15;
const MAX_CONSECUTIVE_ERRORS = 3;
const ERROR_BACKOFF_INCREMENT_MINUTES = 1;

let consecutiveErrors = 0;
let currentIntervalMinutes: number | null = null;

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    const settings = await getSettings();
    await resetAlarm(settings);
    console.log('[Floatr] Installed. Alarm set.', settings);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await runPollCycle();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'poll-now') {
    runPollCycle()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (message.action === 'get-deals') {
    getDealLog().then((deals) => sendResponse({ deals }));
    return true;
  }
  if (message.action === 'clear-deals') {
    clearDealLog().then(() => {
      updateBadge(0);
      sendResponse({ ok: true });
    });
    return true;
  }
  if (message.action === 'preview-listings') {
    (async () => {
      try {
        const settings = await getSettings();
        const apiKey = settings.apiKey || undefined;
        const data = await fetchRecentListings({ limit: message.limit || 5 }, apiKey);
        sendResponse({ ok: true, listings: data?.data || [] });
      } catch (err: any) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
});

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId) {
    const url = `https://csfloat.com/item/${notificationId}`;
    chrome.tabs.create({ url });
    chrome.notifications.clear(notificationId);
  }
});

async function runPollCycle() {
  const settings = await getSettings();

  if (!settings.enabled) {
    console.log('[Floatr] Polling disabled. Skipping.');
    return { skipped: true, reason: 'disabled' };
  }

  console.log(
    `[Floatr] ▶ Poll starting — mode: ${settings.watchlist?.length > 0 ? 'watchlist' : 'firehose'}, interval: ${settings.pollIntervalMinutes}min, limit: ${settings.maxListingsPerPoll}`
  );

  try {
    const listings = await fetchListingsForMode(settings);
    const dealsFound = await processListings(listings, settings);

    if (consecutiveErrors > 0) {
      consecutiveErrors = 0;
      await resetAlarm(settings);
      console.log('[Floatr] Error state cleared — restored normal polling interval.');
    }

    await updateBadgeFromStorage();
    console.log(`[Floatr] ✓ Poll complete. ${listings.length} listings checked, ${dealsFound} deals found.`);
    return { listingsChecked: listings.length, dealsFound };
  } catch (err: any) {
    console.error('[Floatr] ✗ Poll failed:', err.message);
    consecutiveErrors += 1;
    console.warn(`[Floatr] Consecutive errors: ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}`);

    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      const newInterval = Math.min(
        (currentIntervalMinutes || settings.pollIntervalMinutes) + ERROR_BACKOFF_INCREMENT_MINUTES,
        MAX_POLL_INTERVAL_MINUTES
      );
      console.warn(`[Floatr] Backing off to ${newInterval}min after ${consecutiveErrors} errors.`);
      await chrome.alarms.create(ALARM_NAME, { periodInMinutes: newInterval });
      currentIntervalMinutes = newInterval;
    }

    return { error: err.message };
  }
}

async function fetchListingsForMode(settings: Awaited<ReturnType<typeof getSettings>>) {
  const watchlist = Array.isArray(settings.watchlist) ? settings.watchlist : [];
  const limit = settings.maxListingsPerPoll ?? 30;
  const apiKey = settings.apiKey || undefined;

  if (watchlist.length > 0) {
    console.log(
      `[Floatr] API Call — watchlist mode, items: [${watchlist.slice(0, 5).join(', ')}], limit per item: ${Math.min(limit, 20)}`
    );
    const all: any[] = [];
    for (const name of watchlist.slice(0, 5)) {
      try {
        const data = await fetchWatchedItemListings(name, { limit: Math.min(limit, 20) }, apiKey);
        console.log(`[Floatr] API Response — "${name}": ${data?.data?.length ?? 0} listings`);
        if (data?.data) all.push(...data.data);
      } catch (e: any) {
        console.warn(`[Floatr] API Error — watchlist item "${name}":`, e.message);
      }
    }
    return all;
  }

  console.log(`[Floatr] API Call — firehose mode, limit: ${limit}`);
  const data = await fetchRecentListings({ limit }, apiKey);
  console.log(`[Floatr] API Response — firehose: ${data?.data?.length ?? 0} listings`);
  return data?.data || [];
}

async function processListings(listings: any[], settings: Awaited<ReturnType<typeof getSettings>>) {
  let dealsFound = 0;
  const DEBUG = true;

  for (const listing of listings) {
    const id = listing.id;

    if (await hasSeen(id)) {
      if (DEBUG) console.log(`[Floatr] [SKIP] Listing ${id.slice(0, 8)}... already seen.`);
      continue;
    }
    await markSeen(id);

    const item = listing.item;
    const mhn = item?.market_hash_name;

    const result = evaluateListing(listing, { settings });

    if (DEBUG && !result.isDeal) {
      console.log(
        `[Floatr] [NO DEAL] ${mhn || '?'} | price=$${(result.priceCents / 100).toFixed(2)} | ` +
          `stickerRatio=${result.stickerRatio?.toFixed(2) || 0} | float=${item?.float_value ?? 'n/a'}`
      );
    }

    if (result.isDeal) {
      dealsFound += 1;
      console.log(
        `[Floatr] [DEAL FOUND] ${mhn} — ${result.reasons.map((r) => r.type).join(', ')}`
      );

      const deal: Deal = {
        id,
        timestamp: Date.now(),
        marketHashName: result.marketHashName,
        priceCents: result.priceCents,
        priceDisplay: `$${(result.priceCents / 100).toFixed(2)}`,
        floatValue: item?.float_value ?? null,
        stickers:
          item?.stickers?.map((s: any) => ({
            name: s?.name,
            price: s?.reference?.price ?? null,
          })) || [],
        stickerValueCents: result.stickerValueCents,
        reasons: result.reasons as Deal['reasons'],
        item,
      };

      await logDeal(deal);
      await fireNotification(deal);
    }
  }

  return dealsFound;
}

async function fireNotification(deal: any) {
  const primaryReason = deal.reasons[0];
  const title = primaryReason
    ? `Floatr Deal: ${primaryReason.type === 'sticker_arbitrage' ? 'Sticker Arb' : 'Rare Float'}`
    : 'Floatr Deal Found';

  const message = `${deal.marketHashName} — ${deal.priceDisplay}`;

  try {
    await chrome.notifications.create(String(deal.id), {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title,
      message,
      priority: 1,
    });
  } catch (e) {
    console.warn('[Floatr] Notification failed:', e);
  }
}

async function updateBadgeFromStorage() {
  const deals = await getDealLog();
  updateBadge(deals.length);
}

async function resetAlarm(settings: Awaited<ReturnType<typeof getSettings>>) {
  const interval = settings.pollIntervalMinutes ?? 3;
  const safeInterval = Math.max(MIN_POLL_INTERVAL_MINUTES, Math.min(interval, MAX_POLL_INTERVAL_MINUTES));

  await chrome.alarms.clear(ALARM_NAME);
  if (settings.enabled) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: safeInterval });
    currentIntervalMinutes = safeInterval;
    console.log(`[Floatr] Alarm set: every ${safeInterval} minutes`);
  } else {
    console.log('[Floatr] Alarm cleared — polling stopped.');
  }
}
