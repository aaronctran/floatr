# Floatr — MVP Tasks

Last reviewed: 2026-10-02.

This is the active task checklist for the React/Vite Chrome extension. It supersedes the old vanilla-JS plan in `spec/TASKS.md`. Checked items mean implemented, not necessarily verified in a real Chrome session. The core scanner is implemented; release validation and the fixes below remain open.

## Current MVP scope

- Passive CSFloat listing scanner; no automatic purchases.
- Two scoring signals: adjusted sticker value and a user-defined float range. Either signal can qualify a listing. Market discount and statistical float percentiles are not implemented scoring signals.
- Sensitivity changes the sticker ratio threshold: Strict 0.70, Balanced 0.50, Loose 0.30. Float bounds are configured separately. Saved settings apply to subsequent scans; existing cards are replaced after a successful scan.
- Watchlist queries use exact `market_hash_name`, `type=buy_now`, and cheapest-first ordering. Catalog suggestions and wear expansion help construct queries; returned names are also checked locally.
- Empty watchlist scans recent listings. Defaults are scanning off, three-minute interval, 30 recent listings; watchlist requests fetch up to 20 listings per expanded query. This is not exhaustive marketplace coverage.
- Deals represent the latest successful scan, grouped by weapon/skin in expandable dropdowns. Ranking uses saved qualifying signals, sticker ratio, price, then float; it is not estimated profit.
- Requests are serialized with two-second spacing. A 429 stops scanning, retains prior results, clears the alarm, and restores the Start Scanning button. Persisted cooldown applies to manual restarts; scanning does not automatically resume.

## Implemented

- [x] React, TypeScript, Vite/CRXJS, Tailwind, popup, options page, and MV3 background worker.
- [x] Deals / Filters / Settings navigation shared by popup and options. Settings contains only API key and appearance; Filters contains watchlist search, sticker selection, float/wear controls, sensitivity, and scanning configuration. Mounted forms retain drafts across tab switches; filter saves do not overwrite the API key.
- [x] All seven mockup palettes plus Original Blue are selectable in Settings. Appearance saves immediately under a separate storage key, updates open extension pages, and survives reopening without invalidating scans. Semantic wear colors are preserved.
- [x] Onboarding screen and locally persisted settings/API key; first-run login still needs cleanup below.
- [x] Alarm-driven scanning, interval changes, alarm restoration, and prevention of overlapping scans.
- [x] Watchlist draft persistence across tab switches and serialized storage writes.
- [x] Per-entry watchlist ignore/restore checkboxes in popup and options, persisted as `!`-prefixed lines. Ignored matches are excluded from requests, deals, and badges; an entirely ignored watchlist makes no listing requests. This is separate from the proposed persistent per-listing Ignore action.
- [x] Catalog constants, update script, autocomplete, canonical names, and supported wear expansion.
- [x] All watched skins queried without the previous five-item/query cap; results deduplicated by listing ID.
- [x] Watchlist additions during scanning trigger a refresh, including a follow-up when a scan is in flight.
- [x] Successful scans refresh prices and remove stale results; failed scans retain the prior snapshot.
- [x] Changed settings or stopping scanning discard obsolete in-flight results.
- [x] Sticker/float scoring and saved sensitivity settings wired into scanning.
- [x] Deal cards, skin groups, best-deal ordering, expandable details, and CSFloat links.
- [x] Session dismissal from each individual deal card, keyed by listing ID. Other listings of the same skin remain visible. Session storage survives popup/worker restarts; a browser restart clears it. Restore hidden deals is available in Deals.
- [x] Saved Deals sticker filter: All skins / With stickers / No stickers. Filters displayed deals, badge counts, and notifications by applied-sticker presence, independently of sticker valuation.
- [x] Sticker filter uses three visible selection buttons. Float controls in popup and options provide multi-select FN/MW/FT/WW/BS buttons, one shared slider with minimum/maximum handles, and exact-value inputs. Selected wears exclude gaps (e.g. FN + FT excludes MW) in scoring and displayed deals. Changes apply with Save Settings.
- [x] Scan progress, last completion, next scheduled scan, and error display.
- [x] Notifications, notification-click links, badge updates, and seen-ID notification deduplication implemented; Chrome validation pending.
- [x] Shared request pacing, Retry-After handling, persisted cooldown, and 429 stop behavior.
- [x] Removed Test API, Load Mock Data, and Preview buttons and their UI handlers. Preview consolidation is no longer a task.
- [x] Regression suite: 22 tests passed at the last review; TypeScript checking passed.

## Remaining MVP work

### P0 — Normalize API data used for scoring and display

- [ ] Verify sticker price fields against an authenticated response and the supplied documented sample. Scoring currently reads `reference.price`; the sample uses `scm.price`.
- [ ] Centralize sticker-price normalization for scoring and displayed stickers. Define precedence, units, and missing-value behavior without double counting.
- [ ] Support numeric API rarity values as well as named values in card colors.
- [ ] Add fixtures covering both supported sticker schemas, missing prices, and numeric rarity. Confirm equivalent supported prices produce equivalent scores and display values.

Acceptance: supported response shapes yield consistent sticker totals and rarity colors; missing pricing is not presented as a verified valuation.

### P1 — Make onboarding and scoring descriptions accurate

