// api/add-superlig-match.js
// Süper Lig maçlarını manuel ekler

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { key, home, away, date, time } = req.body;

    // Auth
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Validation
    if (!home || !away || !date) {
      return res.status(400).json({ 
        error: 'Eksik bilgi: home, away, date gerekli' 
      });
    }

    console.log(`🇹🇷 Süper Lig maçı ekleniyor: ${home} vs ${away}`);

    // Logoları bul
    let homeLogo = "";
    let awayLogo = "";

    try {
      const homeSnap = await db.collection("teams")
        .where("nameLower", "==", home.toLowerCase().trim())
        .limit(1)
        .get();
      
      if (!homeSnap.empty) {
        homeLogo = homeSnap.docs[0].data().logo || "";
      }

      const awaySnap = await db.collection("teams")
        .where("nameLower", "==", away.toLowerCase().trim())
        .limit(1)
        .get();
      
      if (!awaySnap.empty) {
        awayLogo = awaySnap.docs[0].data().logo || "";
      }
    } catch (e) {
      console.warn('Logo fetch error:', e.message);
    }

    // Tarih formatı: "2024-10-25 19:00" veya "2024-10-25T19:00:00Z"
    const fullDateTime = time ? `${date} ${time}` : date;

    // Maçı kaydet
    const docId = `sl-${home}-${away}-${date}`.replace(/\s+/g, "_").replace(/:/g, "-");
    
    const matchData = {
      competition: "super-lig",
      league: "Süper Lig",
      home: home,
      away: away,
      homeTeam: home,
      awayTeam: away,
      homeLogo: homeLogo,
      awayLogo: awayLogo,
      date: fullDateTime,
      time: fullDateTime,
      votes: {},
      popularPrediction: null,
      voteCount: 0,
      syncedAt: new Date().toISOString(),
    };

    await db.collection("matches").doc(docId).set(matchData);

    console.log(`✅ Maç eklendi: ${home} vs ${away}`);

    return res.status(200).json({
      ok: true,
      message: `✅ ${home} vs ${away} maçı eklendi`,
      matchId: docId,
      logos: {
        home: !!homeLogo,
        away: !!awayLogo,
      },
    });

  } catch (error) {
    console.error('Add match error:', error);
    return res.status(500).json({ 
      ok: false,
      error: error.message 
    });
  }
}
