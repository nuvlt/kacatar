// api/check-logos.js
// Tüm takımları ve logo durumlarını gösterir

import admin from "firebase-admin";

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
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    console.log("\n🔍 Logo durumları kontrol ediliyor...\n");

    // Tüm takımları al
    const snapshot = await db.collection("teams").get();

    const allTeams = [];
    const problematicLogos = [];
    const validLogos = [];
    const noLogos = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const team = {
        id: doc.id,
        name: data.name,
        logo: data.logo,
      };

      allTeams.push(team);

      // Kategorize et
      if (!data.logo) {
        noLogos.push(team);
      } else if (
        data.logo.includes("placeholder") ||
        data.logo.includes("via.placeholder") ||
        data.logo.includes("example.com") ||
        data.logo === "" ||
        data.logo === "null"
      ) {
        problematicLogos.push(team);
      } else {
        validLogos.push(team);
      }
    });

    // Alfabetik sırala
    allTeams.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    problematicLogos.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    noLogos.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const result = {
      ok: true,
      summary: {
        total: allTeams.length,
        valid: validLogos.length,
        problematic: problematicLogos.length,
        missing: noLogos.length,
      },
      problematicLogos: problematicLogos.length > 0 ? problematicLogos : undefined,
      noLogos: noLogos.length > 0 ? noLogos : undefined,
      allTeams: allTeams.slice(0, 30), // İlk 30 takım (fazla uzun olmasın)
      timestamp: new Date().toISOString(),
    };

    console.log("📊 Özet:", result.summary);
    if (problematicLogos.length > 0) {
      console.log("\n⚠️ Sorunlu logolar:");
      problematicLogos.forEach(t => console.log(`   - ${t.name}: ${t.logo}`));
    }
    if (noLogos.length > 0) {
      console.log("\n❌ Logo yok:");
      noLogos.forEach(t => console.log(`   - ${t.name}`));
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("❌ Check logos error:", error);
    return res.status(500).json({
      error: error.message || String(error),
    });
  }
}
