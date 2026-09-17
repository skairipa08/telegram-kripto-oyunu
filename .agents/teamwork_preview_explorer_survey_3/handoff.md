# Stream 4 Deep-Dive Investigation: Social, Missions, Shop & Celebration Modals

## 1. Observation

A comprehensive direct code inspection was performed on all designated targets and related modules in `apps/web` and `packages/shared`.

### 1.1 Streak & Milestones Rendering and Claiming
- **Files**:
  - `apps/web/src/screens/missions-screen.tsx` (lines 13–71, 277–307, 309–430)
  - `apps/web/src/components/arcade.css` (lines 1028–1221, 1252–1259)
  - `apps/web/src/screens/missions-milestones.test.tsx` (lines 1–118)
  - `apps/api/src/economy/routes.ts` (lines 566–642)
  - `packages/shared/src/index.ts` (lines 198–240)
  - `apps/web/src/game/live-game.tsx` (lines 254–261, 424, 455–475)
- **Observations**:
  1. `STREAK_MILESTONES` is an exported constant containing exactly 5 tiers (days: 7, 30, 90, 180, 365). Each defines `label`, `period`, `sruMultiplier`, `cashBonus`, `icon`, `description`, and optionally `badgeName` ('İmparatorluk Kıdemlisi' on Day 365).
  2. The 7-day strip (`<ol className="missions-week-strip">`, lines 293–306) visualizes days 1 to 7 using `streakDays = Math.min(7, Math.max(0, streak))`. It renders checkmarks `✓` for completed days.
  3. The extended milestone track (`<article className="panel missions-milestones-track">`, lines 310–430) iterates over `STREAK_MILESTONES` and sets card classes: `is-achieved` (`streak >= milestone.days`), `is-target` (`!isAchieved && prevAchieved`), and `is-locked`.
  4. Unit test `missions-milestones.test.tsx` strictly verifies the presence of CSS classes: `missions-milestones-track`, `missions-milestones-header`, `missions-milestones-grid`, `milestone-card`, `is-achieved`, `is-target`, `is-locked`, and exact text badges `✓ AÇILDI`, `HEDEF`, `🔒 KİLİTLİ`.
  5. **Claiming gap**: In `missions-screen.tsx`, `MissionsScreenProps` (lines 136–142) only accepts `onClaim?: (id: string) => void` for regular missions. Neither the 7-day streak header nor the milestone cards contain an interactive claim button or claim mutation invocation.
  6. **Backend ready**: In `apps/api/src/economy/routes.ts` (lines 596–642), `POST /streak/claim` is fully implemented and tested, accepting `ClaimStreakRequest` (`{ requestId: UUID }`) and returning `ClaimStreakResponse` (`{ apiVersion, rewardPoints, newStreak, newSeasonPoints, isCycleBonus, claimedAt }`).
  7. In `live-game.tsx` (lines 254–261), the `streak` query already fetches `/api/streak` returning `playerStreakDtoSchema` (`canClaimToday`, `todayRewardPoints`, `currentStreak`, `isCycleBonusToday`), but `live-game.tsx` only passes `rawStreak` into `missionsResource.data.streak`.

### 1.2 Referral & Partnership ("Kasaya Aktar", Friend Invite Cards, Badges)
- **Files**:
  - `apps/web/src/screens/friends-screen.tsx` (lines 88–188, 267–326, 358–489, 491–649, 731–748)
  - `apps/web/src/screens/social.css` (lines 58–174, 175–203, 339–390, 582–605)
  - `apps/web/src/components/share-referral-modal.tsx` (lines 1–150)
  - `apps/web/src/screens/friends-screen.test.ts` (lines 1–25)
