// background.ts — Floatr polling engine (Manifest V3 service worker)

import type { Deal } from '../types';
import { getVisibleDeals, isDealVisible } from '../services/dealVisibility';
import { fetchRecentListings, fetchWatchedItemListings } from '../services/csfloatApi';
import { expandWatchQueries, activeWatchlist, matchesWatchlist } from '../services/watchlist';
import { evaluateListing } from '../services/scoring';
import { CSFloatRateLimitError } from '../services/requestPacing';
import {
  getSettings,
  getDismissedDeals,
  dismissDeal,
  setSettings,
  hasSeen,
  markSeen,
  replaceDealLog,
  setScanStatus,
  clearDealLog,
  updateBadge,
} from '../services/storage';

import { POLL_ALARM, syncPollingAlarm } from '../services/pollingSchedule';

const startupReady = setScanStatus({ running: false }).then(syncPollingAlarm);
void startupReady.catch((err) => console.error('[Floatr] Alarm setup failed:', err));
let activePoll: Promise<Awaited<ReturnType<typeof executePollCycle>>> | null = null;
let watchlistRefreshTimer: ReturnType<typeof setTimeout> | undefined;
let rescanRequested = false;

async function stopForRateLimit(error: CSFloatRateLimitError) {
  clearTimeout(watchlistRefreshTimer);
  rescanRequested = false;
  await setSettings({ enabled: false });
  await syncPollingAlarm();
  await setScanStatus({ running: false, nextScanAt: null, error: error.message });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    await syncPollingAlarm();
  }
});

