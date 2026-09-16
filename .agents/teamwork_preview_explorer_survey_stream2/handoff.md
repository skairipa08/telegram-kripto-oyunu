# Stream 2: Rich Interactive Frontend Mini-Games & Mini App UI — Survey & Architecture Report

## 1. Observation

### 1.1 Existing Frontend Architecture & Arcade Inventory
Direct observation of files in `apps/web/`:
- **Shell & Navigation**:
  - `apps/web/src/app.tsx:34-43`: `GameShell` is rendered upon valid player session.
  - `apps/web/src/game/live-game.tsx:158`: Active tab state is managed via `useState<GameTab>('empire')`.
  - `apps/web/src/game/types.ts:1-2`: `GameTab` is currently typed as `'empire' | 'missions' | 'friends' | 'leaderboard' | 'shop'`.
  - `apps/web/src/game/game-layout.tsx:7-13`: Desktop rail and mobile bottom navigation list the 5 tabs.
- **Current Arcade Location & Implementation**:
  - `apps/web/src/screens/empire-screen.tsx:292-297`: `<EmpireArcade preview={previewMiniGame} ... />` is embedded directly within the Empire screen between city skyline and the investment portfolio business grid.
  - `apps/web/src/components/empire-arcade.tsx:5-73`:
    - Defines `type ArcadeGame = 'mint' | 'cipher' | 'merge';`
    - Renders tab buttons for "Darphane", "Şifre", "Birleştir".
    - Contains `arcade-module-card` offering Telegram Stars assists (Hassasiyet Modülü 79⭐, Şifre Botu 99⭐, Oto Birleştirici 129⭐).
  - `apps/web/src/components/micro-games.tsx`:
    - `DynastyCipherGame` (lines 12–130): Simple memory sequence game with 4 static sigils (`◆`, `●`, `▲`, `✦`), 5 lives, setTimeout-driven flash sequence, and `extendMemorySequence`.
    - `CoinMergeGame` (lines 132–220): Flat 9-tile array board `[1, 1, 2, 2, 1, 1, 3, 3, 2]`, 20 moves limit, click-to-select, click-to-merge, static coin icon (`/assets/empire-coin-ui.png`), and simple `findMergePair` auto-merge.
  - `apps/web/src/components/mint-game.tsx:1-150`: 45-second precision timing game with rotating angle, combo strikes, and target width scoring.
  - `apps/web/src/game/arcade-game-model.ts:1-49`: Pure helper functions `memoryRewardForRound`, `extendMemorySequence`, `findMergePair`, `mergeCoinBoard`.
- **Missing / Gaps**:
  - No Notcoin tap clicker game exists anywhere in `apps/web/`.
  - No Crypto Candlestick "Moon or Doom" crash game exists anywhere in `apps/web/`.
  - No standalone `ArcadeScreen` (`apps/web/src/screens/arcade-screen.tsx`) exists; games are only accessible as an embedded widget inside `EmpireScreen`.
  - Merge game is static 3x3 with 20 moves limit, generic coin image, max level 7, no passive DPS coin generation, no periodic mystery parcels, no drag-and-drop, and no particle effects.
  - Cipher game has static 4 symbols, lacks cyberpunk terminal aesthetic, CRT scanline effects, combo streak multipliers, firewall progress gauge, audio/haptic feedback, and time-attack urgency.

### 1.2 Theming, Styling & Mobile Viewport Constraints
- **Theme Variables**:
  - `apps/web/src/styles.css:3-65`: Astra 6.0 design tokens provide `--bg: #10141d`, `--surface: #181e29`, `--surface-raised: #202736`, `--text: #f4f0e8`, `--muted: #a8b0bf`, `--accent: #e1b47e`, `--accent-ink: #352416`, `--border: rgba(150, 160, 180, 0.18)`, `--green: #7ed2ad`, `--red: #ff9e9e`, `--radius: 20px`. Light mode overrides are defined under `[data-telegram-theme='light']` and `[data-design-theme='light']`.
- **Mobile Layout Bounds (320px–390px)**:
  - `apps/web/src/styles.css:883-887`: Mobile workspace grid has `padding: 26px 20px 116px;`.
  - `apps/web/src/styles.css:1000-1003`: For `@media (max-width: 359px)`, `padding-inline: 14px;`.
  - **Net Available Content Width**:
    - At 320px: `320px - (2 * 14px) = 292px`.
    - At 360px: `360px - (2 * 20px) = 320px`.
    - At 390px: `390px - (2 * 20px) = 350px`.
  - Fixed-width elements over 290px without fluid constraints cause horizontal scroll / layout break.
