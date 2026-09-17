# Handoff Report: Stream 1 (Global Design System, Micro-Interactions, Navigation) & Stream 2 (Empire Screen & City Silhouette)

## 1. Observation

### 1.1 Existing CSS Variables, Tokens, Keyframes, and Utilities
- **`apps/web/src/styles.css` (lines 3–22, 24–37, 53–65)**:
  - Theme tokens defined on `:root` and `:root[data-design-theme='dark']`:
    ```css
    --bg: #10141d;
    --surface: #181e29;
    --surface-raised: #202736;
    --text: #f4f0e8;
    --muted: #a8b0bf;
    --accent: #e1b47e;
    --accent-ink: #352416;
    --border: rgba(150, 160, 180, 0.18);
    --green: #7ed2ad;
    --red: #ff9e9e;
    --radius: 20px;
    ```
  - Light mode tokens defined on `:root[data-telegram-theme='light'], :root[data-design-theme='light']`:
    ```css
    --bg: #f4f2ed;
    --surface: #fffefa;
    --surface-raised: #ece9e2;
    --text: #222735;
    --muted: #616574;
    --accent: #946125;
    --accent-ink: #fffaf2;
    --border: rgba(90, 80, 65, 0.18);
    --green: #29755b;
    --red: #a73242;
    ```
  - Telegram Mini App viewport insets: `--tg-safe-area-inset-top`, `--tg-content-safe-area-inset-top`, `--tg-content-safe-area-inset-bottom`, `env(safe-area-inset-bottom)`.
  - **Keyframes**: Exactly ONE keyframe exists in `styles.css` (lines 239–243):
    ```css
    @keyframes pulse {
      50% {
        opacity: 0.4;
      }
    }
    ```
  - **`apps/web/src/screens/empire-missions.css`**: Contains ZERO `@keyframes` declarations. Extensive usage of `color-mix(in srgb, var(--accent) X%, transparent)`.
  - **Interactive Button Utilities** (`styles.css` lines 128–157):
    `.button`, `.primary-action`, `.secondary-action` have:
    ```css
    transition: background 0.18s, transform 0.18s;
    ```
    Hover state: `filter: brightness(1.08); transform: translateY(-1px);`.
    Missing: `:active` spring press state (`transform: scale(0.96);`), ripple/glow on touch, and haptic feedback classes.

### 1.2 Navigation Tabs & Screen Rendering Architecture
- **`apps/web/src/app.tsx` (lines 10–73)**:
  `App` resolves session state; when authenticated, mounts `<GameShell state={session.playerState.data} ... />`.
- **`apps/web/src/game/live-game.tsx` (lines 147–170, 638–790)**:
  `GameShell` holds active tab state `const [tab, setTab] = useState<GameTab>('empire');`.
  Renders `<GameLayout tab={tab} onTab={setTab} ...>` wrapping conditional screen branches:
  ```tsx
  {tab === 'empire' && <EmpireScreen ... />}
  {tab === 'missions' && <MissionsScreen ... />}
  {tab === 'friends' && <FriendsScreen ... />}
  {tab === 'leaderboard' && <LeaderboardScreen ... />}
  {tab === 'shop' && <ShopScreen ... />}
  ```
- **`apps/web/src/game/game-layout.tsx` (lines 45–52, 76–99, 172–179, 227–241)**:
  - Topbar breadcrumb: `OYUN ALANIN / {tabs.find((t) => t.key === tab)?.label}`
  - Tab switch handler effect:
    ```tsx
    useEffect(() => {
      if (previousTab.current !== tab) {
        mainRef.current?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: 'instant' });
        previousTab.current = tab;
      }
    }, [tab]);
    ```
  - Mobile bottom navigation (`styles.css` lines 897–945):
    ```css
    .mobile-nav-item.active:before {
      content: '';
      width: 24px;
      height: 2px;
      position: absolute;
      top: 0;
      background: var(--accent);
      border-radius: 0 0 3px 3px;
    }
    ```
    **Critical Observation**: `.mobile-nav-item` is NOT declared with `position: relative`. As a result, `:before` anchors to `.mobile-navigation`, which can cause misalignment on dynamic rendering. Furthermore, there is no halo/glow effect or transition.

### 1.3 Top Header Stats & Currency Odometer
- **`apps/web/src/game/game-layout.tsx` (lines 131–142)**:
  ```tsx
  <div className="wallet-strip" aria-label="Bakiyeler">
    <span>
      <i aria-hidden="true" className="cash-dot" />{' '}
      <strong>{formatNumber(cash, true)}</strong>
      <small>Nakit</small>
    </span>
    <span>
      <i aria-hidden="true" className="point-dot" />{' '}
      <strong>{formatNumber(points, true)}</strong>
      <small>SP</small>
    </span>
  </div>
  ```