- **Observations**:
  1. Tab switcher (lines 145–170) toggles between `👥 Arkadaş Ağım & Gelir Payı` and `🛡️ Karteller (Klanlar)`.
  2. The invite card (`.friends-invite`, lines 267–326) provides an input strip with copy functionality and a large button: `🚀 Telegram'da Arkadaşlarını Davet Et (+5.000 Nakit)` which triggers `isShareModalOpen = true`.
  3. `ShareReferralModal` (in `apps/web/src/components/share-referral-modal.tsx`) presents 3 share templates (`starter`, `clan`, `whale`) and supports `window.Telegram.WebApp.openTelegramLink` as well as clipboard copy.
  4. The 0.1% (1/1000) Invitee Cash Kickback & Revenue Milestones Card (lines 491–649):
     - Heading: `🔥 Binde 1 (%0.1) Ortak Primi` with badge `<span className="badge">Oran: ‰1 (%0.1)</span>`.
     - Metrics: `Toplam Ciro Primi` (`data.totalKickbackCashEarned`) and `Birikmiş / Toplanabilir` (`data.unclaimedKickbackCash`).
     - Claim button: When `unclaimedKickbackCash > 0`, it renders:
       `<button type="button" className="button" onClick={() => void handleClaimKickback()}>💰 Biriken {formatNumber(data.unclaimedKickbackCash ?? 0)} Nakdi Kasaya Aktar</button>`.
     - This button uses inline green styling (`background: '#22c55e'`) without CSS animations or glowing shaders.
     - Ciro thresholds: 5 milestone chips (`100K`, `1M`, `10M`, `100M`, `1B` Ciro) currently styled with static inline borders.

### 1.3 Clans / Cartels (Ranking List, Podium Layout, Auras, Level-Up)
- **Files**:
  - `apps/web/src/screens/clans-screen.tsx` (lines 38–272, 274–515, 518–637)
  - `packages/game-core/src/clans.ts`
  - `apps/web/src/screens/social.css`
- **Observations**:
  1. `ClansScreen` is embedded into `FriendsScreen` when `activeTab === 'clans'` (line 172 of `friends-screen.tsx`).
  2. It has 3 sub-navigation tabs: `my_clan` (`🛡️ Kartelim`), `leaderboard` (`🏆 Kartel Sıralaması`), and `create` (`➕ Kartel Kur`).
  3. In `leaderboard` view (lines 518–637), clans are rendered as a plain vertical list of `div`s. Ranks are simply numbered (`#{clan.rank}`) with text color `#f1c99a` for top 3 and `#8c9ba5` for others.
  4. **Podium gap**: There is no Olympic/podium pedestal (1st, 2nd, 3rd) layout. No gold/silver/bronze metallic aura cards exist.
  5. In `my_clan` view (lines 276–334), `myClan.clanLevel` is displayed along with `calculateClanCapacity(myClan.clanLevel)` and `calculateClanProductionBonus(myClan.clanLevel)`. However, there is no level progress bar towards the next level and no level-up visual celebration.

### 1.4 Stars Shop (Empire Pass, Cosmetics, Cyber-Gold & Holographic Tilt)
- **Files**:
  - `apps/web/src/screens/shop-screen.tsx` (lines 44–99, 207–268, 420–525)
  - `apps/web/src/screens/shop-analytics.css` (lines 145–270, 420–460, 673–762)
  - `apps/web/src/screens/shop-screen.test.tsx` (lines 1–150)
- **Observations**:
  1. `ShopScreen` provides 5 category tabs: `all`, `pass`, `bundles`, `upgrades`, `cosmetics`.
  2. `sa-pass-card` (lines 207–268) features SVG `PassEmblem`, price (`sa-price`), and purchase button (`sa-buy-button`). In `shop-analytics.css` (lines 145–188), it already has a dark gradient, rounded corners (`28px`), and pseudo-element circles.
  3. Cosmetic items (`sa-cosmetic-card`, lines 420–525) render SVG artwork with linear metal gradients (`#saFrameMetal`, `#saEmblemMetal`).
  4. Unit tests in `shop-screen.test.tsx` assert exact classes: `sa-badge-soon`, `sa-buy-button`, `sa-cosmetic-buy`, `sa-pass-header-row`, `sa-cosmetic-title-row`, and button labels `Empire Pass Al`, `Satın Al`, `Satışlar yakında`, `Ödeme açılıyor…`.
  5. There is currently no active holographic tilt or animated cyber-gold light sweep on the cards.

### 1.5 Modal & Confetti Infrastructure
- **Files**:
  - `apps/web/package.json` (lines 10–24)
  - `apps/web/src/components/share-referral-modal.tsx` (lines 69–102)
  - `apps/web/src/components/crypto-crash-game.tsx` (lines 53–76)
