# Project Empire — Stratejik Durum Raporu, Rekabet Analizi ve Yol Haritası

**Tarih**: 16 Eylül 2026  
**Kapsam**: Proje Durumu, Kalan Teknik/Operasyonel İşler, Pazar Rekabet Analizi ve Odaklanılması Gereken Kritik Konular  
**Mevcut Sistem Durumu**: %100 Yeşil (60/60 Test Paketi, 735 Test Başarılı, Monorepo Build Hazır)

---

## 1. Yönetici Özeti (Executive Summary)

Project Empire, Telegram Mini App ekosisteminde teknik ve mekanik olarak çok zengin ve modüler bir altyapıya kavuşmuştur:

- **Çok Katmanlı Mini Oyun Süiti**: 100 seviyeli Catizen tarzı birleştirme, Notcoin tarzı aktif/pasif dokun-kazan, provably fair adaptif Risk (Crash) oyunu ve siber şifre kırma terminali.
- **Güçlü Ekonomi Altyapısı**: 16 adet holding/teknoloji işletmesi, kademeli referans komisyonları (%3-%7), karşılıklı 5.000 nakit hoş geldin bonusu, 365 güne kadar uzanan katlanarak artan günlük seri ödülleri ve tek seferlik kalıcı genel görevler.
- **Güvenlik ve Monetizasyon**: Telegram Stars (XTR) faturalandırma motoru, webhook imza doğrulama, anti-P2W kuralları, PostgreSQL atomik ledger ve `@Barandnz` & `@Mberked` için tam yetkili RBAC yönetim paneli.

---

## 2. Kalan İşler ve Teknik/Operasyonel İyileştirmeler

### 2.1. Canlı Dağıtım ve Altyapı (Infrastructure & Deployment)

1. **Supabase Cloud Prod Ortamı**:
   - `supabase/migrations/` altındaki 10 adet migrasyonun canlı PostgreSQL veritabanına uygulanması.
   - RLS (Row Level Security) politikalarının ve Postgres fonksiyonlarının canlıda doğrulanması.
