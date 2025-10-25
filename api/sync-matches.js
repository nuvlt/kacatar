// api/sync-matches.js (DÜZELTÄ°LMÄ°ÅŸ)
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
    // Auth: Manuel veya Cron
    const manualKey = req.query.key;
    const cronSecret = req.headers['x-vercel-cron-secret'];
    
    const isManual = manualKey === process.env.SECRET_KEY;
    const isCron = cronSecret !== undefined; // Vercel otomatik doğrular
    
    if (!isManual && !isCron) {
      console.error("❌ Unauthorized request");
      return res.status(403).json({ error: "Unauthorized" });
    }

    const triggerType = isCron ? '⏰ CRON' : '👤 MANUAL';
    console.log(`🚀 Sync başlatılıyor... (${triggerType})`);

    const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;

    if (!FOOTBALL_API_KEY) {
      return res.status(500).json({ error: "FOOTBALL_API_KEY missing" });
    }

    // Tarih aralığı: Son 7 gün + gelecek 60 gün
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Geçmişe 7 gün bak (yakın zamanda oynanan maçlar için)
    const fromAdjusted = new Date(from.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // İleriye 60 gün bak (Şampiyonlar Ligi için geniş aralık)
    const to = new Date(from.getTime() + 60 * 24 * 60 * 60 * 1000);
    
    const dateFrom = fromAdjusted.toISOString().split("T")[0];
    const dateTo = to.toISOString().split("T")[0];

    console.log(`📅 Tarih Aralığı: ${dateFrom} → ${dateTo} (67 gün)`);
    console.log(`📅 Bugün: ${from.toISOString().split("T")[0]}`);

    // Eski maçları sil (2 gün önce)
    const twoDaysAgo = new Date(from.getTime() - 2 * 24 * 60 * 60 * 1000);
    const oldMatches = await db.collection("matches")
      .where("date", "<", twoDaysAgo.toISOString())
      .get();
    
    if (!oldMatches.empty) {
      const batch = db.batch();
      oldMatches.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      console.log(`🧹 ${oldMatches.size} eski maç silindi`);
    }

    let totalMatches = 0;
    const errors = [];

    // DÜZELTÄ°LDÄ°: CLI yerine CL, ancak hata yönetimi eklendi
    const apiFootballComps = ["PL", "PD", "SA", "BL1", "FL1", "CL"];
    
    for (const comp of apiFootballComps) {
      try {
        const url = `https://api.football-data.org/v4/matches?competitions=${comp}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
        
        console.log(`🔍 ${comp} sorgulanıyor...`);
        
        const response = await fetch(url, {
          headers: { "X-Auth-Token": FOOTBALL_API_KEY },
        });

        // Detaylı hata mesajı
        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`⚠️ ${comp}: ${response.status} - ${errorText}`);
          errors.push({
            competition: comp,
            status: response.status,
            message: errorText.substring(0, 100)
          });
          
          // 403 = API planı yetersiz (Şampiyonlar Ligi erişimi yok)
          if (response.status === 403) {
            console.error(`❌ ${comp}: API planınız bu ligi içermiyor!`);
          }
          
          continue;
        }

        const data = await response.json();
        
        // DETAYLI LOG
        console.log(`📊 ${comp} API Response:`, {
          count: data.resultSet?.count || 0,
          matchCount: data.matches?.length || 0,
          filters: data.filters
        });
        
        if (!data.matches || data.matches.length === 0) {
          console.log(`ℹ️ ${comp}: Hiç maç bulunamadı (Tarih aralığında maç olmayabilir)`);
          continue;
        }

        console.log(`✅ ${comp}: ${data.matches.length} maç bulundu`);

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
        console.error(`❌ ${comp} error:`, e.message);
        errors.push({
          competition: comp,
          error: e.message
        });
      }
    }

    console.log(`\n✅ Toplam ${totalMatches} maç senkronize edildi`);
    
    if (errors.length > 0) {
      console.log(`⚠️ ${errors.length} hata oluştu:`, errors);
    }

    return res.status(200).json({
      ok: true,
      message: `✅ ${totalMatches} maç senkronize edildi`,
      stats: { 
        totalMatches,
        errors: errors.length > 0 ? errors : undefined
      },
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
