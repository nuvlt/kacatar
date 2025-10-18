// api/debug-match.js
// Tek bir maçı debug eder

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

    console.log("\n🔍 İlk maçı kontrol ediyorum...\n");

    // İlk maçı al
    const matchesSnapshot = await db.collection("matches").limit(1).get();
    
    if (matchesSnapshot.empty) {
      return res.status(404).json({ error: "Hiç maç yok!" });
    }

    const matchDoc = matchesSnapshot.docs[0];
    const matchData = matchDoc.data();

    // Field'ları analiz et
    const analysis = {
      docId: matchDoc.id,
      fields: Object.keys(matchData),
      home: matchData.home,
      away: matchData.away,
      homeLogo: matchData.homeLogo,
      awayLogo: matchData.awayLogo,
      homeLogoType: typeof matchData.homeLogo,
      awayLogoType: typeof matchData.awayLogo,
      homeLogoLength: matchData.homeLogo?.length || 0,
      awayLogoLength: matchData.awayLogo?.length || 0,
      hasLogosField: "logos" in matchData,
      rawData: matchData,
    };

    // Teams'den kontrol et
    const homeTeamSnapshot = await db
      .collection("teams")
      .where("nameLower", "==", matchData.home.toLowerCase().trim())
      .limit(1)
      .get();
    
    const awayTeamSnapshot = await db
      .collection("teams")
      .where("nameLower", "==", matchData.away.toLowerCase().trim())
      .limit(1)
      .get();

    analysis.teamsCheck = {
      homeTeamFound: !homeTeamSnapshot.empty,
      awayTeamFound: !awayTeamSnapshot.empty,
      homeTeamLogo: homeTeamSnapshot.empty ? null : homeTeamSnapshot.docs[0].data().logo,
      awayTeamLogo: awayTeamSnapshot.empty ? null : awayTeamSnapshot.docs[0].data().logo,
    };

    console.log("\n📊 Analiz:", JSON.stringify(analysis, null, 2));
    return res.status(200).json(analysis);

  } catch (error) {
    console.error("❌ Debug error:", error);
    return res.status(500).json({
      error: error.message || String(error),
    });
  }
}
