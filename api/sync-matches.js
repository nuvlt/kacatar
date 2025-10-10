const admin = require("firebase-admin");

let fetchFn;
(async () => {
  fetchFn = (await import("node-fetch")).default;
})();

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const LEAGUE_CODES = ["PL", "PD", "SA", "BL1", "FL1"]; // Premier, La Liga, Serie A, Bundesliga, Ligue 1
const logoCache = {};

async function getTeamLogo(teamName) {
  if (logoCache[teamName]) return logoCache[teamName];
  try {
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`;
    const res = await fetchFn(url);
    const data = await res.json();
    const logo = data.teams?.[0]?.strTeamBadge || "";
    logoCache[teamName] = logo;
    return logo;
  } catch {
    return "";
  }
}

module.exports = async (req, res) => {
  try {
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!fetchFn) fetchFn = (await import("node-fetch")).default;

    const apiKey = process.env.FOOTBALL_DATA_KEY;

    // 🔹 tarih filtresi: bugünden +3 gün
    const now = new Date();
    const from = now.toISOString().split("T")[0];
    const to = new Date(now.getTime() + 3 * 86400000).toISOString().split("T")[0];

    console.log(`Fetching weekly matches: ${from} → ${to}`);

    const url = `https://api.football-data.org/v4/matches?dateFrom=${from}&dateTo=${to}`;
    const response = await fetchFn(url, {
      headers: { "X-Auth-Token": apiKey },
    });
    const data = await response.json();

    if (!data.matches || !Array.isArray(data.matches)) {
      console.error("Invalid API response:", data);
      return res.status(500).json({ error: "Invalid API response" });
    }

    // 🧹 Önce tüm eski maçları sil
    const oldMatches = await db.collection("matches").get();
    for (const doc of oldMatches.docs) await doc.ref.delete();

    let totalAdded = 0;

    // 🔹 yalnızca 5 ligdeki maçları al
    const filtered = data.matches.filter((m) =>
      LEAGUE_CODES.includes(m.competition.code)
    );

    for (const m of filtered) {
      const ref = db.collection("matches").doc(String(m.id));
      const homeLogo = await getTeamLogo(m.homeTeam.name);
      const awayLogo = await getTeamLogo(m.awayTeam.name);

      const matchData = {
        league: m.competition.name,
        home: m.homeTeam.name,
        away: m.awayTeam.name,
        homeLogo,
        awayLogo,
        date: m.utcDate,
        time: new Date(m.utcDate).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      await ref.set(matchData, { merge: true });
      totalAdded++;
    }

    return res.json({
      ok: true,
      message: `${totalAdded} maç senkronize edildi (önümüzdeki 3 gün)`,
    });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
};
