# Project Empire geliştirici devir kaydı

## Güncel durum

- Mevcut adım: **Ekonomi Matematiksel Dengesi, Başlangıç Bakiyeleri, ROI Modelleri ve Deterministik Simülasyon (R1–R5)**.
- Durum: **TAMAMLANDI**. Başlangıç hibesi (100 Nakit taban, +500 referans bonusu), sıfır-gelir kilitlenmesini önleyen veritabanı tetikleyici ve RPC'leri, amortisman/ROI formülleri, güvenli büyük sayı formatlayıcısı, deterministik simülasyon motoru (`scripts/simulate-economy.ts`), `/economy/roi` ve `/economy/simulation` API uç noktaları tamamlandı; Astra 6.0 UI ve anti-cheat sınırları eksiksiz korundu.
- Sıradaki adımlar:
  - **Astra 6.0**: Canlı Telegram/güvenlik doğrulaması, Adım 4 (R3) Empire UI, Liderlik Tablosu & Mağaza UI görsel bileşenleri, bot kümeleme ve anti-fraud hardening.
- Kullanıcı her tamamlanan adım sonunda durulmasını ve kısa durum raporu verilmesini istiyor.

## 1–12. Adım Durum Özeti

1. **Adım 1 (R0 - Altyapı):** pnpm workspace, TypeScript, ESLint, Prettier, Vitest, CI akışı, `/health` endpoint'i. (TAMAMLANDI)
2. **Adım 2 (R1 - Telegram Shell & Auth):** HMAC auth, cookie oturumu ve Supabase auth migration'ı yazıldı; rotalar `/api` önekiyle bağlandı. Güvenlik incelemesi ve canlı Telegram testi Astra 6.0'a devredildi. (TAMAMLANDI)
3. **Adım 3 (R2 - Core Economy):** `packages/game-core` deterministik ekonomi formülleri (upgrade cost, production, milestone bonuses, offline earnings, whale factor), 6 işletme tanımı, shared DTO'lar ve `202609140002_economy.sql` şeması. (TAMAMLANDI)
4. **Adım 4 (R3 - Empire UI):** Kullanıcı talimatı gereği Astra 6.0'a bırakıldı.
5. **Adım 5 (R4 - Seasons & Missions):** 9 kanonik görev tanımı, SRU zorluk çarpanları, streak takip döngüsü, Zod sözleşmeleri ve `202609140003_seasons_missions.sql` şeması. (TAMAMLANDI)
6. **Adım 6 (R5 - Referral Engine):** Telegram startapp `ref_<code>` ayrıştırıcı, 30 dakikalık bağlama penceresi, 4 aşamalı kilometre taşı değerlendirmesi (5.00x SRU), 20 davet sonrası balina faktörü, `202609140004_referrals.sql`. (TAMAMLANDI)
7. **Adım 7 (R6 - Leaderboards Engine & Season Freeze):**
   - `packages/game-core/src/leaderboard.ts`: Deterministik eşitlik bozma (`points DESC, updated_at ASC, user_id ASC`), cursor tabanlı sayfalama (`base64` keyset), kullanıcı sıra sabitleme (rank pinning), arkadaş grafiği filtreleme, sezon dondurma doğrulama.
   - `packages/shared/src/index.ts`: `LeaderboardEntryDto`, `LeaderboardResponseDto`, `LeaderboardQuerySchema`, `FreezeSeasonRequest/Response`.
   - `supabase/migrations/202609140005_step7_to_11_backend.sql`: `season_scores(season_id, points desc, updated_at asc, user_id asc)` birleşik indeksi, `season_archives` nihai sıralama tablosu, `empire_leaderboard_*` RPC fonksiyonları.
   - `apps/api/src/leaderboard/`: `GET /leaderboard` (global ve arkadaşlar), `POST /admin/seasons/:id/freeze`.