- **Observations**:
  1. `apps/web/package.json` contains no external animation/canvas libraries (no `framer-motion`, no `canvas-confetti`). The app relies on standard React 19 + pure CSS + HTML5 `<canvas>`.
  2. `crypto-crash-game.tsx` uses a responsive `<canvas>` with `window.devicePixelRatio` scaling.
  3. No general celebration modal or confetti canvas particle system currently exists in the codebase. All feedback currently renders as flat text banners (e.g. `missions-action-note`, `sa-feedback-banner`, `kickbackFeedback`).

### 1.6 Mobile Responsiveness & Viewport Invariants (320px, 360px, 390px)
- **Observations**:
  1. In `social.css`: Breakpoints exist at `max-width: 760px`, `720px`, and `440px`.
  2. In `shop-analytics.css`: Breakpoints exist at `max-width: 760px` and `480px`.
  3. In `arcade.css`: Milestone track has an explicit breakpoint at `max-width: 359px` (padding reduced to 10px).
  4. On 320px viewports ($320 - 24 = 296\text{px}$ usable width), inline CSS grids like `gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))'` in `friends-screen.tsx` (line 539) risk layout cramping if margins/paddings are not constrained.

---

## 2. Logic Chain

1. **Streak & Milestones**:
   - Because `missions-milestones.test.tsx` tests exact string matches (`✓ AÇILDI`, `HEDEF`, `🔒 KİLİTLİ`, `missions-milestones-track`), any visual enhancements (neon path, glowing nodes) must wrap or style these existing elements without altering their test-verified text or class names.
   - Because `POST /streak/claim` is already fully wired in the API and `live-game.tsx` already receives `canClaimToday`, adding a claim button and passing an `onClaimStreak` callback directly unlocks the end-to-end streak claim loop.
   - A glowing neon ribbon is best implemented using a dedicated CSS energy path (or an inline SVG spine) connecting the milestone cards, transitioning from cyber-emerald (`#7ed2ad`) for achieved cards to pulsing gold (`#e1b47e`) for the target card.
   - When a claim occurs, transitioning the card to a chest unlock animation with an interactive particle burst gives high "game juice" while keeping bundle size at 0 KB extra dependencies.

2. **Referral Kickback & Friend Cards**:
   - The "Kasaya Aktar" button in `friends-screen.tsx` currently has inline styling `background: '#22c55e'`. Moving this to a CSS class `.kickback-claim-glow` with a gold gradient, 0 0 20px golden aura, and an infinite sweep shimmer (`@keyframes goldShimmerSweep`) directly fulfills the requirement without affecting logic.
   - The ‰1 badge at line 525 can be upgraded with a metallic gold shimmer animation (`background: linear-gradient(90deg, #eab308, #fef08a, #eab308)`).
   - Linking `handleClaimKickback` to the Universal Celebration Modal triggers an immediate confetti reward celebration when cash is transferred to the user's balance.

3. **Clan Ranking & Podium**:
   - In `clans-screen.tsx`, `leaderboardQuery.data?.clans` returns clans sorted by rank.
   - Extracting `clans.slice(0, 3)` into an Olympic-style Podium component (`#2 Silver` on left, `#1 Gold` in center with crown, `#3 Bronze` on right) with metallic aura card borders and glows provides the exact requested visual hierarchy.
   - Clans ranked 4+ continue rendering in the existing vertical list below the podium.
   - Clan level-up visuals can be added to `my_clan` with an animated level-progress track and glowing badge.

4. **Stars Shop Cyber-Luxe Styling**:
   - `shop-screen.test.tsx` checks button classes and text. Therefore, holographic tilt and cyber-gold shine effects should be applied via CSS classes (`.sa-pass-card`, `.sa-cosmetic-card`) using CSS pseudo-elements (`::after`) and GPU-accelerated transforms (`perspective`, `rotateX`, `rotateY`).
   - A cyber-gold light beam sweep animation (`@keyframes cyberGoldSweep`) on `.sa-pass-card::after` creates the luxury look with zero runtime performance cost.

