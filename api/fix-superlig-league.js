// api/fix-superlig-league.js
// Mevcut Süper Lig maçlarının league field'ını düzeltir

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
    const { key } = req.query;

    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    console.log('🔧 Süper Lig maçları düzeltiliyor...');

    const matchesSnapshot = await db.collection("matches").get();
    
    const batch = db.batch();
    let fixedCount = 0;

    matchesSnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Süper Lig maçını bul
      if (data.league === 'Süper Lig' || data.competition === 'super-lig') {
        batch.update(doc.ref, { league: 'super-lig' });
        fixedCount++;
        console.log(`✅ Düzeltildi: ${data.home} vs ${data.away}`);
      }
    });

    if (fixedCount > 0) {
      await batch.commit();
    }

    return res.status(200).json({
      ok: true,
      message: `✅ ${fixedCount} Süper Lig maçı düzeltildi`,
      fixedCount,
    });

  } catch (error) {
    console.error('Fix error:', error);
    return res.status(500).json({ error: error.message });
  }
}
