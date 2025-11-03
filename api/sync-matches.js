// api/sync-matches.js
// Predictions collection'a dokunmaz, sadece matches collection'ı temizler

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
      
      // Logoları sadece yoksa güncelle
      if (!existing.homeLogo || existing.homeLogo === "") {
        if (homeLogo) updates.homeLogo = homeLogo;
      }
      
      if (!existing.awayLogo || existing.awayLogo === "") {
        if (awayLogo) updates.awayLogo = awayLogo;
      }
      
      await db.collection("matches").doc(docId).update(updates);
    } else {
      // Yeni maç - votes'u boş bırak (artık predictions'ta tutuluyor)
      await db.collection("matches").doc(docId).set({
        ...matchData,
        homeLogo: homeLogo,
        awayLogo: awayLogo,
        votes: {}, // Boş - artık kullanılmıyor
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
    console.log("📥 Incoming request:", {
      query: req.query,
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-vercel-cron-secret': req.headers['x-vercel-cron-secret'],
      },
      url: req.url,
    });
    
    // Auth Kontrolü
    const manualKey = req.query.key;
    
    if (!manualKey || manualKey === '') {
      console.log(`🚀 Sync başlatılıyor... (⏰ CRON - key yok)`);
    } else if (manualKey === process.env.SECRET_KEY) {
      console.log(`🚀 Sync başlatılıyor... (👤 MANUAL)`);
    } else {
      console.error("❌ Invalid manual key:", manualKey);
      return res.status(403).json({ error: "Invalid key" });
    }

    const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;

    if (!FOOTBALL_API_KEY) {
      return res.status(500).json({ error: "FOOTBALL_API_KEY missing" });
    }

    const now = new Date();
    const turkeyOffset = 3 * 60 * 60 * 1000;
    const nowTurkey = new Date(now.getTime() + turkeyOffset);
    
    const from = new Date(nowTurkey.getFullYear(), nowTurkey.getMonth(), nowTurkey.getDate());
    const to = new Date(from.getTime() + 10 * 24 * 60 * 60 * 1000);
    
    const dateFrom = from.toISOString().split("T")[0];
    const dateTo = to.toISOString().split("T")[0];

    console.log(`📅 Tarih Aralığı: ${dateFrom} → ${dateTo} (10 gün)`);

    // ========== YENİ: Eski maçları sil ama predictions'ı koru ==========
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const sixHoursAgoISO = sixHoursAgo.toISOString();
    
    console.log(`🗑️ ${sixHoursAgoISO} öncesi maçlar silinecek...`);
    console.log(`⚠️ NOT: Predictions collection'daki tahminler KORUNACAK`);
    
    const oldMatches = await db.collection("matches")
      .where("date", "<", sixHoursAgoISO)
      .get();
    
    if (!oldMatches.empty) {
      const batch = db.batch();
      let deleteCount = 0;
      const deletedMatchIds = [];
      
      oldMatches.forEach((doc) => {
        // Sadece matches collection'dan sil
        // Predictions collection'a dokunma
        batch.delete(doc.ref);
        deletedMatchIds.push(doc.id);
        deleteCount++;
      });
      
      await batch.commit();
      console.log(`🧹 ${deleteCount} eski maç silindi (tahminler korundu)`);
      console.log(`📋 Silinen match ID'ler:`, deletedMatchIds.slice(0, 5), '...');
      
      // ⚠️ ÖNEMLİ: Predictions'taki maç bilgilerini güncelleme yapma
      // Çünkü predictions zaten homeTeam, awayTeam, homeLogo, awayLogo içeriyor
    } else {
      console.log(`ℹ️ Silinecek eski maç yok`);
    }

    let totalMatches = 0;
    const errors = [];

    const apiFootballComps = ["PL", "PD", "SA", "BL1", "FL1", "CL"];
    
    for (const comp of apiFootballComps) {
      try {
        const url = `https://api.football-data.org/v4/matches?competitions=${comp}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
        
        console.log(`🔍 ${comp} sorgulanıyor...`);
        
        const response = await fetch(url, {
          headers: { "X-Auth-Token": FOOTBALL_API_KEY },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`⚠️ ${comp}: ${response.status} - ${errorText}`);
          errors.push({
            competition: comp,
            status: response.status,
            message: errorText.substring(0, 100)
          });
          
          if (response.status === 403) {
            console.error(`❌ ${comp}: API planınız bu ligi içermiyor!`);
          }
          
          continue;
        }

        const data = await response.json();
        
        if (!data.matches || data.matches.length === 0) {
          console.log(`ℹ️ ${comp}: Hiç maç bulunamadı`);
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
      message: `✅ ${totalMatches} maç senkronize edildi. Tahminler korundu.`,
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
