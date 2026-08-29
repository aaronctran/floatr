# Floatr — MVP

A Chrome extension (Manifest V3) that polls the [CSFloat](https://csfloat.com) public
listings API and surfaces deals in your extension popup — because of undervalued
stickers or a float that lands in your target range.

This is **not** an auto-buy sniper bot. It's a passive scanner + notifier: it never touches
your CSFloat account, balance, or does any purchasing. You still buy manually.

## Status

Core architecture is built. The extension includes the full popup UI (React + TypeScript + Tailwind),
background service worker, storage layer, scoring engine, and CSFloat API client.

## Why this instead of the existing "sniper bot"

The paid ~$25 Discord bot that inspired this only filters on float/pattern/price and
auto-buys as fast as possible — it's a speed tool, not a valuation tool. Floatr does
the opposite: it flags *why* a listing might be a deal (stickers, float range) and just
tells you, so you can decide.

## Tech Stack

- **React 18** + **TypeScript** — popup UI and options page
- **Vite** — build tooling with `@crxjs/vite-plugin` for Chrome extension bundling
- **Tailwind CSS** — styling
- **Manifest V3** — modern Chrome extension format

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension config (MV3, permissions: `storage`, `notifications`, `alarms`, host access to `csfloat.com`) |
| `src/background/background.ts` | Service worker: alarm-driven poll loop, scoring, triggers `chrome.notifications` |
| `src/popup/` | React app for the popup — login, onboarding, main app (deals + settings tabs) |
| `src/options/` | React app for the options page |
| `src/services/csfloatApi.ts` | Thin client for `GET /api/v1/listings` — fetches recent listings or watchlist items |
| `src/services/scoring.ts` | Pure scoring functions: sticker arbitrage, float range matching |
| `src/services/storage.ts` | Persists settings, deal log, seen listing IDs |
| `src/services/steamanalyst.ts` | SteamAnalyst pricing API client (optional alternate source) |
| `src/hooks/useChromeStorage.ts` | React hook for reading/writing `chrome.storage.local` |
| `src/types/index.ts` | TypeScript interfaces for settings, deals, and API responses |
| `public/icons/` | Extension icons (16, 48, 128px) |

## How scoring works

Every listing is checked against **two independent signals**. A deal can trip **either one** —
they represent different reasons a listing might be worth buying:

### 1. Sticker arbitrage

CSFloat's listing payload includes each sticker's Steam Community Market price
(`item.stickers[].scm.price`). We sum those and compare to the total listing price:

```
stickerRatio = (sum of sticker SCM prices × stickerRealizationRate) / listing price
```

`stickerRealizationRate` (default 0.5) is a deliberate haircut — peeling and reselling
stickers rarely recovers their full SCM price, so this avoids flagging deals that look great
on paper but aren't realistic.

**Flags when:** `stickerRatio >= stickerRatioThreshold` (default 0.5, i.e. stickers alone
are conservatively worth ≥50% of the asking price).

### 2. Float range match

Instead of an automatic "float rarity" score, **you define the range** you're interested in:

```
IF item.float_value >= minFloat AND item.float_value <= maxFloat:
  → DEAL (type: "rare_float")
```

**Defaults:** `minFloat = 0.00`, `maxFloat = 0.15` — catches Factory New, Minimal Wear,
and good Field-Tested floats.

This puts you in control. Want only super-low floats? Set `maxFloat = 0.01`. Want a broader
net? Widen the range.

## Settings (stored via `chrome.storage.local`)

| Setting | Default | Description |
|---|---|---|
| `enabled` | `false` | User must explicitly start scanning |
| `apiKey` | `""` | Optional CSFloat API key (unauthenticated requests work but are more rate-limited) |
| `pollIntervalMinutes` | `3` | How often to poll (1–60 min) |
| `maxListingsPerPoll` | `30` | Listings fetched per poll (1–50; 50 with API key) |
| `watchlist` | `[]` | Comma-separated item names. Empty = firehose mode (all recent listings) |
| `minFloat` | `0.00` | Minimum float to flag |
| `maxFloat` | `0.15` | Maximum float to flag |
| `stickerRatioThreshold` | `0.50` | Flag when sticker value ≥ this ratio of price |
| `stickerRealizationRate` | `0.50` | Haircut applied to sticker SCM prices |

## Install

1. `npm install`
2. `npm run build`
3. `chrome://extensions` → enable **Developer Mode**
4. **Load unpacked** → select the `dist/` folder
5. Click the extension icon → configure settings and start scanning

## Development

```bash
# Start Vite dev server (popup UI only — extension APIs won't work in browser)
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview
```

## v2 ideas (not in this MVP)

- Pattern-index / paint-seed rarity database (blue gems, marble fades, etc.)
- Cross-market comparison once Skinport/DMarket are added
- Webhook/Discord notification option instead of just `chrome.notifications`
- Real user auth + tiered plans (Free vs Premium)
- CS2 inventory integration via content script
