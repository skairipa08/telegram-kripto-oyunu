# Master Execution Plan — Project Orchestrator 11

## Objective
Transform all user interfaces, micro-interactions, screen transitions, and arcade mini-game experiences in Project Empire Telegram Mini App into a high-fidelity, 60fps, cyber-luxe neon/gold mobile gaming experience with zero layout shift and zero monorepo errors (`pnpm check` green).

## Stream Architecture (Max 4 Concurrent Workers)
Strict file boundary isolation to prevent merge conflicts and context pollution:

### Stream 1: Global Design System, Micro-Interactions & Navigation
- **Target Files**:
  - `apps/web/src/styles.css`
  - `apps/web/src/game/game-layout.tsx`
  - `apps/web/src/components/` (shared UI components, tab bar, header stats, counter)
  - `apps/web/src/app.tsx`
- **Features**:
  - Global CSS animation system (shimmer, pulse, 3D tilt, spring tactile haptics: scale 0.96, neon glow)
  - Smooth slide/fade screen/tab transitions, active tab halo/under-bar light effect
  - Top bar dynamic animated number roll/odometer for Cash, Season Points, Level with gold spark bursts on balance increases.

### Stream 2: Empire Screen & City / Holding Visual Experience
- **Target Files**:
  - `apps/web/src/screens/empire-screen.tsx`
  - `apps/web/src/screens/empire-missions.css`
  - `apps/web/src/components/city-silhouette.tsx`
- **Features**:
  - Visual overhaul of 16 business cards (cyber-holding glassmorphism, neon borders, upgrade pulse explosion, animated level badges)
  - "Collect All" and periodic cash generation with floating gold coin trajectory animation (`+₺1.4M`)
  - Live animated city skyline in background (moving atmospheric night/day lights, skyscraper window twinkle/pulse, subtle depth/parallax).

### Stream 3: Arcade Suite "Game Juice" & Particle FX
- **Target Files**:
  - `apps/web/src/components/arcade.css`
  - `apps/web/src/components/catizen-merge-game.tsx`
  - `apps/web/src/components/crypto-crash-game.tsx`
  - `apps/web/src/components/notcoin-tap-game.tsx`
  - `apps/web/src/components/dynasty-cipher-game.tsx`
- **Features**:
  - Notcoin Tap: 3D dynamic squish tilt based on touch angle, multi-touch `CRIT! +50` sparks, flowing neon wave in energy bar.
  - Catizen Merge: Confetti/star explosion on merge, box drop shake, distinct gradients and glow accents across 100 levels.
  - Crypto Crash: Rocket/neon trail climbing live candlestick chart, tension heartbeat pulse, screen shake on cashout/crash, dramatic red mist on crash and confetti victory flash.
  - Dynasty Cipher: Matrix streaming glyphs, glitch and neon decipher surge upon successful hack.

### Stream 4: Social, Missions, Shop & Celebration Modals
- **Target Files**:
  - `apps/web/src/screens/friends-screen.tsx`
  - `apps/web/src/screens/missions-screen.tsx`
  - `apps/web/src/screens/shop-screen.tsx`
  - `apps/web/src/screens/clans-screen.tsx`
  - `apps/web/src/screens/social.css`
  - `apps/web/src/screens/shop-analytics.css`
- **Features**:
  - Streak & Milestones: Neon energy ribbon connecting 7d, 30d, 90d, 180d, 365d milestones; chest unlock celebration FX on claim.
  - Referral / Partnership: Glowing gold "Transfer to Vault" button, shimmering 1/1000 badges in invite cards.
  - Clans / Cartels: Top 3 podium gold, silver, bronze auras; clan level-up visual flare.
  - Stars Shop: Empire Pass luxury card shine & holographic tilt effect.
  - Universal Celebration Modal: Particle burst / confetti canvas for milestone and reward completions.

## Phased Workflow
1. **Phase 0: Survey & Investigation**
   - Dispatch Explorers to inspect existing implementations, DOM structures, state flows, and CSS class hierarchies across all 4 streams.
   - Synthesize explorer findings into concrete implementation blueprints.
2. **Phase 1-4: Implementation & Verification**
   - Dispatch dedicated specialized Workers (max 4 concurrent) to execute the visual updates in their isolated stream scopes.
   - Workers run tests, lint, and build verification (`pnpm check`).
3. **Phase 5: Gate Review, Adversarial Challenge & Forensic Audit**
   - Reviewers inspect visual fidelity, responsive behavior (320px, 360px, 390px), 60fps performance (transform/opacity only), and zero regressions.
   - Challengers test edge cases and device sizes.
   - Forensic Auditor confirms zero cheating/mocking/regression.
4. **Phase 6: Final Monorepo Verification & Human Report**
   - Final `pnpm check` verification.
   - Compile HANDOFF.md and report to parent orchestrator.
