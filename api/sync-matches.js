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

export default async function handler(req, res) {
  try {
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
    if (!FOOTBALL_API_KEY) {
      return res.status(500).json({ error: "FOOTBALL_API_KEY missing" });
    }

    console.log("🚀 Sync başlatılıyor...");

    // Tarih: bugünden +10 gün
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(from.getTime() + 10 * 24 * 60 * 60 * 1000);
    const dateFrom = from.toISOString().split("T")[0];
    const dateTo = to.toISOString().split("T")[0];

    console.log(`📅 ${dateFrom} → ${dateTo}`);

    // SADECE geçmiş maçları sil (bugünden önce)
    const yesterday = new Date(from.getTime() - 24 * 60 * 60 * 1000);
    const oldMatchesQuery = await db.collection("matches")
      .where("date", "<", yesterday.toISOString())
      .get();
    
    if (!oldMatchesQuery.empty) {
      const deleteBatch = db.batch();
      oldMatchesQuery.forEach((doc) => deleteBatch.delete(doc.ref));
      await deleteBatch.commit();
      console.log(`🧹 ${oldMatchesQuery.size} geçmiş maç silindi`);
    } else {
      console.log(`🧹 Silinecek geçmiş maç yok`);
    }

    // Ligler
    const competitions = ["PL", "PD", "SA", "BL1", "FL1"];
    let totalMatches = 0;

    for (const comp of competitions) {
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

        // Teams'den logoları al (önce nameLower, sonra name ile dene)
        let homeLogo = "";
        let awayLogo = "";

        try {
          // Home team logo
          let homeSnap = await db.collection("teams")
            .where("nameLower", "==", homeTeam.toLowerCase().trim())
            .limit(1)
            .get();
          
          if (homeSnap.empty) {
            // Alternatif: name field'ı ile dene
            homeSnap = await db.collection("teams")
              .where("name", "==", homeTeam)
              .limit(1)
              .get();
          }
          
          if (!homeSnap.empty) {
            homeLogo = homeSnap.docs[0].data().logo || "";
            console.log(`✅ ${homeTeam}: Logo bulundu`);
          } else {
            console.warn(`⚠️ ${homeTeam}: Teams'de yok`);
          }

          // Away team logo
          let awaySnap = await db.collection("teams")
            .where("nameLower", "==", awayTeam.toLowerCase().trim())
            .limit(1)
            .get();
          
          if (awaySnap.empty) {
            // Alternatif: name field'ı ile dene
            awaySnap = await db.collection("teams")
              .where("name", "==", awayTeam)
              .limit(1)
              .get();
          }
          
          if (!awaySnap.empty) {
            awayLogo = awaySnap.docs[0].data().logo || "";
            console.log(`✅ ${awayTeam}: Logo bulundu`);
          } else {
            console.warn(`⚠️ ${awayTeam}: Teams'de yok`);
          }
        } catch (e) {
          console.error(`Logo fetch error: ${homeTeam} vs ${awayTeam}`, e.message);
        }

        // Maçı kaydet - SADECE logo yoksa güncelle
        const docId = match.id ? String(match.id) : `${comp}-${homeTeam}-${awayTeam}`.replace(/\s+/g, "_");
        
        // Önce mevcut maçı kontrol et
        const existingMatchDoc = await db.collection("matches").doc(docId).get();
        
        if (existingMatchDoc.exists()) {
          // Maç zaten var - SADECE logosu YOKSA güncelle
          const existingData = existingMatchDoc.data();
          const updates = {
            date: match.utcDate,
            time: match.utcDate,
            syncedAt: new Date().toISOString(),
          };
          
          // Home logo: Sadece yoksa veya boşsa güncelle
          if (!existingData.homeLogo || existingData.homeLogo === "") {
            if (homeLogo) {
              updates.homeLogo = homeLogo;
              console.log(`🆕 ${homeTeam}: Logo eklendi`);
            }
          } else {
            console.log(`✅ ${homeTeam}: Mevcut logo korundu`);
          }
          
          // Away logo: Sadece yoksa veya boşsa güncelle
          if (!existingData.awayLogo || existingData.awayLogo === "") {
            if (awayLogo) {
              updates.awayLogo = awayLogo;
              console.log(`🆕 ${awayTeam}: Logo eklendi`);
            }
          } else {
            console.log(`✅ ${awayTeam}: Mevcut logo korundu`);
          }
          
          await db.collection("matches").doc(docId).update(updates);
        } else {
          // Yeni maç - tüm bilgileri kaydet
          const matchData = {
            competition: comp,
            league: comp,
            home: homeTeam,
            away: awayTeam,
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            homeLogo: homeLogo,
            awayLogo: awayLogo,
            date: match.utcDate,
            time: match.utcDate,
            votes: {},
            popularPrediction: null,
            voteCount: 0,
            syncedAt: new Date().toISOString(),
          };
          
          await db.collection("matches").doc(docId).set(matchData);
          console.log(`🆕 Yeni maç: ${homeTeam} vs ${awayTeam}`);
        }
        
        totalMatches++;
      }
    }

    return res.status(200).json({
      ok: true,
      message: `✅ ${totalMatches} maç senkronize edildi`,
      stats: { totalMatches },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("❌ Sync error:", error);
    return res.status(500).json({ 
      error: error.message,
    });
  }
}
