# Empire Oyun Salonu

## Oyunlar

| Oyun              | Ana beceri              | Tur                | Yardımcı ürün                                                    |
| ----------------- | ----------------------- | ------------------ | ---------------------------------------------------------------- |
| Empire Darphanesi | Zamanlama ve seri       | 45 sn, 5 hak       | Hassasiyet Modülü: 3 tur hedef alanını genişletir, 79 Stars      |
| Hanedan Şifresi   | Hafıza ve dikkat        | 5 hak, uzayan dizi | Şifre Botu: 3 tur sıradaki mührü gösterir, 99 Stars              |
| Coin Birleştir    | Planlama ve birleştirme | 20 hamle           | Oto Birleştirici: 20 uygun çifti otomatik birleştirir, 129 Stars |

Yardımcı kullanılan skorlar rekabetçi skorlarla karıştırılmaz. Standart ve
yardımlı sıralamalar ayrı tutulur. Yardımcı ürünler yeni ödül üretmez; yalnızca
oyuncunun tur içindeki kararına yardımcı olur.

## Canlı ekonomi güvenlik sözleşmesi

Mevcut arayüz etkileşimli bir tasarım prototipidir. Gerçek ödül ve Stars satışı
açılmadan önce aşağıdaki sunucu sözleşmesi uygulanmalıdır:

1. Sunucu kısa ömürlü, kullanıcıya bağlı ve tek kullanımlık `runId` üretir.
2. İstemci ödül tutarı göndermez. Sunucu sürümlü kurallarla skoru ve ödülü
   olaylardan yeniden hesaplar.
3. Tur bitirme çağrısı UUID `requestId` ile idempotent olur; aynı `runId` ikinci
   kez ödüllendirilemez.
4. Günlük ödüllü tur ve toplam ödül sınırları veritabanında atomik uygulanır.
5. Yardımcı hakkı yalnız doğrulanmış Telegram Stars ödemesiyle tanımlanır. SKU,
   XTR tutarı, fatura sahibi ve charge kimliği sunucuda eşleştirilir.
6. Yardımcı kullanımı tur kaydına ve ödül defterine yazılır; standart
   leaderboard bu koşuları kabul etmez.
7. İade, kalan yardımcı hakkını kapatır. Kullanılmış hak geçmişi silinmez.

Önizlemedeki “Modülü dene” düğmesi yalnız tasarım önizlemesinde çalışır. Canlı
oyunda ödeme sözleşmesi tamamlanana kadar yardımcı aktivasyonu kapalıdır.
