// api/update-logo.js
// Admin panelden logo güncelleme (güvenli)

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
    const { teamName, logoUrl, adminKey } = req.body;

    // Admin auth kontrolü
    if (adminKey !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Validation
    if (!teamName || !logoUrl) {
      return res.status(400).json({ 
        error: 'teamName ve logoUrl gerekli' 
      });
    }

    // URL validation
    if (!logoUrl.startsWith('http://') && !logoUrl.startsWith('https://')) {
      return res.status(400).json({ 
        error: 'Geçersiz URL formatı' 
      });
    }

    console.log(`🎨 Logo güncelleniyor: ${teamName}`);

    // 1. Teams collection'a kaydet/güncelle
    const teamDocId = teamName.toLowerCase().replace(/\s+/g, '-');
    await db.collection("teams").doc(teamDocId).set({
      name: teamName,
      nameLower: teamName.toLowerCase().trim(),
      logo: logoUrl,
      lastUpdated: new Date().toISOString(),
    }, { merge: true });

    // 2. Bu takımın tüm maçlarını bul ve güncelle
    const matchesSnapshot = await db.collection("matches").get();
    const batch = db.batch();
    let updatedCount = 0;

    matchesSnapshot.forEach((doc) => {
      const match = doc.data();
      let needsUpdate = false;
      const updates = {};

      // Home team kontrolü
      if ((match.home || match.homeTeam) === teamName) {
        updates.homeLogo = logoUrl;
        needsUpdate = true;
      }

      // Away team kontrolü
      if ((match.away || match.awayTeam) === teamName) {
        updates.awayLogo = logoUrl;
        needsUpdate = true;
      }

      if (needsUpdate) {
        batch.update(doc.ref, updates);
        updatedCount++;
      }
    });

    // Batch commit
    if (updatedCount > 0) {
      await batch.commit();
    }

    console.log(`✅ ${teamName}: ${updatedCount} maç güncellendi`);

    return res.status(200).json({
      ok: true,
      message: `✅ ${teamName} logosu güncellendi`,
      updatedMatches: updatedCount,
      logoUrl: logoUrl,
    });

  } catch (error) {
    console.error('Update logo error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}
