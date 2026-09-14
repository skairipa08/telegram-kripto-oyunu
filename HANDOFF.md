# Project Empire geliştirici devir kaydı

## Güncel durum

- Mevcut adım: **6 — R5 Referral Engine (Nitelikli Davetler & Gecikmeli Ödüller)**.
- Durum: **TAMAMLANDI**. Derin link çözümleme, 30 dakikalık bağlama süresi, self-referral engeli, 4 aşamalı kilometre taşı değerlendirmesi (`activation`, `retained_d2`, `retained_d7`, `progression`), balina azalan getiri formülü, sözleşmeler ve veritabanı şeması tamamlandı; Friends UI tasarımı ve anti-sybil siber güvenlik denetimi Astra 6.0 için izole bırakıldı.
- Sıradaki adımlar:
  - **Astra 6.0**: Adım 2 (R1) canlı Telegram/güvenlik doğrulaması & Adım 4 (R3) Empire UI & Friends UI görsel bileşenleri.
  - **Sıradaki mantık adımı**: **7 — R6 Liderlik Tablosu (Veri Mühendisliği, Global/Arkadaş Sıralaması, Sezon Dondurma)**.
- Çalışma dalı: `work/step-06`.
- Kullanıcı her tamamlanan adım sonunda durulmasını ve kısa durum raporu verilmesini istiyor.

## 1–6. Adım Durum Özeti

1. **Adım 1 (R0 - Altyapı):** pnpm workspace, TypeScript, ESLint, Prettier, Vitest, CI akışı, `/health` endpoint'i. (TAMAMLANDI)
2. **Adım 2 (R1 - Telegram Shell & Auth):** HMAC auth, cookie oturumu ve Supabase auth migration'ı yazıldı; rotalar `/api` önekiyle bağlandı. Güvenlik incelemesi ve canlı Telegram testi Astra 6.0'a devredildi.
3. **Adım 3 (R2 - Core Economy):** `packages/game-core` deterministik ekonomi formülleri (upgrade cost, production, milestone bonuses, offline earnings, whale factor), 6 işletme tanımı, shared DTO'lar ve `202609140002_economy.sql` şeması. (TAMAMLANDI)
4. **Adım 4 (R3 - Empire UI):** Kullanıcı talimatı gereği Astra 6.0'a bırakıldı.
5. **Adım 5 (R4 - Seasons & Missions):** 9 kanonik görev tanımı, SRU zorluk çarpanları, streak takip döngüsü, Zod sözleşmeleri ve `202609140003_seasons_missions.sql` şeması. (TAMAMLANDI)
6. **Adım 6 (R5 - Referral Engine):**
   - `packages/game-core`: Telegram startapp `ref_<code>` parametre ayrıştırıcı, 30 dakikalık bağlama penceresi kontrolü, self-referral engeli, 4 aşamalı nitelikli kilometre taşı yaşam döngüsü (toplam 5.00x SRU), 20 davet sonrası balina azalan getiri formülü, 7 kademeli kozmetik/rozet seviyeleri.
   - `packages/shared`: `ReferralMilestoneDto`, `PlayerReferralOverview`, `BindReferralRequest/Response`, `ReferralEventItem`, `ClaimReferralRewardRequest/Response` Zod şemaları.
   - `supabase/migrations/202609140004_referrals.sql`: `users.referral_code`, `referrals` (self-referral check kısıtlamalı) ve `referral_events` (mükerrer ödülü engelleyen unique kısıtlamalı) tabloları, RLS koruması.
   - 14 yeni birim test eklendi (toplam 82 test, %100 başarılı).

## Doğrulama kanıtları

2026-09-14, Windows / Node 24.14.0 / pnpm 9.1.0:

- `pnpm format:check`: Başarılı, tüm dosyalar Prettier uyumlu.
- `pnpm lint`: Başarılı, 0 lint hatası.
- `pnpm typecheck`: 4 pakette (`game-core`, `shared`, `api`, `web`) hatasız tamamlandı.
- `pnpm test`: 7 test dosyası, 82/82 test başarılı.
- `pnpm -r build`: Web Vite build ve API Wrangler deploy dry-run başarılı.

## Bilinen sınırlar ve Astra 6.0 Notları

- Friends ekranı görsel tasarımı kullanıcı isteği doğrultusunda Astra 6.0'a bırakıldı.
- Graph-based Sybil kümeleme, IP kümesi bot filtreleme (R9 Anti-Fraud) Astra 6.0'a devredildi.