8. **Adım 8 (R7 - Stars Monetization & Pass Entitlements):**
   - `packages/game-core/src/monetization.ts`: Kolaylık bileti hak hesaplama (12 saat = 43.200s çevrimdışı tavanı vs 4 saat = 14.400s ücretsiz; 3 yükseltme kuyruğu; 3 görev yenileme hakkı; otomatik tahsilat), eklemeli süre yığma (30 gün), katı anti-P2W kuralları (sıfır Sezon Puanı çarpanı, para ile puan/sıralama satın alma yasağı).
   - `packages/shared/src/index.ts`: `ShopSkuDto`, `ConveniencePassDto`, `ShopCatalogResponseDto`, `CreateInvoiceRequest/Response`, `FulfillPaymentRequest/Response`.
   - `supabase/migrations/202609140005_step7_to_11_backend.sql`: `purchases` tablosu (benzersiz `telegram_payment_charge_id` ile mükerrer ödemeyi engelleyen idempotency), `player_entitlements` tablosu.
   - `apps/api/src/shop/`: `GET /shop`, `POST /shop/invoice`, `POST /telegram/webhook` (pre_checkout_query ve idempotent successful_payment).
9. **Adım 9 (R8 - Admin Remote Config & Feature Flags):**
   - `packages/game-core/src/remote-config.ts`: 2 katmanlı güvenli geri çekilme hiyerarşisi (DB `economy_config` -> bellek içi `DEFAULT_ECONOMY_CONFIG`), özellik bayrağı değerlendirici (`feature.token` varsayılan olarak kesinlikle `false`).
   - `packages/shared/src/index.ts`: `EconomyConfigDto`, `PublicConfigResponse`, `AdminAuditLogDto`, `UpdateConfigRequest/Response`.
   - `supabase/migrations/202609140005_step7_to_11_backend.sql`: Bölüm 18'in 20 kanonik anahtar tohumlaması, `admin_audit_logs` denetim izi tablosu.
   - `apps/api/src/config/`: `GET /config/public`, `POST /admin/config`.
10. **Adım 11 (R10 - Analytics Pipeline & Cohort Models):**
    - `packages/game-core/src/analytics.ts`: Bölüm 18 kanonik 21 analitik olay taksonomisi doğrulaması, UTC takvim günü normalizasyonlu D1, D2 ve D7 kohort tutunma hesaplama modelleri, kullanıcı aktivasyon oranı (`tutorial_complete` + `business_upgrade`), ödeyen dönüşüm oranı ve ARPPU (kullanıcı başına ortalama Stars geliri).
    - `packages/shared/src/index.ts`: `CanonicalAnalyticsEvent`, `TrackAnalyticsEventsRequest/Response`, `RetentionCohortDto`, `AnalyticsMetricsResponse`.
    - `supabase/migrations/202609140005_step7_to_11_backend.sql`: `analytics_events` ve `daily_metrics` tabloları.
    - `apps/api/src/analytics/`: `POST /analytics/events`, `GET /analytics/metrics`.
