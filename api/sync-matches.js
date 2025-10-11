const admin = require("firebase-admin");
const axios = require("axios");

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// 🔹 TheSportsDB logo fetch helper
let foundLogos = 0;
let missingLogos = 0;

async function fetchTeamLogo(teamName, key) {
  if (!teamName) return "";
  try {
    const url = `https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(teamName)}`;
    const { data } = await axios.get(url);
    if (data.teams && data.teams.length > 0) {
      const team = data.teams.find((t) => t.strSport === "Soccer");
      if (team && team.strBadge) {
        foundLogos++;
        return team.strBadge;
      }
    }
    missingLogos++;
    return "";
  } catch (e) {
    missingLogos++;
    return "";
  }
}

// 🔹 Ana handler
module.exports = async (req, res) => {
  try {
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
    const THESPORTSDB_KEY = process.env.THESPORTSDB_KEY;

    if (!FOOTBALL_API_KEY || !THESPORTSDB_KEY) {
      throw new Error("API anahtarları eksik (FOOTBALL_API_KEY veya THESPORTSDB_KEY)");
    }

    const today = new Date();
    const from = today.toISOString().split("T")[0];
    const to = new Date(today.getTime() + 10 * 86400000).toISOString().split("T")[0];

    // 🔹 5 büyük lig kodları
    const leagues = ["PL", "PD", "SA", "BL1", "FL1"];

    // 🔹 Önce eski maçları temizle
    const snapshot = await db.collection("matches").get();
    const batch = db.batch();
    snapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log("🧹 Eski maçlar silindi.");

    let totalAdded = 0;

    for (const league of leagues) {
      const url = `https://api.football-data.org/v4/matches?competitions=${league}&dateFrom=${from}&dateTo=${to}`;
      console.log("📡 Fetch:", url);

      const response = await axios.get(url, {
        headers: { "X-Auth-Token": FOOTBALL_API_KEY },
      });

      const matches = response.data.matches || [];
      console.log(`📦 ${league} liginden ${matches.length} maç bulundu.`);

      for (const match of matches) {
        const matchId = String(match.id);
        const homeTeam = match.homeTeam.name;
        const awayTeam = match.awayTeam.name;

        // Logoları al
        const [homeLogo, awayLogo] = await Promise.all([
          fetchTeamLogo(homeTeam, THESPORTSDB_KEY),
          fetchTeamLogo(awayTeam, THESPORTSDB_KEY),
        ]);

        const matchData = {
          home: homeTeam,
          away: awayTeam,
          homeLogo,
          awayLogo,
          date: match.utcDate,
          league: match.competition.name,
          time: new Date(match.utcDate).toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };

        await db.collection("matches").doc(matchId).set(matchData, { merge: true });
        totalAdded++;
      }
    }

    console.log(`🏁 Logo istatistiği → Bulunan: ${foundLogos}, Eksik: ${missingLogos}`);

    return res.json({
      ok: true,
      message: `${totalAdded} maç senkronize edildi.`,
      logos: { found: foundLogos, missing: missingLogos },
    });
  } catch (err) {
    console.error("❌ Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
};