- **Telegram WebApp Capabilities**:
  - `apps/web/src/telegram/types.ts:24-37`: `TelegramWebApp` interface currently defines `initData`, `colorScheme`, `themeParams`, `safeAreaInset`, `ready()`, `expand()`, `onEvent()`, `openInvoice()`. Standard `HapticFeedback` (`impactOccurred`, `notificationOccurred`, `selectionChanged`) is supported by Telegram client runtime and can be leveraged.

### 1.3 Quality Gate Baseline
- Command `vitest run` executed: **43 test files passed, 524 tests passed (0 failures)**.
- Command `pnpm build` executed: **`apps/api` (Wrangler dry-run) and `apps/web` (Vite build) exited with code 0**.
- Command `pnpm lint; pnpm format:check` executed: **0 lint errors, 100% formatted with Prettier**.

---

## 2. Logic Chain

1. **User Requirement & Scope Alignment**:
   - The authoritative prompt (2026-09-16T11:18:25Z) requires a complete revamp of the arcade suite: Catizen-style item merge overhaul, Dynasty Cipher cyber terminal revamp, Notcoin tap-to-earn game, and Crypto Candlestick "Moon or Doom" crash game.
   - Concurrency boundary strictly assigns frontend UI, components, styling, and interactions to Stream 2 (`apps/web/src/components/`, `apps/web/src/screens/`, `apps/web/src/game/`).
2. **Current Limitations -> Target Architecture**:
   - The current `CoinMergeGame` and `DynastyCipherGame` are minimal prototypes in `apps/web/src/components/micro-games.tsx`.
   - To avoid monolithic file bloat, each of the 4 games must be refactored into dedicated, modular components with decoupled pure mathematical helper models in `apps/web/src/game/`:
     - `CatizenMergeGame` in `apps/web/src/components/catizen-merge-game.tsx` + `catizen-merge-model.ts`
     - `DynastyCipherGame` in `apps/web/src/components/dynasty-cipher-game.tsx` (re-exported via `micro-games.tsx`) + `arcade-game-model.ts`
     - `NotcoinTapGame` in `apps/web/src/components/notcoin-tap-game.tsx` + `notcoin-tap-model.ts`
     - `CryptoCrashGame` in `apps/web/src/components/crypto-crash-game.tsx` + `crypto-crash-model.ts`
3. **Integration Strategy**:
   - Both embedded mode in `EmpireScreen` via `EmpireArcade` and full-screen view in a dedicated `ArcadeScreen` (`apps/web/src/screens/arcade-screen.tsx`) should be supported.
   - Existing tests referencing `micro-games.tsx` and `arcade-game-model.ts` must maintain 100% backwards-compatibility to prevent regressions.
4. **Responsive Mobile Strategy**:
   - With minimum content width of 292px on 320px screens, grid columns must be CSS Grid `repeat(N, minmax(0, 1fr))` with percentage/clamp gaps.
   - Merge board uses 4x3 (12 slots) or 3x3 (9 slots) with `aspect-ratio: 1`, ensuring touch targets are at least 65px–75px wide.
   - Tap coin uses `clamp(170px, 48vw, 220px)`.
   - Crash candlestick chart uses an auto-resizing `<canvas>` scaled by `window.devicePixelRatio` with responsive height (180px–220px), leaving ample room for stake controls and Cash Out buttons above Telegram bottom navigation.
5. **Zero-Asset Sound & Juice Strategy**:
   - Bundling external MP3/WAV audio files introduces network latency, CORS, or broken assets on Telegram mobile webviews.
   - A pure Web Audio API procedural synthesizer (`arcade-audio.ts`) provides zero-byte external overhead, instant response, and configurable tones for clicks, chimes, crits, crashes, and win fanfare.
   - Telegram `HapticFeedback` wrapper (`arcade-haptics.ts`) delivers native mobile vibration feedback with non-Telegram browser fallback (`navigator.vibrate`).
   - A lightweight Canvas / CSS particle emitter provides visual bursts on merge, crit, and crash/win.

---

## 3. Detailed Component Breakdown & Interaction Design

