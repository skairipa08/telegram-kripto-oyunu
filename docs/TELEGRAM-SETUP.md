# Telegram Mini App kurulumu

## 1. BotFather: Main Mini App

1. Telegram'da `@BotFather` ile botu açın.
2. `/mybots` → bot → **Bot Settings** → **Configure Mini App** → **Enable Mini App** yolunu izleyin.
3. **Main Mini App** URL'si olarak uygulamanın herkese açık HTTPS adresini girin: `https://<uygulama-alanı>/`.
4. Bot profilindeki **Launch app** düğmesinden açılışı kontrol edin.

Telegram Mini Apps ayrıntıları: [Telegram Mini Apps resmî dokümantasyonu](https://core.telegram.org/bots/webapps).

## 2. HTTPS ve Worker yönlendirmesi

Web arayüzü ile API aynı HTTPS origin altında çalışmalıdır:

- Web: `https://<uygulama-alanı>/`
- Worker API: `https://<uygulama-alanı>/api/*`

Cloudflare route ayarında `/api/*` isteklerini Worker'a, diğer istekleri web uygulamasına yönlendirin. `APP_ORIGIN`, BotFather'a verilen origin ile birebir aynı olmalıdır; sonuna farklı bir alan adı veya protokol eklemeyin.

## 3. Sunucu sırları

Aşağıdaki değişkenleri yalnızca Worker/sunucu secret'ı olarak tanımlayın; istemci koduna, repoya, ekran görüntüsüne veya sohbete koymayın:

```text
TELEGRAM_BOT_TOKEN=<server-only>
SESSION_SECRET=<server-only, en az 32 rastgele karakter>
APP_ORIGIN=<https-origin>
SUPABASE_URL=<server-only>
SUPABASE_SERVICE_ROLE_KEY=<server-only>
```

Değerleri terminal istemine yerel olarak girerek `wrangler secret put <DEĞİŞKEN_ADI>` ile kaydedin. Cloudflare yönergeleri: [Workers secrets resmî dokümantasyonu](https://developers.cloudflare.com/workers/configuration/secrets/).

`AUTH_RATE_LIMIT` binding'i `wrangler` yapılandırmasında ayrıca planlanmıştır; dağıtımdan önce tanımlandığını doğrulayın.

## 4. Veritabanı migration'ı

Supabase projesine aşağıdaki migration'ı uygulayın:

```text
202609140001_auth.sql
```

Uygulamadan önce hedef projeyi kontrol edin; ardından Supabase'in standart migration akışıyla çalıştırın.

## 5. Gerçek test kontrol listesi

- [ ] Telegram içinden geçerli kullanıcıyla giriş yapılır; `/api/me` ve `/api/state` başarılı ve doğru kullanıcı durumunu döndürür.
- [ ] Değiştirilmiş (tamper) Telegram init data reddedilir.
- [ ] Süresi geçmiş Telegram init data reddedilir.
- [ ] Çıkıştan sonra korumalı istek `401` döndürür.
- [ ] Kullanıcı banlandıktan sonra erişim bir sonraki istekte engellenir.
- [ ] Açık/koyu Telegram temaları doğru uygulanır ve arayüz 320 px genişlikte taşmadan kullanılabilir.

## Durum

Bu belge hazırlanırken dağıtım yapılmadı ve gerçek Telegram girişi doğrulanmadı. Yukarıdaki maddeler dağıtım ortamında gerçek Telegram istemcisiyle tamamlanmalıdır.
