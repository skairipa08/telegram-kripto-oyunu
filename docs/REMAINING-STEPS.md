# Project Empire — Kalan adımlar

15 Eylül 2026 kaynak kodu incelemesi. Bu liste docs/PLAN.md içindeki özgün 1–14 numaralarını kullanır. Gemini'nin son kaydındaki “Adım 13”, bir entegrasyon çalışma paketidir; özgün plandaki canlı sezon işletimi tamamlandı anlamına gelmez.

## Önce tamamlanması gerekenler

| Özgün adım                 | Mevcut temel                                                         | Eksik kabul ölçütü                                                                                                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 / R1 — Kimlik ve oturum  | Telegram HMAC, oturum, giriş sınırlama ve yerel testler              | Gerçek Telegram Android/iOS/Desktop oturumu, süre bitişi, güvenli çerez ve dağıtım alan adında uçtan uca doğrulama.                                                                                                                    |
| 3 / R2 — Ekonomi           | İşletmeler, ledger, tahsilat/yükseltme API ve ekran bağlantıları     | Düzeltme 1 sonrası gerçek PostgreSQL üzerinde eşzamanlı işlemler, migrasyon provası ve sunucu/istemci tutarlılığının canlı doğrulanması.                                                                                               |
| 4 / R3 — Tasarım           | Beş oyuncu ekranı, analitik önizlemesi, açık/koyu ve duyarlı tasarım | Gerçek Telegram cihazlarında görsel kabul, erişilebilirlik ve gerçek veriyle tüm işlem durumlarının uçtan uca testi.                                                                                                                   |
| 5 / R4 — Görevler ve sezon | Görev tanımları, SRU hesapları, görev okuma/ödül alma, streak okuma  | Oyuncuya günlük/haftalık görev atama, oyun olaylarıyla ilerleme güncelleme, günlük streak ödül işlemi, sezon takvimi ve QAP/SRU yenileme akışı.                                                                                        |
| 6 / R5 — Davetler          | Bağlama, başlangıç bonusu, özet; saf kilometre taşı hesapları        | Aktivasyon/D2/D7/ilerleme olaylarının kalıcı takibi, nitelik değerlendirmesi, gecikmeli ödül dağıtımı ve riskli ödül inceleme akışı.                                                                                                   |
| 7 / R6 — Sıralama          | Global/arkadaş sıralaması ve dondurma yordamı                        | Dondurmada yönetici yetkisi, sezon geçişi/arşiv kabulü ve gerçek veri hacminde sayfalama/yük doğrulaması. Mevcut rota tüm puanları çekip uygulamada sıralıyor.                                                                         |
| 8 / R7 — Stars             | Katalog, fatura/ödeme kayıt şeması, pass hesabı                      | Gerçek Telegram fatura API bağlantısı, webhook kaynak doğrulaması, alıcı/tutar/para birimi kontrolleri, pre-checkout yanıtı, iade/destek, kuyruk/otomatik tahsilat/yenileme haklarının uygulanması. Satın alma arayüzü kapalı kalmalı. |
| 9 / R8 — Yönetim           | Config API ve denetim kaydı                                          | Yönetici rolü ve sunucuda yetki kontrolü; config yönetim ekranı, doğrulama/geri alma, özellik bayraklarının gerçek işlem kapılarına bağlanması.                                                                                        |
| 10 / R9 — Hile önleme      | Bazı veri kısıtları ve olay isimleri                                 | Davranış/hız sınırları, çoklu hesap ve davet suistimali tespiti, risk puanı, ödül dondurma ve inceleme/itiraz süreci.                                                                                                                  |
| 11 / R10 — Analitik        | Olay API'si, metrik hesapları ve örnek veriyle analitik ekranı       | Güvenilir sunucu olayları, istemci olay bağlantısı, yönetici erişimi, gerçek metrik ekranı ve deneylerin işletimi.                                                                                                                     |
| 12 / R11 — Kapalı lansman  | Yerel testler ve dağıtım dry-run                                     | Gerçek ortam kurulumu, uçtan uca güvenlik ve yük testi, izleme/uyarılar, yedekten dönüş ve geri alma provası, kapalı kullanıcı kabulü.                                                                                                 |
| 13 / R12 — Canlı işletim   | Sezon ve config veri temeli                                          | Sezon/event/içerik takvimi, işletim araçları ve canlı destek süreci.                                                                                                                                                                   |
| 14 / R13 — Token           | Kapalı                                                               | Yalnız kullanıcı ayrıca kararlaştırırsa. Lansman için zorunlu değil.                                                                                                                                                                   |

## Kritik kanıtlar

- `apps/api/src/leaderboard/routes.ts`: sezon dondurma, oturum yokken de store çağrısına ilerliyor; yönetici rol kontrolü yok.
- `apps/api/src/config/routes.ts`: config değişikliği oturumla sınırlı, yönetici rol kontrolü yok.
- `apps/api/src/analytics/routes.ts`: tüm uygulama metrikleri için yalnız oturum kontrolü var.
- `apps/api/src/shop/routes.ts`: webhook kaynak sırrı doğrulaması yok; doğrudan ödeme DTO'su kabul ediliyor. Pre-checkout dalı yalnız JSON dönüyor. Ortak POST Origin kontrolü ise gerçek Telegram sunucu bildirimine uygun ayrı bir webhook politikası gerektiriyor.
- `supabase/migrations/202609140005_step7_to_11_backend.sql`: fatura bağlantısı Telegram'dan alınmak yerine metin birleştirilerek üretiliyor.
- `apps/api/src/index.ts`, `apps/api/wrangler.jsonc`: planlı görev/sezon çalıştırıcısı bulunmuyor.
- `apps/web/src/preview/design-preview.tsx`: analitik ekranı geliştirme önizlemesinde; gerçek yönetim paneli değildir.

Bu bulgular Düzeltme 1 kapsamı dışındaki kalan işleri tarif eder; giderildiği iddia edilmez. Yerel testlerin geçmesi canlı ödeme, hile önleme veya lansman güvenliği onayı değildir.

## Önerilen sıra

1. Yönetici ve ödeme uç noktalarını yetkisiz erişime kapat; ekonomi için gerçek PostgreSQL eşzamanlılık provası yap.
2. Görev/streak ve nitelikli davet döngülerini bitir.
3. Ödeme/pass, yönetim ve güvenilir analitik bağlantılarını tamamla.
4. Gerçek Telegram cihaz kabulü, yük/izleme/yedekleme sonrası kapalı lansman yap.
5. Canlı sezon işletimine geç. Token kararı ayrı kalsın.
