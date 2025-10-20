// api/sync-matches.js
// SADECE API-Football'dan maçları çeker
// Logoları Firestore cache'den alır (teams collection)

import admin from "firebase-admin";

// Firebase başlatma (TEK SEFER)
if (!admin.apps.length) {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT missing");
  } else {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(svc)),
    });
  }
}

const db = admin.firestore(); // ← Sadece burada tanımlandı

// Manuel logo URL'leri
const MANUAL_LOGO_URLS = {
  "psg": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/100px-Paris_Saint-Germain_F.C..svg.png",
  "paris saint-germain": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/100px-Paris_Saint-Germain_F.C..svg.png",
  "arsenal": "https://upload.wikimedia.org/wikipedia/en/thumb/5/53/Arsenal_FC.svg/100px-Arsenal_FC.svg.png",
  "chelsea": "https://upload.wikimedia.org/wikipedia/en/thumb/c/cc/Chelsea_FC.svg/100px-Chelsea_FC.svg.png",
  "liverpool": "https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Liverpool_FC.svg/100px-Liverpool_FC.svg.png",
  "man city": "https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/100px-Manchester_City_FC_badge.svg.png",
  "manchester city": "https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/100px-Manchester_City_FC_badge.svg.png",
  "real madrid": "https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/100px-Real_Madrid_CF.svg.png",
  "barcelona": "https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/100px-FC_Barcelona_%28crest%29.svg.png",
  "bayern": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg/100px-FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg.png",
  "bayern munich": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg/100px-FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg.png",
  "juventus": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Juventus_FC_-_pictogram_black_%28Italy%2C_2017%29.svg/100px-Juventus_FC_-_pictogram_black_%28Italy%2C_2017%29.svg.png",
  "milan": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Logo_of_AC_Milan.svg/100px-Logo_of_AC_Milan.svg.png",
  "ac milan": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Logo_of_AC_Milan.svg/100px-Logo_of_AC_Milan.svg.png",
  "napoli": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/SSC_Neapel.svg/100px-SSC_Neapel.svg.png",
  "inter": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/FC_Internazionale_Milano_2021.svg/100px-FC_Internazionale_Milano_2021.svg.png",
  "tottenham": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b4/Tottenham_Hotspur.svg/100px-Tottenham_Hotspur.svg.png",
  "man united": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/Manchester_United_FC_crest.svg/100px-Manchester_United_FC_crest.svg.png",
  "manchester united": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/Manchester_United_FC_crest.svg/100px-Manchester_United_FC_crest.svg.png",
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// TheSportsDB'den logo al
async function tryTheSportsDB(teamName, apiKey) {
  if (!apiKey) return null;
  
  try {
    await delay(300);
    const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/searchteams.php?t=${encodeURIComponent(teamName)}`;
    
    const response = await fetch(url, { timeout: 8000 });
    const text = await response.text();
    
    if (text.startsWith("<") || text.startsWith("<!")) {
      return null;
    }
    
    const data = JSON.parse(text);
    
    if (data?.teams?.[0]) {
      const logo = data.teams[0].strTeamBadge || data.teams[0].strTeamLogo;
      if (logo) {
        console.log(`✅ TheSportsDB: ${teamName}`);
        return logo;
      }
    }
  } catch (error) {
    console.warn(`❌ TheSportsDB error: ${teamName}`, error.message);
  }
  
  return null;
}

// Logo bul
async function findTeamLogo(teamName, apiKey) {
  const lowerName = teamName.toLowerCase().trim();
  
  // Manuel URL'lere bak
  if (MANUAL_LOGO_URLS[lowerName]) {
    console.log(`✅ Manuel URL: ${teamName}`);
    return MANUAL_LOGO_URLS[lowerName];
  }
  
  // TheSportsDB
  const logo = await tryTheSportsDB(teamName, apiKey);
  if (logo) return logo;
  
  console.log(`❌ Logo yok: ${teamName}`);
  return null;
}

// Firestore'dan takım logosu al (cache)
async function getTeamLogo(teamName, apiKey) {
  try {
    const normalizedName = teamName.toLowerCase().trim();
    
    // Teams collection'dan ara
    const snapshot = await db
      .collection("teams")
      .where("nameLower", "==", normalizedName)
      .limit(1)
      .get();
    
    // Cache'de varsa dön
    if (!snapshot.empty) {
      const teamData = snapshot.docs[0].data();
      console.log(`💾 Cache: ${teamName} → ${teamData.logo ? "✅" : "❌"}`);
      return teamData.logo || null;
    }
    
    // Yoksa API'den bul
    console.log(`🆕 Yeni takım: ${teamName}`);
    const logo = await findTeamLogo(teamName, apiKey);
    
    // Firestore'a kaydet
    await db.collection("teams").add({
      name: teamName,
      nameLower: normalizedName,
      logo: logo,
      createdAt: new Date().toISOString(),
      lastChecked: new Date().toISOString(),
    });
    
    console.log(`💾 Firestore: ${teamName} → ${logo ? "✅" : "❌"}`);
    return logo;
    
  } catch (error) {
    console.error(`❌ getTeamLogo error: ${teamName}`, error.message);
    return null;
  }
}

export default async function handler(req, res) {
  try {
    // Auth kontrolü
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
    const THESPORTSDB_KEY = process.env.THESPORTSDB_KEY;

    console.log("\n🚀 Sync başlatılıyor...");
    console.log("📊 API Keys:", {
      football: !!FOOTBALL_API_KEY,
      thesportsdb: !!THESPORTSDB_KEY,
      firebase: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    });

    if (!FOOTBALL_API_KEY) {
      return res.status(500).json({ error: "FOOTBALL_API_KEY missing" });
    }

    // Tarih aralığı: bugünden +10 gün
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(from.getTime() + 10 * 24 * 60 * 60 * 1000);
    const dateFrom = from.toISOString().split("T")[0];
    const dateTo = to.toISOString().split("T")[0];

    console.log(`📅 Tarih: ${dateFrom} → ${dateTo}`);

    // Eski maçları sil
    console.log("🧹 Eski maçlar siliniyor...");
    const matchesSnapshot = await db.collection("matches").get();
    const deleteBatch = db.batch();
    matchesSnapshot.forEach((doc) => deleteBatch.delete(doc.ref));
    await deleteBatch.commit();
    console.log(`🧹 ${matchesSnapshot.size} maç silindi.`);

    // Ligler
    const competitions = ["PL", "PD", "SA", "BL1", "FL1"];
    let totalMatches = 0;
    let newTeams = 0;
    let cachedTeams = 0;

    for (const comp of competitions) {
      const url = `https://api.football-data.org/v4/matches?competitions=${comp}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      
      console.log(`\n📡 Çekiliyor: ${comp}`);
      const response = await fetch(url, {
        headers: { "X-Auth-Token": FOOTBALL_API_KEY },
      });

      if (!response.ok) {
        console.warn(`⚠️ Football-data error: ${comp} (${response.status})`);
        continue;
      }

      const data = await response.json();
      if (!data.matches || !Array.isArray(data.matches)) {
        console.warn(`⚠️ No matches: ${comp}`);
        continue;
      }

      console.log(`✅ ${data.matches.length} maç: ${comp}`);

      for (const match of data.matches) {
        const homeTeam = match.homeTeam?.shortName || match.homeTeam?.name || "Unknown";
        const awayTeam = match.awayTeam?.shortName || match.awayTeam?.name || "Unknown";
        const utcDate = match.utcDate;

        // Logoları cache'den al
        const homeLogo = await getTeamLogo(homeTeam, THESPORTSDB_KEY);
        const awayLogo = await getTeamLogo(awayTeam, THESPORTSDB_KEY);

        if (homeLogo) cachedTeams++; else newTeams++;
        if (awayLogo) cachedTeams++; else newTeams++;

        // Firestore'a kaydet
        const matchData = {
          competition: comp,
          league: comp,
          home: homeTeam,
          away: awayTeam,
          homeTeam: homeTeam,
          awayTeam: awayTeam,
          homeLogo: homeLogo || "",
          awayLogo: awayLogo || "",
          date: utcDate,
          time: utcDate ? new Date(utcDate).toISOString() : null,
          votes: {},
          popularPrediction: null,
          voteCount: 0,
          syncedAt: new Date().toISOString(),
        };

        const docId = match.id ? String(match.id) : `${comp}-${homeTeam}-${awayTeam}`.replace(/\s+/g, "_");
        
        await db.collection("matches").doc(docId).set(matchData, { merge: false });
        
        console.log(`✅ ${homeTeam} (${homeLogo ? "✓" : "✗"}) vs ${awayTeam} (${awayLogo ? "✓" : "✗"})`);
        totalMatches++;
      }
    }

    const result = {
      ok: true,
      message: `✅ ${totalMatches} maç senkronize edildi`,
      stats: {
        totalMatches,
        newTeamsChecked: newTeams,
        cachedLogos: cachedTeams,
      },
      timestamp: new Date().toISOString(),
    };

    console.log("\n📊 Sonuç:", result);
    return res.status(200).json(result);

  } catch (error) {
    console.error("❌ Sync error:", error);
    return res.status(500).json({ 
      error: error.message || String(error),
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

// Firestore'dan takım logosu al (cache)
async function getTeamLogo(teamName, apiKey) {
  try {
    const normalizedName = teamName.toLowerCase().trim();
    
    // Teams collection'dan ara
    const snapshot = await db
      .collection("teams")
      .where("nameLower", "==", normalizedName)
      .limit(1)
      .get();
    
    // Cache'de varsa dön
    if (!snapshot.empty) {
      const teamData = snapshot.docs[0].data();
      console.log(`💾 Cache: ${teamName} → ${teamData.logo ? "✅" : "❌"}`);
      return teamData.logo || null;
    }
    
    // Yoksa API'den bul
    console.log(`🆕 Yeni takım: ${teamName}`);
    const logo = await findTeamLogo(teamName, apiKey);
    
    // Firestore'a kaydet
    await db.collection("teams").add({
      name: teamName,
      nameLower: normalizedName,
      logo: logo,
      createdAt: new Date().toISOString(),
      lastChecked: new Date().toISOString(),
    });
    
    console.log(`💾 Firestore: ${teamName} → ${logo ? "✅" : "❌"}`);
    return logo;
    
  } catch (error) {
    console.error(`❌ getTeamLogo error: ${teamName}`, error.message);
    return null;
  }
}

export default async function handler(req, res) {
  try {
    // Auth kontrolü
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
    const THESPORTSDB_KEY = process.env.THESPORTSDB_KEY;

    console.log("\n🚀 Sync başlatılıyor...");
    console.log("📊 API Keys:", {
      football: !!FOOTBALL_API_KEY,
      thesportsdb: !!THESPORTSDB_KEY,
    });

    if (!FOOTBALL_API_KEY) {
      return res.status(500).json({ error: "FOOTBALL_API_KEY missing" });
    }

    // Tarih aralığı: bugünden +10 gün
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(from.getTime() + 10 * 24 * 60 * 60 * 1000);
    const dateFrom = from.toISOString().split("T")[0];
    const dateTo = to.toISOString().split("T")[0];

    console.log(`📅 Tarih: ${dateFrom} → ${dateTo}`);

    // Eski maçları sil
    console.log("🧹 Eski maçlar siliniyor...");
    const matchesSnapshot = await db.collection("matches").get();
    const batch = db.batch();
    matchesSnapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`🧹 ${matchesSnapshot.size} maç silindi.`);

    // Ligler
    const competitions = ["PL", "PD", "SA", "BL1", "FL1"];
    let totalMatches = 0;
    let newTeams = 0;
    let cachedTeams = 0;

    for (const comp of competitions) {
      const url = `https://api.football-data.org/v4/matches?competitions=${comp}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      
      console.log(`\n📡 Çekiliyor: ${comp}`);
      const response = await fetch(url, {
        headers: { "X-Auth-Token": FOOTBALL_API_KEY },
      });

      if (!response.ok) {
        console.warn(`⚠️ Football-data error: ${comp} (${response.status})`);
        continue;
      }

      const data = await response.json();
      if (!data.matches || !Array.isArray(data.matches)) {
        console.warn(`⚠️ No matches: ${comp}`);
        continue;
      }

      console.log(`✅ ${data.matches.length} maç: ${comp}`);

      for (const match of data.matches) {
        const homeTeam = match.homeTeam?.shortName || match.homeTeam?.name || "Unknown";
        const awayTeam = match.awayTeam?.shortName || match.awayTeam?.name || "Unknown";
        const utcDate = match.utcDate;

        // Logoları cache'den al
        const homeLogo = await getTeamLogo(homeTeam, THESPORTSDB_KEY);
        const awayLogo = await getTeamLogo(awayTeam, THESPORTSDB_KEY);

        if (homeLogo) cachedTeams++; else newTeams++;
        if (awayLogo) cachedTeams++; else newTeams++;

        // Firestore'a kaydet
        const matchData = {
          competition: comp,
          league: comp,
          home: homeTeam,
          away: awayTeam,
          homeTeam: homeTeam,
          awayTeam: awayTeam,
          homeLogo: homeLogo || "",
          awayLogo: awayLogo || "",
          date: utcDate,
          time: utcDate ? new Date(utcDate).toISOString() : null,
          votes: {},
          popularPrediction: null,
          voteCount: 0,
          syncedAt: new Date().toISOString(),
        };

        const docId = match.id ? String(match.id) : `${comp}-${homeTeam}-${awayTeam}`.replace(/\s+/g, "_");
        
        await db.collection("matches").doc(docId).set(matchData, { merge: false });
        
        console.log(`✅ ${homeTeam} (${homeLogo ? "✓" : "✗"}) vs ${awayTeam} (${awayLogo ? "✓" : "✗"})`);
        totalMatches++;
      }
    }

    const result = {
      ok: true,
      message: `✅ ${totalMatches} maç senkronize edildi`,
      stats: {
        totalMatches,
        newTeamsChecked: newTeams,
        cachedLogos: cachedTeams,
      },
      timestamp: new Date().toISOString(),
    };

    console.log("\n📊 Sonuç:", result);
    return res.status(200).json(result);

  } catch (error) {
    console.error("❌ Sync error:", error);
    return res.status(500).json({ 
      error: error.message || String(error),
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

// Firebase başlatma
if (!admin.apps.length) {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT missing");
  } else {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(svc)),
    });
  }
}
const db = admin.firestore();

// Firestore'dan takım logosu al (cache)
async function getTeamLogo(teamName, apiKeys) {
  try {
    const normalizedName = teamName.toLowerCase().trim();
    
    // Teams collection'dan ara
    const snapshot = await db
      .collection("teams")
      .where("nameLower", "==", normalizedName)
      .limit(1)
      .get();
    
    // Cache'de varsa dön
    if (!snapshot.empty) {
      const teamData = snapshot.docs[0].data();
      console.log(`💾 Cache: ${teamName} → ${teamData.logo ? "✅" : "❌"}`);
      return teamData.logo || null;
    }
    
    // Yoksa TheSportsDB'den bul
    console.log(`🆕 Yeni takım: ${teamName}`);
    const logo = await findTeamLogo(teamName, apiKeys);
    
    // Firestore'a kaydet
    await db.collection("teams").add({
      name: teamName,
      nameLower: normalizedName,
      logo: logo,
      createdAt: new Date().toISOString(),
      lastChecked: new Date().toISOString(),
    });
    
    console.log(`💾 Firestore: ${teamName} → ${logo ? "✅" : "❌"}`);
    return logo;
    
  } catch (error) {
    console.error(`❌ getTeamLogo error: ${teamName}`, error.message);
    return null;
  }
}

export default async function handler(req, res) {
  try {
    // Auth kontrolü
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
    
    // Sadece TheSportsDB için API key
    const apiKeys = {
      thesportsdb: process.env.THESPORTSDB_KEY,
    };

    console.log("\n🚀 Sync başlatılıyor...");
    console.log("📊 API Keys:", {
      football: !!FOOTBALL_API_KEY,
      thesportsdb: !!apiKeys.thesportsdb,
    });

    if (!FOOTBALL_API_KEY) {
      return res.status(500).json({ error: "FOOTBALL_API_KEY missing" });
    }

    // Tarih aralığı: bugünden +10 gün
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(from.getTime() + 10 * 24 * 60 * 60 * 1000);
    const dateFrom = from.toISOString().split("T")[0];
    const dateTo = to.toISOString().split("T")[0];

    console.log(`📅 Tarih: ${dateFrom} → ${dateTo}`);

    // Eski maçları sil
    console.log("🧹 Eski maçlar siliniyor...");
    const matchesSnapshot = await db.collection("matches").get();
    const batch = db.batch();
    matchesSnapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`🧹 ${matchesSnapshot.size} maç silindi.`);

    // Ligler
    const competitions = ["PL", "PD", "SA", "BL1", "FL1"];
    let totalMatches = 0;
    let newTeams = 0;
    let cachedTeams = 0;

    for (const comp of competitions) {
      const url = `https://api.football-data.org/v4/matches?competitions=${comp}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      
      console.log(`\n📡 Çekiliyor: ${comp}`);
      const response = await fetch(url, {
        headers: { "X-Auth-Token": FOOTBALL_API_KEY },
      });

      if (!response.ok) {
        console.warn(`⚠️ Football-data error: ${comp} (${response.status})`);
        continue;
      }

      const data = await response.json();
      if (!data.matches || !Array.isArray(data.matches)) {
        console.warn(`⚠️ No matches: ${comp}`);
        continue;
      }

      console.log(`✅ ${data.matches.length} maç: ${comp}`);

      for (const match of data.matches) {
        const homeTeam = match.homeTeam?.shortName || match.homeTeam?.name || "Unknown";
        const awayTeam = match.awayTeam?.shortName || match.awayTeam?.name || "Unknown";
        const utcDate = match.utcDate;

        // Logoları cache'den al veya API'den bul
        const homeLogo = await getTeamLogo(homeTeam, apiKeys);
        const awayLogo = await getTeamLogo(awayTeam, apiKeys);

        if (homeLogo) cachedTeams++; else newTeams++;
        if (awayLogo) cachedTeams++; else newTeams++;

        // Firestore'a kaydet
        const matchData = {
          competition: comp,
          league: comp,
          home: homeTeam,
          away: awayTeam,
          homeTeam: homeTeam,
          awayTeam: awayTeam,
          homeLogo: homeLogo || "",
          awayLogo: awayLogo || "",
          date: utcDate,
          time: utcDate ? new Date(utcDate).toISOString() : null,
          votes: {},
          popularPrediction: null,
          voteCount: 0,
          syncedAt: new Date().toISOString(),
        };

        const docId = match.id ? String(match.id) : `${comp}-${homeTeam}-${awayTeam}`.replace(/\s+/g, "_");
        
        await db.collection("matches").doc(docId).set(matchData, { merge: false });
        
        console.log(`✅ ${homeTeam} (${homeLogo ? "✓" : "✗"}) vs ${awayTeam} (${awayLogo ? "✓" : "✗"})`);
        totalMatches++;
      }
    }

    const result = {
      ok: true,
      message: `✅ ${totalMatches} maç senkronize edildi`,
      stats: {
        totalMatches,
        newTeamsChecked: newTeams,
        cachedLogos: cachedTeams,
      },
      timestamp: new Date().toISOString(),
    };

    console.log("\n📊 Sonuç:", result);
    return res.status(200).json(result);

  } catch (error) {
    console.error("❌ Sync error:", error);
    return res.status(500).json({ 
      error: error.message || String(error),
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}
