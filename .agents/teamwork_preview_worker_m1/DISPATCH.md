# Dispatch for teamwork_preview_worker_m1

You are teamwork_preview_worker_m1.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_m1
Parent Orchestrator: teamwork_preview_orchestrator_1

Read c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md.
Read c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_1\PROJECT.md.
Read Explorer reports:
- c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_spec_miner_survey_1\spec_report.md
- c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey_2\codebase_report.md
- c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_survey_3\testing_report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope Boundaries (R5):
- Do NOT create or modify UI/UX visual components or CSS styles (reserved for Astra 6.0). apps/web must NOT be modified (except if shared imports require it, but no visual/CSS changes).
- Do NOT alter anti-cheat/anti-fraud algorithms, exploit testing, or external auth penetration hardening (reserved for Astra 6.0).
- Implement only pure formulas in packages/game-core, DTO schemas in packages/shared, SQL migrations in supabase/migrations/, and backend routes in apps/api.

Deliverables:
1. Update .prettierignore to ignore .agents and ORIGINAL_REQUEST.md so prettier checks pass cleanly.
2. Migration: supabase/migrations/202609140005_step7_to_11_backend.sql
   - season_scores composite index on (season_id, points DESC, updated_at ASC, user_id ASC)
   - season_archives table
   - purchases table (unique telegram_payment_charge_id)
   - player_entitlements table
   - admin_audit_logs table
   - analytics_events & daily_metrics tables
   - Seed missing Section 18 economy_config keys (20 keys total)
3. packages/shared/src/index.ts:
   - DTO schemas for Leaderboard, Monetization, Remote Config, Analytics
4. packages/game-core/src/:
   - leaderboard.ts & leaderboard.test.ts (deterministic tie-breaking, pagination, rank pinning, season freeze, 100% test coverage)
   - monetization.ts & monetization.test.ts (convenience pass 12h cap, 3 queue slots, additive 30-day pass stacking, anti-P2W guardrails)
   - remote-config.ts & remote-config.test.ts (2-tier fallback resolver, feature flag evaluator defaulting feature.token to false)
   - analytics.ts & analytics.test.ts (21-event taxonomy validator, UTC-day normalized D1/D2/D7 retention models, activation, payer conversion, ARPPU)
   - index.ts exports
5. apps/api/:
   - Implement route handlers and store adapters for leaderboard, shop, config, analytics
   - Mount routes in apps/api/src/index.ts
   - Write integration tests using PGlite
6. Verification & Root HANDOFF:
   - Run tests, linter, typechecker, build, and pnpm check. Ensure pnpm check exits with code 0!
   - Write c:\Users\Administrator\Desktop\telegram kripto oyunu\HANDOFF.md documenting step-by-step progress and verification.
   - Write c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_m1\handoff.md following Handoff Protocol.
