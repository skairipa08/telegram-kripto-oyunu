# Challenge Report: Leaderboard & Monetization Empirical Stress Testing

**Challenger**: `teamwork_preview_challenger_1`  
**Role**: critic, specialist (Empirical Challenger)  
**Date**: 2026-09-14  
**Verdict**: **APPROVE** (Low Risk)

---

## Challenge Summary

**Overall risk assessment**: **LOW**

Worker M1's implementations for Leaderboards (deterministic tie-breaking, keyset cursor pagination, user rank pinning, season freeze) and Monetization (Stars invoicing, webhook fulfillment idempotency, Convenience Pass entitlements, anti-P2W guardrails) were subjected to rigorous adversarial stress testing.

10 custom stress test scenarios were designed and executed in dedicated test suites:
- `packages/game-core/src/leaderboard-stress.test.ts` (6 test suites)
- `apps/api/src/shop/payment-stress.test.ts` (4 test suites)

All 10 empirical stress tests and all 127 baseline tests passed (137 total passed tests across 17 test files). The full CI pipeline (`pnpm check` including ESLint, Prettier, TypeScript, Vitest, Vite build, and Wrangler dry-run) exited with code 0.

---

## Challenges & Stress Scenarios

### Challenge 1 (Low Risk): Keyset Pagination Stability Across Identical Score and Timestamp Clusters
- **Assumption Challenged**: Keyset cursor pagination `points DESC -> updated_at ASC -> user_id ASC` might experience skipped entries or duplicate records when navigating large clusters where both points and timestamps are identical.
- **Attack Scenario**: Created a synthetic leaderboard of 1,500 players featuring a massive collision block of 250 players with identical points (5,000) and identical timestamps (`2026-09-14T12:00:00.000Z`), varying solely by UUID. Traversed the entire leaderboard page-by-page using prime/misaligned limit sizes (7, 13, 23, 50, 100) across page boundaries directly intersecting the collision cluster.
- **Blast Radius**: If pagination leaked or skipped rows, players near rank thresholds would observe jumpy or missing positions during scroll.
- **Empirical Result**: **PASS**. Zero missing items, zero duplicate items across all 1,500 entries. Every single user ID was retrieved in strictly identical order across all page sizes.
- **Mitigation / Defense in Code**: Total order guarantees provided by `user_id.localeCompare` tie-breaking at `packages/game-core/src/leaderboard.ts:63` ensure that `compareLeaderboardEntries(a, b)` forms a strict total ordering with no equivalence classes other than identity.

### Challenge 2 (Low Risk): Leaderboard Permutation Stability Under Input Jitter
- **Assumption Challenged**: Asynchronous or unordered score ingestion could cause unstable rank outputs if tie-breaking comparator relied on non-transitive or insertion-order sensitive logic.
- **Attack Scenario**: Generated 1,500 synthetic records and shuffled them into 5 distinct random permutations using a PRNG seed. Sorted all 5 permutations with `rankLeaderboardEntries`.
- **Blast Radius**: Non-deterministic tie-breaking would cause players with equal scores to swap ranks between page reloads or leaderboard views.
- **Empirical Result**: **PASS**. Output ranks were 100% bit-for-bit identical across all 5 shuffled runs (ranks 1 to 1500 mapped to identical user IDs and score attributes).

### Challenge 3 (Low Risk): Concurrent Webhook Replay / Double-Spend Attack
- **Assumption Challenged**: Rapid burst delivery of duplicate Telegram payment webhook notifications could race and double-fulfill player pass entitlements.
- **Attack Scenario**: Authenticated a test player, created an invoice for `convenience_pass_30d`, and fired 10 concurrent requests (`Promise.all`) to `/telegram/webhook` using the exact same `telegram_payment_charge_id`.
- **Blast Radius**: Double-crediting pass days (+300 days instead of +30 days) or corrupting purchase ledger.
- **Empirical Result**: **PASS**. All 10 requests returned HTTP 200. Exactly 1 request fulfilled with `duplicate: false`, and exactly 9 requests returned `duplicate: true`. Expiration timestamp was consistent across all responses. In the database, only 1 purchase record was created, and pass duration was extended by exactly 30 days.
- **Mitigation / Defense in Code**: Database unique constraint on `purchases.telegram_payment_charge_id` and row-level locking (`for update`) in `empire_shop_fulfill_payment` prevent race conditions.

