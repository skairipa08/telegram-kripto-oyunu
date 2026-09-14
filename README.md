# Project Empire

Telegram içinde ekonomik işletme geliştirme oyunu. Ana ürün kaynağı: `Project_Empire_Master_Blueprint_v1.0.docx`.

## Devam edecek geliştirici

Önce **HANDOFF.md**, sonra **docs/PLAN.md** ve **docs/ADR-001.md** oku. Kullanıcı her tamamlanan adımın sonunda durulmasını istedi. Aynı anda iki modelin aynı dosyaları düzenlemesinden kaçın; devralmadan önce mevcut değişiklikleri incele.

## Yerel kurulum

Node.js 24 LTS ve pnpm 9.1.0 kullan. Asgari Node sürümü 24.0.0.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm dev
```

Web: http://127.0.0.1:5173 — API: http://127.0.0.1:8787/health.
Web `/api` isteklerini yerelde Vite üzerinden API'ye iletir. 1. adımda credential gerekmez. İlgili portlar boş olmalıdır. Üretimde aynı origin `/api` yönlendirmesi henüz kurulmamıştır; bu adım yayına alma içermez.

## Komutlar

| Komut               | İşlev                                     |
| ------------------- | ----------------------------------------- |
| `pnpm dev`          | Web ve yerel Worker birlikte çalışır      |
| `pnpm lint`         | Kaynak kod denetimi                       |
| `pnpm format:check` | Biçim denetimi                            |
| `pnpm format`       | Biçimi düzeltir                           |
| `pnpm typecheck`    | Tüm paketlerde TypeScript denetimi        |
| `pnpm test`         | Vitest testleri                           |
| `pnpm build`        | Web çıktısı ve Worker dry-run; yayınlamaz |
| `pnpm check`        | Yukarıdaki tüm kalite kontrolleri         |

## Dizinler

- `apps/web`: React/Vite/Tailwind/TanStack Query istemcisi.
- `apps/api`: Hono/Cloudflare Workers API ve gelecekte bot webhook.
- `packages/shared`: Zod API sözleşmeleri.
- `packages/game-core`: Saf ekonomi fonksiyonlarının yeri; 3. adımda uygulanır.
- `supabase/migrations`: Versiyonlu SQL.
- `docs`: Geliştirme planı ve mimari kararlar.

## Güvenlik ve kapsam

Bot token, session secret ve Supabase service role yalnız API ortamında tutulur. `.env.example` ve `apps/api/.dev.vars.example` boş örneklerdir; gerçek secret dosyaları Git dışında bırakılır. `/health` yalnız uygulamanın çalıştığını bildirir, veritabanı bağlantısı veya üretime hazır olma kontrolü değildir. Telegram girişi, oyun ekonomisi, ödemeler ve blockchain bu başlangıç adımına dahil değildir.

## İlerleme

Güncel adım durumu ve test kanıtları HANDOFF.md içindedir. Tam yol haritası docs/PLAN.md içindedir.

- [x] 1. adım (R0): Proje temeli; temiz kurulum, kalite kontrolleri ve yerel web/API doğrulandı.
- [ ] 2. adım (R1): Telegram shell ve auth.
- [ ] 3–13. adımlar (R2–R12): Oyun, güvenlik ve canlı operasyon.
- [ ] 14. adım (R13): Koşullu token hazırlığı; varsayılan kapalı.
