# Handoff Report: Specification Mining for Steps 7, 8, 9, 11 (Blueprints R6, R7, R8, R10 / Section 18)

**Agent**: `teamwork_preview_spec_miner_survey_1`  
**Date**: 2026-09-14  
**Working Directory**: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey_1`  
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation

1. **Master Blueprint Document**:
   - Location: `c:\Users\Administrator\Desktop\telegram kripto oyunu\Project_Empire_Master_Blueprint_v1.0.docx`.
   - Extracted text: 736 lines extracted via PowerShell `System.IO.Compression.ZipFile` on `word/document.xml`.
   - References in existing code:
     - `docs/PLAN.md:3`: `"Ana kaynak: Project_Empire_Master_Blueprint_v1.0.docx."`
     - `README.md:3`: `"Ana ürün kaynağı: Project_Empire_Master_Blueprint_v1.0.docx."`
     - `supabase/migrations/202609140002_economy.sql:3`: `"-- Remote / Seed Economy Configurations (Blueprint Section 18)"`

2. **Blueprint R6 (Leaderboards Engine & Season Freeze)**:
   - `blueprint_text.txt:193-195`: `"Leaderboard: Global / friends; season score; own rank sabit görünür. Ana CTA: VIEW PROFILE."`
   - `blueprint_text.txt:258-262`: `"Season score her sezon sıfırlanır; lifetime profile ayrı tutulur. Eski sezon performansı sonraki sezona yalnız kozmetik badge ve maksimum %2 'veteran XP' bonusu olarak taşınabilir. Season Points çarpanı taşınmaz... Season süresi config'tir. Kodda gün/ay sabitlenmez."`
   - `blueprint_text.txt:443-444`: Data model `seasons` (`id, name, starts_at, ends_at, status, config_json`) and `season_scores` (`season_id, user_id, points, referral_points, mission_points`).
   - `blueprint_text.txt:498-499`: Endpoint `GET /leaderboard`: `"Global/friends rank, cursor pagination"`.
   - `blueprint_text.txt:581-583`: Roadmap R6 exit criteria: `"High-volume query indexleri testli; season reset güvenli."`
   - `ORIGINAL_REQUEST.md:42-45`:
     - Optimized composite indexes on `season_scores(season_id, points desc)`.
     - Pure sorting, ranking, and pagination functions in `packages/game-core` or API handle ties and edge cases with 100% test coverage.
     - Season freeze and archival functions correctly preserve past season final ranks.

3. **Blueprint R7 (Stars Monetization & Pass Entitlement Backend)**:
   - `blueprint_text.txt:313-342`: Convenience Pass specifications:
     - Free offline cap: 4h (14,400s); Pass offline cap: 12h (43,200s). `"Aynı production rate; yalnız daha seyrek giriş"`.
     - Upgrade queue: Free = 1; Pass = 3.
     - Auto-claim / auto-reinvest: Free = none; Pass = enabled.
     - Mission rerolls: Free = 1/day; Pass = 3/day.
     - Season Points multiplier: Free = 1x; Pass = 1x. `"KESİNLİKLE değişmez"`.
     - Default price: 250 Telegram Stars / 30-day pass (`passPriceStars = 250`, `passDurationDays = 30`).
   - `blueprint_text.txt:349-355`: Strict anti-P2W prohibitions: Season Points, SRU multiplier, Leaderboard rank, exclusive high production business, and direct Cash sales with real money are forbidden.
   - `blueprint_text.txt:455-456`: Table `purchases`: `id, user_id, telegram_payment_charge_id UNIQUE, sku, stars_amount, status, created_at`.
   - `blueprint_text.txt:468`: `"Payment fulfillment: telegram_payment_charge_id unique ve idempotent."`
   - `ORIGINAL_REQUEST.md:48-50`: Idempotent payment fulfillment, 12h offline cap without altering production, contract tests verifying Stars cannot buy Season Points.

4. **Blueprint R8 (Admin Remote Config & Feature Flags)**:
   - `blueprint_text.txt:457-458`: Table `economy_config`: `key UNIQUE, value_json, version, updated_at`.
   - `blueprint_text.txt:532-539`: Admin panel features: economy config, business/mission toggles, season create/start/end/freeze, user audit trail, feature flags.
   - `blueprint_text.txt:661-701` (Section 18): Machine-implementable defaults:
     - `economy.offline_cap_free_sec: 14400`
     - `economy.offline_cap_pass_sec: 43200`
     - `economy.upgrade_cost_growth: 1.18`
     - `economy.production_level_growth: 1.07`
     - `season.sru_base: 500`
     - `season.sru_reference_qap: 100`
     - `season.sru_exponent: -0.10`
     - `season.sru_min: 100`, `season.sru_max: 500`
     - `referral.bind_window_min: 30`
     - `referral.diminish_after_qualified: 20`
     - `referral.diminish_floor: 0.25`
     - `pass.price_stars: 250`, `pass.duration_days: 30`
     - `mission.daily_slots: 3`, `mission.free_rerolls: 1`, `mission.pass_rerolls: 3`
     - `feature.token: false`, `feature.stars_payments: false`
   - `ORIGINAL_REQUEST.md:52-55`: Safe fallbacks, `feature.token` defaulting to false, configuration mutation audit trail.

5. **Blueprint R10 / Section 18 (Analytics Event Pipeline & Cohort Models)**:
   - `blueprint_text.txt:405-407`: PostHog-compatible event abstraction.
   - `blueprint_text.txt:461-462`: Table `daily_metrics`: `date, qap, sru, dau, new_users, qualified_referrals, revenue_stars`.
   - `blueprint_text.txt:702-707` (Section 18): 21 canonical events:
     `app_open`, `auth_success`, `tutorial_complete`, `business_upgrade`, `cash_claim`, `mission_assigned`, `mission_complete`, `mission_claim`, `streak_claim`, `referral_link_copy`, `referral_bound`, `referral_milestone_qualified`, `referral_reward_claim`, `leaderboard_view`, `shop_view`, `invoice_created`, `payment_success`, `payment_refund`, `fraud_flag_created`, `reward_frozen`, `pass_activated`.
   - `blueprint_text.txt:540-560`: KPI definitions: Activation rate, D1/D7 retention, Sessions/active user, Qualified referral rate, Payer conversion, ARPPU.
   - `ORIGINAL_REQUEST.md:58-59`: Event schemas validate against all Blueprint Section 18 names; retention functions correctly identify D1, D2, and D7 qualifying players.

---

## 2. Logic Chain

1. From Observation 1, the single authoritative specification document for all Project Empire mechanics is `Project_Empire_Master_Blueprint_v1.0.docx`, supplemented by `ORIGINAL_REQUEST.md`.
2. From Observation 2, Leaderboards require deterministic tie-breaking. A deterministic total order over players must order by `points DESC`, then `updated_at ASC`, then `user_id ASC`. Friends leaderboard is a restricted projection of the global score table over the 1-hop referral graph (`invitees + referrer + self`). Season freeze transitions season status to `'frozen'`, rejects further point increments, snapshots final ranks to `season_archives`, and resets active score for the next season while preserving lifetime cash and veteran badges.
3. From Observation 3, Monetization with Telegram Stars must obey the strict Anti-P2W guardrail. Convenience Pass extends offline earning cap from 4 hours to 12 hours without increasing `productionPerSecond`. Payment fulfillment requires Telegram webhook handlers for `pre_checkout_query` and `successful_payment`. Idempotency is enforced by tracking unique `telegram_payment_charge_id`. Stacking of Convenience Pass is additive (`remaining_time + 30 days` if active).
4. From Observation 4, Remote Config must implement a 2-tier fallback: `DB economy_config -> in-memory DEFAULT_ECONOMY_CONFIG`. Feature flags (specifically `feature.token`) must evaluate strictly to `false` when absent or disabled. Every mutation must write to an `admin_audit_logs` table recording `(admin_user_id, action, target_type, target_key, old_value, new_value, reason, created_at)`.
5. From Observation 5, Analytics requires a strongly typed Zod validator accepting only the 21 canonical event names defined in Blueprint Section 18. Cohort models must perform calendar day calculations normalized to UTC date boundaries (`date_trunc('day', timestamp)`). D1 requires activity on signup + 1 day; D2 on signup + 2 days; D7 on signup + 7 days (or $\ge 4$ active days within 7 days for referral qualification).
6. From Observation 1-5, all specifications have been compiled into `spec_report.md` with 26 discovered features, 18 edge cases, complete database schemas, DTOs, formulas, and constraints.

---

## 3. Caveats

- **Astra 6.0 Boundaries**: No UI components or CSS styles were created or modified. Anti-fraud graph clustering and external exploit penetration tools were not altered, preserving isolation for Astra 6.0.
- **Pre-existing Migrations**: Existing migrations `202609140001` through `202609140004` cover auth, initial economy, seasons/missions, and referrals. Blueprints R6, R7, R8, and R10 require additional migrations (e.g. `202609140005_leaderboards_monetization_analytics.sql`) and new modules in `packages/game-core`, `packages/shared`, and `apps/api`.

---

## 4. Conclusion

All required formulas, schemas, event names, database columns, constraints, and acceptance criteria for:
- Blueprint R6 (Leaderboards Engine & Season Freeze)
- Blueprint R7 (Stars Monetization & Pass Entitlement Backend)
- Blueprint R8 (Admin Remote Config & Feature Flags)
- Blueprint R10 / Section 18 (Analytics Event Pipeline & Cohort Models)
have been mined from the authoritative source (`Project_Empire_Master_Blueprint_v1.0.docx`) and documented in full detail in `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey_1\spec_report.md`.

---

## 5. Verification Method

To independently verify these findings:
1. Inspect the extracted specifications in `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey_1\spec_report.md`.
2. Inspect the extracted raw blueprint text at `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey_1\blueprint_text.txt`.
3. Verify existing project tests pass:
   ```powershell
   pnpm test
   pnpm typecheck
   pnpm lint
   ```
4. Verify event list against Blueprint Section 18 (lines 702–707 of `blueprint_text.txt`).
