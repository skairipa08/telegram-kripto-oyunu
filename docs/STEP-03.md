# 3. Adım — R2 Core Economy Motoru ve Veri Modeli

Kaynak: Blueprint R2 ve kullanıcının güvenlik/tasarım sınırlandırma direktifi.
Bu adımda doğrudan arayüz veya siber güvenlik katmanına karışılmadan, oyunun deterministik matematik motoru, paylaşılan veri tipleri ve veritabanı şeması kurulmuştur.

## Yapılanlar

1. **Saf Deterministik Matematik Motoru (`packages/game-core`):**
   - `calculateUpgradeCost`: Seviye maliyet eğrisi (\(\text{baseCost} \times 1.18^{\text{level}-1}\)).
   - `calculateMilestoneMultiplier`: 10, 25, 50, 100 seviyelerinde \(\times 2\) çarpan, sonrasında her +50 seviyede \(\times 1.5\).
   - `calculateProductionPerSecond`: Üretim formülü (\(\text{baseIncome} \times \text{level} \times 1.07^{\text{level}-1} \times \text{milestoneMultiplier}\)).
   - `calculateTotalProduction`: Tüm işletmelerin toplam üretim hızı.
   - `calculateOfflineEarnings`: Çevrimdışı kazanç ve 4 saat / 12 saat tavan kontrolü.
   - `calculateSRU`: QAP bazlı Sezon Puanı azalan küresel emisyon formülü (Blueprint kıyaslama tablosu ile testli).
   - `calculateReferralWhaleFactor`: 20 davet sonrası balina azalan getiri formülü (\(\max(0.25, \sqrt{20 / Q})\)).
   - 6 kanonik işletme tanımı (`DEFAULT_BUSINESSES`) ve başlangıç konfigürasyonu (`DEFAULT_ECONOMY_CONFIG`).

2. **Paylaşılan DTO ve Sözleşmeler (`packages/shared`):**
   - `PlayerBusiness`, `PlayerEconomyState`, `PlayerState` Zod şemaları ve tipleri.
   - `ClaimCashRequest`, `ClaimCashResponse`, `UpgradeBusinessRequest`, `UpgradeBusinessResponse`.

3. **Veritabanı Şeması (`supabase/migrations/202609140002_economy.sql`):**
   - `economy_config`: Deploy gerektirmeyen uzaktan ayarlar (SRU, tavan süreleri, büyüme katsayıları).
   - `businesses`: 6 kanonik işletme ve başlangıç seed kayıtları.
   - `player_balances`: Cash ve Sezon Puanı bakiyeleri.
   - `player_businesses`: Oyuncunun sahip olduğu işletmeler, seviyeler ve son claim zamanı.
   - `reward_ledger`: İdempotency anahtarlı değişmez ödül ve harcama defteri.
   - Tablolarda RLS etkinleştirildi; anon/authenticated yetkileri kapatıldı.

4. **Doğrulama ve Testler:**
   - `packages/game-core/src/formulas.test.ts` altında 17 kapsamlı birim test yazıldı ve başarıyla geçti.
   - Toplam test sayısı 40'tan 57'ye yükseldi (%100 yeşil).

## Astra 6.0 İçin Bırakılan Alanlar

- Veritabanı fonksiyonlarının (RPC) güvenlik ve SQL injection denetimi.
- RLS politikalarının ve anti-exploit testlerinin yapılması.
- Adım 4'te (R3) bu ekonomi motorunu kullanacak Empire UI görsel bileşenlerinin tasarımı.