### Game 1: Catizen-Style Merge Overhaul (`CatizenMergeGame`)
- **Board Grid**:
  - 4x3 living grid (12 slots) or 3x3 (9 slots). 12 slots accommodates 10+ tiers smoothly without premature deadlock.
  - Slot states: `empty`, `parcel` (mystery gift crate), `item` (tier 1..10+ emblem), `drag_over` (hover highlight).
- **10+ Collectible Emblems**:
  - Tier 1: **Bronz Çip** (Bronze Chip) — +1 Cash/s
  - Tier 2: **Gümüş Külçe** (Silver Ingot) — +3 Cash/s
  - Tier 3: **Altın Kasa** (Gold Safe) — +8 Cash/s
  - Tier 4: **Platin Sunucu** (Platinum Server) — +20 Cash/s
  - Tier 5: **Kripto Çekirdek** (Crypto Core) — +50 Cash/s
  - Tier 6: **Kuantum Düğüm** (Quantum Node) — +125 Cash/s
  - Tier 7: **Siber Ağ** (Cyber Network) — +300 Cash/s
  - Tier 8: **Yapay Zeka Matrisi** (AI Neural Matrix) — +750 Cash/s
  - Tier 9: **Galaktik Blokzincir** (Galactic Blockchain) — +1,800 Cash/s
  - Tier 10: **İmparatorluk Tacı** (Imperial Crown) — +4,500 Cash/s
  - Tier 11+ (Bonus): **Tekillik Çekirdeği** (Singularity Core) — +10,000 Cash/s
  - Each tier rendered with bespoke vector SVG iconography and distinct border glow.
- **Controls & Gestures**:
  - **Drag & Drop**: Pointer Events (`pointerdown`, `pointermove`, `pointerup`) with floating drag ghost following pointer and target highlight.
  - **Click-to-Merge**: Accessible one-hand fallback: click first tile to select (glowing border), tap matching tile to merge, or tap empty slot to move.
- **Juice & Particles**:
  - Merge burst: Canvas/CSS star/sparkle explosion + shockwave ripple.
  - Drop bounce: squish-stretch bounce animation on slot drop.
  - Highest tier unlocked splash toast announcing new rank.
- **Mystery Parcel Drops**:
  - Timer drops a mystery parcel every 15–20s into a random vacant slot with parachute/drop animation.
  - Tapping parcel unboxes with gift opening animation, yielding Tier 1 (75%) or Tier 2 (25%).
- **Idle DPS Counters**:
  - Passive coin accumulation based on items on board.
  - Floating coin tickers (`+N`) floating upward from tiles every 3–4 seconds.
  - Session accumulated coin bank with "Kasa Topla" (Collect) action.
- **Intelligent Auto-Bot**:
  - Toggle assistant (Oto-Birleştirici).
  - Ticks every 1.5s: opens pending mystery parcels first, finds lowest matching pair (`findLowestMergePair`), and merges them automatically.

### Game 2: Dynasty Cipher Terminal Revamp (`DynastyCipherGame`)
- **Cyberpunk Terminal Aesthetic**:
  - Dark obsidian terminal background (`#080c14`), scanline texture overlay, CRT glow, monospace typography.
  - Header: `[SYS_OVERRIDE_V4]`, `STATUS: DECRYPTING`, `FIREWALL: 60%`.
- **Dynamic Pacing & Sequence**:
  - 4 cyberpunk hex nodes: `0x01 [ALPHA]`, `0x02 [BETA]`, `0x03 [GAMMA]`, `0x04 [DELTA]` or cyber runes.
  - Flash speed accelerates as rounds increase (450ms -> 320ms -> 220ms per glyph).
  - Audio-visual decrypt pulse: glowing energy ring ripples on each flash and tap.
- **Combo Streaks & High-Stakes Multipliers**:
  - Consecutive perfect rounds without mistakes build combo multiplier: 1.0x -> 1.5x -> 2.0x -> 3.0x -> 5.0x OVERLOAD.
  - Combo fire glow and high-score multipliers.
- **Time-Attack Pressure**:
  - Depleting hack timer bar (6.0s countdown per round).
  - Audio clicks quicken as timer drops below 2.0s.
- **Firewall Gauge & Animations**:
  - Visual breach gauge (e.g. 5 rounds to 100% breach).
  - On breach: "FIREWALL BYPASS COMPLETE - ACCESS GRANTED" green neon matrix cascade.
  - On fail: "INTRUSION DETECTED - FIREWALL LOCKED" red glitch flicker.

