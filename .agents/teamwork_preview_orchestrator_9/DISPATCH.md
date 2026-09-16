# Dispatch Record

## 2026-09-16T11:19:35Z
You are the Project Orchestrator (teamwork_preview_orchestrator_9) for Project Empire Arcade Suite Overhaul.

Working directory: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_9
Your identity: teamwork_preview_orchestrator_9
Authoritative Request: c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\ORIGINAL_REQUEST.md (see the latest entry dated 2026-09-16T11:18:25Z)

### Objective
Revamp and expand the Project Empire mini-game arcade suite:
1. Catizen-Style Merge Game Overhaul (CatizenMergeGame)
2. Dynasty Cipher Terminal Revamp (DynastyCipherGame)
3. Notcoin Tap-to-Earn Clicker Game (NotcoinTapGame) with Cash & Telegram Stars upgrades and strict economic balance
4. Crypto Candlestick "Moon or Doom" Crash Game (CryptoCrashGame)

### Architecture & Agent Boundary Constraints (CRITICAL: Max 2 Concurrent Agents)
To respect the user's strict maximum 2-agent concurrency limit and isolate responsibilities:
- Stream 1 - Core Math Models, Simulation & Economy Engine:
  - Scope: packages/game-core/src/, packages/shared/src/, apps/api/src/
  - Responsibilities: Mathematical formulas for Notcoin Tap economy (energy curve, tap scaling base * 1.5^lvl, offline TapBot accumulator, Stars SKU bindings), Catizen merge progression economy (tier multipliers 1 to 10+, idle cash rate, drop parcel spawn probabilities, auto-merge solver), Crypto Candlestick crash math (provably fair random walk/multiplier curve, crash point distribution, payout calc), exhaustive unit tests and invariant proofs.
- Stream 2 - Rich Interactive Frontend Mini-Games & Mini App UI:
  - Scope: apps/web/src/components/, apps/web/src/screens/, apps/web/src/game/
  - Responsibilities: Catizen-Style Merge visual tier progression, drag/drop & click merge, particle burst, mystery parcel drops, idle DPS coin counters, auto-bot toggle; Dynasty Cipher cyberpunk terminal styling, audio/visual decrypt pulse, combo multipliers, time-attack, hack progress bar; Notcoin Tap-to-Earn 3D tactile coin squish/tilt, floating digits, animated energy bar, dual-currency upgrade drawer; Crypto Candlestick 60fps canvas/SVG chart, rising multiplier, Boğa/Kârı Al button, win/crash animations. Mobile 320px–390px zero overflow, Astra 6.0 theme.

### Quality & Performance Gates
- Monorepo verification must pass with 0 errors: `pnpm check` (lint, format:check, typecheck, test, build).
- Unit & stress tests in packages/game-core.
- Mobile responsiveness on 320px–390px.
- Update HANDOFF.md with game mechanics, mathematical formulas, and test evidence.

Maintain your BRIEFING.md and progress.md in your working directory. Report completion back to Sentinel when finished.
