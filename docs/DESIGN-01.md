# Tasarım 1 Oyun ekranları

Kullanıcı isteği: Önce Gemini'den devralınan tasarımlar tamamlanacak. Kolay uygulama işleri gpt-5.6-sol alt ajanlarında; tasarım yönü, entegrasyon ve güvenli sınırlar ana Astra görevinde. Bu çalışma mevcut backend geliştirmesini devam ettirmez.

## Görsel karar

Gece mavisi/mürekkep zemin, sıcak bakır vurgular, ince ayırıcılar ve işletmeye özgü küçük vektör illüstrasyonları. Oyuncunun odağı nakit, üretim ve bir sonraki yükseltmedir. Büyük bir imparatorluk özeti, altında okunaklı işletme listesi; mağazada belirgin pass sunumu; sıralamada podyum yerine okunabilir sıralar. Türkçe metin, sistem fontları, açık ve koyu tema, azaltılmış hareket ve Telegram güvenli alanları.

## Kapsam

- Empire: Nakit/Sezon Puanı, gelir özeti, toplama alanı, altı işletme, kilit/seviye/ROI durumları.
- Missions: Günlük/haftalık görevler, ilerleme, seri takvimi ve ödül durumları.
- Friends: Davet bağlantısı, nitelikli davet ilerlemesi ve ödül aşamaları.
- Leaderboard: Global/arkadaş filtreleri, kendi sıra satırı ve devam sayfası.
- Shop: Convenience Pass, hak karşılaştırması, kozmetik, satın alma/destek durumları.
- Analytics: Yönetici paneli tasarımı; yalnız ayrı geliştirme önizlemesinde, normal oyuncu navigasyonunda yok.

## Güvenlik ve veri sınırı

Üretim ekranlarında bakiyeler uydurulmaz, auth bypass eklenmez. Eksik backend işlemleri devre dışı ve açıklamalıdır. Canlı ödeme başlatılmaz; ödeme güvenlik incelemesi bitmeden satın alma aktive edilmez. İstemci miktar/ödül belirlemez. Davet linkleri izin verilen Telegram adresleriyle sınırlıdır. Önizleme yalnız import.meta.env.DEV üzerinden ayrı yüklenir, örnek veri etiketi sürekli görünür ve ağdaki auth/ödeme işlemlerine ulaşmaz.

## İş bölümü

1. Ana görev: Ortak görsel sistem, navigasyon, kaynak durumları, geliştirme önizlemesi ve mevcut salt-okunur API bağlantıları.
2. Sol A: Empire + Missions bileşenleri ve yalnız kendi CSS dosyası.
3. Sol B: Friends + Leaderboard bileşenleri ve yalnız kendi CSS dosyası.
4. Sol C: Shop + Analytics bileşenleri ve yalnız kendi CSS dosyası.

## Kontrol

- [ ] Altı ekran ve ortak karşılama akışı.
- [ ] Mobil 320/390 px, masaüstü 1440 px, açık/koyu tema.
- [ ] Klavye gezinmesi, 44 px hedefler, loading/error/empty durumları.
- [ ] Gerçek API ile örnek verinin ayrılması ve önizlemenin üretimden çıkarılması.
- [ ] İlgili test, typecheck, build ve görsel inceleme.
- [ ] Handoff güncellemesi; bu tasarım adımı sonunda dur.
