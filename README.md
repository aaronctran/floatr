# Floatr — MVP

A Chrome extension (Manifest V3) that polls the [CSFloat](https://csfloat.com) public
listings API and notifies you when a listing looks mispriced — because of undervalued
stickers, a rare/low float, or a price well below what similar listings have sold for.

This is **not** an auto-buy sniper bot. It's a passive scanner + notifier: it never touches
your CSFloat account, balance, or does any purchasing. You still buy manually.

## Status

Core data-layer modules are built. Still to finish: `background.js` (the polling loop that
wires these modules together) and the `popup.html`/`popup.js` settings UI. This doc
describes the design so far and what's left.

## Why this instead of the existing "sniper bot"

The paid ~$25 Discord bot that inspired this only filters on float/pattern/price and
auto-buys as fast as possible — it's a speed tool, not a valuation tool. Floatr does
the opposite: it prices out *why* a listing might be a deal (stickers, float rarity,
below-average price) and just tells you, so you can decide.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension config (MV3, permissions: `storage`, `notifications`, `alarms`, host access to `csfloat.com`) |
| `csfloatApi.js` | Thin client for `GET /api/v1/listings` — fetches recent listings or listings for a specific watched skin |
| `steamanalyst.js` | Optional alternate pricing source — SteamAnalyst's per-item average price API |
| `scoring.js` | Pure scoring functions: sticker arbitrage, discount-vs-reference-price, float rarity |
| `storage.js` | Persists settings, a rolling per-item price average (fallback only), a de-dupe set of seen listing IDs, and a capped log of found deals |
| `background.js` | *(pending)* Service worker: alarm-driven poll loop, scoring, triggers `chrome.notifications` |
| `popup.html` / `popup.js` | *(pending)* Settings UI — API key, thresholds, watchlist, recent deals list |
| `icons/` | Placeholder icons |

## How pricing/scoring works

Every listing is checked against three independent signals. A deal can trip **any one** of
these — they represent different reasons a listing might be worth buying, so they aren't
averaged together:

### 1. Sticker arbitrage
CSFloat's listing payload includes each sticker's Steam Community Market price
(`item.stickers[].scm.price`). We sum those and compare to the total listing price:

```
stickerRatio = (sum of sticker SCM prices × stickerRealizationRate) / listing price
```

`stickerRealizationRate` (default 0.5) is a deliberate haircut — peeling and reselling
stickers rarely recovers their full SCM price, so this avoids flagging deals that look great
on paper but aren't realistic. Flags when `stickerRatio >= stickerRatioThreshold` (default 0.5,
i.e. stickers alone are conservatively worth ≥50% of the asking price).

### 2. Below-average price
Rather than Steam Community Market (which CSFloat's own team has noted runs ~25%+ above
real trading prices — a "fake discount" if you benchmark against it), pricing now comes from
sources that reflect what things actually trade for on CSFloat itself:

1. **CSFloat's own Float Appraiser (`pricingSource: "csfloat"`, default).** Every listing
   already includes `item.reference.predicted_price` — an ML model CSFloat trained on
   hundreds of thousands of real CSFloat sales, factoring in the base cross-market price,
   float/wear impact, and item popularity. It's free, bundled in every listing response
   (zero extra API calls), and scales fine to firehose-mode scanning. This is the default
   and the one to use unless you have a specific reason not to.
2. **SteamAnalyst (`pricingSource: "steamanalyst"`).** Calls SteamAnalyst's pricing API per
   item for `avg_price_7_days` / `avg_price_30_days` — a literal trailing average across
   marketplaces. More transparent about what "average" means, but the free tier is
   **100 requests/day, single-item lookup only** — so this only works in watchlist mode with
   a handful of skins, not the general firehose. Requires your own free SteamAnalyst API key.
3. **Our own rolling average (fallback).** If neither of the above has data for an item, we
   fall back to an average built from listings we've personally observed while polling, once
   we have `minSamplesForAverage` (default 5) samples.
4. **Steam Community Market `item.scm.price` (last resort).** Only used if nothing else is
   available — flagged as `low` confidence given the ~25%+ markup noted above.

Whichever source wins, the math is:

```
discount = (referencePrice - listingPrice) / referencePrice
```

Flags when `discount >= discountThreshold` (default 0.2, i.e. ≥20% below reference).

### 3. Float rarity
Approximate, wear-tier-based rarity: we check where the listing's float sits inside the
standard range for its wear tier (e.g. Factory New = 0–0.07) and score how close it is to the
rare (low) extreme of that range. Flags when the rarity score `>= floatRarityThreshold`
(default 0.9).

**Known limitation:** this does *not* account for pattern-index rarity (blue gems, fire/ice
marbles, low-float "the AWP" style pattern hunting). That needs a per-skin pattern database
this MVP doesn't have — noted as a v2 improvement below.

## Settings (stored via `chrome.storage.local`)

- `apiKey` — optional CSFloat API key (unauthenticated requests work but are more rate-limited)
- `pollIntervalMinutes` — default 2
- `watchlist` — comma-separated `market_hash_name`s. If set, polls just those skins
  (cheapest-first) instead of the general firehose — lower API load, more targeted
- `pricingSource` — `"csfloat"` (default, Float Appraiser) or `"steamanalyst"`
- `steamAnalystApiKey`, `steamAnalystWindow` (`"avg_price_7_days"` or `"avg_price_30_days"`) — only used when `pricingSource` is `"steamanalyst"`
- `stickerRatioThreshold`, `stickerRealizationRate`
- `discountThreshold`, `minSamplesForAverage`
- `floatRarityThreshold`
- `maxListingsPerPoll` — capped at CSFloat's documented max of 50

## Install (once background.js/popup are finished)

1. `chrome://extensions` → enable Developer Mode
2. "Load unpacked" → select this folder
3. Click the extension icon → enter your CSFloat API key (optional) and adjust thresholds
4. Leave it running — notifications fire as deals are found

## v2 ideas (not in this MVP)

- Pattern-index / paint-seed rarity database (blue gems, marble fades, etc.)
- Cross-market comparison once Skinport/DMarket are added (per earlier discussion)
- Webhook/Discord notification option instead of just `chrome.notifications`
- Persisting rolling averages to something more durable than local extension storage, so
  history survives a reinstall
