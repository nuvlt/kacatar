// api/status.js
// Sistemin gerçek durumunu gösterir

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

export default async function handler(req, res) {
  try {
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    console.log("\n📊 Sistem durumu kontrol ediliyor...\n");

    // 1️⃣ Teams collection
    const teamsSnapshot = await db.collection("teams").get();
    const teamsWithLogo = [];
    const teamsWithoutLogo = [];
    
    teamsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.logo && data.logo !== "" && data.logo !== "null") {
        teamsWithLogo.push(data.name);
      } else {
        teamsWithoutLogo.push(data.name);
      }
    });

    // 2️⃣ Matches collection - gerçekte hangi takımlar var?
    const matchesSnapshot = await db.collection("matches").get();
    const teamsInMatches = new Set();
    const matchesWithMissingLogos = [];
    
    matchesSnapshot.forEach((doc) => {
      const data = doc.data();
      const home = data.home || data.homeTeam;
      const away = data.away || data.awayTeam;
      
      if (home) teamsInMatches.add(home);
      if (away) teamsInMatches.add(away);
      
      // Logo eksik mi?
      const homeMissing = !data.homeLogo || data.homeLogo === "";
      const awayMissing = !data.awayLogo || data.awayLogo === "";
      
      if (homeMissing || awayMissing) {
        matchesWithMissingLogos.push({
          home: home,
          away: away,
          homeLogo: !!data.homeLogo,
          awayLogo: !!data.awayLogo,
        });
      }
    });

    // 3️⃣ Maçlarda olan ama teams'de OLMAYAN takımlar
    const teamsInTeamsCollection = new Set(
      teamsSnapshot.docs.map(d => d.data().name?.toLowerCase().trim()).filter(Boolean)
    );
    
    const teamsNotInTeamsCollection = Array.from(teamsInMatches).filter(team => {
      return !teamsInTeamsCollection.has(team.toLowerCase().trim());
    });

    const result = {
      ok: true,
      teams: {
        total: teamsSnapshot.size,
        withLogo: teamsWithLogo.length,
        withoutLogo: teamsWithoutLogo.length,
        missingTeams: teamsWithoutLogo.sort(),
      },
      matches: {
        total: matchesSnapshot.size,
        uniqueTeams: teamsInMatches.size,
        matchesWithMissingLogos: matchesWithMissingLogos.length,
        missingLogoDetails: matchesWithMissingLogos.slice(0, 10),
      },
      inconsistencies: {
        teamsInMatchesButNotInTeams: teamsNotInTeamsCollection.length,
        list: teamsNotInTeamsCollection,
      },
      timestamp: new Date().toISOString(),
    };

    console.log("\n📊 Sonuç:", JSON.stringify(result, null, 2));
    return res.status(200).json(result);

  } catch (error) {
    console.error("❌ Status error:", error);
    return res.status(500).json({
      error: error.message || String(error),
    });
  }
}
