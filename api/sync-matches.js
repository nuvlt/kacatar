// api/sync-matches.js
// SADECE API-Football'dan maçları çeker
// Logoları Firestore cache'den alır (teams collection)

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
