## 2026-09-17T12:27:48Z

Conduct a comprehensive, read-only audit of Project Empire Telegram Mini App (apps/web/src/screens/ and apps/web/src/game/) to identify all UX, communication flow, state persistence, error handling, and arcade synchronization bugs. Produce a detailed findings report.

CRITICAL CONSTRAINTS:
1. STRICTLY READ-ONLY: KESİNLİKLE HİÇBİR KAYNAK KODU VEYA TESTİ DEĞİŞTİRME/DÜZELTME. `git status` must remain completely clean throughout. No code edits or patches.
2. REQUESTED TEAM STRUCTURE: The user requested exactly 1 audit agent (read-only, find bugs only, do not patch). Dispatch a dedicated audit specialist (e.g. explorer/worker) to perform this deep code audit without code modifications.
3. REQUIREMENTS:
   - R1. Frontend Screens & Communication Flows Audit (Read-Only):
     - Check all components in `apps/web/src/screens/` and `apps/web/src/game/` (e.g. empire-screen.tsx, friends-screen.tsx, shop-screen.tsx, clans-screen.tsx, arcade-screen.tsx, analytics-screen.tsx, admin-screen.tsx, etc.):
       * Raw `fetch` calls: directly calling `fetch()` instead of `postGameResource` or `api/client`, missing `Authorization` / `X-Empire-Session` headers.
       * Blind `finally` / Fake Success: showing success modals or congratulations even when requests fail.
       * F5 / Reload Persistence: critical states stored only in ephemeral `useState` instead of server-backed or persistent cache.
       * Missing Mutations & Query Invalidation: actions that do not update user balance, score, or invalidate queries, leaving UI stale.
       * Dangling Handlers: empty action functions or props not passed from parent.
   - R2. Mini Games & Arcade Flow Audit (Read-Only):
     - Inspect all mini game components (`catizen-merge-game.tsx`, `crypto-crash-game.tsx`, `crypto-mines-game.tsx`, `crypto-predictions-game.tsx`, `dynasty-cipher-game.tsx`, `notcoin-tap-game.tsx`):
       * Correct recording of balance and score to the server API upon game end, cashout, or life loss.
       * Behavior during network disconnects or API errors: does user funds get stranded, or unfair gains/losses occur?
   - R3. Comprehensive Report:
     - Produce a comprehensive markdown report formatted as:
       1. Hata Başlığı & Etki Derecesi (Kritik / Yüksek / Orta / Düşük)
       2. Etkilenen Dosya & Satır Numarası (`file:///...#Lxx`)
       3. Hatanın Mekaniği (Kullanıcı ne yaşar?)
       4. Önerilen Kalıcı Çözüm Özeti
4. COORDINATION & REPORTING:
   - Maintain `progress.md` and `BRIEFING.md` in your working directory (`c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_orchestrator_13`).
   - When finished, write your findings and comprehensive report, and notify the sentinel when complete.
