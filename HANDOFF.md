# Project Empire geliştirici devir kaydı

## Güncel durum

- Mevcut adım: **1 — R0 proje temeli**.
- Durum: **TAMAMLANDI**. Bu adım sonunda duruldu; 2. adım için kullanıcının devam mesajı bekleniyor.
- Sıradaki adım: **2 — R1 Telegram shell ve auth**. Başlamadı.
- Çalışma dalı: `work/step-01`.
- Kullanıcı her tamamlanan adım sonunda durulmasını ve kısa `N. adım tamamlandı.` mesajını istiyor. Sonraki adımı kullanıcı devam dediğinde uygula; tek oturumda tüm yol haritasına geçme.
- Kullanıcı Codex ve Gemini 3.8 Flash arasında elle geçiş yapacak. Bu dosya her iki model için ortak devir kaydıdır; Gemini'ye otomatik bağlantı yapılmış değildir.

## Önce okunacaklar

1. Bu dosya.
2. `docs/PLAN.md`: 1–14 adım eşlemesi ve değişmeyecek kurallar.
3. `docs/ADR-001.md`: mimari kararlar.
4. `Project_Empire_Master_Blueprint_v1.0.docx`: asıl ürün şartnamesi; özellikle başlayacağın fazın çıkış kriteri.
5. `README.md`: komutlar ve yerel çalışma.

## 1. adımda yapılanlar

- pnpm workspace: React/Vite web, Hono Worker API, shared ve game-core paketleri.
- Strict TypeScript, ESLint 10, Prettier, Vitest, lockfile ve GitHub Actions kalite akışı.
- `/health` JSON sözleşmesi ve tanımlanmamış yollar için JSON 404.
- Gerçek API bağlantısını, hata durumunu ve yeniden denemeyi gösteren Türkçe başlangıç ekranı.
- Vite `/api` geliştirme proxy'si; yerel `pnpm dev` ile iki servis.
- Env örnekleri, secret/build ignore kuralları, mimari karar ve numaralı plan.

## Doğrulama kanıtları

2026-09-14, Windows / Node 24.14.0 / pnpm 9.1.0:

- `pnpm install --frozen-lockfile`: başarılı. Ayrıca 9632465 kaynak kaydından ayrı geçici dizine temiz Git clone alındı; kurulum ve tüm `pnpm check` kontrolleri orada da geçti.
- `pnpm check`: lint, biçim, dört pakette typecheck, 2/2 API testi, web build ve Worker dry-run başarılı.
- Testler endpoint uygulanmadan önce 2/2 başarısızdı; uygulama sonrasında 2/2 geçti.
- Gerçek yerel Worker `/health`, web `/api/health` ve web HTML: HTTP 200.
- Chrome ile 320, 390, 1440 px: yatay taşma yok, API bağlantısı hazır, JavaScript sayfa hatası yok.
- API 503 yanıtı tarayıcıda hata ve Tekrar dene düğmesini gösterdi; yeniden deneme gerçek API'ye döndüğünde toparlandı.
- Bağımsız kod incelemesi: Node minimum sürümü 24'e düzeltildi; Wrangler editör schema yolu düzeltildi; eksik devir kaydı eklendi.

## Bilinen sınırlar

- Bu sürüm oyun değil, geliştirme temelidir. Auth, Supabase, ekonomi, görev, davet, sıralama, ödeme ve yönetim paneli henüz yok.
- game-core bilerek boş; migration dizininde yalnız açıklama var.
- `/health` veritabanı veya üretim hazırlığı kontrol etmez.
- GitHub uzak depo ve yayın yok; CI dosyası mevcut fakat GitHub üzerinde çalıştırılmadı.
- `pnpm build` yayın yapmaz. Üretim `/api` yönlendirmesi ve gerçek Telegram testi ileride gerekir.
- pnpm 9 / Node 24 kurulumunda `url.parse` deprecation uyarısı var. Zod 4.6.5 derlenirken iki üçüncü taraf PURE yorum uyarısı var; derleme başarılı. Bağımlılık dosyaları değiştirilmedi.
- Gerçek secret eklenmedi; hiçbir key kullanıcıdan bu adımda istenmedi.

## 2. adımı devralma talimatı

Kullanıcı devam dediğinde yalnız R1 uygula: Telegram tema/shell, sunucuda initData HMAC ve auth_date kontrolü, kısa ömürlü session, `/auth/telegram` ve `/me/state` sınırı. Sahte geliştirme girişini production-safe auth yerine koyma. User upsert kalıcılığı için gereken minimum SQL/auth bağımlılığını açıkça planla; R2'nin ekonomi işlerini erken tamamlandı sayma. Secret yoksa örnek yapılandırma ve otomatik testlerle ilerle; gerçek Telegram kullanıcısıyla giriş kanıtı olmadan R1 tamamlandı deme. Bu durumda adımı `devam ediyor / dış doğrulama bekliyor` kaydet.

Her adımın sonunda yapılanları, değişen kararları, çalıştırılan testleri, kısıtları ve sıradaki numarayı burada güncelle. README kontrol listesini eşleştir, Git checkpoint oluştur ve dur.