2. **Cloudflare Workers Dağıtımı (`apps/api`)**:
   - `wrangler deploy` ile API'nin Cloudflare Edge ağına alınması.
   - Ortam değişkenlerinin (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`) Worker Secrets olarak tanımlanması.
3. **Frontend CDN Dağıtımı (`apps/web`)**:
   - Cloudflare Pages veya Vercel üzerine SSL destekli özel alan adı ile deploy edilmesi (`https://app.project-empire.io`).

### 2.2. Canlı Telegram Bot ve Menü Bağlantısı

1. **BotFather Konfigürasyonu**:
   - `/newapp` komutu ile Web App oluşturulup URL'in bağlanması.
   - `setChatMenuButton` ile botun sol alt köşesindeki "Oyna / Başlat" butonunun Mini App'e yönlendirilmesi.
2. **Cihaz Uyumluluk Testleri**:
   - Telegram Web, iOS Telegram istemcisi ve Android Telegram istemcisi üzerinde dokunmatik tepkilerin, viewport safe-area (çentik/home bar) boşluklarının ve Telegram WebApp SDK sürümünün (v7.0+) uçtan uca testi.

### 2.3. Canlı Zamanlanmış Görevler (Cron Triggers & Scheduled Tasks)

- **Gece Yarısı Senkronizasyonu (00:00 UTC)**:
  - Günlük görev havuzunun yenilenmesi (`generateDailyMissions`).
  - Giriş yapmayan kullanıcıların günlük serilerinin dondurulması / sıfırlanması.
  - Haftalık sezon puanlarının (SRU) arşivlenmesi ve liderlik tablosu snapshot'ı.
  - _Uygulama Yöntemi_: Cloudflare Workers Cron Triggers (`scheduled` event) veya PostgreSQL `pg_cron` eklentisi.

### 2.4. Ekonomi İnce Ayarı ve Matematiksel Kalibrasyon

- **Sink / Faucet Dengelemesi**: Tıklama ve işletmelerden basılan toplam nakit ile Risk oyunu ve Merge birleştirme ücretleriyle sistemden yakılan (burn) nakit arasındaki oran dengelenmeli.
- **Prestij / Rebirth Mekaniği**: İleride sonsuz sayı büyümesinin oyun zevkini öldürmesini engellemek için işletmeleri sıfırlayıp kalıcı prestij çarpanı kazanma döngüsü planlanmalı.

### 2.5. Görsel ve İşitsel Cila (Juice & Polish)

- Mevcut sentetik Web Audio API sesleri hafiftir; ancak oyun içi vuruş hissini katlamak için özel kısa SFX paketleri (retro coin, level up jingle, terminal glitch sound) eklenebilir.
- SVG işletme ikonları yerine her biri seviye atladıkça görsel olarak evrimleşen Lottie animasyonları veya zengin 2D illüstrasyonlar entegre edilebilir.

---

## 3. Telegram Kripto Oyun Pazarı Rekabet Analizi

| Proje              | Ana Mekanik                     | Güçlü Yönleri                                                                                     | Zayıf Yönleri                                                        | Project Empire İçin Ders                                                           |
| :----------------- | :------------------------------ | :------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------- | :--------------------------------------------------------------------------------- |
| **Notcoin**        | Salt Tıklama (Tap-to-Earn)      | - İlk hareket eden avantajı<br>- Yüksek dokunma hazzı<br>- Klan/Squad dinamikleri                 | - İçerik derinliği sığ<br>- Token dağıtımı sonrası retansiyon çöküşü | Tıklama tek başına yetmez; holding işletmelerini besleyen bir yan motor olmalıdır. |
| **Hamster Kombat** | CEO / Borsa Yönetimi            | - Günlük kombo kartlar & Mors şifresi ile **devasa sosyal viralite**<br>- Saatlik Kâr (PPH) odağı | - Şeffaf olmayan airdrop dağıtımı<br>- Reklam/anahtar spam'i         | Günlük viral bilmeceler (Daily Cipher/Combo) organik büyümenin en ucuz yoludur.    |
| **Catizen**        | Birleştirme (Merge) + Kedi      | - **Gerçek IAP geliri**: Milyonlarca $ Telegram Stars cirosu<br>- Balık tutma ve mini oyunlar     | - Aşırı P2W hissiyatı<br>- Bir süre sonra otomasyonun pasifleşmesi   | Paralı otomasyon ve birleştirme bağımlılığı harika bir gelir modelidir.            |
| **Blum / Dogs**    | Düşen Nesne Yakalama / Görevler | - 30 saniyelik mikro oyun seansları<br>- Telegram hesap yaşına göre ödül                          | - Oynanış derinliği yok<br>- Spekülasyon sonrası tutundurma zor      | Oyuncuyu birden fazla oyun arasında portföy yönetmeye teşvik etmeliyiz.            |

---

## 4. Üstüne Düşmemiz Gereken Stratejik Konular (Öncelikli Odak Alanları)

1. **Klan / Birlik (Cartel & Syndicate) Sistemi**:
   - Telegram grup/kanal yöneticilerinin kendi "Kartelini" kurup üyelerinin kazancından pay alması. Bu, Telegram kanallarını ücretsiz pazarlama elçisi yapar.
2. **Günlük Viral Kancalar (Daily Mystery Combos & Secret Terminal Codes)**:
   - 16 işletmeden gizli 3 tanesini bulanlara günlük büyük ödül (Hamster kombo kartları gibi).
   - Dynasty Cipher hacking terminaline sosyal medyada paylaşılan günlük mors/şifre sistemi.
3. **Akıllı Push Bildirimleri (Bot Re-engagement Engine)**:
   - "Patron kasan doldu!", "Serin bozulmak üzere!", "Arkadaşın seviye atladı, komisyonun yattı!" gibi Telegram Bot DM bildirimleri.
4. **Enflasyon Kontrolü ve Sağlam Tokenomics**:
   - Risk/Crash oyunu (%97 RTP) ve Merge ücretleri nakit emicidir. Airdrop ölçümünde şişkin nakit değil, stratejik Sezon Puanı (SRU) baz alınmalıdır.
5. **Telegram Stars ile Erken Nakit Akışı**:
   - VIP Pass (450 ★), TapBot (149 ★), 24s Çevrimdışı Kasa (99 ★) ile ilk günden net döviz/Stars geliri elde etmek.
