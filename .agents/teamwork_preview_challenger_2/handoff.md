# STREAM 2 EMPIRICAL CHALLENGE REPORT

**Reviewer**: `teamwork_preview_challenger_2` (EMPIRICAL CHALLENGER: critic, specialist)  
**Target Milestone**: Stream 2 Frontend & Arcade Verification  
**Working Directory**: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_challenger_2`  
**Verdict**: `VERDICT: REQUEST_CHANGES`

---

## 1. Observation

### 1.1 Baseline Execution
- Ran test suite on `@empire/web`:
  - Command: `pnpm vitest run apps/web`
  - Output: `Test Files: 16 passed (16) | Tests: 176 passed (176)`
  - Duration: `2.07s`
- Ran production build:
  - Command: `pnpm --filter @empire/web build`
  - Output: `dist/index.html 0.52 kB | dist/assets/index.css 92.07 kB | dist/assets/index.js 494.23 kB | built in 2.29s`
- Ran monorepo-wide typechecking:
  - Command: `pnpm typecheck`
  - Output: `Scope: 4 of 5 workspace projects, all Done with exit code 0`
- Monorepo full test execution:
  - Command: `pnpm test`
  - Output: `Test Files: 56 passed (56) | Tests: 672 passed (672)`

---

### 1.2 Vector 1: Mobile Responsiveness & Viewport Stress (320px–390px)
1. **Fixed Width Audit**:
   - `apps/web/src/components/arcade.css` was audited with regex `/(?:^|[^-])\b(?:width|min-width)\s*:\s*(\d+)px/g`.
   - Result: Zero fixed widths > 290px found. The only explicit pixel width in `arcade.css` is line 53: `width: 36px;` (for `.arcade-mute-btn`).
2. **Grid Template Verification**:
   - In `apps/web/src/components/arcade.css`:
     - Line 73: `.arcade-nav-tabs { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }`
     - Line 180: `.catizen-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }`
     - Line 436: `.cipher-grid-v2 { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }`
     - Line 956: `@media (max-width: 359px) { .arcade-nav-tabs { gap: 4px; } .catizen-grid { gap: 4px; } }`
   - Geometric calculation on 320px screen:
     - Outer container padding: 12px left + 12px right = 24px total (`padding: 12px;` at `<=520px`).
     - Available width: `320px - 24px = 296px`.
     - Catizen grid: 4 columns, 3 gaps of 4px = 12px. Each slot is `(296 - 12) / 4 = 71px`. Total width = `296px + 24px = 320px` (zero horizontal overflow).
     - **Defect 1.1 (Deviation from requirement)**: The requirement states: *"Verify that all grids use repeat(N, minmax(0, 1fr)) with percentage/clamp gaps."* The implementation uses fixed pixel gaps (`6px`, `8px`, `12px` and `4px` in media queries) instead of fluid CSS `clamp(min, val, max)` or percentage gaps (e.g. `gap: clamp(4px, 1.5vw, 8px);`).
3. **Interactive Touch Target Audit (< 44px)**:
   - Evaluated against WCAG 2.1 Success Criterion 2.5.5 and Apple HIG (minimum 44x44px touch targets):
     - `.catizen-slot`: 71x71px on 320px (>= 44px, PASS).
     - `.cipher-node-btn`: 142x101px on 320px (>= 44px, PASS).
     - `.tap-coin-target`: `clamp(170px, 48vw, 220px)` (>= 170px, PASS).
     - `.crash-main-btn`: ~48px rendered height (>= 44px, PASS).
     - **Defect 1.2 (Touch Target Violations)**:
       - `apps/web/src/components/arcade.css:53-54`: `.arcade-mute-btn { width: 36px; height: 36px; }` (36px < 44px).
       - `apps/web/src/components/arcade.css:160`: `.catizen-auto-btn { padding: 6px 10px; font-size: 0.75rem; }` (~26px total height < 44px).
       - `apps/web/src/components/arcade.css:894`: `.crash-chip-btn { padding: 6px 4px; font-size: 0.75rem; }` (~24px total height < 44px).
       - `apps/web/src/components/arcade.css:300`: `.catizen-controls button { padding: 10px 12px; font-size: 0.85rem; }` (~38px total height < 44px).
       - `apps/web/src/components/notcoin-tap-game.tsx:327`: `.tap-upgrade-actions button { padding: 6px 10px; font-size: 0.75rem; }` (~28px total height < 44px).

---

### 1.3 Vector 2: Adversarial Interaction & State Handling
1. **Catizen Merge (`catizen-merge-model.ts` & `catizen-merge-game.tsx`)**:
   - Invalid drag onto different tier: `moveOrSwapSlot` cleanly swaps positions without losing item IDs or corrupting tiers.
   - Invalid drag onto parcel: `moveOrSwapSlot` cleanly swaps parcel with item without corrupting parcel state.
   - Drag onto empty slot: moves item and sets origin to null.
   - Out-of-bounds drag: returns `null`, leaving board unchanged.
   - Max-tier merge (Tier 12 with Tier 12): does not merge past 12; swaps slots instead.
   - Fuzzer: 500 randomized operations (spawns, parcel opens, auto-merges, drag swaps) preserved board length = 12, valid types (`item`/`parcel`), valid tiers [1..12], and non-negative DPS.
   - **Minor observation (`catizen-merge-game.tsx:102-120`)**: In `autoBotTimerRef.current`, `onReward(merged.reward)`, `setLastMergedTier`, and `setToastMessage` are called inside the functional updater of `setBoard((currentBoard) => ...)`. While functioning synchronously in node, calling external `onReward` or sibling setState within a state updater is an anti-pattern in React Concurrent/StrictMode.
2. **Notcoin Tap (`notcoin-tap-model.ts` & `notcoin-tap-game.tsx`)**:
   - Rapid clicks at 0 energy: 1,000 simulated clicks on `performTap` with 0 energy returned `null` for every click. Energy remained at 0 (never negative). `totalCoinsEarned` and `totalTaps` did not increase.
   - Energy regeneration cap: 1,000,000 simulated seconds did not exceed `maxEnergy`.
   - Offline TapBot math: strictly caps at `offlineLimitHours * 3600` seconds; yields 0 coins when TapBot is locked.
   - Upgrade formulas: cleanly cap at level 10 (multitap/capacity), level 5 (recharge), and 24h (offline extender) by returning `null`.
   - **Minor observation (`notcoin-tap-game.tsx:112-116`)**: In `handleCoinTap`:
     ```tsx
     function handleCoinTap(e: React.PointerEvent<HTMLDivElement>) {
       const result = performTap(tapState);
       if (!result) return;
       setTapState(result.nextState);
       if (onReward) onReward(result.coinsEarned);
     ```
     `performTap(tapState)` reads from the closed-over `tapState`. If multi-touch fires 2 or 3 pointer events within the same frame before re-render, both events read the same `tapState.currentEnergy`, potentially firing multiple `onReward` calls for a single unit of energy.
3. **Dynasty Cipher (`dynasty-cipher-game.tsx` & `arcade-game-model.ts`)**:
   - Monotonic combo progression tested and verified: `1.0 -> 1.5 -> 2.0 -> 3.0 -> 5.0 -> 5.0`.
   - Sequence generation correctly bounds cyber node indices to [0..3].
   - Unmount cleanup in `dynasty-cipher-game.tsx:43-48`:
     ```tsx
     useEffect(() => {
       return () => {
         timers.current.forEach(window.clearTimeout);
         if (countdownIntervalRef.current)
           clearInterval(countdownIntervalRef.current);
       };
     }, []);
     ```
     Timers and countdown interval are cleared on unmount.
4. **Crypto Crash (`crypto-crash-game.tsx` & `crypto-crash-model.ts`)**:
   - Multiplier math: starts at 1.00x, monotonically non-decreasing over time with 2-decimal resolution.
   - Provably fair crash point: 10,000 iterations strictly bounded between 1.00x and 100.00x.
   - Tiers classified properly (<2.0 bear, 2.0..9.99 bull, >=10.0 moon).
   - Candlestick wicks satisfy high >= max(open, close) and low <= min(open, close).
   - **CRITICAL DEFECT 2.1 — Countdown Timer Leak on Unmount (`crypto-crash-game.tsx:216-240`)**:
     ```tsx
     function handleStartRound() {
       ...
       setPhase('countdown');
       setCountdown(3);

       const countTimer = setInterval(() => {
         setCountdown((prev) => {
           if (prev <= 1) {
             clearInterval(countTimer);
             startRunningGame(targetCrash);
             return 0;
           }
           return prev - 1;
         });
       }, 800);
     }
     ```
     `countTimer` is created as a local variable. It is **NOT** stored in a `useRef` and **NOT** cleared in `useEffect(() => { return () => ... }, [])`.
     If the user clicks "BOĞA BAŞLAT" and switches tabs in `EmpireArcade` within 2.4 seconds, `countTimer` continues firing in the background. When `prev <= 1`, it invokes `startRunningGame(targetCrash)` on an unmounted component, which launches an orphaned `requestAnimationFrame(loop)` that permanently leaks CPU cycles and attempts state updates on an unmounted component!
   - **CRITICAL DEFECT 2.2 — Cash Out Double-Payout Race Condition (`crypto-crash-game.tsx:242-252`)**:
     ```tsx
     function handleCashOut() {
       if (phase !== 'running') return;

       const securedMult = multiplier;
       setCashOutMultiplier(securedMult);
       setPhase('cashed_out');

       const payout = calculateCrashPayout(stake, securedMult);
       playWinSound();
       hapticSuccess();
       if (onReward) onReward(payout);
     }
     ```
     The only guard in `handleCashOut` is `if (phase !== 'running') return;`.
     Because `phase` is React state (`useState`), it is updated asynchronously. There is **no synchronous ref guard** (such as `const cashedOutRef = useRef(false)`).
     When a player rapidly double-clicks or multi-taps the "KÂRI AL" button before React re-renders the component with `phase = 'cashed_out'`, both events evaluate `phase === 'running'` as `true`, both execute `onReward(payout)`, and the player receives **DOUBLE** the payout!
   - **HIGH DEFECT 2.3 — Crash Window Exploit**:
     In the animation loop:
     ```tsx
     if (currentMult >= targetCrash) {
       setMultiplier(targetCrash);
       ...
       setPhase('crashed');
       return;
     }
     ```
     There is no shared boolean ref (e.g. `isFinishedRef.current = true`) between the animation loop and `handleCashOut`. If the market crashes and the user clicks "KÂRI AL" in the 16ms window before React renders the crashed state, `handleCashOut` executes, setting `phase = 'cashed_out'` and rewarding the player for a crashed round.

---

### 1.4 Vector 3: Audio Synthesizer & Telegram Haptics
1. **Web Audio Synthesizer (`arcade-audio.ts`)**:
   - Mute handling: when `isMuted() === true`, all sound functions (`playTapSound`, `playCritSound`, `playMergeSound`, `playUnboxSound`, `playCipherKeySound`, `playDecryptPulseSound`, `playCrashSound`, `playWinSound`, `playErrorSound`) execute `if (muted) return;` at line 1.
   - Headless / Un-interacted safety: `getAudioContext()` catches constructor errors. In `getAudioContext()`, `audioCtx.resume().catch(() => {})` prevents `UnhandledRejection` errors. All Web Audio node connections and starts are enclosed in `try/catch`.
2. **Telegram Haptics (`arcade-haptics.ts`)**:
   - Undefined Telegram fallback: safely checks `window.Telegram?.WebApp?.HapticFeedback`. If undefined, it falls back to `fallbackVibrate(...)` which verifies `typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'`.
   - Confirmed in tests: when `window.Telegram` is mocked, all actions (`hapticTap`, `hapticCrit`, `hapticMerge`, `hapticSuccess`, `hapticError`, `hapticCrash`) call `impactOccurred`, `notificationOccurred`, and `selectionChanged` with exact parameters.

---

## 2. Logic Chain

1. **Premise**: Financial games on mobile Telegram WebApps must guarantee strict transactional integrity, prevent double payouts on rapid user clicks, prevent unmounted memory leaks, and adhere to touch target standards (>= 44px).
2. **Defect 2.1 Logic**: In `CryptoCrashGame`, `countTimer` is created inside `handleStartRound` via `setInterval` without saving to `useRef`. The component's unmount cleanup only cancels `animFrameRef.current`. When a user navigates away during the 3-second countdown, the countdown callback fires 2.4 seconds later on an unmounted component and calls `startRunningGame()`, starting an orphaned `requestAnimationFrame` loop.
3. **Defect 2.2 Logic**: `handleCashOut()` relies entirely on React state `phase === 'running'`. In browser environments, two pointer/click events can fire within a few milliseconds (well under React's 16ms render frame). Because the first click's `setPhase('cashed_out')` has not yet triggered a render commit, the second click reads the same closure where `phase === 'running'`. Consequently, `onReward(payout)` is invoked twice, resulting in a duplicate payout exploit.
4. **Defect 1.2 Logic**: WCAG 2.1 SC 2.5.5 and Telegram Mini App UI guidelines mandate minimum 44x44px touch targets. Five interactive controls in `arcade.css` (`.arcade-mute-btn` at 36px, `.catizen-auto-btn` at ~26px, `.crash-chip-btn` at ~24px, `.catizen-controls button` at ~38px, and `.tap-upgrade-item button` at ~28px) are undersized, increasing miss-tap rates on 320px–390px phone screens.
5. **Conclusion**: While all tests pass, the mathematical models are solid, and the build succeeds, the double-crediting race condition, the timer leak on unmount, and the sub-44px touch targets constitute legitimate flaws that require remediation before release.

---

## 3. Caveats

- **No Caveats**: All 4 game models, styling rules, sound synthesis, haptic integrations, and screen wrappers were empirically tested.
- 31 automated challenger tests were added to `apps/web/src/game/arcade-stream2-challenger.test.ts` and pass with 0 errors, with Prettier and ESLint 100% clean.

---

## 4. Conclusion & Required Changes

**VERDICT: REQUEST_CHANGES**

To achieve production readiness and receive approval, the following concrete fixes must be implemented:

### Change 1: Fix CryptoCrash Timer Leak on Unmount
In `apps/web/src/components/crypto-crash-game.tsx`:
1. Add `const countTimerRef = useRef<number | null>(null);`
2. In `handleStartRound()`: store the interval in `countTimerRef.current = window.setInterval(...)`
3. In the unmount `useEffect`:
   ```tsx
   useEffect(() => {
     return () => {
       if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
       if (countTimerRef.current) clearInterval(countTimerRef.current);
     };
   }, []);
   ```

### Change 2: Fix CryptoCrash Double Cashout Race Condition
In `apps/web/src/components/crypto-crash-game.tsx`:
1. Add a synchronous ref guard: `const hasCashedOutRef = useRef(false);`
2. In `handleStartRound()`: reset `hasCashedOutRef.current = false;`
3. In `handleCashOut()`:
   ```tsx
   function handleCashOut() {
     if (phase !== 'running' || hasCashedOutRef.current) return;
     hasCashedOutRef.current = true;
     ...
   ```
4. In `startRunningGame()` animation loop: when `currentMult >= targetCrash`, set `hasCashedOutRef.current = true;` before `setPhase('crashed')` to eliminate the post-crash cashout window.

### Change 3: Improve Mobile Touch Target Ergonomics
In `apps/web/src/components/arcade.css`:
1. Update `.arcade-mute-btn`: change `width: 36px; height: 36px;` to `min-width: 44px; min-height: 44px;`.
2. Update `.catizen-auto-btn`: set `min-height: 44px; display: inline-flex; align-items: center; justify-content: center;`.
3. Update `.crash-chip-btn`: set `min-height: 44px; display: flex; align-items: center; justify-content: center;`.
4. Update `.catizen-controls button`: set `min-height: 44px;`.
5. Update grid gaps to use `gap: clamp(4px, 1.5vw, 8px);` for fluid scaling.

---

## 5. Verification Method

To independently verify all findings and reproduction tests:

1. **Run Monorepo Full Verification Suite**:
   ```bash
   pnpm test
   ```
   *Expected Output: 56 test files passed, 672 passed tests.*

2. **Run Stream 2 Challenger Adversarial Probes**:
   ```bash
   pnpm vitest run apps/web/src/game/arcade-stream2-challenger.test.ts
   ```
   *Expected Output: 31 passed tests verifying mobile geometry, fuzzer, audio safety, and defect probes.*

3. **Run Web Production Build**:
   ```bash
   pnpm --filter @empire/web build
   ```
   *Expected Output: Built in ~2.3s with exit code 0.*

4. **Verify TypeScript & Linting**:
   ```bash
   pnpm typecheck
   pnpm eslint apps/web/src
   pnpm prettier --check apps/web/src
   ```
   *Expected Output: Zero type errors, zero lint errors, 100% formatted.*