# Dispatch Log

## 2026-09-16T12:43:29Z

You are the Project Orchestrator (Orchestrator 10).
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_10
Store all your coordination files (plan.md, progress.md, context.md, handoff.md) in this folder.

Your authoritative user request is in:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md (and c:\Users\Administrator\Desktop\telegram kripto oyunu\ORIGINAL_REQUEST.md) under timestamp ## 2026-09-16T12:42:13Z.

Here is the exact task specification:

# Teamwork Project Prompt — Draft
Goal: Execute prompt via teamwork_preview multi-agent system
Requested team: Maximum 2 concurrent agents with strict domain isolation (Core Math & API vs. Frontend UI Components)

Implement free-text custom stake inputs in the Risk (Crypto Crash) game, integrate a dynamic adaptive house-edge/baiting curve (encouraging small wins but punishing sudden high-roller spikes), and extend daily login streaks with exponential milestone bonuses for 7 days, 30 days, 90 days, 180 days, and 365 days.

Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu
Integrity mode: demo

## Architecture & Agent Boundary Constraints (Max 2 Concurrent Agents)
To conserve tokens and prevent context pollution:

1. **Stream 1 - Core Math, Adaptive Crash Engine & Streak Milestones**:
   - Scope: `packages/game-core/src/crypto-crash.ts`, `packages/game-core/src/missions.ts`, `apps/api/src/arcade/`
   - Responsibilities:
     - Free-range stake validation (min 10, max user balance).
     - Adaptive crash algorithm: tracks player recent average stake and win streaks; when player bets normal/modest amounts, preserves high win engagement; when player spikes stake (e.g. >2.5x average or large jump after consecutive wins), increases probability of low-multiplier crash (<1.5x) to prevent house bleed and guarantee long-term house advantage.
     - Streak milestone calculator: adds 7-day, 30-day (1 month), 90-day (3 months), 180-day (6 months), and 365-day (1 year) milestones with escalating exponential Cash and Season Point multipliers.
2. **Stream 2 - Frontend Risk Game & Streak Milestone UI**:
   - Scope: `apps/web/src/components/crypto-crash-game.tsx`, `apps/web/src/screens/missions-screen.tsx`, `apps/web/src/components/arcade.css`
   - Responsibilities:
     - Editable numeric input box in Crypto Crash game alongside quick-chip buttons, allowing free typing of any stake amount with instant validation.
     - Extended streak milestone visual track on Missions/Streak screen displaying 7-day, 30-day, 90-day, 180-day, and 365-day claim targets with milestone badge rewards.
     - Responsive mobile styling (320px–390px) without layout overflow.

---

## Requirements

### R1. Risk Game Custom Free Stake Input
- Replace/enhance fixed chip buttons in `CryptoCrashGame` with an interactive number input:
  - Players can type any amount directly (e.g. 250, 1500, 10000) or tap quick chips (+10, +50, +100, MAKS).
  - Validates boundaries in real-time ($10 \le \text{stake} \le \text{playerCash}$).

### R2. Adaptive Crash / Baiting Math Engine
- Update crash point generation to model realistic psychological casino dynamics:
  - Under baseline/modest stakes, maintain high perceived RTP and frequent green runs.
  - When player suddenly increases bet (stake $> 2.5\times$ baseline) or bets high after a win streak, dynamically bias crash distribution toward early dumps ($1.00\times - 1.45\times$), ensuring the house retains long-term profitability.

### R3. Extended Daily Streak Milestones (7d, 30d, 90d, 180d, 365d)
- Expand streak system beyond 7 days with compounding milestone bonuses:
  - Day 7: 1.0x SRU + 500 Cash
  - Day 30 (1 Ay): 2.5x SRU + 5,000 Cash
  - Day 90 (3 Ay): 5.0x SRU + 25,000 Cash
  - Day 180 (6 Ay): 10.0x SRU + 100,000 Cash
  - Day 365 (1 Yıl): 25.0x SRU + 500,000 Cash + "İmparatorluk Kıdemlisi" Badge
- Update streak UI to visually showcase upcoming and unlocked long-term milestones.

---

## Acceptance Criteria

### Risk Game
- [ ] Number input allows typing any custom stake with immediate validation and clamping.
- [ ] Adaptive crash engine fuzzed: small steady stakes yield high win frequency, sudden spike bets trigger house edge correction.

### Streak Milestones
- [ ] Milestone rewards calculated accurately for 7, 30, 90, 180, and 365 days.
- [ ] UI displays milestones progress clearly on mobile (320px–390px).

### Quality Gates
- [ ] `pnpm check` passes with 0 errors (lint, format:check, typecheck, tests, build).
- [ ] `HANDOFF.md` updated with new features and tests.

---

## Operating Instructions
- You manage workers and reviewers. Maximum 2 concurrent agents.
- Continuously update your `progress.md` file in your working directory.
- When done and all quality gates pass, report back to Sentinel via send_message with a comprehensive victory claim.