5. **Universal Celebration Modal Architecture**:
   - A standalone component `apps/web/src/components/celebration-modal.tsx` with an embedded HTML5 `<canvas>` will provide 60fps confetti/coin particles without external dependencies.
   - The animation loop uses `requestAnimationFrame` and self-terminates when all particles decay (2.5–3 seconds), ensuring 0% idle CPU/GPU consumption.
   - The modal can be imported and shared across `MissionsScreen`, `FriendsScreen`, `ShopScreen`, and `ClansScreen`.

6. **Mobile Responsiveness (320px–390px)**:
   - For 320px screens, media queries must set `padding: 10px`, clamp font sizes down to `11px–13px`, and enforce single-column layouts for all milestone cards, podium columns, and kickback metrics to guarantee zero horizontal scroll.

---

## 3. Caveats

1. **No External Libraries**: Do NOT install packages like `canvas-confetti` or `framer-motion`. The project strictly uses React 19 with native CSS and lightweight HTML5 Canvas.
2. **Strict Test Integrity**:
   - `missions-milestones.test.tsx` expects exact strings and classes (`missions-milestones-track`, `milestone-card`, `✓ AÇILDI`, `HEDEF`, `🔒 KİLİTLİ`).
   - `shop-screen.test.tsx` expects exact button text (`Empire Pass Al`, `Satın Al`, `Satışlar yakında`, `Ödeme açılıyor…`) and class `sa-badge-soon`.
   - `friends-screen.test.ts` expects `isSafeTelegramInvite` to remain unchanged.
