# Project Empire geliştirme planı

Ana kaynak: Project_Empire_Master_Blueprint_v1.0.docx. Kullanıcı bu mimariye göre geliştirmeyi ve her tamamlanan adım sonunda durmayı istedi. Her oturum yalnız mevcut adımı tamamlar; model değişikliği adım numarasını değiştirmez.

| Adım | Blueprint | Çıktı                                                   |
| ---- | --------- | ------------------------------------------------------- |
| 1    | R0        | Monorepo, yerel web/API, test ve CI altyapısı           |
| 2    | R1        | Telegram shell, güvenli initData doğrulaması ve session |
| 3    | R2        | Veritabanı, işletmeler, claim/upgrade, ekonomi ledger   |
| 4    | R3        | Empire ekranı ve mobil/masaüstü oyun akışı              |
| 5    | R4        | Sezonlar, QAP/SRU, görevler ve streak                   |
| 6    | R5        | Nitelikli davetler ve gecikmeli ödüller                 |
| 7    | R6        | Global/arkadaş sıralaması ve sezon dondurma             |
| 8    | R7        | Stars ödemeleri, pass, destek ve iade                   |
| 9    | R8        | Yönetim paneli ve özellik bayrakları                    |
| 10   | R9        | Hile tespiti ve ödül inceleme akışı                     |
| 11   | R10       | Analitik ve deneyler                                    |
| 12   | R11       | Kapalı lansman, yük/güvenlik ve yedekten dönüş          |
| 13   | R12       | Canlı sezon, etkinlik ve içerik yönetimi                |
| 14   | R13       | Yalnız ayrıca kararlaştırılırsa token hazırlığı         |

## 1. adım uygulama planı

Amaç: Kimlik bilgisi gerektirmeyen, temiz kurulumdan çalıştırılabilen geliştirme temeli.

Mimari: apps/web React/Vite istemcisi, apps/api Hono Worker. packages/shared Zod API sözleşmelerini, packages/game-core ileride saf ekonomi fonksiyonlarını içerir. Veritabanı bağlama 3. adımdadır. Başlangıç ekranı oynanabilir oyun gibi davranmaz; gerçek API bağlantısını gösterir.

- [x] pnpm workspace, strict TypeScript, ESLint ve Prettier kur.
- [x] Health API sözleşmesini tanımla; başarılı yanıt ve bilinmeyen yol testlerini önce çalıştır.
- [x] Hono health endpoint ve standart 404 yanıtını uygula.
- [x] React başlangıç ekranını API durumunu gerçekten okuyacak şekilde kur.
- [x] CI, env örnekleri, ADR, README ve devir kayıtlarını yaz.
- [x] Kurulum, lint, format, typecheck, test ve build çalıştır.
- [x] Yerel web/API süreçlerini başlatıp HTTP üzerinden doğrula.
- [x] Sonuçları HANDOFF.md içine kaydet ve yalnız 1. adım sonunda dur.

## Kalıcı kurallar

Ekonomi yalnız sunucuda hesaplanır; istemci ödül miktarı belirleyemez. Oyun denge değerleri seed/config içinde tutulur. Token kapalıdır. Ödeme kurulmadan Stars satışları kapalıdır. Kritik ekonomi ve ödeme işlemleri atomik ve idempotent olmalıdır. Gerçek Telegram, veritabanı veya ödeme testleri yapılmadan bunlar tamamlandı yazılmaz.
