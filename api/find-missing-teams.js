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

    // Tüm mevcut takımları (logo dahil) listele
    const teamLogos = {};
    teamsSnap.forEach(doc => {
      const data = doc.data();
      const name = data?.name?.trim()?.toLowerCase();
      if (name) {
        teamLogos[name] = data.logo || null; // varsa logo, yoksa null
      }
    });

    const missingTeams = new Set();

    matchesSnap.forEach(doc => {
      const match = doc.data();

      const homeName = match?.homeTeam && typeof match.homeTeam === "string"
        ? match.homeTeam.trim()
        : null;
      const awayName = match?.awayTeam && typeof match.awayTeam === "string"
        ? match.awayTeam.trim()
        : null;

      if (homeName) {
        const key = homeName.toLowerCase();
        const hasLogo = teamLogos[key] && teamLogos[key].startsWith("http");
        if (!hasLogo) missingTeams.add(homeName);
      }

      if (awayName) {
        const key = awayName.toLowerCase();
        const hasLogo = teamLogos[key] && teamLogos[key].startsWith("http");
        if (!hasLogo) missingTeams.add(awayName);
      }
    });

    res.status(200).json({
      ok: true,
      message: "Eksik logo tespiti tamamlandı",
      count: missingTeams.size,
      missing: [...missingTeams].sort(),
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
