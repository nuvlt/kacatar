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
    teamsSnap.forEach(doc => existingTeams.add(doc.data().name.trim().toLowerCase()));

    const missingTeams = new Set();
    matchesSnap.forEach(doc => {
      const match = doc.data();
      const home = match.homeTeam?.trim().toLowerCase();
      const away = match.awayTeam?.trim().toLowerCase();

      if (home && !existingTeams.has(home)) missingTeams.add(match.homeTeam);
      if (away && !existingTeams.has(away)) missingTeams.add(match.awayTeam);
    });

    res.status(200).json({
      ok: true,
      count: missingTeams.size,
      missing: [...missingTeams],
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
