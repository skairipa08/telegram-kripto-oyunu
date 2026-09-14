# 5. Adım — R4 Sezonlar, Görevler ve Streak Mantığı

Kaynak: Blueprint R4, Section 5, Section 8 ve kullanıcının güvenlik/tasarım sınırlandırma direktifi.
Bu adımda görsel tasarıma (Missions UI) ve harici siber güvenlik saldırı testlerine dokunulmadan; sezon modeli, SRU emisyon çarpanları, görev havuzu, streak takip mekanizması, paylaşılan veri tipleri ve veritabanı şeması inşa edilmiştir.

## Yapılanlar

1. **Görev ve Streak Mantığı (`packages/game-core`):**
   - Görev havuzu ve zorluk çarpanları (`easy`: 0.75x, `normal`: 1.00x, `hard`: 1.25x, `weekly`: 5.00x SRU).
   - `calculateMissionReward`: Güncel SRU snapshot'ına göre tam Sezon Puanı hesaplama.
   - `calculateStreakReward`: Günlük 0.25x SRU, 7. gün döngü tamamlanmasında 1.00x SRU bonusu.
   - `evaluateStreak`: UTC tarih bazlı ardışık gün kontrolü, gün kaçırıldığında sıfırlanma ve aynı gün tekrar claim edilmesinin engellenmesi.
   - `isMissionCompleted`: İlerleme ve hedef kontrolü.
   - `DEFAULT_MISSIONS`: 9 adet kanonik oyun içi görev tanımı.

2. **Paylaşılan DTO Sözleşmeleri (`packages/shared`):**
   - `SeasonDto`, `SeasonStatus` Zod şemaları.
   - `PlayerMissionInstance`, `MissionDifficultyDto` Zod şemaları.
   - `PlayerStreakDto`, `ClaimMissionRequest/Response`, `ClaimStreakRequest/Response`.

3. **Veritabanı Şeması (`supabase/migrations/202609140003_seasons_missions.sql`):**
   - `seasons`: Sezon adı, tarihleri, SRU/QAP snapshot'ları ve Genesis Season seed kaydı.
   - `season_scores`: Oyuncu bazlı sezon puanı, görev puanı ve referans puanı toplamları. Liderlik sıralaması için indeksli.
   - `missions`: Kanonik görev havuzu tanımları ve seed verileri.
   - `mission_instances`: Oyuncuya atanan günlük/haftalık görev kopyaları, ilerleme ve mükerrer claim'i engelleyen check kısıtlamaları.
   - `player_streaks`: Oyuncunun mevcut ve en uzun streak durumu, son claim tarihi.
   - RLS tüm tablolarda aktif; anon/authenticated yetkileri kapalı.

4. **Doğrulama ve Testler:**
   - `packages/game-core/src/missions.test.ts` altında 11 yeni birim test eklendi.
   - Toplam test sayısı 57'den 68'e yükseldi (%100 yeşil).

## Astra 6.0 İçin Bırakılan Alanlar

- Missions ekranının görsel tasarımı ve streak widget'ı UI/UX bileşenleri.
- Veritabanı fonksiyonlarının (RPC) güvenlik ve double-claim sızma denetimleri.
