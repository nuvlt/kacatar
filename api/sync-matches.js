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

    // 1️⃣ API-Football
    const apiFootballComps = ["PL", "PD", "SA", "BL1", "FL1"];
    
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

    // 2️⃣ CollectAPI - Süper Lig
    if (COLLECTAPI_KEY) {
      try {
        console.log(`🇹🇷 Süper Lig çekiliyor...`);
        
        // Alternatif endpoint: fixture (yaklaşan maçlar)
        const collectUrl = `https://api.collectapi.com/football/fixture?data.league=super-lig`;
        const collectResponse = await fetch(collectUrl, {
          method: 'GET',
          headers: { 
            "authorization": `apikey ${COLLECTAPI_KEY}`,
            "content-type": "application/json"
          },
        });

        console.log(`CollectAPI Status: ${collectResponse.status}`);

        if (collectResponse.ok) {
          const collectData = await collectResponse.json();
          
          console.log(`CollectAPI Response:`, JSON.stringify(collectData).substring(0, 200));
          
          if (collectData.success && collectData.result) {
            console.log(`✅ Süper Lig: ${collectData.result.length} maç`);
            
            for (const match of collectData.result) {
              const homeTeam = match.home || "Unknown";
              const awayTeam = match.away || "Unknown";
              const matchDate = match.date; // "20.10.2024 19:00" formatı

              const homeLogo = await findTeamLogo(homeTeam);
              const awayLogo = await findTeamLogo(awayTeam);

              const matchData = {
                competition: "super-lig",
                league: "Süper Lig",
                home: homeTeam,
                away: awayTeam,
                homeTeam: homeTeam,
                awayTeam: awayTeam,
                date: matchDate,
                time: matchDate,
              };

              const docId = `sl-${homeTeam}-${awayTeam}-${matchDate}`.replace(/\s+/g, "_").replace(/:/g, "-").replace(/\./g, "-");
              
              await saveMatch(docId, matchData, homeLogo, awayLogo);
              totalMatches++;
            }
          } else {
            console.warn(`⚠️ CollectAPI invalid response:`, collectData);
          }
        } else {
          const errorText = await collectResponse.text();
          console.error(`⚠️ CollectAPI ${collectResponse.status}:`, errorText.substring(0, 200));
        }
      } catch (e) {
        console.error("CollectAPI error:", e.message, e.stack);
      }
    } else {
      console.warn("⚠️ COLLECTAPI_KEY eksik, Süper Lig atlandı");
    }

    console.log(`\n✅ Toplam ${totalMatches} maç`);

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
