# Project Empire geliştirici devir kaydı

## Güncel durum

- Mevcut adım: **3 — R2 Core Economy Engine & Formulas**.
- Durum: **TAMAMLANDI**. Saf matematik ve ekonomi motoru, sözleşmeler ve veritabanı şeması tamamlandı; tasarım ve güvenlik katmanına dokunulmadan Astra 6.0 için izole bırakıldı.
- Sıradaki adımlar:
  - **Astra 6.0**: Adım 2 (R1) canlı Telegram/güvenlik doğrulaması & Adım 4 (R3) Empire UI görsel bileşenleri.
  - **Sıradaki mantık adımı**: **5 — R4 Sezonlar ve Görev Mantığı (Backend & Algorithms)**.
- Çalışma dalı: `work/step-03`.
- Kullanıcı her tamamlanan adım sonunda durulmasını ve kısa durum raporu verilmesini istiyor.

## 1., 2. ve 3. Adım Özeti

1. **Adım 1 (R0 - Altyapı):** pnpm workspace, TypeScript, ESLint, Prettier, Vitest, CI akışı, `/health` endpoint'i.
2. **Adım 2 (R1 - Telegram Shell & Auth):**
   - CPT tarafından HMAC auth, cookie oturumu ve Supabase auth migration'ı yazıldı.
   - Gemini tarafından `/api` rota prefix yönlendirmesi düzeltildi ve 40/40 test yeşile çekildi.
   - Güvenlik incelemesi ve canlı BotFather/Telegram testi Astra 6.0 için bekletildi.
3. **Adım 3 (R2 - Core Economy):**
   - `packages/game-core`: 6 kanonik işletme (`DEFAULT_BUSINESSES`) ve ekonomi konfigürasyonu (`DEFAULT_ECONOMY_CONFIG`).
   - Deterministik saf matematik formülleri: `calculateUpgradeCost`, `calculateMilestoneMultiplier`, `calculateProductionPerSecond`, `calculateTotalProduction`, `calculateOfflineEarnings`, `calculateSRU`, `calculateReferralWhaleFactor`.
   - `packages/shared`: `PlayerBusiness`, `PlayerEconomyState`, `ClaimCashRequest/Response`, `UpgradeBusinessRequest/Response` Zod sözleşmeleri.
   - `supabase/migrations/202609140002_economy.sql`: `economy_config`, `businesses`, `player_balances`, `player_businesses`, `reward_ledger` tabloları ve RLS.
   - 17 yeni birim test eklendi (toplam 57 test, %100 başarılı).

## Doğrulama kanıtları

2026-09-14, Windows / Node 24.14.0 / pnpm 9.1.0:

- `pnpm format:check`: Başarılı, tüm dosyalar Prettier uyumlu.
- `pnpm lint`: Başarılı, 0 lint hatası.
- `pnpm typecheck`: 4 pakette (`game-core`, `shared`, `api`, `web`) hatasız tamamlandı.
- `pnpm test`: 5 test dosyası, 57/57 test başarılı.
- `pnpm -r build`: Web Vite build ve API Wrangler deploy dry-run başarılı.

## Bilinen sınırlar ve Astra 6.0 Notları

- Tasarım ve görsel bileşenler (Tailwind stilleri, Empire UI kartları) kullanıcı isteği doğrultusunda Astra 6.0'a bırakıldı.
- Veritabanı fonksiyonlarının (RPC) güvenlik sertleştirmesi ve sızma denetimi Astra 6.0'a devredildi.
- Token/Web3 özellikleri ve Telegram Stars ödemeleri Blueprint kurallarına uygun olarak feature flag ile kapalı tutuldu.
