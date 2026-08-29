# Floatr — MVP Build Tasks

> **Current status:** Data layer is complete (`csfloatApi.js`, `steamanalyst.js`, `scoring.js`, `storage.js`, `manifest.json`, icons).  
> **Wireframe approved:** Dark mode, CSFloat color scheme, simplified settings, onboarding flow.
> **What's missing:** `background.js` (service worker), `popup.html`/`popup.js` (UI), onboarding flow.

---

## MVP User Flow

```
[Install Extension]
        ↓
[Welcome Screen] ←── explains extension, asks for optional CSFloat API key
        ↓
[Settings Tab] ←── user configures polling, watchlist, sensitivity
        ↓
[Deals Tab] ←── main view, shows scored deals with expandable detail cards
        ↓
[Click Deal] ←── expanded view: screenshot, stickers, float, price comparison
        ↓
[Open on CSFloat] ←── opens listing in new tab
```

---

## MVP Scope (What We're Building Now)

| Feature | Status |
|---|---|
| Polling engine (`background.js`) | ☐ Pending |
| Deals list + expandable detail cards | ☐ Pending |
| Skin rarity colors (Consumer → Contraband) | ☐ Pending |
| StatTrak / Souvenir indicators | ☐ Pending |
| Welcome / onboarding screen | ☐ Pending |
| Settings: polling interval, watchlist, API key | ☐ Pending |
| Settings: Deal Sensitivity slider (Strict / Balanced / Loose) | ☐ Pending |
| Chrome notifications on deal found | ☐ Pending |
| Badge counter on extension icon | ☐ Pending |

## Post-MVP (Not in this build)

| Feature | Why deferred |
|---|---|
| User login / tier system | Requires backend server + database |
| SteamAnalyst pricing source | Simplifying to CSFloat-only for MVP |
| Individual threshold inputs | Replaced by sensitivity slider |
| Pattern-index rarity (blue gems) | Needs per-skin pattern database |
| Discord/webhook notifications | Post-MVP delivery option |

---

## Task 1: Build `background.js` — Polling Engine (P0)

**Goal:** Service worker that wakes up on schedule, fetches listings, scores them, and fires notifications.

**Time:** 45–60 min

### Key Requirements
- [ ] Alarm-driven polling via `chrome.alarms` (not `setInterval`)
- [ ] Default: 3-min interval, 30 listings per poll (without API key)
- [ ] With API key: 2-min interval, 50 listings per poll
- [ ] Watchlist mode (cheapest-first per item) or firehose mode (most recent)
- [ ] De-dupe listings by ID across polls
- [ ] Score each listing against 3 signals (sticker, discount, float)
- [ ] Fire `chrome.notifications` for deals; clicking opens CSFloat listing
- [ ] Log deals to `chrome.storage.local` for popup display
- [ ] Update rolling price averages as fallback reference
- [ ] Error backoff: if polls fail repeatedly, slow down automatically
- [ ] Badge counter: show deal count on extension icon

### Files to modify
- `background.js` (new)

---

## Task 2: Build `popup.html` + `popup.js` — UI (P0)

**Goal:** Chrome extension popup with Deals tab, Settings tab, and onboarding.

**Time:** 60–90 min

### Key Requirements

#### Onboarding Screen (shown on first open)
- [ ] Welcome message explaining the extension
- [ ] CSFloat API key input (optional)
- [ ] "Get API Key" link opens CSFloat profile in new tab
- [ ] "Skip for now" — works without key, just slower polling
- [ ] Save key to `chrome.storage.local`

#### Deals Tab (default view)
- [ ] List of recent deals (last 50), newest first
- [ ] Each card shows: skin name (with rarity color), price, discount %, reason tags
- [ ] StatTrak skins: orange left border + "ST" prefix
- [ ] Souvenir skins: gold left border + "SV" prefix
- [ ] Click to expand: screenshot placeholder, stats grid, sticker list, price comparison
- [ ] Action buttons: "Open on CSFloat", "+ Watchlist", "Ignore"
- [ ] Clear deals button

