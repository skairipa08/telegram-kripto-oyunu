# Plan - R9 Anti-Fraud and Reward Review System

## Overview
Implement an independent, production-grade Anti-Fraud and Reward Review System for Project Empire.
Strict boundary rules:
- Strictly DO NOT TOUCH:
  - `supabase/migrations/202609140007_game_loop_apis.sql`
  - `apps/api/src/auth/test-db.ts`
  - `apps/api/src/economy/**`
  - `apps/web/src/game/**`
  - `apps/web/src/screens/**`, CSS
  - `apps/api/src/shop/**`
- Use `supabase/migrations/202609140008_anti_fraud.sql` for migration.
- Test database environment must match real migration (no test-only compatibility columns).
- All 252 existing tests must continue to pass and `pnpm check` must pass (exit code 0).

## Execution Phases
1. **Phase 0: Multi-Explorer Survey**
   - Explorer 1: Inspect `packages/game-core` (modules, types, referral, economy velocity calculations, existing tests).
   - Explorer 2: Inspect `apps/api` (Fastify/Express server routing, authentication middleware, admin roles, DB connection).
   - Spec Miner: Inspect database migrations (player tables, balance ledger, audit tables, RLS patterns, functions).
2. **Phase 1: Architecture Specification (`PROJECT.md`)**
   - Synthesize survey findings.
   - Define exact interfaces, schemas, reason codes, risk scoring formulas, API endpoints.
3. **Milestone 1: Core Scoring Engine (`packages/game-core`)**
   - Fraud detection signals & scoring engine with explainable reason codes.
   - Comprehensive unit tests.
4. **Milestone 2: Database Migration (`202609140008_anti_fraud.sql`)**
   - Tables: `fraud_flags`, `frozen_rewards`, `admin_roles`.
   - RLS policies (service_role only).
   - Stored procedures/functions for flag creation, reward freezing, admin review, and audit logging.
5. **Milestone 3: Admin Review, Decision & Audit APIs (`apps/api`)**
   - RBAC middleware verifying active admin role.
   - `GET /admin/fraud/flags`, `GET /admin/fraud/frozen`, `POST /admin/fraud/review`.
   - Atomic reward unfreezing & ledger crediting on approve; cancellation on reject.
   - Audit logging in `admin_audit_logs`.
6. **Milestone 4: Independent Test Database Harness & Integration Tests**
   - Independent test harness `apps/api/src/fraud/test-db.ts` running real migrations without modifying `apps/api/src/auth/test-db.ts`.
   - Comprehensive integration tests for all admin endpoints, RBAC (401/403), review actions, edge cases.
7. **Milestone 5: Verification & Quality Gate**
   - Run all existing tests (ensure >= 252 pass) and all new tests.
   - Run `pnpm check` typecheck and linting.
   - Reviewer, Challenger, and Forensic Auditor verification.
8. **Milestone 6: HANDOFF.md & Sentinel Report**
