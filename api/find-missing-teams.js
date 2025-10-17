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

// Takım ismini normalize eden yardımcı fonksiyon
function normalizeName(name) {
  return name
    ?.toLowerCase()
    ?.replace(/[^a-z0-9ğüşıöç\s]/gi, "") // özel karakterleri sil
    ?.replace(/\s+/g, " ") // fazla boşlukları tek boşluk yap
    ?.trim();
}

export default async function handler(req, res) {
  try {
    const matchesSnap = await db.collection("matches").get();
    const teamsSnap = await db.collection("teams").get();

    const teamLogos = {};
    teamsSnap.forEach(doc => {
      const data = doc.data();
      const normalized = normalizeName(data?.name);
      if (normalized) {
        teamLogos[normalized] = data.logo || null;
      }
    });

    const missingTeams = new Set();

    matchesSnap.forEach(doc => {
      const match = doc.data();

      const home = normalizeName(match?.homeTeam);
      const away = normalizeName(match?.awayTeam);

      if (home) {
        const logo = teamLogos[home];
        if (!logo || !logo.startsWith("http")) missingTeams.add(match.homeTeam);
      }

      if (away) {
        const logo = teamLogos[away];
        if (!logo || !logo.startsWith("http")) missingTeams.add(match.awayTeam);
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
