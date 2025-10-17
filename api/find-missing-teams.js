import admin from "firebase-admin";

let app;
if (!admin.apps.length) {
  app = admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
} else {
  app = admin.app();
}

const db = admin.firestore();

export default async function handler(req, res) {
  try {
    const matchesSnap = await db.collection("matches").get();
    const teamsSnap = await db.collection("teams").get();

    const existingTeams = new Set();
    teamsSnap.forEach(doc => {
      const name = doc.data()?.name;
      if (name && typeof name === "string") {
        existingTeams.add(name.trim().toLowerCase());
      }
    });

    const missingTeams = new Set();

    matchesSnap.forEach(doc => {
      const match = doc.data();

      // Takım isimlerini güvenli şekilde alıyoruz
      const home = match?.homeTeam && typeof match.homeTeam === "string"
        ? match.homeTeam.trim().toLowerCase()
        : null;
      const away = match?.awayTeam && typeof match.awayTeam === "string"
        ? match.awayTeam.trim().toLowerCase()
        : null;

      if (home && !existingTeams.has(home)) missingTeams.add(match.homeTeam);
      if (away && !existingTeams.has(away)) missingTeams.add(match.awayTeam);
    });

    res.status(200).json({
      ok: true,
      count: missingTeams.size,
      missing: [...missingTeams].sort(),
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
