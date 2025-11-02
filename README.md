# 🇹🇷 Kaç Atar - Skor Tahmin Platformu

## 📦 Firestore Collections

### 1. `matches` (Maçlar)
- Güncel maçları tutar
- 6 saat öncesi maçlar otomatik silinir
- `votes` field'ı artık kullanılmıyor (boş tutulur)
- Sadece popüler tahmin bilgisi saklanır

```javascript
{
  id: "123456",
  home: "Manchester United",
  away: "Liverpool",
  homeLogo: "https://...",
  awayLogo: "https://...",
  league: "PL",
  date: "2024-03-15T18:00:00Z",
  popularPrediction: "2-1",
  voteCount: 145,
  votes: {}, // Boş - artık kullanılmıyor
  syncedAt: "2024-03-15T10:00:00Z"
}
```

### 2. `predictions` (Tahminler) ⭐ YENİ
- Kullanıcı tahminlerini kalıcı olarak saklar
- Maçlar silinse bile tahminler korunur
- Her tahmin ayrı bir doküman

```javascript
{
  id: "user123_match456",
  userId: "user123",
  matchId: "456",
  prediction: "2-1",
  homeTeam: "Manchester United",
  awayTeam: "Liverpool",
  homeLogo: "https://...",
  awayLogo: "https://...",
  league: "PL",
  matchDate: "2024-03-15T18:00:00Z",
  status: "pending", // pending | correct | wrong
  points: 0,
  actualScore: null, // Maç bitince doldurulur
  createdAt: "2024-03-14T12:00:00Z",
  updatedAt: "2024-03-14T12:00:00Z",
  calculatedAt: null // Puan hesaplandığında doldurulur
}
```

### 3. `users` (Kullanıcılar)
- Gmail ile giriş yapan kullanıcılar
- Stats ve puan bilgileri

### 4. `teams` (Takımlar)
- Takım logoları
- Admin panelden güncellenebilir

### 5. `pointHistory` (Puan Geçmişi)
- Kullanıcıların kazandığı puanların geçmişi

## 🔄 Veri Akışı

### Tahmin Yapma:
1. Kullanıcı tahmin yapar
2. `predictions` collection'a kaydedilir (userId_matchId)
3. Tüm tahminler toplanır ve en popüler tahmin hesaplanır
4. `matches` collection'daki `popularPrediction` güncellenir

### Maç Bittiğinde:
1. API'den maç skoru alınır
2. `predictions` collection'dan o maç için tüm tahminler çekilir
3. Her tahmin için puan hesaplanır
4. `predictions` dokümanı güncellenir (status, points, actualScore)
5. Kullanıcı puanları `users` collection'da güncellenir

### Eski Maçların Silinmesi:
1. `sync-matches.js` her gün çalışır
2. 6 saatten eski maçlar `matches` collection'dan silinir
3. ⚠️ **ÖNEMLİ:** `predictions` collection'a dokunulmaz
4. Tahminler kalıcı olarak saklanır

## 🚀 Migrasyon (TEK SEFERLIK)

Mevcut `matches.votes` verilerini `predictions` collection'a taşımak için:

```bash
GET /api/migrate-votes?key=YOUR_SECRET_KEY
```

Bu endpoint:
- Tüm maçlardaki `votes` field'larını okur
- Her oyu `predictions` collection'a kaydeder
- Duplicate kontrolü yapar
- Mevcut predictions varsa atlar

## 📊 API Endpoints

### `/api/submit-vote` (POST)
- Tahmin kaydeder
- `predictions` collection'a yazar
- Popüler tahmini günceller

### `/api/calculate-points` (POST)
- Maç bittiğinde puanları hesaplar
- `predictions` collection'dan tahminleri alır
- User stats'ı günceller

### `/api/sync-matches` (GET/Cron)
- Günlük olarak maçları günceller
- 6 saatten eski maçları siler
- Predictions'a dokunmaz

### `/api/update-popular-predictions` (GET)
- Tüm maçların popüler tahminlerini günceller
- `predictions` collection'dan veri okur
- Opsiyonel: Cron olarak çalıştırılabilir

### `/api/migrate-votes` (GET) - TEK SEFERLIK
- Mevcut votes'ları predictions'a taşır
- Sadece bir kere çalıştırılmalı

## ⚙️ Kurulum

1. Mevcut kodu deploy edin
2. Migrasyon endpoint'ini çalıştırın:
   ```bash
   curl "https://your-domain.com/api/migrate-votes?key=YOUR_SECRET_KEY"
   ```
3. Sonuçları kontrol edin (oylarim.html sayfasından)
4. Her şey doğruysa artık eski maçlar silinse bile tahminler kaybolmayacak

## 🔥 Önemli Notlar

1. **API Limiti:** Hiçbir yeni API eklenmedi, sadece Firestore yapısı değişti
2. **Backward Compatibility:** `matches.votes` field'ı boş tutulur ama silinmez
3. **Performance:** Predictions'ta index oluşturun:
   - `userId` (ASC)
   - `matchId` (ASC)
   - `status` (ASC)

## 🎯 Faydalar

✅ Tahminler kalıcı (eski maçlar silinse bile)
✅ Daha iyi sorgulama performansı
✅ Kullanıcı bazlı raporlama kolay
✅ Puan geçmişi detaylı
✅ API limiti aşmıyor
✅ Mevcut kod minimal değişiklik

## 🐛 Sorun Giderme

### Tahminler görünmüyor:
1. Migration yapıldı mı kontrol edin
2. Console'da hata var mı bakın
3. Firestore rules'u kontrol edin

### Popüler tahmin yanlış:
1. `/api/update-popular-predictions` çalıştırın
2. Submit-vote doğru çalışıyor mu kontrol edin

### Puan hesaplanmıyor:
1. `calculate-points.js` doğru çalışıyor mu kontrol edin
2. Predictions collection'da status güncelleniyor mu bakın