chrome.runtime.onStartup.addListener(() => { void syncPollingAlarm(); });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === POLL_ALARM) {
    await runPollCycle();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    const before = changes.settings.oldValue;
    const after = changes.settings.newValue;
    if (JSON.stringify(before?.watchlist) !== JSON.stringify(after?.watchlist) || before?.stickerFilter !== after?.stickerFilter || JSON.stringify(before?.selectedWears) !== JSON.stringify(after?.selectedWears)) {
      void updateBadgeFromStorage().catch((err) => console.error('[Floatr] Badge update failed:', err));
    }
    if (!after?.enabled) {
      clearTimeout(watchlistRefreshTimer);
      rescanRequested = false;
    } else if (before?.enabled && JSON.stringify(before.watchlist) !== JSON.stringify(after.watchlist)) {
      // Let the user finish typing; preserve a follow-up if a scan is in flight.
      clearTimeout(watchlistRefreshTimer);
      watchlistRefreshTimer = setTimeout(() => {
        if (activePoll) rescanRequested = true;
        else void runPollCycle().catch((err) => console.error('[Floatr] Watchlist refresh failed:', err));
      }, 1000);
    }
    if (before?.enabled !== after?.enabled || before?.pollIntervalMinutes !== after?.pollIntervalMinutes) {
      void syncPollingAlarm();
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'poll-now') {
    runPollCycle()
      .then((result) => sendResponse('error' in result ? { ok: false, error: result.error } : { ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (message.action === 'get-deals') {
    Promise.all([getVisibleDeals(), getSettings(), getDismissedDeals()]).then(([deals, settings, dismissed]) =>
      sendResponse({ deals, stickerFilter: settings.stickerFilter ?? 'all', dismissedCount: dismissed.ids.length })
    ).catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.action === 'dismiss-deal' || message.action === 'restore-dismissed-deals') {
    const target = message.action === 'restore-dismissed-deals' ? { reset: true } : {
      id: typeof message.id === 'string' ? message.id : undefined,
    };
    dismissDeal(target).then(updateBadgeFromStorage).then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
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
        const limit = Math.max(1, Math.min(50, Number(message.limit) || 5));
        const listings = await fetchListingsForMode({ ...settings, maxListingsPerPoll: limit });
        sendResponse({ ok: true, listings: listings.slice(0, limit) });
      } catch (err: any) {
        if (err instanceof CSFloatRateLimitError) await stopForRateLimit(err);
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

function runPollCycle() {
  // Manual and scheduled scans share one in-flight request cycle.
  if (!activePoll) {
    clearTimeout(watchlistRefreshTimer);
    activePoll = startupReady.then(executePollCycle).finally(() => {
      activePoll = null;
      if (rescanRequested) {
        rescanRequested = false;
        void runPollCycle().catch((err) => console.error('[Floatr] Follow-up scan failed:', err));
      }
    });
  }
  return activePoll;
}

async function executePollCycle() {
  const settings = await getSettings();

  if (!settings.enabled) {
    console.log('[Floatr] Polling disabled. Skipping.');
    return { skipped: true, reason: 'disabled' };
  }

  console.log(
    `[Floatr] ▶ Poll starting — mode: ${settings.watchlist?.length > 0 ? 'watchlist' : 'firehose'}, interval: ${settings.pollIntervalMinutes}min, limit: ${settings.maxListingsPerPoll}`
  );

  try {
    await syncPollingAlarm();
    await setScanStatus({ running: true, error: null });
    const listings = await fetchListingsForMode(settings);
    if (JSON.stringify(await getSettings()) !== JSON.stringify(settings)) {
      await setScanStatus({ running: false });
      return { skipped: true, reason: 'settings-changed' };
    }
    const dealsFound = await processListings(listings, settings);
    await updateBadgeFromStorage();
    await syncPollingAlarm();
    await setScanStatus({ running: false, lastCompletedAt: Date.now(), listingsChecked: listings.length, dealsFound, error: null });
    console.log(`[Floatr] ✓ Poll complete. ${listings.length} listings checked, ${dealsFound} deals found.`);
    return { listingsChecked: listings.length, dealsFound };
  } catch (err: any) {
    console.error('[Floatr] ✗ Poll failed:', err.message);
    if (err instanceof CSFloatRateLimitError) await stopForRateLimit(err);
    await setScanStatus({ running: false, error: err.message });
    return { error: err.message };
  }
}

async function fetchListingsForMode(settings: Awaited<ReturnType<typeof getSettings>>) {
  const watchlist = activeWatchlist(Array.isArray(settings.watchlist) ? settings.watchlist : []);
  const limit = settings.maxListingsPerPoll ?? 30;
  const apiKey = settings.apiKey || undefined;

  // An entirely ignored watchlist must not fall back to scanning the marketplace.
  if (settings.watchlist.some((name) => name.trim())) {
    const queries: Array<{ item: string; query: string }> = [];
    const queryNames = new Set<string>();
    for (const name of watchlist) {
      for (const query of expandWatchQueries(name)) {
        if (!matchesWatchlist(query, settings.watchlist)) continue;
        const key = query.toLowerCase();
        if (queryNames.has(key)) continue;
        queryNames.add(key);
        queries.push({ item: name, query });
      }
    }
    console.log(
      `[Floatr] API Call — watchlist mode, ${watchlist.length} item(s) → ${queries.length} quer(ies), per-query limit: ${Math.min(limit, 20)}`
    );

    const all: any[] = [];
    const seenIds = new Set<string>();
    let lastError: unknown;
    for (const { item, query } of queries) {
      // Do not finish a long obsolete queue after the user edits or stops scanning.
      const current = await getSettings();
      if (JSON.stringify(current.watchlist) !== JSON.stringify(settings.watchlist) || current.enabled !== settings.enabled) break;
      try {
        const data = await fetchWatchedItemListings(query, { limit: Math.min(limit, 20) }, apiKey);
        console.log(`[Floatr] API Response — "${item}" → "${query}": ${data?.data?.length ?? 0} listings`);
        if (data?.data) {
          for (const listing of data.data) {
            if (!seenIds.has(listing.id) && matchesWatchlist(listing.item?.market_hash_name, [query])) {
              seenIds.add(listing.id);
              all.push(listing);
            }
          }
        }
      } catch (e: any) {
        if (e instanceof CSFloatRateLimitError) throw e;
        lastError = e;
        console.warn(`[Floatr] API Error — watchlist item "${item}" (${query}):`, e.message);
      }
    }
    if (lastError) throw lastError; // Keep the previous list if any query failed.
    return all;
  }

  console.log(`[Floatr] API Call — firehose mode, limit: ${limit}`);
  const data = await fetchRecentListings({ limit }, apiKey);
  console.log(`[Floatr] API Response — firehose: ${data?.data?.length ?? 0} listings`);
  return data?.data || [];
}

async function processListings(listings: any[], settings: Awaited<ReturnType<typeof getSettings>>) {
  const deals: Deal[] = [];
  const DEBUG = true;

  for (const listing of listings) {
    const id = listing.id;

    const item = listing.item;
    const mhn = item?.market_hash_name;

    const result = evaluateListing(listing, { settings });

    if (DEBUG && !result.isDeal) {
      console.log(
        `[Floatr] [NO DEAL] ${mhn || '?'} | price=$${(result.priceCents / 100).toFixed(2)} | ` +
          `stickerRatio=${result.stickerRatio?.toFixed(2) || 0} | float=${item?.float_value ?? 'n/a'}`
      );
    }

    if (result.isDeal && (!listing.state || listing.state === 'listed')) {
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

      deals.push(deal);
    }
  }

  await replaceDealLog(deals);
  // Seen IDs suppress repeat notifications, never price/scoring refreshes.
  for (const deal of deals) {
    if (!isDealVisible(deal, await getSettings(), await getDismissedDeals())) continue;
    if (!(await hasSeen(deal.id))) {
      await fireNotification(deal);
      await markSeen(deal.id);
    }
  }
  return (await getVisibleDeals()).length;
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
  await updateBadge((await getVisibleDeals()).length);
}
