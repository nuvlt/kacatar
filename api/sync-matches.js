// api/sync-matches.js
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

// Logo bul helper
async function findTeamLogo(teamName) {
  try {
    let snap = await db.collection("teams")
      .where("nameLower", "==", teamName.toLowerCase().trim())
      .limit(1)
      .get();
    
    if (snap.empty) {
      snap = await db.collection("teams")
        .where("name", "==", teamName)
        .limit(1)
        .get();
    }
    
    if (!snap.empty) {
      return snap.docs[0].data().logo || "";
    }
    return "";
  } catch (e) {
    console.error(`Logo error: ${teamName}`, e.message);
    return "";
  }
}

// Maçı kaydet veya güncelle
async function saveMatch(docId, matchData, homeLogo, awayLogo) {
  try {
    const existingDoc = await db.collection("matches").doc(docId).get();
    
    // Admin SDK'da exists bir property, fonksiyon değil
    if (existingDoc.exists) {
      const existing = existingDoc.data();
      const updates = {
        date: matchData.date,
        time: matchData.time,
        syncedAt: new Date().toISOString(),
      };
      
      if (!existing.homeLogo || existing.homeLogo === "") {
        if (homeLogo) updates.homeLogo = homeLogo;
      }
      
      if (!existing.awayLogo || existing.awayLogo === "") {
        if (awayLogo) updates.awayLogo = awayLogo;
      }
      
      await db.collection("matches").doc(docId).update(updates);
    } else {
      await db.collection("matches").doc(docId).set({
        ...matchData,
        homeLogo: homeLogo,
        awayLogo: awayLogo,
        votes: {},
        popularPrediction: null,
        voteCount: 0,
        syncedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error(`Save match error: ${docId}`, e.message);
  }
}

export default async function handler(req, res) {
  try {
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    console.log("🚀 Sync başlatılıyor...");

    const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
    const COLLECTAPI_KEY = process.env.COLLECTAPI_KEY;

    if (!FOOTBALL_API_KEY) {
      return res.status(500).json({ error: "FOOTBALL_API_KEY missing" });
    }

    // Tarih
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(from.getTime() + 10 * 24 * 60 * 60 * 1000);
    const dateFrom = from.toISOString().split("T")[0];
    const dateTo = to.toISOString().split("T")[0];

    console.log(`📅 ${dateFrom} → ${dateTo}`);

    // Eski maçları sil
    const yesterday = new Date(from.getTime() - 24 * 60 * 60 * 1000);
    const oldMatches = await db.collection("matches")
      .where("date", "<", yesterday.toISOString())
      .get();
    
    if (!oldMatches.empty) {
      const batch = db.batch();
      oldMatches.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      console.log(`🧹 ${oldMatches.size} eski maç silindi`);
    }

    let totalMatches = 0;

    // 1️⃣ API-Football (CL dahil)
    const apiFootballComps = ["PL", "PD", "SA", "BL1", "FL1", "CL"];
    
    for (const comp of apiFootballComps) {
      try {
        const url = `https://api.football-data.org/v4/matches?competitions=${comp}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
        
        const response = await fetch(url, {
          headers: { "X-Auth-Token": FOOTBALL_API_KEY },
        });

        if (!response.ok) {
          console.warn(`⚠️ ${comp}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        if (!data.matches) continue;

        console.log(`✅ ${comp}: ${data.matches.length} maç`);

        for (const match of data.matches) {
          const homeTeam = match.homeTeam?.shortName || match.homeTeam?.name || "Unknown";
          const awayTeam = match.awayTeam?.shortName || match.awayTeam?.name || "Unknown";

          const homeLogo = await findTeamLogo(homeTeam);
          const awayLogo = await findTeamLogo(awayTeam);

          const matchData = {
            competition: comp,
            league: comp,
            home: homeTeam,
            away: awayTeam,
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            date: match.utcDate,
            time: match.utcDate,
          };

          const docId = match.id ? String(match.id) : `${comp}-${homeTeam}-${awayTeam}`.replace(/\s+/g, "_");
          
          await saveMatch(docId, matchData, homeLogo, awayLogo);
          totalMatches++;
        }
      } catch (e) {
        console.error(`${comp} error:`, e.message);
      }
    }

    console.log(`\n✅ Toplam ${totalMatches} maç`);

    // 2️⃣ Süper Lig - Gelecekte eklenecek
    // TODO: Süper Lig için uygun API bulunduğunda buraya eklenecek
    console.log('\n🇹🇷 Süper Lig: API bekleniyor...');

    return res.status(200).json({
      ok: true,
      message: `✅ ${totalMatches} maç senkronize edildi`,
      stats: { totalMatches },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("❌ Sync error:", error);
    return res.status(500).json({ 
      ok: false,
      error: error.message || "Internal server error",
    });
  }
}