- **`apps/web/src/game/ui.tsx` (lines 4–10)**:
  `formatNumber` uses `Intl.NumberFormat(compact ? 'en-US' : 'tr-TR', { notation: compact ? 'compact' : 'standard' })`.
- **Level Metric**: `GameLayout` does not receive or render any "Level" badge in the top bar. Level exists only per business (`business.level` in `BusinessCard`).

### 1.4 Business Cards Rendering in `empire-screen.tsx`
- **`apps/web/src/screens/empire-screen.tsx` (lines 27–88, 113–193, 368–390)**:
  - Renders `data.businesses.map((business, index) => <BusinessCard key={business.slug} ... />)`.
  - Business icons cycle through only 6 types:
    ```tsx
    const businessKinds = ['stand', 'cafe', 'delivery', 'factory', 'tech', 'holding'] as const;
    <BusinessSilhouette kind={businessKinds[index % businessKinds.length]!} />
    ```
  - **`packages/game-core/src/config.ts` (lines 9–116)**:
    `DEFAULT_BUSINESSES` defines 16 businesses:
    1. `street_stand`
    2. `cafe`
    3. `delivery_hub`
    4. `factory`
    5. `tech_company`
    6. `global_holding`
    7. `crypto_mining`
    8. `blockchain_bank`
    9. `ai_datacenter`
    10. `cyber_security`
    11. `fintech_giant`
    12. `quantum_lab`
    13. `satellite_network`
    14. `spaceport_logistics`
    15. `orbital_colony`
    16. `galactic_federation`
  - Current card styles (`empire-missions.css` lines 232–246):
    Static background `var(--surface)`. When recommended, adds `border-color: color-mix(in srgb, var(--accent) 52%, transparent); box-shadow: inset 3px 0 0 var(--accent);`. No animation, pulse, or glassmorphic blur.

### 1.5 Offline Earnings, "Collect All", and Revenue Generation
- **`apps/web/src/game/live-game.tsx` (lines 170–175, 193–215, 393–398, 661–671)**:
  - 1-second timer: `setInterval(() => setNow(Date.now()), 1000)`.
  - Offline calculation: `estimateClaimableCash(economy.data.businesses, now, offlineCapSeconds)`.
  - Claim action triggers `POST /api/economy/claim` via `claimMutation.mutate(attempt)`.
  - Response payload: `ClaimCashResponse` contains `claimedAmount: number, newBalance: number`.
  - In `claimMutation.onSuccess`: invalidates queries. Does NOT currently pass `claimedAmount` or element coordinates to trigger floating particle trajectory animations.

### 1.6 Construction of `city-silhouette.tsx` & `Skyline`
- **`apps/web/src/components/city-silhouette.tsx` (lines 1–51)**:
  - Container `.city-art` contains two unstyled divs: `<div className="city-orbit city-orbit-one" />` and `<div className="city-orbit city-orbit-two" />`.
  - SVG 700x560 with `#cityGlow`, `#cityInk`, `#softGlow` filter, ground path, building silhouettes, windows path, ground lines, and tower beacon circle at (386, 155).
- **`apps/web/src/screens/empire-screen.tsx` (lines 90–111)**:
  - `Skyline` SVG 420x172: contains `#empire-building` gradient, ground lines, window lines (`.empire-skyline-line`), and beacon circle at (279, 8).
  - Placed inside `.empire-production-art`.

### 1.7 Mobile Responsive Bottlenecks (320px, 360px, 390px)
- **`apps/web/src/styles.css` (lines 1113–1157)**:
  - Line 1120: `.game-content .empire-production-copy { padding-right: 85px; }`.
  - Line 1139: `.game-content .empire-claim-row { margin-right: -63px; flex-direction: row; align-items: center; }`.
  - In `empire-missions.css` (line 537), `.empire-claim-row` has `@media (max-width: 420px) { flex-direction: column; }`.
  - **Conflict**: Because `.game-content .empire-claim-row` in `styles.css` has specificity `(0, 2, 0)` versus `(0, 1, 0)` in `empire-missions.css`, it forces `flex-direction: row` even on 320px screens with negative margin `margin-right: -63px`. On narrow screens, the claimable amount text and button collide.
- **Topbar Density**: On 320px (`styles.css` lines 1004–1016), padding is 14px on each side (width available = 292px). If brand (`EMPIRE.`, ~65px), wallet strip (`Nakit` + `SP`, ~110px), admin badge (60px), and avatar (36px) are displayed simultaneously, the container overflows unless elements wrap or scale down.

---

## 2. Logic Chain

