# Floatr — Technical Specification

> Spec-driven development source of truth. Every feature, data structure, API contract, and UI behavior is defined here before code is written.

---

## 1. Overview

**Floatr** is a Chrome Extension (Manifest V3) that polls the CSFloat marketplace API for Counter-Strike 2 skin listings, detects deals using two signals (stickers and float range), and surfaces them to the user via an in-popup deals feed and native Chrome notifications.

### Core Value Propositions
1. **Sticker Arbitrage** — skins with applied stickers whose SCM value exceeds a threshold ratio of the listing price
2. **Float Range Matching** — skins with floats within a user-defined min/max range

### Target User Flow
1. Install extension → Login screen → Onboarding (optional API key) → Main App
2. Configure float range + sticker sensitivity → Start Scanning
3. Receive deals in popup + optional Chrome notifications
4. Click deal → open CSFloat listing → purchase

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)                             │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │ Popup UI     │   │ Background   │   │ Content Script │  │
│  │ (screens/*)  │◄──►│ Service      │   │ (future: CS2   │  │
│  │              │   │ Worker       │   │  inventory     │  │
│  │ - login      │   │              │   │   integration) │  │
│  │ - onboarding │   │ - Alarm      │   └────────────────┘  │
│  │ - main       │   │ - Polling    │                         │
│  │   ├─ deals   │   │ - Scoring    │                         │
│  │   └─ settings│   │ - Storage    │                         │
│  └──────────────┘   └──────────────┘                         │
│         │                  │                                 │
│         ▼                  ▼                                 │
│  ┌────────────────────────────────────┐                     │
│  │ chrome.storage.local               │                     │
│  │ - settings (user config)           │                     │
│  │ - dealLog (capped history)         │                     │
│  │ - seenListingIds (de-dupe)         │                     │
│  └────────────────────────────────────┘                     │
│                              │                               │
│                              ▼                               │
│                    ┌──────────────────┐                      │
│                    │ CSFloat API      │                      │
│                    │ api/v1/listings  │                      │
│                    └──────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### File Organization

| Directory | Purpose |
|-----------|---------|
| `screens/` | One subdirectory per screen: HTML + CSS + JS bundled together |
| `services/` | Pure JS business logic: API clients, scoring, storage abstractions |
| `icons/` | Extension icons (16, 48, 128px) |
| `wireframes/` | Design assets, mockups, logo iterations |
| Root | `manifest.json`, `options.html`, `popup.html` (redirect), docs |

---

## 3. User Flows & Screen Specifications

### 3.1 Screen: Login (`screens/login.*`)

**Entry point** — `manifest.json` `default_popup` points here.

**State guard**: On load, check `chrome.storage.local.get("onboarded")`. If `true`, redirect to `main.html`.

**UI Elements**:
- Lock icon (branded)
- "Sign In" heading
- Email input (decorative for MVP — no real auth backend)
- Password input (decorative for MVP)
- **"Log In" button** → navigates to `onboarding.html`
- **"Continue as Guest" link** → navigates to `onboarding.html`
- "Create account" / "Forgot password" links → `alert("Coming soon!")`

**Future**: Real auth with Firebase/Supabase, tiered plans (Free: 50 polls/day, Premium: unlimited).

---

### 3.2 Screen: Onboarding (`screens/onboarding.*`)

**Purpose**: Collect optional CSFloat API key + explain the extension.

**State guard**: If `onboarded === true`, redirect to `main.html`.

**UI Elements**:
- Target icon (branded)
- "Welcome to Floatr" heading
- One-sentence value prop
- **API Key step-by-step instructions**:
  1. Go to csfloat.com/profile
  2. Click **Developers** tab
  3. Click **New Key**
  4. Copy key (starts with `cf_`)
- **API Key input + Save button**
- **"Skip for now →" link**

**Actions**:
- **Save**: Write `settings.apiKey` to storage, set `onboarded = true`, navigate to `main.html`
- **Skip**: Set `onboarded = true`, navigate to `main.html`

---

### 3.3 Screen: Main App (`screens/main.*`)

**Purpose**: Core UX — browse deals and configure settings.

**State guard**: If `onboarded !== true`, redirect to `login.html`.

**Layout**:
```
┌──────────────────────────────┐
│  Floatr          [badge] 🔄  │  ← Header
├──────────────────────────────┤
│  [  Deals  ] [ Settings ]    │  ← Tabs
├──────────────────────────────┤
│                              │
│  { active panel content }    │
│                              │
└──────────────────────────────┘
```

#### Deals Tab (`#panel-deals`)

**Empty state**: Icon + "No deals found yet." + hint about background polling.

**Deal card** (collapsible, inline expansion):
```
┌────────────────────────────────────┐
│ [img]  Skin Name            Float  │  ← Summary row (click to expand)
│        $123.45   [tags]       ▼    │
├────────────────────────────────────┤
│ Float: 0.001234   Pattern: 42      │  ← Detail panel
│ Wear: FN          Float Rarity:    │
│                                    │
│ Screenshot                         │
│ [Click to view CSFloat screenshot] │
│                                    │
│ Applied Stickers (3)               │
│ [icon] Sticker Name          $5.00 │
│ ─────────────────────────────────  │
│ Total sticker value         $15.00 │
│                                    │
│ [ Open on CSFloat ] [ Ignore ]     │
└────────────────────────────────────┘
```

**Deal card requirements**:
- Skin name color matches CS2 rarity (Consumer → Contraband)
- StatTrak™ prefix: orange `ST` badge before name
- Souvenir prefix: gold `SV` badge before name
- Left border accent for ST (orange) / Souvenir (gold)
- Tags: `sticker arb`, `float match`, `API test`
- Expand/collapse: click summary row, only one open at a time
- **Open on CSFloat**: opens `https://csfloat.com/item/{id}` in new tab
- **Ignore**: hides card from current view (does not persist)

#### Settings Tab (`#panel-settings`)

**Sections** (in order):

1. **Polling Control**
   - **Start/Stop Scanning button** (large, stateful)
     - Stopped: green gradient, "▶ Start Scanning"
     - Scanning: red gradient, "⏸ Stop Scanning"
   - Status hint text below

2. **Polling Config**
   - Interval (minutes): number input, 1–60, default 3
   - Max listings: number input, 1–50, default 30
   - Hint: "30 is safe without an API key. 50 with a key."

3. **Watchlist**
   - Textarea: one item name per line
   - Hint: "Empty = scan all recent listings (firehose mode)"

4. **API Key**
   - Input field (prefilled if saved during onboarding)
   - "Open CSFloat" button → opens profile page
   - Hint about rate limiting

5. **Float Range**
   - Min Float: number input, 0–1, step 0.001, default 0.00
   - Max Float: number input, 0–1, step 0.001, default 0.15
   - Hint: "Only flags skins with float in this range. Default 0.00–0.15 catches FN/MW and good FT."

6. **Sticker Sensitivity**
   - Interactive slider (draggable, 3 positions: Strict / Balanced / Loose)
   - Visual feedback: fill bar + thumb + description text
   - Auto-saves on drag release

7. **Save Settings button**
   - Gradient blue button
   - On click: saves all inputs, shows "Saved!" feedback, triggers immediate poll

8. **Test API (debug)**
   - "Test API (Best Deals)" button
   - Fetches listings, displays first 5 in Deals tab
   - Falls back from `sort_by=best_deal` to `sort_by=most_recent`
   - Shows sort method used in result area

---

## 4. Data Models

### 4.1 Settings (`chrome.storage.local` key: `settings`)

```typescript
interface Settings {
  enabled: boolean;                  // default: false (user must explicitly start)
  apiKey: string;                    // default: "" (optional)
  pollIntervalMinutes: number;       // default: 3, range: 1-60
  maxListingsPerPoll: number;        // default: 30, range: 1-50
  watchlist: string[];               // default: [] (empty = firehose mode)
  stickerRatioThreshold: number;     // default: 0.5
  stickerRealizationRate: number;    // default: 0.5 (haircut on sticker SCM value)
  minFloat: number;                  // default: 0.00
  maxFloat: number;                  // default: 0.15
}
```

### 4.2 Deal Entry (`chrome.storage.local` key: `dealLog`)

```typescript
interface Deal {
  id: string;                        // CSFloat listing ID
  timestamp: number;                 // when detected
  marketHashName: string;
  priceCents: number;
  priceDisplay: string;              // formatted "$123.45"
  floatValue: number | null;
  stickers: Array<{
    name: string;
    price: number | null;            // SCM price in cents
  }>;
  stickerValueCents: number;
  reasons: Array<{
    type: "sticker_arbitrage" | "rare_float" | "api_test";
    detail?: string;
    [key: string]: any;
  }>;
  item: object;                      // raw CSFloat item object
}
```

**Storage constraints**:
- `dealLog`: max 50 entries, FIFO eviction
- `seenListingIds`: max 2000 entries, circular buffer

---

## 5. API Contracts

### 5.1 External: CSFloat API

**Base URL**: `https://csfloat.com/api/v1/listings`

**Auth**: `Authorization: cf_...` header (optional but recommended)

**Endpoints used**:

| Endpoint | Params | Purpose |
|----------|--------|---------|
| `GET /api/v1/listings` | `sort_by=most_recent`, `limit=N` | Firehose mode |
| `GET /api/v1/listings` | `sort_by=lowest_price`, `market_hash_name=X`, `limit=N` | Watchlist mode |
| `GET /api/v1/listings` | `sort_by=best_deal`, `limit=N` | Test API (fallback to `most_recent`) |

**Response shape** (simplified):
```json
{
  "listings": [
    {
      "id": "string",
      "price": 12345,
      "item": {
        "market_hash_name": "AK-47 | Redline (Field-Tested)",
        "float_value": 0.151234,
        "paint_seed": 42,
        "wear_name": "Field-Tested",
        "rarity": "Classified",
        "icon_url": "...",
        "has_screenshot": true,
        "stickers": [
          {
            "name": "Sticker | Titan (Holo) | Katowice 2014",
            "icon_url": "...",
            "scm": { "price": 50000 }
          }
        ]
      }
    }
  ]
}
```

**Error handling**:
- `429` → back off polling interval
- `401/403` → warn user about invalid API key
- Network errors → retry with exponential backoff (max 3 consecutive errors)

### 5.2 Internal: Background ↔ Popup Messaging

| Message | Direction | Payload | Response |
|---------|-----------|---------|----------|
| `poll-now` | Popup → BG | — | `{ ok, result \| error }` |
| `get-deals` | Popup → BG | — | `{ deals: Deal[] }` |
| `clear-deals` | Popup → BG | — | `{ ok }` |

---

## 6. Deal Scoring Logic

### 6.1 Signals

A listing is flagged as a **deal** if any of the following signals trip:

#### Signal 1: Sticker Arbitrage
```
stickerValueCents = sum(sticker.scm.price for each sticker)
stickerRatio = (stickerValueCents * realizationRate) / listingPriceCents

IF stickerRatio >= stickerRatioThreshold:
  → DEAL (type: "sticker_arbitrage")
```

#### Signal 2: Float Range Match
```
IF item.float_value >= settings.minFloat AND item.float_value <= settings.maxFloat:
  → DEAL (type: "rare_float")
```

### 6.2 Sticker Sensitivity Presets

| Preset | `stickerRatioThreshold` | Description |
|--------|------------------------|-------------|
| Strict | 0.70 | Fewer deals, higher quality — stickers worth ≥70% of price |
| Balanced | 0.50 | Default — flags stickers worth ≥50% of listing price |
| Loose | 0.30 | More deals, more noise — stickers worth ≥30% of price |

### 6.3 Float Range Defaults

| Setting | Default | Description |
|---------|---------|-------------|
| `minFloat` | 0.00 | Minimum float to flag |
| `maxFloat` | 0.15 | Maximum float to flag — catches FN, MW, and good FT |

---

## 7. Polling Behavior

### 7.1 Alarm Schedule
- Alarm name: `"floatr-poll"`
- Default interval: 3 minutes (configurable 1–60)
- Respects `settings.enabled` — if disabled, alarm is cleared

### 7.2 Polling Modes

**Firehose mode** (`watchlist.length === 0`):
- Fetches `sort_by=most_recent`, `limit=maxListingsPerPoll`

**Watchlist mode** (`watchlist.length > 0`):
- For each item (capped at 5 items):
  - Fetches `sort_by=lowest_price`, `market_hash_name=item`, `limit=min(20, maxListingsPerPoll)`

### 7.3 Error Resilience
- Track consecutive errors in memory (resets on SW restart, which is acceptable)
- After 3 consecutive errors: back off interval by +1 minute (cap at 15 min)
- On success: reset error count, restore user-configured interval

### 7.4 Rate Limiting Safety
- Default 30 listings × 20 polls/hour = 600 listings/hour (well within free tier)
- With API key: can bump to 50 listings
- `429` response → immediately back off and warn user

---

## 8. UI/UX Specifications

### 8.1 Color Palette (Dark Mode / CSFloat-inspired)

```css
--bg-primary:   #090d14;
--bg-secondary: #0f1520;
--bg-card:      #141a28;
--text-primary:   #f0f4f8;
--text-secondary: #94a3b8;
--text-muted:     #64748b;
--accent-blue:    #3b82f6;
--accent-green:   #22c55e;
--accent-amber:   #f59e0b;
--accent-red:     #ef4444;
```

### 8.2 Rarity Colors (CS2 Standard)

| Rarity | Hex |
|--------|-----|
| Consumer Grade | `#b0c3d9` |
| Industrial Grade | `#5e98d9` |
| Mil-Spec Grade | `#5b7cff` |
| Restricted | `#a855f7` |
| Classified | `#e879f9` |
| Covert | `#f87171` |
| Contraband | `#fbbf24` |

### 8.3 Button Styles

All primary actions use **rounded gradient buttons**:
- Primary: `linear-gradient(135deg, #2563eb, #3b82f6)`
- Success/Start: `linear-gradient(135deg, #16a34a, #22c55e)`
- Danger/Stop: `linear-gradient(135deg, #dc2626, #ef4444)`
- Border radius: `8px`
- Hover: translateY(-1px) + stronger shadow

---

## 9. Security & Privacy

- API key stored only in `chrome.storage.local` (never sent to any server except CSFloat)
- No user data collected or transmitted to third parties
- Extension permissions minimal: `storage`, `notifications`, `alarms`, `host_permissions` for `csfloat.com`

---

## 10. Testing Strategy

### 10.1 Manual Tests

| Test | Steps | Expected |
|------|-------|----------|
| Fresh install | Install → open popup | Shows login screen |
| Guest flow | Login → Guest → Skip | Shows main app, Deals tab empty |
| Start scanning | Settings → Start Scanning | Button turns red, hint updates, bg logs show poll |
| Test API | Settings → Test API | Loads 5 cards into Deals tab |
| Deal expand | Deals → click card summary | Detail panel opens, only one open at a time |
| Open listing | Deal → "Open on CSFloat" | New tab to csfloat.com/item/{id} |
| Float range | Set min=0.00, max=0.01 → Save | Only flags extremely low floats |
| Save settings | Change interval → Save | Shows "Saved!", persists after reload |
| Slider drag | Drag sensitivity slider | Thumb moves, description updates, auto-saves |
| Re-open popup | Close → reopen extension | Returns to last active tab, deals preserved |

### 10.2 API Test Button

The **Test API** button in Settings exists for development/debugging:
- Calls `GET /api/v1/listings?sort_by=best_deal&limit=30`
- Falls back to `sort_by=most_recent` on error
- Renders first 5 listings as deal cards (no scoring — raw display)
- Auto-switches to Deals tab

---

## 11. Future Roadmap (Post-MVP)

| Feature | Priority | Notes |
|---------|----------|-------|
| Real auth + tiered plans | High | Firebase/Supabase auth, Free vs Premium |
| CS2 inventory integration | Medium | Content script to read user's Steam inventory |
| Auto-watchlist from inventory | Medium | "Watch skins I own" |
| Price history charts | Medium | Per-item price over time |
| Discord webhook notifications | Low | Alternative to Chrome notifications |
| Custom deal filters | Low | Per-item min/max price, float ranges |
| Bulk ignore / snooze | Low | Better deal management |

---

## 12. Change Log

| Date | Change |
|------|--------|
| 2026-08-28 | Initial spec written — defines MVP architecture, flows, data models, scoring logic |
| 2026-08-28 | Removed below-average price signal; replaced auto float-rarity with user-defined minFloat/maxFloat range |

---

*This document is authoritative. If behavior in code diverges from this spec, the spec is the source of truth and code should be updated to match.*
