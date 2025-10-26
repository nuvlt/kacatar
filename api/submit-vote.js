// api/submit-vote.js
// Güvenli oy kaydetme endpoint'i

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
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { matchId, prediction, userId } = req.body;

    // Validation
    if (!matchId || !prediction || !userId) {
      return res.status(400).json({ 
        error: 'matchId, prediction, userId gerekli' 
      });
    }

    // Skor formatı kontrolü (örn: "2-1")
    if (!/^\d+-\d+$/.test(prediction)) {
      return res.status(400).json({ 
        error: 'Geçersiz skor formatı. Örnek: "2-1"' 
      });
    }

    // Skor limiti (0-20 arası)
    const [home, away] = prediction.split('-').map(Number);
    if (home > 20 || away > 20 || home < 0 || away < 0) {
      return res.status(400).json({ 
        error: 'Skor 0-20 arasında olmalı' 
      });
    }

    // Maç var mı kontrol et
    const matchRef = db.collection("matches").doc(matchId);
    const matchSnap = await matchRef.get();

    if (!matchSnap.exists) {
      return res.status(404).json({ error: 'Maç bulunamadı' });
    }

    const matchData = matchSnap.data();

    // Maç başladı mı kontrol et (opsiyonel)
    const matchDate = new Date(matchData.date || matchData.time);
    const now = new Date();
    if (matchDate < now) {
      return res.status(400).json({ 
        error: 'Maç başladı, tahmin yapılamaz' 
      });
    }

    // Oyu kaydet
    const votes = matchData.votes || {};
    votes[userId] = prediction;

    // En popüler tahmini hesapla
    const counts = {};
    Object.values(votes).forEach((p) => {
      counts[p] = (counts[p] || 0) + 1;
    });

    let popular = null;
    let maxCount = 0;
    for (let [score, count] of Object.entries(counts)) {
      if (count > maxCount) { 
        popular = score; 
        maxCount = count; 
      }
    }

    // Güncelle
    await matchRef.update({
      votes: votes,
      popularPrediction: popular,
      voteCount: maxCount,
      lastVoteAt: new Date().toISOString()
    });

    return res.status(200).json({
      ok: true,
      message: 'Tahmin kaydedildi',
      prediction: prediction,
      popularPrediction: popular,
      voteCount: maxCount
    });

  } catch (error) {
    console.error('Submit vote error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}
