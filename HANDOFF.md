# Project Empire geliştirici devir kaydı

## Güncel durum

- Mevcut adım: **5 — R4 Seasons, Missions & Streak Engine**.
- Durum: **TAMAMLANDI**. Sezon modeli, görev havuzu ve çarpanları, streak döngü mantığı, sözleşmeler ve veritabanı şeması tamamlandı; görsel tasarım (Missions UI) ve güvenlik denetimi Astra 6.0 için izole bırakıldı.
- Sıradaki adımlar:
  - **Astra 6.0**: Adım 2 (R1) canlı Telegram/güvenlik doğrulaması & Adım 4 (R3) Empire UI görsel bileşenleri.
  - **Sıradaki mantık adımı**: **6 — R5 Referral Motoru (Algoritma, Deep Link, D2/D7 Kilometre Taşları)**.
- Çalışma dalı: `work/step-05`.
- Kullanıcı her tamamlanan adım sonunda durulmasını ve kısa durum raporu verilmesini istiyor.

## 1–5. Adım Durum Özeti

1. **Adım 1 (R0 - Altyapı):** pnpm workspace, TypeScript, ESLint, Prettier, Vitest, CI akışı, `/health` endpoint'i. (TAMAMLANDI)
2. **Adım 2 (R1 - Telegram Shell & Auth):** HMAC auth, cookie oturumu ve Supabase auth migration'ı yazıldı; rotalar `/api` önekiyle bağlandı. Güvenlik incelemesi ve canlı Telegram testi Astra 6.0'a devredildi.
3. **Adım 3 (R2 - Core Economy):** `packages/game-core` deterministik ekonomi formülleri (upgrade cost, production, milestone bonuses, offline earnings, whale factor), 6 işletme tanımı, shared DTO'lar ve `202609140002_economy.sql` şeması. (TAMAMLANDI)
4. **Adım 4 (R3 - Empire UI):** Kullanıcı talimatı gereği Astra 6.0'a bırakıldı.
5. **Adım 5 (R4 - Seasons & Missions):**
   - `packages/game-core`: 9 kanonik görev tanımı (`DEFAULT_MISSIONS`), SRU zorluk çarpanları (`easy`: 0.75x, `normal`: 1.00x, `hard`: 1.25x, `weekly`: 5.00x), `calculateMissionReward`, `calculateStreakReward` (7 günlük döngü ve bonusu), `evaluateStreak` ardışık gün mantığı.
   - `packages/shared`: `SeasonDto`, `SeasonStatus`, `PlayerMissionInstance`, `PlayerStreakDto`, `ClaimMissionRequest/Response`, `ClaimStreakRequest/Response` Zod şemaları.
   - `supabase/migrations/202609140003_seasons_missions.sql`: `seasons`, `season_scores`, `missions`, `mission_instances`, `player_streaks` tabloları, Genesis Season seed verisi ve RLS koruması.
   - 11 yeni birim test eklendi (toplam 68 test, %100 başarılı).

## Doğrulama kanıtları

2026-09-14, Windows / Node 24.14.0 / pnpm 9.1.0:

- `pnpm format:check`: Başarılı, tüm dosyalar Prettier uyumlu.
- `pnpm lint`: Başarılı, 0 lint hatası.
- `pnpm typecheck`: 4 pakette (`game-core`, `shared`, `api`, `web`) hatasız tamamlandı.
- `pnpm test`: 6 test dosyası, 68/68 test başarılı.
- `pnpm -r build`: Web Vite build ve API Wrangler deploy dry-run başarılı.

## Bilinen sınırlar ve Astra 6.0 Notları

- Missions ekranı görsel tasarımı ve streak animasyonları kullanıcı isteği doğrultusunda Astra 6.0'a bırakıldı.
- Veritabanı fonksiyonlarının (RPC) güvenlik sertleştirmesi ve double-claim sızma testleri Astra 6.0'a devredildi.