### Game 3: Notcoin Tap-to-Earn Clicker Game (`NotcoinTapGame`)
- **Central 3D Tactile Coin**:
  - Large circular coin (~180px–220px diameter) with metallic rim, embossed Empire "E" and laurel wreath.
  - 3D Squish Tilt Physics: calculates click offset from center `(dx, dy)` and applies CSS 3D transform:
    `transform: perspective(600px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(0.95);`
  - Spring rebound back to rest state (`cubic-bezier(0.34, 1.56, 0.64, 1)`).
  - Multi-touch handling: listens to `onTouchStart` / `onPointerDown` with `touch-action: manipulation`, registering simultaneous multi-finger taps.
- **Floating Trajectory Numbers**:
  - Spawns floating digits (+1, +2...) at exact tap coordinates drifting upward with random horizontal jitter (-15px to +15px) and fading out over 800ms.
  - 10% Critical Hit chance: glowing golden `+5 CRIT!` with heavy haptic and special chime.
- **Dynamic Energy System**:
  - Energy pool: `currentEnergy` / `maxEnergy` (default: 1,000 max).
  - Depletes on each tap; tapping disabled when energy reaches 0.
  - Animated Energy Bar: glowing cyan/gold gradient bar, regenerating at `rechargeRate` per second (default +3/s).
  - Battery/lightning icon with numeric readout: `⚡ 940 / 1,000`.
- **Dual-Currency Upgrade Drawer**:
  - Sliding drawer / modal with In-Game Cash and Telegram Stars purchase options:
    1. **Multitap** (Lv 1–10): +1 coin per tap (Cash: `100 * 2^lvl`, Stars: 25 ⭐).
    2. **Energy Capacity** (Lv 1–10): +500 max energy (Cash / Stars).
    3. **Recharge Speed** (Lv 1–5): +1 energy/s (Cash / Stars).
    4. **TapBot (Auto-Tapper)**: Auto-taps when idle up to offline cap (Stars: 149 ⭐ or Cash: 50,000).
    5. **Offline Safe Extender**: Extends TapBot collection time from 3h to 6h, 12h, 24h (Stars: 99 ⭐).
  - Offline TapBot earnings modal when reopening the game.

### Game 4: Crypto Candlestick "Moon or Doom" Crash Game (`CryptoCrashGame`)
- **Real-Time 60fps Candlestick Chart**:
  - Rendered via `<canvas>` with `devicePixelRatio` scaling.
  - Multiplier curve starts at `1.00x` and rises dynamically: `1.05x, 1.20x, 1.85x, 3.40x, 8.50x...`.
  - Candlesticks generated incrementally every 600ms (green bullish body if close >= open, red bearish body if close < open, high/low wicks).
  - Central large bold HUD: real-time multiplier readout (e.g. `2.45x`).
- **Interactive State Machine**:
  - `idle`: Player sets stake (quick chips: 50, 100, 250, 500, MAX) and clicks "BOĞA BAŞLAT (Rally)".
  - `countdown`: 3-second hype countdown: "3... 2... 1... ROKET ATEŞLENDİ!".
  - `running`: Multiplier climbs dynamically. Big glowing "KÂRI AL (Cash Out)" button displays real-time payout: `KÂRI AL (+${Math.floor(stake * multiplier)})`.
  - `cashed_out`: Player secured winnings before crash! Victory fanfare, golden confetti burst, payout credited. Chart finishes running until crash.
  - `crashed`: Market dumps at randomized `crashPoint`! Screen shake, red flash, status: "DUMP! PİYASA ÇÖKTÜ @ 2.45x". Uncollected stake is lost.
- **Round History Bar**:
  - Pill strip showing the last 6 round crash multipliers with color coding (red for <2x, green for 2x–10x, purple/gold for >10x moon).

---

## 4. Responsive CSS & Layout Strategy for 320px–390px Viewports

To guarantee zero horizontal overflow and zero layout shift on mobile devices:
1. **Container Constraints**:
   - Use `width: 100%`, `max-width: 100%`, and `box-sizing: border-box` across all arcade wrappers.
   - In `.workspace-grid` where available width is 292px on 320px screens, grid columns must be CSS Grid `repeat(N, minmax(0, 1fr))`.
