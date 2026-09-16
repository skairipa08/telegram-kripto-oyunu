# Plan: Risk Game Custom Stake, Adaptive Crash Engine, and Extended Streaks

## Architectural Constraints
- Maximum 2 concurrent agents running at any time.
- Strict domain isolation:
  - Stream 1: Core Math & Backend (`packages/game-core`, `apps/api`)
  - Stream 2: Web UI Components & Styling (`apps/web`)

## Phases & Milestones

### Phase 1: Exploration & Survey (Concurrency: 2)
- **Explorer Stream 1**: Inspect `packages/game-core/src/crypto-crash.ts`, `packages/game-core/src/missions.ts`, `apps/api/src/arcade/`, existing tests, formulas, state contracts.
- **Explorer Stream 2**: Inspect `apps/web/src/components/crypto-crash-game.tsx`, `apps/web/src/screens/missions-screen.tsx`, `apps/web/src/components/arcade.css`, existing UI state, responsiveness.

### Phase 2: Implementation (Concurrency: 2)
- **Worker Stream 1**:
  - Implement free-range stake validation ($10 \le \text{stake} \le \text{balance}$).
  - Implement adaptive crash algorithm (recent average stake, win streak tracking, spike punishment curve for $>2.5\times$ or large jumps).
  - Implement streak milestone calculator (7d, 30d, 90d, 180d, 365d) with exact multipliers, Cash, and "İmparatorluk Kıdemlisi" badge.
  - Add comprehensive unit and stress/fuzz tests in `packages/game-core` and verify with `pnpm test`.
- **Worker Stream 2**:
  - Add editable numeric input alongside quick chips (+10, +50, +100, MAKS) in `CryptoCrashGame`.
  - Add extended streak visual track (7d, 30d, 90d, 180d, 365d) with progress markers and milestone badges.
  - Implement responsive mobile styling (320px–390px) in `arcade.css`.

### Phase 3: Review & Empirical Verification (Concurrency: 2)
- **Reviewer**: Verify code quality, boundary handling, mathematical correctness, strict domain separation, and monorepo checks.
- **Challenger**: Run empirical fuzzing/stress tests on the adaptive crash curve and streak milestones to verify house edge stability and edge case behavior.

### Phase 4: Forensic Audit & Monorepo Gate (Concurrency: 1-2)
- **Forensic Auditor**: Verify no hardcoding, genuine math calculations, authentic implementations.
- Verification Worker: Run `pnpm check` and ensure 0 lint/format/typecheck/test/build errors.

### Phase 5: Handoff & Completion
- Update `HANDOFF.md`.
- Send victory claim to Sentinel parent.
