// api/update-popular-predictions.js
// Predictions collection'dan popüler tahminleri hesaplar ve matches'e yazar
// Bu endpoint'i cron olarak da çalıştırabilirsiniz veya submit-vote'tan sonra çağırabilirsiniz

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

export default async function handler(req, res) {
  try {
    // GET isteği de kabul et (cron için)
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('🔄 Popüler tahminler güncelleniyor...');

    // Tüm aktif maçları getir
    const matchesSnapshot = await db.collection("matches").get();
    
    let updatedCount = 0;
    const batch = db.batch();
    let batchCount = 0;

    for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;

      // Bu maç için tüm tahminleri getir
      const predictionsQuery = await db.collection("predictions")
        .where("matchId", "==", matchId)
        .get();

      if (predictionsQuery.empty) {
        // Tahmin yoksa boş yaz
        batch.update(matchDoc.ref, {
          popularPrediction: null,
          voteCount: 0,
          votes: {} // Backward compatibility için
        });
        batchCount++;
        continue;
      }

      // Tahminleri say
      const counts = {};
      predictionsQuery.forEach(predDoc => {
        const pred = predDoc.data().prediction;
        counts[pred] = (counts[pred] || 0) + 1;
      });

      // En popüleri bul
      let popular = null;
      let maxCount = 0;
      for (let [score, count] of Object.entries(counts)) {
        if (count > maxCount) {
          popular = score;
          maxCount = count;
        }
      }

      // Matches'e yaz
      batch.update(matchDoc.ref, {
        popularPrediction: popular,
        voteCount: maxCount,
        votes: {} // Boş - artık kullanılmıyor
      });

      batchCount++;
      updatedCount++;

      // Her 500 işlemde bir commit
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`💾 ${batchCount} maç commit edildi`);
        batchCount = 0;
      }
    }

    // Kalan kayıtları commit et
    if (batchCount > 0) {
      await batch.commit();
      console.log(`💾 Son ${batchCount} maç commit edildi`);
    }

    console.log(`✅ ${updatedCount} maçın popüler tahmini güncellendi`);

    return res.status(200).json({
      ok: true,
      message: `✅ ${updatedCount} maç güncellendi`,
      stats: {
        totalMatches: matchesSnapshot.size,
        updated: updatedCount
      }
    });

  } catch (error) {
    console.error('❌ Update popular predictions error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}
