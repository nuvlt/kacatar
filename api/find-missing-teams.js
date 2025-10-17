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

function normalizeName(name) {
  return name
    ?.toLowerCase()
    ?.replace(/[^a-z0-9ğüşıöç\s]/gi, "")
    ?.replace(/\b(fc|cf|sc|ac|afc|club|deportivo|calcio|athletic|sporting|real|olympique|atleti)\b/g, "")
    ?.replace(/\s+/g, " ")
    ?.trim();
}

// iki ismin birbirine benzer olup olmadığını kaba kontrol eden yardımcı
function isSimilar(a, b) {
  if (!a || !b) return false;
  a = normalizeName(a);
  b = normalizeName(b);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // örn: “man city” vs “manchester city”
  if (a.startsWith(b.split(" ")[0]) || b.startsWith(a.split(" ")[0])) return true;
  return false;
}

export default async function handler(req, res) {
  try {
    const matchesSnap = await db.collection("matches").get();
    const teamsSnap = await db.collection("teams").get();

    const teams = teamsSnap.docs.map(doc => doc.data());
    const missingTeams = new Set();

    matchesSnap.forEach(doc => {
      const match = doc.data();
      [match?.homeTeam, match?.awayTeam].forEach(teamName => {
        if (!teamName) return;

        const hasLogo = teams.some(
          t =>
            isSimilar(t.name, teamName) &&
            t.logo &&
            t.logo.startsWith("http")
        );

        if (!hasLogo) missingTeams.add(teamName);
      });
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
