# Düzeltme 1 — Oyun döngüsü doğruluğu

15 Eylül 2026. Kullanıcı, son incelemede bulunan eksiklerin gpt-5.6-sol alt ajanlarıyla giderilmesini, ardından durulup kalan proje adımlarının açıklanmasını istedi.

## Kapsam ve iş bölümü

1. Sol / backend: Gerçek migrasyonlarla test ortamını eşitle; ekonomi formüllerini ortak çekirdekle tutarlı yap; tahsilat, yükseltme, görev ve davet işlemlerinde tekrarlı/eşzamanlı ödülü önle. Önce hatayı gösteren regresyon testi, sonra düzeltme.
2. Sol / frontend: İşlem hataları ve oturum bitişini görünür yap; bekleyen işlemleri koru; görev sonrası sezon puanını güncelle; işletme başına gelir tahmini ve güvenli davet bağlantısını düzelt.
3. Ana görev: Değişiklikleri incele, bütün kalite kapılarını çalıştır, mevcut koddan kalan iş haritasını çıkar. Son bağımsız Sol incelemesi ve gerekli düzeltmelerden sonra devir kaydını güncelle ve dur.
4. Güvenlik entegrasyonu: Anti-fraud çekirdeğini gerçek sunucu olaylarına bağla veya sunucunun zaten matematiksel olarak engellediği sinyalleri açıkça ayır. Riskli ödül dondurma kararı ödül yazımıyla aynı atomik sınırda olmalı; yalnız sonradan kayıt atan göstermelik bağlantı kabul edilmez. Admin listeleme girdilerini sınırla ve inceleme notlarını boşluklardan arındır.

## Sınırlar

Görsel tasarım korunur. Gerçek dağıtım, ödeme açılması, yeni görev üreticisi, yönetim paneli veya yeni ürün özelliği bu düzeltmenin kapsamında değildir. Önceden var olan kaydedilmemiş Gemini değişiklikleri korunur. Mevcut özellik dalı üzerinde çalışılır; ortak ana dal değiştirilmez. Yeni SQL dağıtılmadan önce gerçek PostgreSQL üzerinde eşzamanlılık ve yükseltme provası gerekir; PGlite testleri tek başına bunun kanıtı değildir.

## Arabirim kontrolü

| İşler                 | Paylaşılan sınır                 | Karar                                                                    |
| --------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| Backend / frontend    | Mevcut API sözleşmeleri          | DTO şekilleri korunur; gereken değişiklik önce ana göreve bildirilir.    |
| Backend / test ortamı | SQL ve PGlite                    | Tek ajan sahipliği; yalnız testte şema tamamlama yapılmaz.               |
| Frontend / ekranlar   | Sunum bileşenleri                | Yalnız geri bildirim ve bekleme durumu için gerekli küçük değişiklikler. |
| Her iş / kabul        | İstenen davranış ve regresyonlar | Sadece başarılı derleme yeterli değildir; hatayı yakalayan test gerekir. |

## Durum

- [ ] Backend düzeltmesi ve hedefli regresyonlar.
- [ ] Frontend düzeltmesi ve hedefli regresyonlar.
- [ ] Bağımsız inceleme ve bütün kalite kapıları.
- [ ] Anti-fraud gerçek işlem bağlantısı ve yetki/girdi sertleştirmesi.
- [ ] Devir kaydı ve kalan proje adımları.