3. **Telegram WebApp Context**: Modals must account for safe area insets (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`) inside the Telegram Mini App frame.

---

## 4. Conclusion & Implementation Blueprint

### 4.1 Architecture of Components & Changes

```
apps/web/src/
├── components/
│   ├── celebration-modal.tsx       <-- NEW: Reusable confetti canvas celebration modal
│   ├── celebration-modal.css       <-- NEW: GPU-accelerated modal styles & particle glow
│   └── share-referral-modal.tsx    <-- EXISTING: Keep intact
├── screens/
│   ├── missions-screen.tsx         <-- ADD: Energy ribbon SVG/CSS, Streak claim trigger
│   ├── friends-screen.tsx          <-- ADD: .kickback-claim-glow, .badge-shimmer-gold, celebration modal call
│   ├── clans-screen.tsx            <-- ADD: Top-3 Clan Podium layout with Gold/Silver/Bronze auras
│   ├── shop-screen.tsx             <-- ADD: Cyber-gold shine & holographic tilt classes
│   ├── social.css                  <-- ADD: Podium auras, kickback gold glow, mobile @media (max-width: 359px)
│   ├── shop-analytics.css          <-- ADD: Cyber-gold sweep keyframes, holo reflection overlay
│   └── empire-missions.css         <-- ADD: Neon energy ribbon connecting path & chest unlock visuals
```

### 4.2 Detailed Implementation Specifications

#### A. Streak & Milestones (Glowing Ribbon & Chest Animation)
1. **Neon Energy Path**:
   - In `empire-missions.css` / `arcade.css`, add a connecting vertical neon ribbon:
     ```css
     .missions-milestones-grid {
       position: relative;
       padding-left: 20px;
     }
     .missions-milestones-grid::before {
       content: '';
       position: absolute;
       left: 8px;
       top: 24px;
       bottom: 24px;
       width: 4px;
       background: linear-gradient(180deg, #7ed2ad 0%, #e1b47e 60%, rgba(150, 160, 180, 0.2) 100%);
       box-shadow: 0 0 10px rgba(126, 210, 173, 0.6), 0 0 20px rgba(225, 180, 126, 0.3);
       border-radius: 2px;
     }
     ```
   - On each card, add a glowing connector node (`::before` dot) aligned to the vertical energy path.
2. **Chest Unlock Animation**:
   - SVG or CSS chest icon on the claimable milestone or 7-day card.
   - When unlocked:
     - `@keyframes chestUnlockShake`: gentle wiggle (0% to 30%).
     - `@keyframes chestLidOpen`: rotates lid upward by -45deg.
     - Golden god-rays burst from behind the chest.
     - Triggers `CelebrationModal` with `+Cash` and `+SP`.

#### B. Referral & Partnership ("Kasaya Aktar" & 1/1000 Badges)
1. **Gold Glowing Button Effect**:
   - In `social.css`:
     ```css
     .kickback-claim-glow {
       width: 100%;
       padding: 12px 16px;
       border-radius: 12px;
       background: linear-gradient(135deg, #ffd700 0%, #f59e0b 50%, #d97706 100%);
       color: #0b0f17;
       font-weight: 800;
       border: 1px solid rgba(255, 255, 255, 0.4);
       box-shadow: 0 0 20px rgba(245, 158, 11, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.4);
       position: relative;
       overflow: hidden;
       cursor: pointer;
       transition: transform 0.15s ease, box-shadow 0.15s ease;
     }
     .kickback-claim-glow:hover:not(:disabled) {
       transform: translateY(-1px);
       box-shadow: 0 0 28px rgba(245, 158, 11, 0.7);
     }
     .kickback-claim-glow::after {
       content: '';
       position: absolute;
       top: -50%;
       left: -50%;
       width: 200%;
       height: 200%;
       background: linear-gradient(60deg, transparent 40%, rgba(255, 255, 255, 0.45) 50%, transparent 60%);
       transform: rotate(25deg);
       animation: goldShimmerSweep 3s infinite;
     }
     @keyframes goldShimmerSweep {
       0% { transform: translateX(-120%) rotate(25deg); }
       40%, 100% { transform: translateX(120%) rotate(25deg); }
     }
     ```
2. **Shimmering 1/1000 Badge**:
   - In `social.css`:
     ```css
     .badge-shimmer-gold {
       background: linear-gradient(90deg, #eab308 0%, #fef08a 25%, #eab308 50%, #fef08a 75%, #eab308 100%);
       background-size: 200% auto;
       color: #0b0f17 !important;
       font-weight: 800 !important;
       box-shadow: 0 0 12px rgba(234, 179, 8, 0.4);
       animation: badgeShimmer 3s linear infinite;
     }
     @keyframes badgeShimmer {
       to { background-position: 200% center; }
     }
     ```

#### C. Clans / Cartels (Podium Layout & Auras)
1. **Podium Structure in `clans-screen.tsx`**:
   - When `activeSubTab === 'leaderboard'`, display a top-3 podium component above the clan list:
     - 3 podium pedestals: #2 (Silver, left, ~110px high), #1 (Gold, center, ~140px high, crowned), #3 (Bronze, right, ~95px high).
     - Each podium card displays emblem, tag, name, production/sec, and aura glow:
       - **#1 Gold Aura**: `border: 2px solid #ffd700; box-shadow: 0 0 25px rgba(255, 215, 0, 0.4), inset 0 0 12px rgba(255, 215, 0, 0.2); background: radial-gradient(circle at top, rgba(255, 215, 0, 0.18), rgba(24, 30, 41, 0.95));`
       - **#2 Silver Aura**: `border: 2px solid #cbd5e1; box-shadow: 0 0 20px rgba(203, 213, 225, 0.35), inset 0 0 10px rgba(203, 213, 225, 0.15); background: radial-gradient(circle at top, rgba(203, 213, 225, 0.15), rgba(24, 30, 41, 0.95));`
       - **#3 Bronze Aura**: `border: 2px solid #d97706; box-shadow: 0 0 18px rgba(217, 119, 6, 0.3), inset 0 0 10px rgba(217, 119, 6, 0.12); background: radial-gradient(circle at top, rgba(217, 119, 6, 0.12), rgba(24, 30, 41, 0.95));`
2. **Clan Level-Up Visual**:
   - Progress gauge towards next level capacity with glowing level-up badge.

#### D. Stars Shop (Cyber-Gold Shine & Holographic Tilt)
1. **Cyber-Gold Shine on `sa-pass-card`**:
   - In `shop-analytics.css`:
     ```css
     .sa-pass-card {
       position: relative;
       overflow: hidden;
       border-color: rgba(241, 201, 154, 0.5);
     }
     .sa-pass-card::after {
       content: '';
       position: absolute;
       top: -50%;
       left: -50%;
       width: 200%;
       height: 200%;
       background: linear-gradient(
         65deg,
         transparent 35%,
         rgba(255, 255, 255, 0.08) 45%,
         rgba(255, 215, 0, 0.22) 50%,
         rgba(255, 255, 255, 0.08) 55%,
         transparent 65%
       );
       transform: rotate(25deg);
       animation: cyberGoldSweep 7s ease-in-out infinite;
       pointer-events: none;
     }
     @keyframes cyberGoldSweep {
       0%, 20% { transform: translateX(-150%) rotate(25deg); }
       60%, 100% { transform: translateX(150%) rotate(25deg); }
     }
     ```
2. **Holographic Tilt Overlay**:
   - Iridescent gradient overlay on cosmetic cards with gentle CSS tilt/hover response.

#### E. Universal Celebration Modal (`celebration-modal.tsx`)
1. **Props Interface**:
   ```tsx
   export interface CelebrationModalProps {
     isOpen: boolean;
     onClose: () => void;
     title: string;
     subtitle?: string;
     rewardValue: string;
     badgeName?: string;
     icon?: string;
     actionLabel?: string;
   }
   ```
2. **Canvas Confetti Engine**:
   - 50–60 lightweight physics particles (`x, y, vx, vy, rot, vRot, color, size`).
   - 60fps `requestAnimationFrame` loop with friction and gravity.
   - Automatically stops when particles fall off screen or fade out (~2.5 seconds), guaranteeing 0% idle CPU overhead.
3. **Pop-in Modal Card**:
   - Rotating god-ray backdrop behind a large bouncing reward emblem.
   - Golden reward pill with high-contrast text.
   - Large glowing action button ("Harika!").

#### F. Mobile Responsiveness Standards (320px, 360px, 390px)
- **320px Guardrails**:
  - `padding: 10px` on containers.
  - Clan podium switches from horizontal 3-pillar layout to compact stacked or horizontally scroll-safe flex layout.
  - `sa-comparison-row`: labels and columns scale to `minmax(84px, 1.3fr) minmax(42px, 0.5fr) minmax(42px, 0.5fr)`.
  - All text wraps with `overflow-wrap: break-word;` and `hyphens: auto;`.
- **Reduced Motion Support**:
  - `@media (prefers-reduced-motion: reduce)` disables canvas particle loop and CSS shimmer sweeps, providing instant static celebration.

---

## 5. Verification Method

### 5.1 Independent Commands to Verify
To verify the existing test suite and confirm that any changes do not cause regressions:

```bash
# 1. Run the entire test suite across all 65 test files (all 761 tests must pass)
pnpm test

# 2. Run unit tests specific to Stream 4
npx vitest run apps/web/src/screens/missions-milestones.test.tsx
npx vitest run apps/web/src/screens/shop-screen.test.tsx
npx vitest run apps/web/src/screens/friends-screen.test.ts

# 3. Verify TypeScript type-checking across the workspace
pnpm typecheck

# 4. Verify production build
pnpm build
```

### 5.2 Key Files to Inspect
1. `apps/web/src/screens/missions-screen.tsx`: Verify `STREAK_MILESTONES` constants and all milestone card CSS classes.
2. `apps/web/src/screens/friends-screen.tsx`: Verify `isSafeTelegramInvite` regex and kickback button click handlers.
3. `apps/web/src/screens/shop-screen.tsx`: Verify `ShopScreen` purchase button classes and text strings.
4. `apps/web/src/screens/clans-screen.tsx`: Verify clan leaderboard parsing and podium rendering.
5. `apps/web/src/screens/social.css`, `apps/web/src/screens/shop-analytics.css`: Verify CSS selectors and media queries.

### 5.3 Invalidation Conditions
- Any removal or renaming of CSS classes tested in `missions-milestones.test.tsx` (`missions-milestones-track`, `milestone-card`, `is-achieved`, `is-target`, `is-locked`).
- Any alteration of `isSafeTelegramInvite` logic in `friends-screen.tsx`.
- Any external package installation (`npm install canvas-confetti` etc.) in `apps/web/package.json`.
- Any horizontal overflow or layout breakage at 320px viewport width.
