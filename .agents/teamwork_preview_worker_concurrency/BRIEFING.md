# BRIEFING — 2026-09-15T12:06:17Z

## Mission
Implement PostgreSQL Concurrency Test Suite and 100+ Player Load Stress Benchmark for Project Empire (Milestone M4 / Requirement R4).

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_concurrency
- Original parent: 3219366b-6e17-4215-806c-8fc42e4d3c7f
- Milestone: M4 (PostgreSQL Concurrency Test Suite and 100+ Player Load Stress Benchmark)

## 🔒 Key Constraints
- Exclusive write ownership:
  - `apps/api/src/launch/test-db.ts`
  - `apps/api/src/launch/concurrency.test.ts`
  - `scripts/load-benchmark.ts`
  - `package.json` (adding `"test:load": "tsx scripts/load-benchmark.ts"`)
  - `PROJECT.md` (sync milestones/status)
- DO NOT touch any files in `apps/web/src/screens/**` or `apps/api/src/auth/test-db.ts`.
- Genuine implementation only, no mock shortcuts or hardcoded test results.

## Current Parent
- Conversation ID: 3219366b-6e17-4215-806c-8fc42e4d3c7f
- Updated: not yet

## Task Summary
- **What to build**:
  1. `apps/api/src/launch/test-db.ts`: PGlite test harness dynamically running migrations 0001 through 0009, mock PostgREST fetcher and transaction handles.
  2. `apps/api/src/launch/concurrency.test.ts`: 20+ parallel racing requests against real PGlite/Postgres transactions testing balance consistency, streak claims, mission claims, referral bindings.
  3. `scripts/load-benchmark.ts`: 100+ virtual concurrent player interleaved game loop stress benchmark with RPS, p50/p95/p99 latency reporting and connection stability.
  4. Update `package.json` to add `"test:load"`.
  5. Sync `PROJECT.md`.
- **Success criteria**:
  - `pnpm vitest run apps/api/src/launch/concurrency.test.ts` passes (all 4 suites).
  - `pnpm test:load` completes with 100 concurrent players and 0 unhandled errors.
- **Interface contracts**: PROJECT.md & handoff.md from spec miner.
- **Code layout**: apps/api/src/launch/ & scripts/

## Change Tracker
- **Files modified**: none yet
- **Build status**: pending
- **Pending issues**: none

## Quality Status
- **Build/test result**: pending
- **Lint status**: pending
- **Tests added/modified**: pending

## Loaded Skills
- None specified in prompt.

## Key Decisions Made
- [TBD]

## Artifact Index
- [TBD]
