## 2026-09-16T12:49:15Z
You are Worker Stream 2 (Frontend Risk Game & Streak Milestone UI).
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_o10_stream2
Please maintain your progress in progress.md inside your directory.

MANDATORY FIRST STEP: Read the user request at:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md under timestamp ## 2026-09-16T12:42:13Z.
Read the Stream 2 Explorer handoff report at:
c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_o10_stream2\handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Exclusive File Ownership:
- `apps/web/src/components/crypto-crash-game.tsx`
- `apps/web/src/screens/missions-screen.tsx`
- `apps/web/src/components/arcade.css`
- (and relevant test files in `apps/web/` if needed)
(DO NOT TOUCH `packages/game-core/` or `apps/api/` - that belongs exclusively to Worker Stream 1).

Tasks:
1. `crypto-crash-game.tsx`:
   - Replace/enhance fixed chip buttons with an interactive numeric input box alongside quick chips (+10, +50, +100, +250, +500, MAKS).
   - Use dual-state tracking (`rawStakeInput` string buffer + `stake` number) so users can freely type any number with instant real-time validation ($10 \le \text{stake} \le \text{playerCash}$).
   - Add real-time validation error/feedback message (e.g. min 10 Nakit, insufficient balance) and disable start button if invalid.
   - On chip click or MAKS click, update input buffer and confirmed stake synchronously.
   - Retain all existing countdown/cashout refs (`countTimerRef`, `hasCashedOutRef`).
2. `missions-screen.tsx`:
   - Add the extended streak milestone visual track (`missions-milestones-track`) displaying 7-day, 30-day, 90-day, 180-day, and 365-day claim targets with milestone badge rewards (including "İmparatorluk Kıdemlisi" at 365 days).
   - Display progress percentages, remaining day counts, reward pills, and status tags (✓ AÇILDI, HEDEF, 🔒 KİLİTLİ).
3. `arcade.css`:
   - Add styling for the custom stake input, chips row, and extended streak milestone visual track.
   - STRICT MOBILE & CHALLENGER INVARIANTS:
     - NO fixed `width` or `min-width` > 290px anywhere in `arcade.css`.
     - ALL `grid-template-columns` MUST strictly match `repeat(N, minmax(0, 1fr))`.
     - All interactive touch targets (buttons, inputs) must have `min-height: 44px`.
     - Fluid grid gap `clamp(4px, 1.5vw, 8px)` or percentage.
     - Flawless mobile rendering on 320px–390px screens with zero horizontal overflow.
4. Tests:
   - Run `pnpm --filter @empire/web test` and specifically verify:
     - `apps/web/src/screens/arcade-screen.test.tsx` (passes all chip checks +50, +100, +250, +500, MAKS)
     - `apps/web/src/game/arcade-stream2-challenger.test.ts` (passes all layout and responsive invariants)
     - `apps/web/src/game/live-game-screens.test.tsx`
5. Document all code changes and test execution output in `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_o10_stream2\handoff.md`.
6. Send a message to parent when done.
