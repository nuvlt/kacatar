// api/update-logos.js
// Eksik logoları toplu günceller (manuel çalıştırma için)

import admin from "firebase-admin";
import { findTeamLogo } from "./logo-service.js";

// Firebase başlatma
if (!admin.apps.length) {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (svc) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(svc)),
    });
  }
}
const db = admin.firestore();

export default async function handler(req, res) {
  try {
    // Auth kontrolü
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    console.log("\n🔄 Logo güncelleme başlatılıyor...");

    // API anahtarları
    const apiKeys = {
      sportmonks: process.env.SPORTMONKS_API_KEY,
      thesportsdb: process.env.THESPORTSDB_KEY,
      googleKey: process.env.GOOGLE_SEARCH_KEY,
      googleCx: process.env.GOOGLE_CX,
    };

    console.log("📊 API Keys:", {
      sportmonks: !!apiKeys.sportmonks,
      thesportsdb: !!apiKeys.thesportsdb,
      google: !!apiKeys.googleKey && !!apiKeys.googleCx,
    });

    // Tüm takımları al ve logo'su olmayanları filtrele
    const allTeamsSnapshot = await db.collection("teams").get();
    
    const teamsWithoutLogo = [];
    allTeamsSnapshot.forEach((doc) => {
      const data = doc.data();
      // Logo yoksa veya boşsa veya placeholder'sa
      if (!data.logo || data.logo === "" || data.logo === "null") {
        teamsWithoutLogo.push(doc);
      }
    });

    if (teamsWithoutLogo.length === 0) {
      console.log("✅ Tüm takımların logosu mevcut!");
      return res.status(200).json({
        ok: true,
        message: "Hiç eksik logo yok",
        stats: { checked: 0, updated: 0, failed: 0 },
      });
    }

    const snapshot = { docs: teamsWithoutLogo, size: teamsWithoutLogo.length };

    console.log(`🔍 ${snapshot.size} takım için logo aranacak\n`);

    let updated = 0;
    let failed = 0;
    const failedTeams = [];

    for (const doc of snapshot.docs) {
      const team = doc.data();
      const teamName = team.name;

      console.log(`\n🎯 İşleniyor: ${teamName}`);

      // Logo bul
      const logo = await findTeamLogo(teamName, apiKeys);

      if (logo) {
        // Firestore'u güncelle
        await doc.ref.update({
          logo: logo,
          lastChecked: new Date().toISOString(),
        });
        updated++;
        console.log(`✅ Güncellendi: ${teamName}`);
      } else {
        failed++;
        failedTeams.push(teamName);
        
        // Yine de lastChecked'i güncelle (30 gün sonra tekrar denesin)
        await doc.ref.update({
          lastChecked: new Date().toISOString(),
        });
        console.log(`❌ Bulunamadı: ${teamName}`);
      }
    }

    const result = {
      ok: true,
      message: `✅ Logo güncelleme tamamlandı`,
      stats: {
        checked: snapshot.size,
        updated,
        failed,
      },
      failedTeams: failedTeams.length > 0 ? failedTeams : undefined,
      timestamp: new Date().toISOString(),
    };

    console.log("\n📊 Sonuç:", result);
    return res.status(200).json(result);

  } catch (error) {
    console.error("❌ Update logos error:", error);
    return res.status(500).json({
      error: error.message || String(error),
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}
