import fetch from "node-fetch";
import admin from "firebase-admin";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const THESPORTSDB_KEY = process.env.THESPORTSDB_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_KEY;
const GOOGLE_CX = process.env.GOOGLE_CX;

// Basit delay (Google rate limit koruması)
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

export default async function handler(req, res) {
  try {
    const snapshot = await db.collection("teams").where("logo", "==", null).get();
    if (snapshot.empty) {
      return res.status(200).json({
        ok: true,
        message: "Hiç eksik logo yok.",
        summary: { updated: 0, skipped: 0, errors: 0 },
      });
    }

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of snapshot.docs) {
      const team = doc.data();
      const teamName = team.name;
      let logoUrl = null;

      console.log(`🔍 Logo aranıyor: ${teamName}`);

      // 1️⃣ SportMonks
      try {
        const smRes = await fetch(
          `https://api.sportmonks.com/v3/football/teams/search/${encodeURIComponent(teamName)}?api_token=${SPORTMONKS_API_KEY}`
        );
        const smData = await smRes.json();
        if (smData?.data?.length > 0) {
          logoUrl = smData.data[0].image_path;
          console.log(`⚽ SportMonks: ${teamName}`);
        }
      } catch {
        console.warn(`⚠️ SportMonks başarısız: ${teamName}`);
      }

      // 2️⃣ TheSportsDB fallback
      if (!logoUrl) {
        try {
          const tsdbRes = await fetch(
            `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_KEY}/searchteams.php?t=${encodeURIComponent(teamName)}`
          );
          const tsdbData = await tsdbRes.json();
          if (tsdbData?.teams?.[0]?.strBadge) {
            logoUrl = tsdbData.teams[0].strBadge;
            console.log(`🏟️ TheSportsDB: ${teamName}`);
          }
        } catch {
          console.warn(`⚠️ TheSportsDB başarısız: ${teamName}`);
        }
      }

      // 3️⃣ Google fallback (sadece null'larda)
      if (!logoUrl && GOOGLE_API_KEY && GOOGLE_CX) {
        try {
          await delay(1000);
          const gRes = await fetch(
            `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
              teamName + " football club logo"
            )}&searchType=image&num=1&key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}`
          );
          const gData = await gRes.json();
          if (gData?.items?.length > 0) {
            logoUrl = gData.items[0].link;
            console.log(`🔵 Google Logo: ${teamName}`);
          }
        } catch {
          console.warn(`⚠️ Google başarısız: ${teamName}`);
        }
      }

      // Firestore güncelleme
      if (logoUrl) {
        await doc.ref.update({ logo: logoUrl });
        updated++;
      } else {
        skipped++;
      }
    }

    res.status(200).json({
      ok: true,
      message: "Logo güncelleme tamamlandı.",
      summary: { updated, skipped, errors },
    });
  } catch (err) {
    console.error("❌ Logo güncelleme hatası:", err);
    res.status(500).json({ error: err.message });
  }
}