2. **Merge Grid (4x3 / 3x3)**:
   - 4-column layout: `grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px;`.
   - On 292px width: `(292px - (3 * 6px)) / 4 = ~68.5px` per tile. Fits comfortably on 320px viewports with zero horizontal overflow.
   - Tiles use `aspect-ratio: 1` and `touch-action: none` during dragging.
3. **Notcoin Tap Target**:
   - `width: clamp(170px, 48vw, 220px); height: clamp(170px, 48vw, 220px); margin: 0 auto;`.
   - Center alignment with `touch-action: manipulation` to prevent double-tap zoom on iOS Safari and Telegram Webview.
4. **Candlestick Chart Canvas**:
   - Container has `width: 100%; height: 200px; position: relative;`.
   - JavaScript resizes canvas width and height to match `container.clientWidth * devicePixelRatio` and scales 2D context accordingly.
5. **Cipher Terminal Grid**:
   - 2x2 grid: `grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 280px; margin: 0 auto; gap: 8px;`.
6. **Bottom Navigation Clearance**:
   - All games include bottom padding (`padding-bottom: 72px`) to prevent floating buttons from being obscured by Telegram's `.mobile-navigation` bar.
7. **Astra 6.0 Theme Cohesion**:
   - Dark mode: uses `--bg`, `--surface`, `--surface-raised`, `--accent`, `--border`.
   - Monospace terminal elements use dark surface `#080c14` with glowing borders in `var(--accent)` and `var(--green)`.
   - Supports `prefers-reduced-motion: reduce` by disabling canvas particle bursts, squish tilt, and screen shake.

---

## 5. State Management, Sound/Haptics & Particle Animation Strategies

### 5.1 Web Audio API Procedural Synthesizer (`arcade-audio.ts`)
- Implemented with pure `window.AudioContext || window.webkitAudioContext`.
- No MP3 or WAV files needed; zero network dependency.
- Procedural sounds:
  - `playTapSound()`: short sine wave pop (440Hz -> 660Hz in 35ms)
  - `playMergeSound(tier)`: sweet resonant pentatonic chord (C5-E5-G5 in 120ms)
  - `playCritSound()`: high bell chime (1200Hz in 80ms)
  - `playCipherKeySound(noteIndex)`: tech synth square wave tone
  - `playWinSound()`: triumphant ascending major arpeggio
  - `playCrashSound()`: low noise burst + resonant filter drop
  - `playErrorSound()`: 120Hz low buzz
- Persistent mute toggle stored in `localStorage` (`empire_arcade_muted`) with audio toggle button in the arcade header.

### 5.2 Telegram Haptic Feedback (`arcade-haptics.ts`)
- Wrapper around `window.Telegram?.WebApp?.HapticFeedback`:
  - `triggerHaptic('tap')` -> `impactOccurred('light')`
  - `triggerHaptic('crit')` -> `impactOccurred('heavy')`
  - `triggerHaptic('merge')` -> `impactOccurred('medium')`
  - `triggerHaptic('cashout')` -> `notificationOccurred('success')`
  - `triggerHaptic('crash')` -> `notificationOccurred('error')`
- Non-Telegram fallback: `navigator.vibrate?.([15])`.

