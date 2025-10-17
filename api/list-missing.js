// api/list-missing.js
// Logo'su eksik takımları listeler

const admin = require("firebase-admin");

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

    console.log("\n🔍 Eksik logolar kontrol ediliyor...\n");

    // Logo'su olmayan takımları bul
    const snapshot = await db
      .collection("teams")
      .where("logo", "in", [null, ""])
      .get();

    const missingLogos = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      missingLogos.push({
        id: doc.id,
        name: data.name,
        nameLower: data.nameLower,
      });
    });

    // Alfabetik sırala
    missingLogos.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const result = {
      ok: true,
      count: missingLogos.length,
      teams: missingLogos,
      timestamp: new Date().toISOString(),
    };

    console.log(`❌ ${missingLogos.length} takımın logosu eksik:`);
    missingLogos.forEach(t => console.log(`   - ${t.name}`));

    return res.status(200).json(result);

  } catch (error) {
    console.error("❌ List missing error:", error);
    return res.status(500).json({
      error: error.message || String(error),
    });
  }
}
