# Project: Project Empire Telegram Mini App — Visual & Animation Overhaul

## Architecture
The project elevates the visual design, micro-interactions, screen transitions, and arcade mini-game experiences to high-fidelity, 60fps, cyber-luxe mobile gaming standards.
The work is decomposed into 4 parallel, completely isolated streams with zero file overlap:
- **Stream 1**: Global Design System, Micro-Interactions, Zero-CLS Screen Transitions, Top Bar Odometer & Gold Spark Bursts
- **Stream 2**: Empire Screen & City Silhouette: 16 Business Cards Glassmorphism, Upgrade Burst, Floating Gold Coin Trajectory (+₺1.4M), Dynamic Moving City Skyline
- **Stream 3**: Arcade Suite "Game Juice": Notcoin Tap 3D Squish Tilt & CRIT Sparks, Catizen Merge Confetti/Stars & 100-Level Gradients, Crypto Crash Rocket Trail & Screen Shake, Dynasty Cipher Matrix Rain & Glitch
- **Stream 4**: Social, Missions, Shop & Celebration Modals: Streak Neon Energy Ribbon & Chest Unlock, Referral ‰1 Metallic Badge & Gold Shimmer Claim, Clan Top 3 Podiums & Auras, Stars Shop Hologram Shine, Reusable Canvas Confetti Modal

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Global Animation System | Keyframes (shimmer, pulse, 3D tilt, spring tactile haptics: scale 0.96) in `styles.css` | M1 (Stream 1) | ORIGINAL_REQUEST R1 |
| 2 | Zero-CLS Screen Transitions | Smooth slide/fade GPU-accelerated transitions on tab switch | M1 (Stream 1) | ORIGINAL_REQUEST R1 |
| 3 | Active Tab Halo & Under-Bar | Neon glow aura & centered under-bar on active bottom navigation item | M1 (Stream 1) | ORIGINAL_REQUEST R1 |
| 4 | Header Odometer & Spark Bursts | Dynamic rAF animated counter for Cash/Points and gold particle sparks on gain | M1 (Stream 1) | ORIGINAL_REQUEST R1 |
| 5 | Mobile Specificity & CLS Fix | Fix `.empire-claim-row` specificity conflict and topbar density on 320px screens | M1 (Stream 1) | Explorer 1 Survey |
| 6 | 16 Business Cards Glassmorphism | Cyber-holding glassmorphism, neon borders, and tier categorization across all 16 businesses | M2 (Stream 2) | ORIGINAL_REQUEST R2 |
| 7 | Upgrade Celebration Burst | Card scale pulse, neon glow, and animated level badge pop upon upgrading | M2 (Stream 2) | ORIGINAL_REQUEST R2 |
| 8 | Floating Gold Coin Trajectory | Curved Bezier gold coin flight path (+₺1.4M) from claim button to topbar wallet | M2 (Stream 2) | ORIGINAL_REQUEST R2 |
| 9 | Live Dynamic City Skyline | Rotating 3D elliptical orbits, twinkling window lights, and blinking tower beacons | M2 (Stream 2) | ORIGINAL_REQUEST R2 |
| 10 | Notcoin 3D Squish & Multi-Touch | Touch-angle perspective tilt, anisotropic squish deformation, and canvas spark pooling | M3 (Stream 3) | ORIGINAL_REQUEST R3 |
| 11 | Notcoin CRIT Sparks & Energy Wave | 360° neon CRIT sparks, animated travelling gradient neon wave on energy bar | M3 (Stream 3) | ORIGINAL_REQUEST R3 |
| 12 | Catizen Merge Confetti & Shake | Radial star/confetti explosion on merge, box drop rumble shake & unboxing flare | M3 (Stream 3) | ORIGINAL_REQUEST R3 |
| 13 | Catizen 100-Level Gradients | Mathematical hue cycling and 10 prestige eras across all 100 tiers | M3 (Stream 3) | ORIGINAL_REQUEST R3 |
| 14 | Crypto Crash Rocket & Thrusters | Real-time Canvas rocket thruster/plasma trail ascending candlestick chart | M3 (Stream 3) | ORIGINAL_REQUEST R3 |
| 15 | Crypto Crash Heartbeat & Shake | Escalating tension heartbeat pulse, screen shake on cashout/crash, red mist & victory confetti | M3 (Stream 3) | ORIGINAL_REQUEST R3 |
| 16 | Dynasty Cipher Matrix & Glitch | Digital rain character streaming, terminal glitch effect, and neon decode sweep | M3 (Stream 3) | ORIGINAL_REQUEST R3 |
| 17 | Streak Neon Ribbon & Chest Unlock | Glowing energy ribbon connecting milestones, chest unlock animation on claim | M4 (Stream 4) | ORIGINAL_REQUEST R4 |
| 18 | Streak API Claim Hook | Wire `POST /streak/claim` into `MissionsScreen` with celebratory feedback | M4 (Stream 4) | Explorer 3 Survey |
| 19 | Referral ‰1 Metallic Badge & Glow | Gold glowing "Kasaya Aktar" button with shimmer sweep and shimmering ‰1 badges | M4 (Stream 4) | ORIGINAL_REQUEST R4 |
| 20 | Clan Top 3 Olympic Podiums | 1st Gold (with crown), 2nd Silver, 3rd Bronze pedestals with metallic auras | M4 (Stream 4) | ORIGINAL_REQUEST R4 |
| 21 | Stars Shop Hologram & Shine | Luxury cyber-gold sweep and iridescent holographic tilt on Pass and cosmetic cards | M4 (Stream 4) | ORIGINAL_REQUEST R4 |
| 22 | Universal Celebration Modal | Lightweight Canvas confetti engine (60fps, self-terminating, zero leaks) | M4 (Stream 4) | ORIGINAL_REQUEST R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Stream 1: Global Design System & Navigation | `styles.css`, `game-layout.tsx`, `app.tsx`, `components/` | None | PLANNED |
| M2 | Stream 2: Empire Screen & City Silhouette | `empire-screen.tsx`, `empire-missions.css`, `city-silhouette.tsx` | None | PLANNED |
| M3 | Stream 3: Arcade Suite "Game Juice" | `arcade.css`, `catizen-merge-game.tsx`, `crypto-crash-game.tsx`, `notcoin-tap-game.tsx`, `dynasty-cipher-game.tsx` | None | PLANNED |
| M4 | Stream 4: Social, Missions, Shop & Celebrations | `friends-screen.tsx`, `missions-screen.tsx`, `shop-screen.tsx`, `clans-screen.tsx`, `social.css`, `shop-analytics.css` | None | PLANNED |
| M5 | Quality Gates, Review & Forensic Audit | Verification, Reviewers, Challengers, Auditor, `pnpm check` | M1, M2, M3, M4 | PLANNED |