11. **Adım 12 (Ekonomi Dengeleme, Başlangıç Bakiyesi, ROI Modelleri & Simülasyon):**
    - **R1: Başlangıç Bakiyesi & Kilitlenme Önleme:**
      - `packages/game-core/src/starter.ts`: `getStarterEconomyState()` saf fonksiyonu; 100 Nakit taban başlangıç bakiyesi (Street Stand Seviye 1'i ilk 5 saniyede açmaya yetecek ve 30 saniye içinde 30 Nakit üreterek kilitlenmeyi önleyecek şekilde kalibre edildi), +500 Nakit referans artışı (toplam 600 Nakit; Street Stand Seviye 4'e hemen geçiş imkanı), 6 işletmenin seviye 0 olarak başlatılması.
      - `supabase/migrations/202609140006_economy_starter_and_roi.sql`: `player_balances.cash` varsayılanını 100 yapan şema değişikliği, yeni kullanıcı kaydında otomatik olarak bakiye, 6 işletme ve `starter_grant` ödül kaydı oluşturan `trigger_new_user_starter_economy` tetikleyicisi, `empire_init_player_economy` ve `empire_economy_get_player_state` RPC'leri.
      - `apps/api/src/auth/test-db.ts`: `202609140006` migrasyonunun PGlite ortamına kaydedilmesi ve ekonomi RPC'lerinin eklenmesi.
    - **R2: Matematiksel Denge, Amortisman (Payback) ve ROI:**
      - `packages/game-core/src/formulas.ts`: `calculatePaybackPeriodSeconds(upgradeCost, currentProduction, nextProduction)` amortisman süresi hesaplayıcısı (maliyet <= 0 ise 0, delta <= 0 ise Infinity, tüm 6 kademe ve Seviye 10 sıçraması için matematiksel kesinlik).
      - `calculateMarginalRoi()` marjinal getiri oranı formülü.
      - `calculateOptimalNextUpgrade()` en kısa amortisman süresi ve en yüksek marjinal ROI'ye göre deterministik çoklu anahtar sıralamalı (amortisman ASC, maliyet ASC, slug ASC) en iyi yükseltme öneri motoru.
      - `formatCompactNumber()` 0 ile 10^15 (katrilyon) ve üzeri için sıfır hassasiyet kayıplı (K, M, B, T, Q, Qi) ve kademe atlama korumalı (999.950 -> 1M) sayı/bigint formatlayıcısı.
      - `packages/game-core/src/index.ts`: Tüm yeni fonksiyon ve arayüzlerin dışa aktarımı.
    - **R3: Deterministik Simülasyon Motoru & CLI:**
      - `packages/game-core/src/simulation.ts`: 1 saat, 24 saat, 7 gün ve 30 günlük başsız deterministik simülasyon çalıştırıcısı (`simulateProgression`). Toplam kazanılan nakit, işletme seviyeleri, kilit açılma süreleri ve Kolaylık Bileti (4 saat vs 12 saat çevrimdışı tavanı) etki analizi.
      - `scripts/simulate-economy.ts`: CLI üzerinden `pnpm simulate` ile doğrudan çalıştırılabilen, formatlanmış tablolar sunan simülasyon aracı.
    - **R4: API & Shared DTO Yükseltmeleri:**
      - `packages/shared/src/index.ts`: `playerBusinessSchema`'ya `paybackPeriodSeconds`, `marginalRoi`, `nextProductionPerSecond` eklendi; `economyRoiResponseSchema` ve `economySimulationResponseSchema` tanımlandı.
      - `apps/api/src/economy/`: `EconomyStore` arayüzü ve `SupabaseEconomyStore`, `GET /economy/roi` ve `GET /economy/simulation` API rotaları oluşturuldu ve `apps/api/src/index.ts` üzerinde `/` ve `/api` önekleriyle bağlandı.
    - **R5: Astra 6.0 Katı Alan İzolasyonu:**
      - `apps/web/` altındaki hiçbir dosyaya dokunulmadı (0 değişiklik).
      - Anti-cheat ve anti-fraud algoritmalarına dokunulmadı (0 değişiklik).

## Doğrulama kanıtları

2026-09-14, Windows / Node 24.14.0 / pnpm 9.1.0:

- `pnpm lint`: Başarılı, 0 lint hatası.
- `pnpm format:check`: Başarılı, tüm kaynak ve test dosyaları Prettier uyumlu.
- `pnpm typecheck`: 4 pakette (`packages/game-core`, `packages/shared`, `apps/api`, `apps/web`) 0 hata ile tamamlandı.
- `pnpm test`: 20 test dosyası, 174/174 birim ve PGlite entegrasyon testi %100 başarılı (önceki 137 teste eklenen 37 yeni test eksiksiz yeşil).
- `pnpm simulate`: 1 saat (1.1B Nakit), 24 saat (666.5T Nakit), 7 gün (84.3Q Nakit) ve 30 gün (1.7Qi Nakit) simülasyon senaryoları hatasız çalıştı.
- `pnpm -r build`: Web Vite build ve API Wrangler deploy dry-run başarılı.
- `pnpm check`: Tüm kalite kapıları tek komutta (lint, format, typecheck, test, build) exit code 0 ile tamamlandı.

## Bilinen sınırlar ve Astra 6.0 Notları

- Liderlik Tablosu, Mağaza ve Analitik paneli kullanıcı arayüzü (React/CSS) kullanıcı isteği doğrultusunda Astra 6.0'a bırakıldı.
- Graph-based Sybil kümeleme, IP kümesi bot filtreleme ve dış yetkilendirme sızma testleri (R9 Anti-Fraud) Astra 6.0'a devredildi.
