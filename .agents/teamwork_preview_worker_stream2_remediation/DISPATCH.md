## 2026-09-16T11:49:15Z
You are teamwork_preview_worker_stream2_remediation.
Your working directory is: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream2_remediation
Your identity: teamwork_preview_worker_stream2_remediation
Authoritative User Request: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md (MUST read the entire file, especially the latest section dated 2026-09-16T11:18:25Z).
Master Project Architecture: c:\Users\Administrator\Desktop\telegram kripto oyunu\PROJECT.md
Challenger 2 Report with Exact Defect Specifications: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_challenger_2\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE FILE OWNERSHIP (Only modify these files):
- apps/web/src/components/crypto-crash-game.tsx
- apps/web/src/components/arcade.css
- apps/web/src/components/catizen-merge-game.tsx
- apps/web/src/components/notcoin-tap-game.tsx

OBJECTIVE & EXACT CHANGES REQUIRED:
1. Fix `apps/web/src/components/crypto-crash-game.tsx`:
   a) Timer Leak on Unmount:
      - Add a ref: `const countTimerRef = useRef<number | null>(null);`
      - In `handleStartRound()`: store interval in `countTimerRef.current = window.setInterval(...)`
      - In unmount `useEffect`:
        ```tsx
        useEffect(() => {
          return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            if (countTimerRef.current) clearInterval(countTimerRef.current);
          };
        }, []);
        ```
   b) Cash Out Double-Payout Race Condition:
      - Add synchronous ref guard: `const hasCashedOutRef = useRef(false);`
      - In `handleStartRound()`: reset `hasCashedOutRef.current = false;`
      - In `handleCashOut()`:
        ```tsx
        function handleCashOut() {
          if (phase !== 'running' || hasCashedOutRef.current) return;
          hasCashedOutRef.current = true;
          ...
        }
        ```
   c) Post-Crash Cashout Race Window:
      - In `startRunningGame()` animation loop: when `currentMult >= targetCrash`, set `hasCashedOutRef.current = true;` before calling `setPhase('crashed')`.
2. Fix `apps/web/src/components/notcoin-tap-game.tsx`:
   - In `handleCoinTap`: protect against multi-touch race condition on `currentEnergy` by using a functional state updater or ref guard so multiple simultaneous pointer events in the same frame don't double-reward from the same energy unit.
3. Fix Mobile Touch Target Ergonomics & Fluid Gaps in `apps/web/src/components/arcade.css`:
   - `.arcade-mute-btn`: change `width: 36px; height: 36px;` to `min-width: 44px; min-height: 44px;`
   - `.catizen-auto-btn`: add `min-height: 44px; display: inline-flex; align-items: center; justify-content: center;`
   - `.crash-chip-btn`: add `min-height: 44px; display: flex; align-items: center; justify-content: center;`
   - `.catizen-controls button`: add `min-height: 44px;`
   - `.tap-upgrade-item button`, `.tap-upgrade-actions button`: ensure minimum 44px touch height.
   - Update grid gaps in `.arcade-nav-tabs`, `.catizen-grid`, `.cipher-grid-v2` to use fluid `gap: clamp(4px, 1.5vw, 8px);` for responsive scaling.
4. Verify all tests and builds:
   - `pnpm vitest run apps/web`
   - `pnpm --filter @empire/web build`
   - `pnpm eslint apps/web/src`
   - `pnpm prettier --check apps/web/src`
5. Write your handoff report to:
   `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_worker_stream2_remediation\handoff.md`
When done, message the orchestrator.
