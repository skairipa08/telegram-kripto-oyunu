# Execution Plan: Project Empire Testing & Quality Verification

## Architecture & Concurrency Constraint
- Two isolated streams: Stream 1 (Math & Game Engine) and Stream 2 (API, Zod & Health Gate).
- STRICT CONSTRAINT: At most 2 concurrent subagents active at any given moment.

## Phase 1: Survey & Codebase Exploration (Max 2 concurrent agents)
- Dispatch Explorer 1: Stream 1 (Mines, Predictions, Crash, Turnover/Commission, Streak Math & existing test suites).
- Dispatch Explorer 2: Stream 2 (Missions, Streak API, Zod schemas, Referral endpoints, current monorepo typecheck/lint/test health).
- Synthesize gap analysis and failure inventory.

## Phase 2: Implementation & Remediation (Max 2 concurrent agents)
- Dispatch Worker 1: Stream 1 test implementation (`packages/game-core` and mini-game models).
- Dispatch Worker 2: Stream 2 API route & Zod schema alignment, plus fixing any monorepo check failures.
- Verify test passes for each stream.

## Phase 3: Adversarial Challenge & Forensic Audit (Max 2 concurrent agents)
- Dispatch Challenger: Stress test math boundaries, random seed distributions, and extreme inputs.
- Dispatch Forensic Auditor: Integrity check (ensure no hardcoded cheats, dummy facades, or suppressed checks).

## Phase 4: Full Monorepo Health Gate & Final Handoff (Single sequence)
- Monorepo gate verification: `pnpm check` (pnpm lint, format:check, typecheck, test, build).
- Update `HANDOFF.md` with complete evidence.
- Send completion message to parent sentinel.