- [ ] Replace the decorative login form with a welcome screen or enter onboarding directly. Remove nonfunctional account/reset controls and unsupported tier/scan-limit promises; real authentication remains post-MVP.
- [ ] Verify authenticated and unauthenticated API behavior. Update onboarding and README so skipping a key does not promise scanning will work.
- [ ] Correct options-page sensitivity descriptions: remove discount and percentile promises and explain the actual sticker thresholds and independent float range.
- [ ] Replace DealCard's raw-float-based “Top X%” labels with factual float/wear information unless supported percentile data is added later. Preserve valid zero float and seed values in display.

Acceptance: the UI describes actual behavior, login requires no pretend credentials, and authentication errors provide an actionable message without exposing keys.

### P0 — Validate the extension in Chrome before release

Use `npm run build`, then load `dist/` as an unpacked extension. Record browser version, date, and results; do not mark these complete based solely on mocked regression tests.

- [ ] Fresh install and reopen: onboarding completion and settings persist.
- [ ] With a valid API key, scan a known skin and verify request filters and returned names. Repeat with multiple skins and wear/StatTrak/Souvenir variants.
- [ ] Switch tabs while typing, select autocomplete entries by keyboard/mouse, and confirm the saved watchlist is used when scanning starts.
- [ ] Leave scanning active across at least two intervals with the popup closed; verify completion times and updated results after reopening.
- [ ] Add/remove watched skins during a scan; verify final groups reflect the current watchlist.
- [ ] Save sensitivity and float bounds; verify the next completed scan uses them. Stop during a scan and confirm obsolete results are discarded.
- [ ] Verify grouped ordering, expansion, CSFloat links, Clear, notifications, notification clicks, duplicate suppression, and badge count.
- [ ] Exercise empty results, invalid credentials, timeout/network errors, and a controlled 429 response. Do not deliberately flood the live API to trigger rate limiting.
- [ ] For 429, verify scanning stops, prior deals remain, both settings surfaces show Start Scanning, and restarting respects cooldown.
- [ ] Verify alarm recovery after service-worker restart and browser restart, plus no recurring alarm when scanning is disabled.
- [ ] Check popup, options, and worker consoles for uncaught errors.

Acceptance: the flows above pass in Chrome, with authenticated API coverage and reproducible controlled error checks.

### P2 — Remove obsolete development code and align documentation

- [ ] Remove unused preview/mock handlers and helpers after checking callers; update regression coverage to exercise supported scan paths.
- [ ] Remove the unused SteamAnalyst client, or explicitly retain it as deferred code. Do not add an alternate provider to MVP scope.
- [ ] Gate verbose background diagnostics behind a development flag.
- [ ] Update README setup, verified CRXJS development workflow, project structure, test commands, newline-separated watchlist instructions, and request limits.
- [ ] Reconcile `spec/SPEC.md` with current scope: removed debug buttons, two scoring signals, uncapped watchlist expansion, snapshot/grouped deals, saved sensitivity behavior, authentication, and stop-on-429 behavior.

## Suggested MVP additions — proposed, not committed scope

Priorities here are recommendations; these items have not been implemented or accepted as release requirements.

| Priority | Suggestion | Acceptance criteria |
| --- | --- | --- |
| P1 | Explain scan coverage and unmatched watchlist entries | Distinguish an unresolved name, zero returned listings, and listings that fail scoring; show the number of queries and disclose per-query limits. |
| P1 | Clarify stale results and cooldown | Retained results visibly carry their last successful scan time and failure state; a 429 shows when retry is allowed while preserving manual restart behavior. |
| P1 | Validate settings before saving | Reject invalid float bounds and non-finite/out-of-range interval or listing limits, with inline feedback and no loss of drafts. Audit existing validation first. |
| P2 | Persist ignored listings across browser sessions | Session hiding and explicit restore are implemented. Optional longer-term persistence would keep ignored IDs after browser restart as well. |
| P2 | Show why a deal qualifies | Explain the actual sticker ratio or float-range match and valuation assumptions; avoid implying guaranteed profit or resale value. Build on existing reason tags/details. |

Recommended order: API normalization → accurate onboarding/scoring text → Chrome validation. Prioritize coverage/error clarity before adding more scoring signals.

## Post-MVP backlog

- [ ] Real user authentication, backend, and tiered plans.
- [ ] Market-discount scoring and price history/rolling averages, with a validated data source and retention strategy.
- [ ] SteamAnalyst or another alternate pricing provider.
- [ ] Pattern-index rarity supported by a per-skin dataset.
- [ ] Discord/webhook notifications.
- [ ] Export deal history to CSV (requires a history policy; current deals are a scan snapshot).
- [ ] Dedicated weapon → skin picker; current catalog autocomplete is already implemented.
- [ ] Inventory integration and automatic watchlists.
- [ ] Per-skin thresholds and bulk ignore/snooze.
- [ ] Backup/sync if settings or history must survive reinstalls; local storage alone is not a reinstall backup.

## Verification record

At the 2026-10-02 code review:

- `node --test scripts/watchlist-regression.test.cjs`: 22 passed, 0 failed.
- `npx tsc --noEmit`: passed.
- Production build passed during the preceding implementation work.
- Real Chrome end-to-end and authenticated CSFloat validation remain unverified.

This task-list update changes documentation only; it does not implement the open tasks or rerun those checks.