### 2.1 Global Micro-Interactions & Transitions (Stream 1)
1. **Observation**: Keyframes are absent in `styles.css` and `empire-missions.css`. Buttons have linear hover transitions without spring dampening or touch feedback.
2. **Inference**: High-end mobile games rely on tactile physics (e.g. `cubic-bezier(0.34, 1.56, 0.64, 1)` scale-down to `0.96` on touch) and instant visual confirmation.
3. **Design Solution**:
   - Add global utility keyframes: `@keyframes screenSlideFadeIn`, `@keyframes neonBorderPulse`, `@keyframes shimmerSweep`, `@keyframes balanceBump`, `@keyframes goldSpark`.
   - Add active states to `.button`, `.primary-action`, `.secondary-action`, `.mobile-nav-item`, `.empire-business-card`:
     `:active { transform: scale(0.96); transition: transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1); }`.
   - Apply zero-layout-shift screen transitions to `.game-content > *` using `animation: screenSlideFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;`. Because this operates solely on `transform: translateY(6px) -> 0` and `opacity: 0 -> 1`, it executes on the GPU compositor thread without reflow.
   - Fix `.mobile-nav-item` by adding `position: relative;`. Upgrade active tab indicator with a bottom-curved neon under-bar and an ambient radial glow aura.

### 2.2 Top Header Stats & Currency Odometer (Stream 1)
1. **Observation**: Header values jump discretely upon mutation refetches. There is no animated interpolation or level counter.
2. **Inference**: A Telegram idle/clicker game must make every balance increase feel substantial and rewarding.
3. **Design Solution**:
   - Create a lightweight React component `<AnimatedCounter value={cash} compact />` using `requestAnimationFrame` with a 400–600ms ease-out curve.
   - Compute player total empire level (`economy.data.businesses.reduce((sum, b) => sum + b.level, 0)`) and display an elegant `Lv.X` gold badge pill in `.wallet-strip`.
   - On balance increase (`value > prevValue`), attach `.balance-bump` class and spawn 4 gold spark DOM elements with randomized CSS transform variables (`--dx`, `--dy`).

### 2.3 Empire Screen & 16 Business Cards (Stream 2)
1. **Observation**: All 16 businesses currently share 6 cycling monochrome SVGs in `empire-screen.tsx`. Cards have flat backgrounds.
2. **Inference**: The progression from Street Stand (Tier 1) to Galactic Federation (Tier 16) requires clear visual tier distinction and celebration.
3. **Design Solution**:
   - Apply cyber-luxe glassmorphism:
     ```css
     background: linear-gradient(145deg, color-mix(in srgb, var(--surface) 92%, var(--accent) 4%), var(--surface-raised));
     backdrop-filter: blur(12px);
     box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.06);
     ```
   - On `is-recommended` cards, apply `@keyframes neonBorderPulse` with continuous amber/gold aura.
   - For business icons, categorize the 16 businesses into 4 tiers with distinct gradient badges or custom silhouette paths:
     - Tier 1–4 (Local/Industrial): Warm Amber / Bronze
     - Tier 5–8 (Tech/Corporate): Cyber Cyan / Emerald
     - Tier 9–12 (Advanced/Quantum): Electric Violet / Purple
     - Tier 13–16 (Space/Cosmic): Supernova Gold / Holographic
   - On business upgrade success, trigger `.card-upgrade-burst` (momentary scale up and gold glow pulse) and `.level-badge-animated` pop.

### 2.4 Revenue Generation & Floating Gold Coin Trajectory (Stream 2)
1. **Observation**: `estimateClaimableCash` updates `claimable` every second. `claimMutation` receives `claimedAmount`.
2. **Inference**: The claim moment ("Geliri topla") is the core dopamine loop.
3. **Design Solution**:
   - When claim succeeds, extract button coordinates (`getBoundingClientRect()`) and header wallet strip coordinates.
   - Launch a floating particle burst: 8 gold coin SVG tokens that travel along a curved quadratic Bezier trajectory from claim button to `.wallet-strip`.
   - Display a floating text tag `+₺{formatNumber(claimedAmount, true)}` floating up 30px with opacity fade.
   - When particles reach topbar, trigger `.balance-bump` on `.cash-dot`.

### 2.5 Dynamic City Silhouette (Stream 2)
1. **Observation**: `CitySilhouette` and `Skyline` contain SVG paths for windows and beacons, plus unstyled `.city-orbit` divs.
2. **Inference**: Static SVGs make the background feel lifeless. Subtle ambient animations at 60fps create an immersive cyberpunk atmosphere without draining mobile battery.
3. **Design Solution**:
   - Style `.city-orbit-one` and `.city-orbit-two` with elliptical 3D rotation (`rotateX(72deg) rotate(360deg)`).
   - Animate skyline windows (`.empire-skyline-line` and SVG window rects) with `@keyframes windowFlicker` at staggered delays (0s, 2s, 4s).
   - Add rhythmic red/cyan blinking to the radio tower beacon (`@keyframes beaconBlink`).
   - Add subtle CSS ambient drift to `.empire-production-art` (`@keyframes atmosphericDrift`) for layered parallax depth at 0% CPU cost.

