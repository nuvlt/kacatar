// api/debug-teams.js
// Firestore'daki teams ve matches durumunu gösterir

const admin = require("firebase-admin");

if (!admin.apps.length) {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (svc) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(svc)),
    });
  }
}
const db = admin.firestore();

module.exports = async (req, res) => {
  try {
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    console.log("\n🔍 Firestore Debug Başlatılıyor...\n");

    // 1️⃣ Teams collection kontrolü
    const teamsSnapshot = await db.collection("teams").get();
    console.log(`📊 Teams Collection: ${teamsSnapshot.size} doküman`);
    
    const teamsData = [];
    teamsSnapshot.forEach((doc) => {
      const data = doc.data();
      teamsData.push({
        id: doc.id,
        name: data.name,
        nameLower: data.nameLower,
        logo: data.logo,
        hasLogo: !!data.logo,
      });
    });

    // 2️⃣ Matches collection kontrolü
    const matchesSnapshot = await db.collection("matches").get();
    console.log(`📊 Matches Collection: ${matchesSnapshot.size} doküman`);
    
    const matchesData = [];
    const uniqueTeams = new Set();
    
    matchesSnapshot.forEach((doc) => {
      const data = doc.data();
      
      uniqueTeams.add(data.home || data.homeTeam);
      uniqueTeams.add(data.away || data.awayTeam);
      
      matchesData.push({
        id: doc.id,
        home: data.home || data.homeTeam,
        away: data.away || data.awayTeam,
        homeLogo: data.homeLogo,
        awayLogo: data.awayLogo,
        hasHomelogo: !!data.homeLogo,
        hasAwayLogo: !!data.awayLogo,
      });
    });

    // 3️⃣ Eksik logoları tespit et
    const teamsWithoutLogo = teamsData.filter(t => !t.logo || t.logo === "");
    const matchesWithoutLogos = matchesData.filter(m => !m.hasHomelogo || !m.hasAwayLogo);

    // 4️⃣ Teams'de olmayan takımlar (matches'de var ama teams'de yok)
    const teamsInDb = new Set(teamsData.map(t => t.nameLower));
    const missingFromTeams = Array.from(uniqueTeams).filter(team => {
      return team && !teamsInDb.has(team.toLowerCase().trim());
    });

    const result = {
      ok: true,
      summary: {
        totalTeams: teamsSnapshot.size,
        totalMatches: matchesSnapshot.size,
        uniqueTeamsInMatches: uniqueTeams.size,
        teamsWithoutLogo: teamsWithoutLogo.length,
        matchesWithMissingLogos: matchesWithoutLogos.length,
        teamsNotInTeamsCollection: missingFromTeams.length,
      },
      teamsWithoutLogo: teamsWithoutLogo.slice(0, 10), // İlk 10
      matchesWithMissingLogos: matchesWithoutLogos.slice(0, 10), // İlk 10
      teamsNotInTeamsCollection: missingFromTeams.slice(0, 20), // İlk 20
      allTeams: teamsData.length < 50 ? teamsData : teamsData.slice(0, 50), // Çok varsa ilk 50
    };

    console.log("\n📊 Sonuç:", JSON.stringify(result, null, 2));
    return res.status(200).json(result);

  } catch (error) {
    console.error("❌ Debug error:", error);
    return res.status(500).json({
      error: error.message || String(error),
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};
