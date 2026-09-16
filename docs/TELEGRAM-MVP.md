# Project Empire — Telegram MVP & Yönetici Kurulum Rehberi

Bu belge, **Project Empire** kripto iş simülasyonu oyununun Telegram üzerinde MVP olarak canlıya alınması, bot yapılandırması ve **@Barandnz** ile **@Mberked** için yönetici yetkilerinin kullanımı hakkında adım adım kılavuzdur.

---

## 1. Yetkili Yöneticiler (Designated Superadmins)

Sistem mimarisinde **@Barandnz** ve **@Mberked** doğrudan **Süper Yönetici (Superadmin)** olarak tanımlanmıştır:

- **Otomatik Rol Atama (`supabase/migrations/202609140010_designated_admins.sql`)**:
  - `@Barandnz` veya `@Mberked` Telegram hesaplarıyla oyuna ilk giriş yaptıklarında veya kayıt olduklarında, veritabanı tetikleyicisi (`trg_designated_admins_auto_assign`) tarafından anında `public.admin_roles` tablosuna `superadmin` yetkisiyle yazılırlar.
  - Veritabanı fonksiyonu (`empire_admin_check_role`), kullanıcı adı eşleştiğinde ek bir manuel onay beklemeden doğrudan tam yetki (`true`) döndürür.
- **Yönetim Yetkileri**:
  - Hile şüphesi taşıyan kullanıcı bayraklarını görüntüleme (`GET /admin/fraud/flags`).
  - Dondurulan kazanç ve ödülleri onaylama/reddetme (`GET /admin/fraud/frozen`, `POST /admin/fraud/review`).
  - Oyuncu bakiyeleri ve denetim kayıtlarına (audit logs) erişim.
  - Telegram botunda `/admin` komutunu kullanma yetkisi.

---

## 2. Telegram BotFather Yapılandırması (5 Dakikada Hazırlık)

Telegram üzerinde MVP'yi açmak için resmî `@BotFather` botunu kullanın:

### Adım 2.1: Bot Oluşturma

1. Telegram uygulamasında `@BotFather` hesabına gidin.
2. `/newbot` komutunu gönderin.
3. Bot için bir isim belirleyin (Örn: `Project Empire Game`).
4. Bot için sonu `bot` ile biten benzersiz bir kullanıcı adı belirleyin (Örn: `ProjectEmpireAppBot`).
5. BotFather size bir **HTTP API Token** verecektir. Bu token'ı saklayın:
   ```text
   Örnek Token: 7123456789:AAFxxx_xxxxxx_xxxxxx
   ```

### Adım 2.2: Mini App (Web App) Tanımlama

1. `@BotFather` içinde `/mybots` yazıp oluşturduğunuz botu seçin.
2. **Bot Settings** -> **Menu Button** -> **Configure menu button** adımlarını izleyin.
3. Menü butonuna bir başlık verin: `🎮 Oyna`
4. Web App URL'si olarak uygulamanın HTTPS adresini girin:
   - **Canlı Yayın**: `https://<sizin-alan-adiniz>/`
   - **Yerel Test (Ngrok / Cloudflare Tunnel)**: `https://<gecici-tunnel-adresi>/`
5. Ayrıca **Bot Settings** -> **Configure Mini App** -> **Enable Mini App** seçeneğini etkinleştirin.

---

## 3. Yerel Test ve Botu Çalıştırma

Geliştirme aşamasında Cloudflare Worker dağıtımı yapmadan, yerel makinenizde gerçek Telegram ile test edebilirsiniz.

### Adım 3.1: Geliştirme Sunucularını Başlatın

Terminal 1:

```bash
# Web arayüzü ve API'yi başlatır (Web: localhost:5173, API: localhost:8787)
pnpm dev
```

### Adım 3.2: Telegram Botunu Başlatın

Terminal 2:

```bash
# BotFather'dan aldığınız token ile bot dinleyicisini çalıştırın:
pnpm telegram:bot 7123456789:AAFxxx_tokeniniz

# Veya çevre değişkeni ile:
$env:TELEGRAM_BOT_TOKEN="7123456789:AAFxxx_tokeniniz"
$env:APP_ORIGIN="http://localhost:5173"
pnpm telegram:bot
```

Konsolda aşağıdaki çıktıyı göreceksiniz:

```text
======================================================
🚀 Project Empire — Telegram MVP Bot Servisi Başlatılıyor
======================================================
🤖 Bot Adı: Project Empire (@ProjectEmpireAppBot)
🆔 Bot ID:  7123456789
🌐 Mini App URL: http://localhost:5173
👑 Yetkili Yöneticiler: @Barandnz, @Mberked (Süper Yönetici)
------------------------------------------------------
📡 Bot dinlemede (long-polling aktif). Durdurmak için Ctrl+C tuşlayın.
```

---

## 4. Kullanıcı ve Yönetici Akışları

### 4.1. Standart Oyuncu Akışı

1. Kullanıcı bota girer ve `/start` tuşuna basar.
2. Bot, oyun mekaniklerini tanıtan şık bir karşılama mesajı ve `[🎮 İmparatorluğu Başlat]` butonu gönderir.
3. Butona dokunulduğunda Telegram Mini App açılır, oyuncunun Telegram kullanıcı bilgileri ile otomatik oturum açılır (`/api/auth/login`), 100 Cash başlangıç kredisi verilir ve idle iş simülasyonu başlar.
4. Arkadaş daveti ile geldiyse (`/start ref_KOD`), her iki tarafa da referans ödülü tanımlanır.

### 4.2. Yönetici Akışı (@Barandnz & @Mberked)

1. `@Barandnz` veya `@Mberked` bota `/start` gönderdiğinde, bot yönetici yetkisini tanır ve karşılama mesajında:
   `🛡️ Yönetici Yetkisi Tanımlandı: Süper Yönetici` ibaresini gösterir.
2. Bota `/admin` komutu gönderildiğinde:
   - Standart kullanıcılara: `⛔ Yetkisiz Erişim` uyarısı verilir.
   - `@Barandnz` veya `@Mberked` için: Süper yönetici kontrol paneli mesajı ve yönetim ekranı butonu sunulur.

---

## 5. Canlı Dağıtım (Production) Ortamı

Canlıya çıkış yaparken:

1. **Supabase Migrasyonları**:
   Tüm migrasyonları (özellikle `202609140008_anti_fraud.sql`, `202609140009_missions_and_launch.sql` ve `202609140010_designated_admins.sql`) Supabase SQL Editor üzerinden sırayla çalıştırın.
2. **Cloudflare Worker Secret Ayarları**:
   ```bash
   wrangler secret put TELEGRAM_BOT_TOKEN
   wrangler secret put SESSION_SECRET
   wrangler secret put APP_ORIGIN
   wrangler secret put SUPABASE_URL
   wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```
3. **Webhook Kurulumu (İsteğe Bağlı)**:
   Sunucu tabanlı webhook kullanmak isterseniz:
   ```bash
   curl -F "url=https://<alan-adiniz>/api/telegram/webhook" https://api.telegram.org/bot<TOKEN>/setWebhook
   ```
   (Yerel testlerde yukarıdaki `pnpm telegram:bot` long-polling komutu hiçbir webhook URL'si gerektirmeden doğrudan çalışır).
