// api/sync-matches-logos.js
// Mevcut maçların logolarını teams collection'dan günceller

import admin from "firebase-admin";

if (!admin.apps.length) {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (svc) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(svc)),
    });
  }
}
const db = admin.firestore();

// Takım adı eşleştirme (matches → teams)
function normalizeTeamName(name) {
  if (!name) return null;
  
  // Özel mapping'ler
  const mappings = {
    "barça": "barcelona",
    "atleti": "atletico madrid",
    "man united": "manchester united",
    "olympique lyon": "lyon",
    "hsv": "hamburger sv",
    "m'gladbach": "borussia monchengladbach",
    "1. fc köln": "fc koln",
  };
  
  const lower = name.toLowerCase().trim();
  
  // Mapping'de varsa
  if (mappings[lower]) {
    return mappings[lower];
  }
  
  return lower;
}

export default async function handler(req, res) {
  try {
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    console.log("\n🔄 Matches logoları güncelleniyor...\n");

    // 1️⃣ Tüm takımları bir map'e al
    const teamsSnapshot = await db.collection("teams").get();
    const teamsMap = new Map();
    
    teamsSnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Orijinal isim (lowercase)
      if (data.name) {
        const nameLower = data.name.toLowerCase().trim();
        teamsMap.set(nameLower, data.logo || null);
        
        // Normalize edilmiş isim
        const normalized = normalizeTeamName(data.name);
        if (normalized && normalized !== nameLower) {
          teamsMap.set(normalized, data.logo || null);
        }
      }
      
      // nameLower field'ı varsa onu da ekle
      if (data.nameLower) {
        teamsMap.set(data.nameLower, data.logo || null);
      }
    });
    
    console.log(`📊 Teams map: ${teamsMap.size} entry`);

    // 2️⃣ Tüm maçları güncelle
    const matchesSnapshot = await db.collection("matches").get();
    let updated = 0;
    let notFound = [];
    
    for (const doc of matchesSnapshot.docs) {
      const data = doc.data();
      const home = data.home || data.homeTeam;
      const away = data.away || data.awayTeam;
      
      if (!home || !away) continue;
      
      // Normalize et
      const homeNormalized = normalizeTeamName(home);
      const awayNormalized = normalizeTeamName(away);
      
      // Logo bul
      let homeLogo = teamsMap.get(homeNormalized);
      let awayLogo = teamsMap.get(awayNormalized);
      
      // Bulamazsa direkt isimle dene
      if (!homeLogo) {
        homeLogo = teamsMap.get(home.toLowerCase().trim());
      }
      if (!awayLogo) {
        awayLogo = teamsMap.get(away.toLowerCase().trim());
      }
      
      // Track missing
      if (!homeLogo) notFound.push(home);
      if (!awayLogo) notFound.push(away);
      
      // Güncelle
      await doc.ref.update({
        homeLogo: homeLogo || "",
        awayLogo: awayLogo || "",
      });
      
      console.log(`✅ ${home} (${homeLogo ? "✓" : "✗"}) vs ${away} (${awayLogo ? "✓" : "✗"})`);
      updated++;
    }

    // Unique not found
    const uniqueNotFound = [...new Set(notFound)];

    const result = {
      ok: true,
      message: `✅ ${updated} maç güncellendi`,
      stats: {
        totalMatches: matchesSnapshot.size,
        updatedMatches: updated,
        teamsInMap: teamsMap.size,
        missingLogos: uniqueNotFound.length,
      },
      missingTeams: uniqueNotFound.length > 0 ? uniqueNotFound : undefined,
      timestamp: new Date().toISOString(),
    };

    console.log("\n📊 Sonuç:", JSON.stringify(result, null, 2));
    return res.status(200).json(result);

  } catch (error) {
    console.error("❌ Sync matches logos error:", error);
    return res.status(500).json({
      error: error.message || String(error),
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}
