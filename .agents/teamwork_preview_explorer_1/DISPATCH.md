# Task Dispatch: Deep Read-Only Codebase Audit for Project Empire

## Objective
Conduct an exhaustive, read-only code audit of Project Empire Telegram Mini App (specifically `apps/web/src/screens/` and `apps/web/src/game/`).
Identify all UX, communication flow, state persistence, error handling, and arcade synchronization bugs.

## CRITICAL CONSTRAINTS (STRICTLY READ-ONLY):
- KESİNLİKLE HİÇBİR KAYNAK KODU VEYA TESTİ DEĞİŞTİRME/DÜZELTME/SİLME/EKLEME.
- Do NOT run git commands that modify the working tree. `git status` MUST remain completely clean.
- Do NOT write or patch source code. Only investigate using search/view tools, and write your findings into your `.agents/teamwork_preview_explorer_1/` directory.

## AUDIT CHECKLIST:

### R1. Frontend Screens & Communication Flows Audit (`apps/web/src/screens/` & `apps/web/src/game/`)
Inspect every screen component (e.g. `empire-screen.tsx`, `friends-screen.tsx`, `shop-screen.tsx`, `clans-screen.tsx`, `arcade-screen.tsx`, `analytics-screen.tsx`, `admin-screen.tsx`, etc.):
1. **Raw `fetch` calls**:
   - Check if components call `fetch()` directly instead of the centralized API client / `postGameResource` / `api/client`.
   - Check if authentication headers (`Authorization: Bearer ...`, `X-Empire-Session`, Telegram initData) are missing or inconsistent.
2. **Blind `finally` / Fake Success**:
   - Inspect all try/catch/finally blocks and async submit handlers.
   - Check if success modals, toast alerts, or congratulations are triggered inside `finally` blocks, or before checking response `.ok` / throwing on error, leading to "Fake Success" even when backend requests fail.
3. **F5 / Page Reload Persistence**:
   - Check if critical states (e.g., wallet connection status, pending claims, game session tokens, active clan role, critical user stats) are stored only in ephemeral component `useState` instead of React Query / persistent cache / localStorage / server sync.
4. **Missing Mutations & Query Invalidation**:
   - Check actions (upgrades, purchases, claiming rewards, joining clans, referral actions) where local state or server query cache is NOT invalidated (e.g. missing `queryClient.invalidateQueries(...)` or balance mutation), leaving UI stale or balance out of sync.
5. **Dangling Handlers & Broken Props**:
   - Look for empty placeholder callbacks (e.g., `onClick={() => {}}`), unhandled promises, or missing required props between parent screen and child modal/tab components.

### R2. Mini Games & Arcade Flow Audit (`apps/web/src/game/`)
Deeply inspect all mini game components:
- `catizen-merge-game.tsx`
- `crypto-crash-game.tsx`
- `crypto-mines-game.tsx`
- `crypto-predictions-game.tsx`
- `dynasty-cipher-game.tsx`
- `notcoin-tap-game.tsx`
and their supporting files (e.g. hooks, helpers, arcade wrappers):
1. **Server API Score & Balance Synchronization**:
   - Check if balance, payout, and score are genuinely sent and committed to the backend upon game end, cashout, or life loss.
   - Are payouts client-calculated and vulnerable to manipulation, or desynced from backend state?
2. **Network Disconnects & Error Handling**:
   - What happens if the network drops or API returns 500/400 during cashout, mine reveal, merge step, tap flush, or crash game multiplier climb?
   - Do user funds get stranded, entry fees deducted without a game session, or unfair infinite replay / free money exploits occur?
   - Are there unhandled Promise rejections during game loops or WebSockets/polling?

## REQUIRED OUTPUT:
Write your comprehensive findings report in Turkish to:
`c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_1\audit_report.md`
and write your `handoff.md` summarizing the discoveries.

Format each bug strictly with:
1. **Hata Başlığı & Etki Derecesi** (Kritik / Yüksek / Orta / Düşük)
2. **Etkilenen Dosya & Satır Numarası** (`file:///c:/Users/Administrator/Desktop/telegram%20kripto%20oyunu/...#Lxx`)
3. **Hatanın Mekaniği (Kullanıcı ve Sistem Ne Yaşar?)**: Kod parçası ile adım adım açıklama
4. **Önerilen Kalıcı Çözüm Özeti**: Mimari ve kod düzeyinde çözüm önerisi
