# 🇹🇷 Süper Lig API Entegrasyonu

## Mevcut Durum
Süper Lig için uygun bir API bulunmadı. CollectAPI çalışmıyor.

## Alternatif API Seçenekleri

### 1. API-Football (api-football.com)
- ✅ Profesyonel
- ✅ Türk Süper Lig desteği var
- ❌ Ücretli (free tier sınırlı)
- Endpoint: `/fixtures?league=203&season=2024`

### 2. TheSportsDB
- ✅ Ücretsiz
- ❌ Süper Lig desteği zayıf
- Endpoint: `/eventsnextleague.php?id=4481`

### 3. RapidAPI - Turkish Super Lig
- ✅ Özel Süper Lig API'si
- ❌ Ücretli
- URL: https://rapidapi.com/api-sports/api/api-football

### 4. Sportradar
- ✅ Kapsamlı
- ❌ Pahalı, enterprise
- URL: https://sportradar.com

### 5. Football-Data.org
- ❌ Süper Lig yok

## Entegrasyon Noktaları

Süper Lig API'si bulunduğunda şu dosyalara eklenmeli:

1. **api/sync-matches.js** - Satır ~120
   - TODO yorumu var
   - Maç çekme fonksiyonu eklenecek

2. **api/live-scores.js** - Satır ~80
   - TODO yorumu var
   - Sonuç çekme fonksiyonu eklenecek

3. **Environment Variables**
   - `SUPERLIG_API_KEY` eklenecek

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
