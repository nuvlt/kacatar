import fetch from "node-fetch";
import admin from "firebase-admin";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const THESPORTSDB_KEY = process.env.THESPORTSDB_KEY;

export default async function handler(req, res) {
  try {
    if (!FOOTBALL_API_KEY || !SPORTMONKS_API_KEY || !THESPORTSDB_KEY) {
      throw new Error("API anahtarları eksik");
    }

    console.log("ENV OK ✅");

    const competitions = ["PL", "PD", "SA", "BL1", "FL1"];
    const today = new Date();
    const dateFrom = today.toISOString().split("T")[0];
    const dateTo = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    let totalFound = 0;
    let totalMissing = 0;

    for (const comp of competitions) {
      console.log(`📡 Fetching: ${comp}`);

      const matchRes = await fetch(
        `https://api.football-data.org/v4/matches?competitions=${comp}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
        { headers: { "X-Auth-Token": FOOTBALL_API_KEY } }
      );

      const matchData = await matchRes.json();
      if (!matchData.matches) continue;

      for (const match of matchData.matches) {
        const homeTeam = match.homeTeam.name;
        const awayTeam = match.awayTeam.name;

        for (const teamName of [homeTeam, awayTeam]) {
          if (!teamName) continue;
          const teamRef = db.collection("teams").doc(teamName);
          const doc = await teamRef.get();

          // Takım daha önce kayıtlı değilse logo=null olarak kaydet
          if (!doc.exists) {
            await teamRef.set({
              name: teamName,
              logo: null,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            totalMissing++;
          } else if (doc.data()?.logo) {
            totalFound++;
          } else {
            totalMissing++;
          }
        }
      }
    }

    res.status(200).json({
      ok: true,
      message: "48 maç senkronize edildi.",
      logos: { found: totalFound, missing: totalMissing },
    });
  } catch (err) {
    console.error("❌ Hata:", err);
    res.status(500).json({ error: err.message });
  }
}