## Exclusive Write Boundaries (Code Layout)
- **Worker 1 (Stream 1)**:
  - `apps/web/src/styles.css`
  - `apps/web/src/game/game-layout.tsx`
  - `apps/web/src/app.tsx`
  - `apps/web/src/components/animated-counter.tsx` (new shared component)
- **Worker 2 (Stream 2)**:
  - `apps/web/src/screens/empire-screen.tsx`
  - `apps/web/src/screens/empire-missions.css`
  - `apps/web/src/components/city-silhouette.tsx`
- **Worker 3 (Stream 3)**:
  - `apps/web/src/components/arcade.css`
  - `apps/web/src/components/catizen-merge-game.tsx`
  - `apps/web/src/components/crypto-crash-game.tsx`
  - `apps/web/src/components/notcoin-tap-game.tsx`
  - `apps/web/src/components/dynasty-cipher-game.tsx`
- **Worker 4 (Stream 4)**:
  - `apps/web/src/screens/friends-screen.tsx`
  - `apps/web/src/screens/missions-screen.tsx`
  - `apps/web/src/screens/shop-screen.tsx`
  - `apps/web/src/screens/clans-screen.tsx`
  - `apps/web/src/screens/social.css`
  - `apps/web/src/screens/shop-analytics.css`
  - `apps/web/src/components/celebration-modal.tsx` (new shared component)