#### Settings Tab
- [ ] Enable/disable toggle
- [ ] Polling interval (minutes)
- [ ] Max listings per poll (1–50, with hint about API key)
- [ ] Watchlist textarea (one item per line)
- [ ] CSFloat API key input with "Get Key" button
- [ ] **Deal Sensitivity slider**: Strict / Balanced / Loose
  - Strict: fewer deals, higher quality (discount ≥30%, stickers ≥70%)
  - Balanced: default (discount ≥20%, stickers ≥50%, float top 10%)
  - Loose: more deals, more noise (discount ≥10%, stickers ≥30%)

### Files to modify
- `popup.html` (new)
- `popup.js` (new)

---

## Task 3: Update `storage.js` defaults for simplified settings (P1)

**Goal:** Adjust stored settings to match the simplified MVP.

**Time:** 10 min

### Changes needed
- [ ] Remove `steamAnalystApiKey`, `steamAnalystWindow` from defaults
- [ ] Remove `pricingSource` or hardcode to `"csfloat"`
- [ ] Add `sensitivity` field: `"strict"` | `"balanced"` | `"loose"` (default `"balanced"`)
- [ ] Add `onboarded` boolean (default `false`) to track first-time users
- [ ] Adjust defaults: `pollIntervalMinutes: 3`, `maxListingsPerPoll: 30`

### Files to modify
- `storage.js`

---

## Task 4: Wire up sensitivity to scoring (P1)

**Goal:** Map the sensitivity slider to actual threshold values used in `scoring.js`.

**Time:** 15 min

### Mapping

| Sensitivity | Sticker Ratio | Discount Threshold | Float Rarity |
|---|---|---|---|
| Strict | 0.70 | 0.30 | 0.95 |
| Balanced | 0.50 | 0.20 | 0.90 |
| Loose | 0.30 | 0.10 | 0.80 |

### Changes needed
- [ ] In `background.js` or `scoring.js`, translate `settings.sensitivity` to actual thresholds before calling `evaluateListing()`
- [ ] Keep raw thresholds in code, only expose sensitivity to users

### Files to modify
- `background.js` or `scoring.js`

---

## Task 5: Load & Test in Chrome (P0)

**Goal:** Verify the extension loads, polls, and notifies correctly.

**Time:** 15–30 min

### Steps
- [ ] `chrome://extensions` → Developer Mode ON → Load Unpacked
- [ ] Open service worker console, verify alarm is set
- [ ] Open popup, confirm onboarding shows on first launch
- [ ] Save settings, verify they persist
- [ ] Click "Poll Now", watch console for fetched listings and scored results
- [ ] Temporarily lower sensitivity to "Loose" to increase chance of finding deals
- [ ] Verify notifications fire and clicking opens CSFloat listing
- [ ] Verify badge counter updates

---

## Summary Checklist

| Priority | Task | Est. Time | Status |
|---|---|---|---|
| **P0** | Build `background.js` — polling engine | 45–60 min | ☐ |
| **P0** | Build `popup.html` + `popup.js` — UI with onboarding | 60–90 min | ☐ |
| **P1** | Update `storage.js` for simplified settings | 10 min | ☐ |
| **P1** | Wire up sensitivity slider to scoring thresholds | 15 min | ☐ |
| **P0** | Load in Chrome and test end-to-end | 15–30 min | ☐ |

**Total estimated time:** ~2.5–3.5 hours

---

## Quick Reference: Deal Thresholds (for developers)

### Signal 1: Sticker Arbitrage
```
stickerRatio = (sum of sticker SCM prices × 0.5) / listing price
```
Flags when `stickerRatio >= threshold` (0.5 for Balanced).

### Signal 2: Below-Average Price
```
discount = (referencePrice - listingPrice) / referencePrice
```
Flags when `discount >= threshold` (0.2 for Balanced = 20% off).

### Signal 3: Float Rarity
```
score = how close float is to best end of its wear tier (0–1)
```
Flags when `score >= threshold` (0.9 for Balanced = top 10% rarest).

---

## v2 Ideas (post-MVP)

- [ ] User login + tier system (requires backend)
- [ ] Pattern-index rarity (blue gems, marble fades)
- [ ] Discord/webhook notifications
- [ ] SteamAnalyst as alternate pricing source
- [ ] Persist rolling averages to survive reinstalls
- [ ] Export deal history to CSV
- [ ] Select each gun and their skins from dropdown