### 2.6 Mobile Layout Optimization (Stream 1 & Stream 2)
1. **Observation**: `.game-content .empire-claim-row` specificity overrides mobile column flex, and `margin-right: -63px` causes squishing on 320px. Topbar items can crowd on 320px.
2. **Inference**: Project Empire runs inside Telegram Mini Apps on screens from iPhone SE (320px/375px) to modern flagships (390px/430px). Zero horizontal scroll is mandatory.
3. **Design Solution**:
   - In `styles.css`, override `.game-content .empire-claim-row` at `@media (max-width: 420px)` to reset `margin-right: 0`, set `flex-direction: column`, and give the claim button `width: 100%`.
   - On screens `<= 359px`: shorten brand text to `E.`, reduce avatar size to 32px, and set `gap: 6px` in `.wallet-strip`.
   - Enforce `html, body { overflow-x: hidden; max-width: 100vw; }` and `.game-content { max-width: 100%; overflow-x: clip; }`.

---

## 3. Caveats
1. **Browser Performance on Low-End Android WebViews**: Heavy blur (`backdrop-filter: blur(20px)`) across 16 simultaneous business cards can cause frame drops on low-end devices. **Mitigation**: Use moderate blur (`blur(10px)`), avoid applying `backdrop-filter` to every individual list item, and use `will-change: transform, opacity` sparingly.
2. **Telegram Mini App Safe Area Insets**: On iOS Telegram, bottom bars can overlap with the home indicator. All bottom navigation padding must keep `env(safe-area-inset-bottom)` and `--tg-content-safe-area-inset-bottom`.
3. **Unit Test DOM Compatibility**: Existing unit tests use `react-dom/server` `renderToStaticMarkup`. All new components (`AnimatedCounter`, `BusinessCard`, `CitySilhouette`) must render clean, accessible HTML strings during SSR/static markup without crashing when `window` or `requestAnimationFrame` is undefined.

---

## 4. Conclusion

The existing architecture in `apps/web` provides a solid, accessible, and clean foundation. However, its visual execution is currently static and utilitarian.

By implementing:
1. A unified CSS keyframe and micro-interaction library in `styles.css` with spring-tactile feedback,
2. An active tab under-bar halo/glow and zero-CLS screen slide/fade in `game-layout.tsx`,
3. An `AnimatedCounter` with gold spark balance bursts in the topbar,
4. Glassmorphic neon-pulsing cards with level badges and upgrade celebrations for all 16 businesses in `empire-screen.tsx`,
5. A floating coin trajectory animation for "Geliri topla" claims,
6. Ambient window pulses, blinking beacons, and 3D orbit lights in `city-silhouette.tsx`, and
7. Responsive mobile fixes for `.empire-claim-row` and topbar density on 320px screens,

the user experience will be elevated to modern commercial Telegram Mini App standards (60fps, cyber-luxe aesthetic, zero horizontal overflow).

---

## 5. Verification Method

### 5.1 Test Suite & Integrity Commands
Run the complete workspace verification command to ensure no regressions:
```bash
# Run Vitest test suite (all 761 tests must pass)
pnpm test

# Run full project quality gates (lint, prettier, typecheck, tests, build)
pnpm check
```

### 5.2 Files to Inspect & Verify
- `apps/web/src/styles.css`: Check keyframe definitions, button active states, and mobile media queries.
- `apps/web/src/game/game-layout.tsx`: Check `.mobile-nav-item` positioning, active indicator styling, and wallet strip layout.
- `apps/web/src/screens/empire-screen.tsx`: Check business card mapping, 16 business styles, upgrade feedback, and claim row layout.
- `apps/web/src/screens/empire-missions.css`: Check `.empire-business-card` glassmorphic properties and `.empire-claim-row` media queries.
- `apps/web/src/components/city-silhouette.tsx`: Check orbit divs, window pulsing, and beacon animation.

### 5.3 Invalidation Conditions
- Any horizontal scrollbar appearing on 320px, 360px, or 390px viewports.
- Vitest test failures in `apps/web/src/game/live-game-screens.test.tsx` due to missing `role="alert"`, `disabled`, or altered button text.
- Dropping below 60fps on mobile due to unconstrained canvas or excessive blur filters.
