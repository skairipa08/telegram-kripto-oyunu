# 2. adım Telegram girişi ve arayüz

Durum: Uygulanıyor. Kaynak: blueprint R1 ve kullanıcının güvenlik/tasarım önceliği. Mevcut klasörde ayrı `work/step-02` dalı kullanılır; modeller dosya sorumluluklarını paylaşır.

## Tasarım ve sınırlar

Telegram imzalı initData yalnız sunucuda Web Crypto HMAC ile doğrulanır. HMAC yöntemi hash dışındaki bütün alanları kapsar; Ed25519 üçüncü taraf yöntemi ile karıştırılmaz. Yaş sınırı 300 saniye, gelecek saat toleransı 30 saniye; duplicate parametre, büyük gövde, bozuk JSON ve bot hesabı reddedilir.

Oturum 30 dakika geçerlidir. HMAC imzalı kimlik `__Host-empire_session` HttpOnly/Secure/SameSite=None çerezinde tutulur; her erişimde PostgreSQL oturumu ve kullanıcı durumu kontrol edilir. Tam origin kontrolü ve JSON zorunluluğu CSRF'yi sınırlar. CORS açılmaz. Kimlikler localStorage'a veya URL'ye yazılmaz. Cookies engellenirse uygulama güvenliği zayıflatan bir fallback yapmaz.

Supabase RPC, doğrulanmış kullanıcı upsert ve oturum oluşturmayı tek transaction içinde yapar. initData canonical hash unique olur. 128 bit rastgele istemci requestId'nin sunucu HMAC özeti aynı isteğin güvenli tekrarına izin verir; farklı requestId replay sayılır. Tekrar aynı oturumu döndürür ve süreyi uzatmaz. Ban ve logout tekrar yoluyla aşılamaz.

Login rate limit Cloudflare binding üzerinden; binding veya zorunlu secret yoksa erişim kapalı. SQL tablolarında RLS, anon/authenticated yetkileri kapalı, RPC yalnız service_role. Test belleği yalnız testlerde; production'da sahte giriş veya bellek veritabanı yok.

Arayüz: Telegram tema değişiklikleri, güvenli ekran boşlukları ve azaltılmış hareket tercihi. Türkçe karşılama; 5 bölümlü oturum sonrası shell. Henüz olmayan ekonomi yerine açık hazırlık durumu, sahte bakiye ve sahte sıralama yok. Gerçek profil yalnız /me/state yanıtından gelir.

## İşler ve doğrulama

- [ ] Ortak auth/state/error sözleşmeleri.
- [ ] Önce saldırı testleri; HMAC, süre ve session doğrulaması.
- [ ] Minimum users/auth_sessions SQL ve RPC, adapter ve API.
- [ ] Cookie, origin, replay, logout/ban, rate limit ve hata sızıntısı testleri.
- [ ] Telegram SDK/tema bağlantısı ve görsel shell.
- [ ] 320/390/desktop, light/dark, loading/error ve klavye tarayıcı kontrolü.
- [ ] Bağımsız Astra güvenlik incelemesi ve tam kalite kontrolleri.
- [ ] Devir kaydı ve gerçek Telegram/Supabase dış doğrulama durumu.

## Resmî kaynaklar

- https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://supabase.com/docs/guides/database/functions

## Çıkış koşulu

Kod/testlerin geçmesi tek başına R1'i bitirmez. Gerçek Telegram kullanıcısıyla güvenli login, kalıcı user upsert ve /me/state yanıtı doğrulanmalı. Gerekli dış yapılandırma yoksa kod tamamlanabilir, adım dış doğrulama bekler; R2'ye geçilmez.
