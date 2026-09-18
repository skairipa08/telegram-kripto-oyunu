# Task Dispatch: Deep Read-Only Codebase Audit for Project Empire

## Objective
Conduct an exhaustive, read-only code audit of Project Empire Telegram Mini App (specifically `apps/web/src/screens/` and `apps/web/src/game/`).
Identify all UX, communication flow, state persistence, error handling, and arcade synchronization bugs.

## CRITICAL CONSTRAINTS (STRICTLY READ-ONLY):
- KESİNLİKLE HİÇBİR KAYNAK KODU VEYA TESTİ DEĞİŞTİRME/DÜZELTME/SİLME/EKLEME.
- Do NOT run git commands that modify the working tree. `git status` MUST remain completely clean.
- Do NOT write or patch source code. Only investigate using search/view tools, and write your findings into your `.agents/teamwork_preview_explorer_2/` directory.

## TARGET FILES:
1. All screens in `apps/web/src/screens/`:
   - `empire-screen.tsx`
   - `friends-screen.tsx`
   - `shop-screen.tsx`
   - `clans-screen.tsx`
   - `arcade-screen.tsx`
   - `analytics-screen.tsx`
   - `admin-screen.tsx`
   - (and any other screens or modals in `apps/web/src/screens/`)
2. All mini games in `apps/web/src/game/`:
   - `catizen-merge-game.tsx`
   - `crypto-crash-game.tsx`
   - `crypto-mines-game.tsx`
   - `crypto-predictions-game.tsx`
   - `dynasty-cipher-game.tsx`
   - `notcoin-tap-game.tsx`
   - (and any supporting files/hooks in `apps/web/src/game/`)

## AUDIT CHECKLIST:
### R1. Frontend Screens & Communication Flows Audit:
1. **Raw `fetch` calls**:
   - Calling `fetch()` directly instead of `postGameResource` or `api/client`.
   - Missing `Authorization`, `X-Empire-Session`, or Telegram initData headers.
2. **Blind `finally` / Fake Success**:
   - Showing success modals, toasts, or congratulations inside `finally` blocks, or before checking response `.ok` / throwing on error.
3. **F5 / Page Reload Persistence**:
   - Critical states stored only in ephemeral `useState` instead of React Query / persistent cache / localStorage / server sync.
4. **Missing Mutations & Query Invalidation**:
   - Actions that do not update balance, score, or invalidate queries (e.g. `queryClient.invalidateQueries`), leaving UI stale.
5. **Dangling Handlers & Broken Props**:
   - Empty action callbacks (`onClick={() => {}}`), unhandled promises, or missing required props between parent screen and child modal/tab components.

### R2. Mini Games & Arcade Flow Audit:
1. **Server API Score & Balance Synchronization**:
   - Balance, payout, and score recorded correctly to server API upon game end, cashout, or life loss?
   - Client-side payout vulnerabilities or desync from backend state?
2. **Network Disconnects & Error Handling**:
   - Network drop or API 500/400 during cashout, mine reveal, merge step, tap flush, crash multiplier climb.
   - Stranded user funds, deducted entry fees without session, unfair replay / free money exploits.
   - Unhandled Promise rejections.

## REQUIRED OUTPUT:
Write your comprehensive findings report in Turkish to:
`c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_2\audit_report.md`
and write your `handoff.md` summarizing the discoveries.

Format each bug strictly with:
1. **Hata Başlığı & Etki Derecesi** (Kritik / Yüksek / Orta / Düşük)
2. **Etkilenen Dosya & Satır Numarası** (`file:///c:/Users/Administrator/Desktop/telegram%20kripto%20oyunu/...#Lxx`)
3. **Hatanın Mekaniği (Kullanıcı ve Sistem Ne Yaşar?)**: Kod parçası ile adım adım açıklama
4. **Önerilen Kalıcı Çözüm Özeti**: Mimari ve kod düzeyinde çözüm önerisi
