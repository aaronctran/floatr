# Floatr (React/Vite port) — Remaining Tasks

> **Status:** Full port complete — Vite + React + TS + CRXJS, Tailwind, background worker, popup (Login/Onboarding/Main), options page, DealCard. Build passes (`tsc && vite build`). All API paths route through the background worker with `type=buy_now`. Pushed to `feature/test-buy-now-deals`.
> **Note:** This file supersedes the old vanilla-JS task list in `csfloat-deal-sniper/TASKS.md`.

---

## Task 1: End-to-end Chrome test (P0) — never done on the React build

- [ ] `npm run build`, then `chrome://extensions` → Developer mode → **Load unpacked** → select `floatr-react/dist`
- [ ] Fresh install flow: Login screen → Onboarding (save API key or skip) → Main; reopen popup and confirm it goes straight to Main (`onboarded` flag persists)
- [ ] Settings tab → **Test API (Buy Now, First 5)** → expect "Loaded 5 buy_now listings…" → switch to Deals tab → 5 deal cards render with correct sticker prices (from `sticker.reference.price`)
- [ ] **Load Mock Data Only** → deal cards render without network
- [ ] Popup console (right-click extension icon → Inspect popup): no red errors
- [ ] Service worker console (`chrome://extensions` → Floatr → *service worker*): alarm set on install, `[Floatr] API Call/Response` logs appear
- [ ] **Poll Now** with sensitivity **Loose** → verify deals logged, `chrome.notifications` fires, clicking notification opens the CSFloat listing, badge counter updates
- [ ] Settings persist across popup closes (interval, watchlist, float range, sensitivity)
- [ ] Error paths: bad API key shows error (not silent), 429 backoff message appears in worker console

## Task 2: Consolidate Deals tab "Preview 5" with the Settings test flow (P1)

- [ ] `DealsTab.tsx` `handlePreview` maps listings with its own inline logic instead of `listingToDeal` + `saveTestDeals`
- [ ] Point it at the same background `preview-listings` → `saveTestDeals` flow so both tabs share one source of truth
- [ ] Decide: does Preview still belong in Deals, or should the Deals tab just read what Test API saved?

## Task 3: Resolve LoginScreen (P1)

- [ ] MVP scope deferred real login (needs backend), but `LoginScreen.tsx` still gates first run
- [ ] Decide: remove it entirely (Onboarding becomes the entry screen), or keep as a lightweight branded welcome

## Task 4: Remove or wire up `steamanalyst.ts` (P2)

- [ ] Ported but referenced nowhere — dead code
- [ ] Either delete the file or wire it as a secondary price reference

## Task 5: Clean up debug noise (P2)

- [ ] `background.ts`: `DEBUG = true` constant and verbose `[Floatr] [NO DEAL]` logs — gate behind a dev flag
- [ ] `SettingsTab.tsx` `handleTestApi`: trim the `console.log` chain to 1–2 lines

## Task 6: README for the React project (P2)

- [ ] Dev workflow: `npm run dev` + load project root (CRXJS HMR) vs production: `npm run build` + load `dist/`
- [ ] Testing checklist (point at Task 1)
- [ ] Repo structure overview

---

## Post-MVP (carried over from original plan)

- [ ] Discord/webhook notifications
- [ ] Pattern-index rarity (blue gems, marble fades) — needs per-skin DB
- [ ] Export deal history to CSV
- [ ] Skin picker dropdowns (gun → skin)
- [ ] Rolling price averages persisted across reinstalls