### Challenge 4 (Low Risk): Anti-P2W Circumvention & SKU Injection
- **Assumption Challenged**: Malicious users could craft invoices or webhook payloads with unauthorized SKUs awarding Season Points, cash multipliers, or production speedups.
- **Attack Scenario**: Attempted invoice creation and direct RPC calls for blacklisted SKUs: `season_points_1000`, `points_multiplier_2x`, `instant_sru_500`, `skip_production_timer`, `pay_to_win_rank_boost`, and `infinite_cash_pack`.
- **Blast Radius**: Pay-to-Win mechanics violating core Blueprint specification (Blueprint R7).
- **Empirical Result**: **PASS**. Invoicing route strictly returned HTTP 400 `FORBIDDEN_P2W_SKU`. Core validation function `validateP2WSafety` threw `P2WViolationError`. Convenience pass entitlement calculation hardcoded `seasonPointsMultiplier` to `1.0` in both active and inactive states. Economy formulas (`calculateProductionPerSecond`, `calculateSRU`) have zero coupling or multiplier parameters for Stars purchases.

---

## Stress Test Results Matrix

| Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| 1,500-player ranking with 250 identical points/timestamps | Strict monotonic order: points DESC, updatedAt ASC, userId ASC | Monotonic comparator invariant holds for all adjacent pairs (0..1499) | **PASS** |
| Permutation invariance (5 randomized shuffles of 1,500 records) | 100% identical rank assignments across all runs | Bit-for-bit identical ranks 1..1500 across all 5 runs | **PASS** |
| Full keyset pagination traversal (page sizes 7, 23, 50, 100) | Zero missing, zero duplicates, sequential ranks 1..1500 | Exactly 1500 collected, Set size 1500, exact sequence match | **PASS** |
| Keyset pagination across 250 identical-score/time collision block | Clean transition across page boundaries without repetition | Exactly 250 unique items collected with page size 13 | **PASS** |
| User rank pinning (rank 1, 750, 1500, collision, unranked, empty) | Exact rank and score returned; unranked/empty returns null | Matches rank exactly; non-existent UUID and undefined return null | **PASS** |
| Malformed / corrupted cursor resilience | Safe fallback without crashing or throwing uncaught exceptions | Returns valid paged response or page 1 fallback safely | **PASS** |
| Concurrent double-spend (10 parallel webhooks with same charge ID) | Exactly 1 fulfill, 9 duplicate detected, +30d entitlement | 1 `duplicate: false`, 9 `duplicate: true`, exactly +30 days in DB | **PASS** |
| Fake / unregistered invoice payload delivery | HTTP 404 UNKNOWN_INVOICE_PAYLOAD | HTTP 404 UNKNOWN_INVOICE_PAYLOAD | **PASS** |
| Additive pass duration stacking (+30d on existing 30d pass) | Total duration extends to ~60 days | DB `player_entitlements` records `expires_at = starts_at + 60 days` | **PASS** |
| P2W SKU rejection (`season_points_1000`, `points_multiplier_2x`, etc.) | HTTP 400 FORBIDDEN_P2W_SKU, `P2WViolationError` thrown | All 6 illegal SKUs rejected at API and core validation layers | **PASS** |
| Anti-P2W pure invariant assertion | `seasonPointsMultiplier === 1.0` always, formulas decouple pass | Multiplier permanently locked to 1.0; production formulas invariant | **PASS** |

---

## Unchallenged Areas

- **UI / Frontend Components**: Strictly out of scope per Blueprint R5 / Astra 6.0 isolation boundaries.
- **External Network Outages to Telegram Webhook Bot**: Covered in unit/integration mocks; real Telegram production webhooks depend on Telegram cloud delivery.
