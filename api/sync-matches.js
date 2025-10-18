// api/sync-matches.js
// Maçları çeker ve logoları Firestore'dan alır (cache)

import admin from "firebase-admin";
import { findTeamLogo } from "./logo-service.js";

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
    // Takım adını normalize et
    const normalizedName = teamName.toLowerCase().trim();
    
    // Teams collection'dan ara
    const snapshot = await db
      .collection("teams")
      .where("nameLower", "==", normalizedName)
      .limit(1)
      .get();
    
    // Varsa cache'den dön
    if (!snapshot.empty) {
      const teamData = snapshot.docs[0].data();
      console.log(`💾 Cache'den alındı: ${teamName}`);
      return teamData.logo || null;
    }
    
    // Yoksa API'lerden bul
    console.log(`🆕 Yeni takım: ${teamName}`);
    const logo = await findTeamLogo(teamName, apiKeys);
    
    // Firestore'a kaydet (logo null bile olsa kaydet, tekrar sorgulamayalım)
    await db.collection("teams").add({
      name: teamName,
      nameLower: normalizedName,
      logo: logo,
      createdAt: new Date().toISOString(),
      lastChecked: new Date().toISOString(),
    });
    
    console.log(`💾 Firestore'a kaydedildi: ${teamName} → ${logo ? "✅" : "❌"}`);
    return logo;
    
  } catch (error) {
    console.error(`❌ getTeamLogo error for ${teamName}:`, error.message);
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

    // API anahtarları
    const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
    const apiKeys = {
      sportmonks: process.env.SPORTMONKS_API_KEY,
      thesportsdb: process.env.THESPORTSDB_KEY,
      googleKey: process.env.GOOGLE_SEARCH_KEY,
      googleCx: process.env.GOOGLE_SEARCH_CX || process.env.GOOGLE_CX,
    };

    console.log("\n🚀 Sync başlatılıyor...");
    console.log("📊 API Keys:", {
      football: !!FOOTBALL_API_KEY,
      sportmonks: !!apiKeys.sportmonks,
      thesportsdb: !!apiKeys.thesportsdb,
      google: !!apiKeys.googleKey && !!apiKeys.googleCx,
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

    console.log(`📅 Tarih aralığı: ${dateFrom} → ${dateTo}`);

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
      
      console.log(`\n📡 Fetching: ${comp}`);
      const response = await fetch(url, {
        headers: { "X-Auth-Token": FOOTBALL_API_KEY },
      });

      if (!response.ok) {
        console.warn(`⚠️ Football-data error: ${comp} (${response.status})`);
        continue;
      }

      const data = await response.json();
      if (!data.matches || !Array.isArray(data.matches)) {
        console.warn(`⚠️ No matches for ${comp}`);
        continue;
      }

      console.log(`✅ ${data.matches.length} maç bulundu: ${comp}`);

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
        
        await db.collection("matches").doc(docId).set(matchData, { merge: true });
        
        console.log(`✅ ${homeTeam} vs ${awayTeam}`);
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
