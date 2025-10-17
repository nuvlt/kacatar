// api/fix-teams.js
// Mevcut teams collection'ı düzeltir ve eksik takımları ekler

const admin = require("firebase-admin");
const { findTeamLogo } = require("./logo-service");

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

    console.log("\n🔧 Teams Collection Düzeltiliyor...\n");

    const apiKeys = {
      sportmonks: process.env.SPORTMONKS_API_KEY,
      thesportsdb: process.env.THESPORTSDB_KEY,
      googleKey: process.env.GOOGLE_SEARCH_KEY,
      googleCx: process.env.GOOGLE_CX,
    };

    // 1️⃣ Mevcut teams'i düzelt
    console.log("📝 Adım 1: Mevcut teams yapısı düzeltiliyor...");
    const teamsSnapshot = await db.collection("teams").get();
    let fixed = 0;
    
    for (const doc of teamsSnapshot.docs) {
      const data = doc.data();
      const docId = doc.id;
      
      // Eğer name field'ı yoksa, doc ID'yi name olarak kullan
      const teamName = data.name || docId;
      const teamLogo = data.logo || null;
      
      await doc.ref.set({
        name: teamName,
        nameLower: teamName.toLowerCase().trim(),
        logo: teamLogo,
        createdAt: data.createdAt || new Date().toISOString(),
        lastChecked: new Date().toISOString(),
      }, { merge: true });
      
      fixed++;
      console.log(`✅ Düzeltildi: ${teamName}`);
    }
    
    console.log(`\n✅ ${fixed} takım yapısı düzeltildi\n`);

    // 2️⃣ Matches'den eksik takımları tespit et
    console.log("📝 Adım 2: Matches'den eksik takımlar bulunuyor...");
    const matchesSnapshot = await db.collection("matches").get();
    const uniqueTeams = new Set();
    
    matchesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.home) uniqueTeams.add(data.home);
      if (data.away) uniqueTeams.add(data.away);
      if (data.homeTeam) uniqueTeams.add(data.homeTeam);
      if (data.awayTeam) uniqueTeams.add(data.awayTeam);
    });
    
    console.log(`🔍 Matches'de ${uniqueTeams.size} farklı takım bulundu`);

    // 3️⃣ Teams'de olmayan takımları bul
    const updatedTeamsSnapshot = await db.collection("teams").get();
    const existingTeams = new Set();
    
    updatedTeamsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.nameLower) existingTeams.add(data.nameLower);
    });
    
    const missingTeams = Array.from(uniqueTeams).filter(team => {
      return team && !existingTeams.has(team.toLowerCase().trim());
    });
    
    console.log(`❌ Teams'de eksik ${missingTeams.length} takım var\n`);

    // 4️⃣ Eksik takımlar için logo bul ve ekle
    let added = 0;
    let foundLogos = 0;
    
    for (const teamName of missingTeams) {
      console.log(`\n🔍 Logo aranıyor: ${teamName}`);
      
      const logo = await findTeamLogo(teamName, apiKeys);
      
      await db.collection("teams").add({
        name: teamName,
        nameLower: teamName.toLowerCase().trim(),
        logo: logo,
        createdAt: new Date().toISOString(),
        lastChecked: new Date().toISOString(),
      });
      
      if (logo) {
        foundLogos++;
        console.log(`✅ Logo bulundu: ${teamName}`);
      } else {
        console.log(`⚠️ Logo bulunamadı: ${teamName}`);
      }
      
      added++;
    }

    // 5️⃣ Matches'i güncelle (logoları teams'den al)
    console.log("\n📝 Adım 3: Matches collection güncelleniyor...");
    
    // Tüm takımları map olarak al
    const finalTeamsSnapshot = await db.collection("teams").get();
    const teamsMap = {};
    
    finalTeamsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.nameLower) {
        teamsMap[data.nameLower] = data.logo || "";
      }
    });
    
    // Matches'i güncelle
    let updatedMatches = 0;
    
    for (const doc of matchesSnapshot.docs) {
      const data = doc.data();
      const home = data.home || data.homeTeam;
      const away = data.away || data.awayTeam;
      
      const homeLogo = teamsMap[home?.toLowerCase().trim()] || "";
      const awayLogo = teamsMap[away?.toLowerCase().trim()] || "";
      
      await doc.ref.update({
        homeLogo: homeLogo,
        awayLogo: awayLogo,
      });
      
      updatedMatches++;
    }
    
    console.log(`✅ ${updatedMatches} maç güncellendi\n`);

    const result = {
      ok: true,
      message: "✅ Teams collection düzeltildi ve matches güncellendi",
      stats: {
        fixedTeams: fixed,
        addedTeams: added,
        foundNewLogos: foundLogos,
        updatedMatches: updatedMatches,
        totalTeams: finalTeamsSnapshot.size,
      },
      timestamp: new Date().toISOString(),
    };

    console.log("📊 Sonuç:", JSON.stringify(result, null, 2));
    return res.status(200).json(result);

  } catch (error) {
    console.error("❌ Fix teams error:", error);
    return res.status(500).json({
      error: error.message || String(error),
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};
