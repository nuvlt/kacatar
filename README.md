# 🇹🇷 Süper Lig API Entegrasyonu

## Mevcut Durum
Süper Lig manual ekleniyor.

## API Seçenekleri

### 2. TheSportsDB
- ✅ Ücretsiz
- ❌ Süper Lig desteği zayıf
- Endpoint: `/eventsnextleague.php?id=4481`

### 5. Football-Data.org
- ✅ Top Ligler var - Ücretsiz
- ❌ Süper Lig yok

## Entegrasyon Noktaları

Süper Lig API'si bulunduğunda şu dosyalara eklenmeli:

1. **api/sync-matches.js** - Satır ~120
   - TODO yorumu var
   - Maç çekme fonksiyonu eklenecek

2. **api/live-scores.js** - Satır ~80
   - TODO yorumu var
   - Sonuç çekme fonksiyonu eklenecek

## Test Edilmesi Gerekenler

- [ ] Maç tarihleri doğru formatta mı?
- [ ] Takım isimleri Firestore'daki ile uyuşuyor mu?
- [ ] Logolar çekiliyor mu?
- [ ] Sonuçlar doğru geliyor mu?

## Manuel Ekleme

API bulunana kadar admin panelden manuel olarak:
1. Teams collection'a Türk takımları ekle
2. Matches collection'a maçları manuel ekle
3. sync-matches.js çalışırken bunlar korunur (logo preserve)