### 5.3 Particle Animation Engine (`particle-canvas.tsx` / CSS particles)
- Spawns burst particles on merge, crit tap, and crash/win.
- Particles have velocity, friction, gravity, alpha fade, and color.
- Automatically cancels requestAnimationFrame when all particles expire.
- Fully disabled if `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.

### 5.4 State Management & Persistence
- Local game progress stored in `localStorage`:
  - `empire_catizen_merge_state_v1`: board array, highest unlocked tier, auto-bot toggle.
  - `empire_notcoin_tap_state_v1`: current energy, upgrade levels (multitap, capacity, recharge), last active timestamp for TapBot offline collection.
  - `empire_crypto_crash_state_v1`: stake history, personal best multiplier.
  - `empire_dynasty_cipher_state_v1`: high score, max combo reached.
- Real-time earnings sync: all mini-game payouts trigger `onReward(amount)` which updates player's cash balance.

---

## 6. Exact File Paths to Create or Update in `apps/web/`

### New Files to Create:
1. `apps/web/src/screens/arcade-screen.tsx`: Standalone Arcade Screen with game switcher, stats, audio toggle, and full-viewport layout.
2. `apps/web/src/components/catizen-merge-game.tsx`: 4x3 living merge board, 10+ collectible emblems, drag/drop + click merge, particle burst, mystery parcels, idle DPS tickers, auto-bot toggle.
3. `apps/web/src/components/dynasty-cipher-game.tsx`: Cyberpunk terminal styling, audio/visual decrypt pulse, combo multipliers (1.5x-3x), time-attack countdown, firewall progress bar.
4. `apps/web/src/components/notcoin-tap-game.tsx`: 3D tactile squish coin, multi-touch listener, floating trajectory numbers (+1, +5 CRIT!), animated energy bar, dual-currency upgrade drawer.
5. `apps/web/src/components/crypto-crash-game.tsx`: Real-time 60fps candlestick canvas chart, rising multiplier, stake selector, Boğa / Kârı Al cash out button, win/crash animations, history strip.
6. `apps/web/src/components/arcade.css`: Styling for all 4 games, cyber terminal effects, 3D perspective, energy bars, merge tiles, particle canvas, crash chart, and 320px–390px mobile rules.
7. `apps/web/src/game/arcade-audio.ts`: Web Audio API synthesizer for procedural sound effects.
8. `apps/web/src/game/arcade-haptics.ts`: Telegram WebApp HapticFeedback abstraction.
9. `apps/web/src/game/catizen-merge-model.ts` & `apps/web/src/game/catizen-merge-model.test.ts`: Pure logic for merge board, tier rates, parcel drops, auto-merge solver.
10. `apps/web/src/game/notcoin-tap-model.ts` & `apps/web/src/game/notcoin-tap-model.test.ts`: Pure logic for energy regeneration, tap power, crit rolls, upgrade scaling, offline TapBot accumulator.
11. `apps/web/src/game/crypto-crash-model.ts` & `apps/web/src/game/crypto-crash-model.test.ts`: Pure logic for candlestick generation, multiplier curve, crash point roll, payout calculation.
12. `apps/web/src/screens/arcade-screen.test.tsx`: Component tests verifying screen rendering, game switching, and interactions.

### Existing Files to Update:
1. `apps/web/src/components/micro-games.tsx`: Re-export `DynastyCipherGame` and `CoinMergeGame` (aliasing to `CatizenMergeGame`) to maintain 100% backwards-compatibility for existing tests.
2. `apps/web/src/components/empire-arcade.tsx`: Support all 4 games (`merge`, `cipher`, `tap`, `crash`, `mint`) with tabs and module cards.
3. `apps/web/src/game/arcade-game-model.ts`: Extend helper functions (combo multipliers, cyber sequence pacing) while preserving existing `memoryRewardForRound`, `findMergePair`, `mergeCoinBoard`.
4. `apps/web/src/screens/empire-missions.css` (or `apps/web/src/styles.css`): Import `arcade.css`.
5. `apps/web/src/preview/design-preview.tsx` & `apps/web/src/preview/fixtures.ts`: Wire up arcade preview controls to preview all 4 games in isolation with sample rewards.

---

## 7. Concrete Step-by-step Execution Plan for Stream 2 Worker

### Step 1: Core Pure Models, Audio & Haptics Engine
- Create `apps/web/src/game/arcade-audio.ts` with Web Audio synthesizer (tap, merge, crit, decrypt, crash, win, mute toggle).
- Create `apps/web/src/game/arcade-haptics.ts` with Telegram HapticFeedback integration.
- Implement `apps/web/src/game/catizen-merge-model.ts` and `catizen-merge-model.test.ts` (10 tiers, idle rates, parcel drop probabilities, auto-merge solver).
- Implement `apps/web/src/game/notcoin-tap-model.ts` and `notcoin-tap-model.test.ts` (energy regen, tap power, crit calculation, upgrade costs, TapBot offline accumulator).
- Implement `apps/web/src/game/crypto-crash-model.ts` and `crypto-crash-model.test.ts` (multiplier curve, crash point generator, candlestick data generator, payout math).
- Run `vitest run apps/web/src/game/` to verify all pure models pass with 100% coverage.

### Step 2: Styling & Assets Architecture
- Create `apps/web/src/components/arcade.css` defining:
  - Cyberpunk terminal styling (`.cipher-terminal`, `.scanline-overlay`, `.firewall-gauge`).
  - 3D tactile coin styling (`.tap-coin`, perspective squish tilt classes, floating numbers physics).
  - Living merge board styling (`.catizen-grid`, item badges, parcel bounce, idle DPS tickers).
  - Candlestick chart styling (`.crash-canvas`, `.multiplier-hud`, `.crash-history-pill`).
  - Mobile responsiveness `@media (max-width: 520px)` and `@media (max-width: 359px)` ensuring zero overflow down to 320px.
- Create bespoke inline SVG icons/emblems for the 10+ tiers, cyber glyphs, and coin details.

### Step 3: Game Component Implementation
- **Implement `DynastyCipherGame`** (`dynasty-cipher-game.tsx`):
  - Cyberpunk terminal UI, scanlines, combo streak multiplier (1.0x-5.0x), time-attack countdown, firewall breach progress, audio/haptic pulse.
- **Implement `CatizenMergeGame`** (`catizen-merge-game.tsx`):
  - 4x3 grid (12 slots), 10+ collectible emblem tiers, drag/drop & click merge, particle burst feedback, mystery parcel drops every 15-20s, idle DPS coin counters, auto-bot assistant toggle.
- **Implement `NotcoinTapGame`** (`notcoin-tap-game.tsx`):
  - 3D tactile squish coin with tilt physics, multi-touch listener, floating numbers (+1, +5 CRIT!), animated energy bar, dual-currency upgrade drawer (Cash & Telegram Stars), TapBot offline modal.
- **Implement `CryptoCrashGame`** (`crypto-crash-game.tsx`):
  - 60fps candlestick canvas chart, real-time multiplier curve, stake chips, Boğa / Kârı Al button, crash / win animations, round history strip.

### Step 4: Arcade Hub & Screen Integration
- Create `apps/web/src/screens/arcade-screen.tsx`:
  - Full-screen arcade hub with tabbed or card-based launcher for all 4 games.
  - Sound toggle, active wallet readout, and play stats.
- Update `apps/web/src/components/empire-arcade.tsx`:
  - Seamlessly embed the 4 games into the existing Empire screen widget.
- Update `apps/web/src/preview/design-preview.tsx`:
  - Add arcade game switcher to allow testing each game in design preview mode.

### Step 5: Automated Testing & Monorepo Verification
- Create `apps/web/src/screens/arcade-screen.test.tsx` verifying:
  - Rendering of all 4 games without crashing.
  - Interaction events (tap clicks, merge operations, cipher inputs, crash stakes).
  - Mobile layout assertions (no fixed width > 290px).
- Execute full verification suite:
  - `pnpm lint`
  - `pnpm format:check`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
- Confirm all 524+ tests pass and 0 regressions exist.

---

## 8. Caveats
- **Read-Only Investigation**: As an Explorer agent, no application source files have been modified. All architecture patterns and file layouts are documented for the subsequent Worker agent.
- **Stream 1 Boundary**: Backend database migrations and server-side RPC contracts for Stars SKUs and server-side crash validation are the domain of Stream 1. The frontend design uses client-side optimistic simulation with graceful fallbacks to server DTO contracts.
- **Audio Autoplay Policies**: Modern browsers require user interaction before playing audio via Web Audio API. The audio system initializes `AudioContext` only upon the user's first tap or click.

---

## 9. Conclusion
- The existing arcade components (`CoinMergeGame`, `DynastyCipherGame`, `MintGame`) are functional prototypes that require complete overhaul to meet the rich visual and tactile requirements of modern Telegram games like Catizen, Notcoin, and Crypto Crash.
- A fully modular architecture with 4 independent game components, pure mathematical models, procedural Web Audio synthesis, Telegram WebApp haptics, and zero-asset footprint is completely designed and ready for immediate implementation by the Stream 2 Worker.
- Zero layout shift and zero horizontal scroll on 320px–390px mobile screens will be strictly guaranteed via fluid CSS grid layouts and responsive canvas rendering.

---

## 10. Verification Method
To independently verify the survey findings and ensure pristine workspace health:
1. Run test suite:
   ```bash
   pnpm test
   ```
   *Expected: All 43 test files and 524 tests pass with exit code 0.*
2. Run build verification:
   ```bash
   pnpm build
   ```
   *Expected: `@empire/web` (Vite) and `@empire/api` (Wrangler dry-run) complete with exit code 0.*
3. Run lint and code formatting verification:
   ```bash
   pnpm lint
   pnpm format:check
   ```
   *Expected: Clean output with 0 errors.*
