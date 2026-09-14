# 6. Adım — R5 Referral Motoru ve Nitelikli Davet Mantığı

Kaynak: Blueprint R5, Section 6 ve kullanıcının güvenlik/tasarım sınırlandırma direktifi.
Bu adımda Friends ekranının görsel tasarımına ve harici anti-sybil graph testlerine dokunulmadan; Telegram derin link çözümleme (`ref_<code>`), 30 dakikalık bağlama penceresi, self-referral engeli, 4 aşamalı nitelikli kilometre taşı yaşam döngüsü (`activation`, `retained_d2`, `retained_d7`, `progression`), balina sınırlandırma çarpanı (\(\max(0.25, \sqrt{20 / Q})\)) ve veritabanı şeması inşa edilmiştir.

## Yapılanlar

1. **Referral Motoru ve Matematik (`packages/game-core`):**
   - `parseReferralCodeFromStartParam`: `t.me/<bot>?startapp=ref_<code>` veya `tg_share` parametresinden temiz referans kodunu ayıklama ve format doğrulama.
   - `generateReferralDeepLink`: Kanonik paylaşım linki oluşturma.
   - `isWithinReferralBindWindow`: Yalnızca ilk 30 dakika içindeki bağlama isteklerini kabul etme (`REFERRAL_BIND_WINDOW_MS = 30 * 60 * 1000`).
   - `isSelfReferral`: Telegram ID bazlı kendi kendini davet etme girişimini engelleme.
   - `calculateReferralReward`: 4 aşamalı kilometre taşı ödülünü hesaplama ve 20 nitelikli davetten sonra balina koruma formülünü uygulama (Toplam tam kaliteli davet: 5.00x SRU).
   - `evaluateInviteeMilestones`: Davet edilen oyuncunun aktivasyon, D2 sadakat (2 ayrı aktif gün), D7 sadakat (7 günde \(\ge 4\) aktif gün) ve imparatorluk seviye eşiğini (\(\ge 10\)) saf fonksiyon olarak değerlendirme.
   - `getUnlockedReferralBadges`: Nitelikli davet sayısına göre kozmetik ve P2W olmayan rozet seviyelerini (1, 3, 5, 10, 25, 50, 100) listeleme.

2. **Paylaşılan DTO Sözleşmeleri (`packages/shared`):**
   - `ReferralMilestoneDto`, `PlayerReferralOverview`, `BindReferralRequest/Response`, `ReferralEventItem`, `ClaimReferralRewardRequest/Response` Zod şemaları ve tipleri.

3. **Veritabanı Şeması (`supabase/migrations/202609140004_referrals.sql`):**
   - `users.referral_code`: Oyuncuya özel tekil kod kolonu.
   - `referrals`: Davet eden ile davet edilen arasındaki değişmez 1-e-1 bağ, self-referral engelleyen DB check kısıtlaması (`invitee_user_id <> referrer_user_id`).
   - `referral_events`: Her bir kilometre taşını tekilleştiren (`unique(referral_id, milestone)`), mükerrer ödül dağıtımını engelleyen tablo.
   - RLS tüm tablolarda aktif, yetkiler izole.

4. **Doğrulama ve Testler:**
   - `packages/game-core/src/referral.test.ts` altında 14 yeni birim test eklendi.
   - Toplam test sayısı 68'den 82'ye yükseldi (%100 yeşil).

## Astra 6.0 İçin Bırakılan Alanlar

- Friends ekranının görsel tasarımı ve davet linki kopyalama/paylaşma UI bileşenleri.
- Sybil kümeleme, IP/cihaz parmak izi analizi ve graph-based bot tespit kuralları (R9 Anti-Fraud).
