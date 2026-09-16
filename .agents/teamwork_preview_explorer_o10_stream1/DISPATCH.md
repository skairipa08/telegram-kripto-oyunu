## 2026-09-16T12:44:19Z

You are Explorer Stream 1.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_o10_stream1
Please maintain your progress in progress.md inside your directory.

MANDATORY FIRST STEP: Read the user request at:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md under timestamp ## 2026-09-16T12:42:13Z.

Your Scope: Stream 1 - Core Math, Adaptive Crash Engine & Streak Milestones:
- Target files: `packages/game-core/src/crypto-crash.ts`, `packages/game-core/src/missions.ts`, `apps/api/src/arcade/` (and related tests in `packages/game-core/test/` or similar).

Your Mission:
1. Thoroughly examine the existing implementation of `crypto-crash.ts`, `missions.ts`, and arcade API endpoints.
2. Analyze how crash points and rounds are currently generated and handled.
3. Analyze how streak milestones and streak rewards are currently calculated and structured.
4. Architect the exact mathematical specification for:
   - Free-range stake validation ($10 \le \text{stake} \le \text{userBalance}$).
   - Adaptive crash algorithm: tracks player recent average stake and win streaks; preserves high win engagement during normal/modest bets; when player spikes stake (e.g. >2.5x average or large jump after consecutive wins), increases probability of low-multiplier crash (<1.5x) to prevent house bleed and guarantee long-term house advantage. Specify the mathematical formula and state tracking structure.
   - Streak milestone calculator: adds 7-day (1.0x SRU + 500 Cash), 30-day (2.5x SRU + 5,000 Cash), 90-day (5.0x SRU + 25,000 Cash), 180-day (10.0x SRU + 100,000 Cash), and 365-day (25.0x SRU + 500,000 Cash + "İmparatorluk Kıdemlisi" Badge) milestones with escalating exponential Cash and Season Point multipliers.
5. Identify all tests that touch these modules and determine what new tests/fuzzing will be required.
6. Write your comprehensive analysis and architectural implementation blueprint to `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_o10_stream1\handoff.md`.
7. Send a message to parent notifying that your report is ready.
