// api/cleanup-logos.js
// Matches collection'dan logos map field'ını siler (gereksiz)

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

    console.log("\n🧹 Gereksiz 'logos' field'ı siliniyor...\n");

    const matchesSnapshot = await db.collection("matches").get();
    let cleaned = 0;

    for (const doc of matchesSnapshot.docs) {
      const data = doc.data();
      
      // Eğer logos field'ı varsa sil
      if (data.logos) {
        await doc.ref.update({
          logos: admin.firestore.FieldValue.delete(),
        });
        
        console.log(`✅ ${data.home} vs ${data.away} - logos field silindi`);
        cleaned++;
      }
    }

    const result = {
      ok: true,
      message: `✅ ${cleaned} maçtan logos field'ı silindi`,
      stats: {
        totalMatches: matchesSnapshot.size,
        cleaned: cleaned,
      },
      timestamp: new Date().toISOString(),
    };

    console.log("\n📊 Sonuç:", JSON.stringify(result, null, 2));
    return res.status(200).json(result);

  } catch (error) {
    console.error("❌ Cleanup error:", error);
    return res.status(500).json({
      error: error.message || String(error),
    });
  }
}
