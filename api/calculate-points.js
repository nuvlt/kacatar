// api/calculate-points.js
// Maç sonuçlandığında puanları hesaplar ve günceller

import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  } catch (e) {
    console.error("Firebase init error:", e);
  }
}

const db = admin.firestore();

// Puan hesaplama mantığı
function calculatePoints(prediction, actualScore) {
  if (prediction === actualScore) {
    // Tam isabetli
    return 10;
  }
  
  const [predHome, predAway] = prediction.split('-').map(Number);
  const [actualHome, actualAway] = actualScore.split('-').map(Number);
  
  // Sonuç doğru mu? (galibiyet/beraberlik)
  const predResult = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw';
  const actualResult = actualHome > actualAway ? 'home' : actualHome < actualAway ? 'away' : 'draw';
  
  if (predResult === actualResult) {
    // Doğru sonuç
    return 3;
  }
  
  // Yanlış
  return 0;
}

export default async function handler(req, res) {
  try {
    const { matchId, actualScore, key } = req.body;

    // Auth
    if (req.method !== 'POST' || key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!matchId || !actualScore) {
      return res.status(400).json({ error: 'matchId ve actualScore gerekli' });
    }

    console.log(`🎯 Puan hesaplanıyor: ${matchId} - ${actualScore}`);

    // Maçı getir
    const matchRef = db.collection("matches").doc(matchId);
    const matchDoc = await matchRef.get();

    if (!matchDoc.exists) {
      return res.status(404).json({ error: 'Maç bulunamadı' });
    }

    const match = matchDoc.data();
    const votes = match.votes || {};
    
    let updatedUsers = 0;
    const batch = db.batch();

    // Her tahmin için puan hesapla
    for (const [userId, prediction] of Object.entries(votes)) {
      // Anonim kullanıcıları atla
      if (userId.startsWith('anon-')) continue;

      const points = calculatePoints(prediction, actualScore);
      
      if (points > 0) {
        const userRef = db.collection("users").doc(userId);
        
        // User stats güncelle
        batch.update(userRef, {
          'stats.totalPredictions': admin.firestore.FieldValue.increment(1),
          'stats.correctPredictions': admin.firestore.FieldValue.increment(points === 10 ? 1 : 0),
          'stats.points': admin.firestore.FieldValue.increment(points),
          'stats.lastUpdated': new Date().toISOString()
        });

        // Puan geçmişi kaydet
        const pointHistoryRef = db.collection("pointHistory").doc();
        batch.set(pointHistoryRef, {
          userId: userId,
          matchId: matchId,
          prediction: prediction,
          actualScore: actualScore,
          points: points,
          timestamp: new Date().toISOString()
        });

        updatedUsers++;
      }
    }

    // Maçı "puanlandı" olarak işaretle
    batch.update(matchRef, {
      pointsCalculated: true,
      pointsCalculatedAt: new Date().toISOString()
    });

    await batch.commit();

    console.log(`✅ ${updatedUsers} kullanıcı puanlandı`);

    return res.status(200).json({
      ok: true,
      message: `✅ ${updatedUsers} kullanıcı puanlandı`,
      updatedUsers: updatedUsers,
      totalVotes: Object.keys(votes).length
    });

  } catch (error) {
    console.error('Calculate points error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}
