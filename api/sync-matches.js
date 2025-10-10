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

const LEAGUE_IDS = {
  PL: 2021, // Premier League
  PD: 2014, // La Liga
  SA: 2019, // Serie A
  BL1: 2002, // Bundesliga
  FL1: 2015, // Ligue 1
};

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

    // 🔹 3 günlük tarih aralığı (UTC)
    const now = new Date();
    const next3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const dateFrom = now.toISOString().split("T")[0];
    const dateTo = next3.toISOString().split("T")[0];

    console.log(`🧹 Eski maçlar siliniyor...`);
    const oldMatches = await db.collection("matches").get();
    for (const doc of oldMatches.docs) await doc.ref.delete();

    let totalAdded = 0;

    for (const [code, id] of Object.entries(LEAGUE_IDS)) {
      const url = `https://api.football-data.org/v4/matches?competitions=${code}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      console.log(`⚽ Fetching ${code}: ${url}`);

      const resp = await fetchFn(url, { headers: { "X-Auth-Token": apiKey } });
      const data = await resp.json();

      if (!data.matches || !Array.isArray(data.matches)) {
        console.log(`❌ ${code} geçersiz yanıt`);
        continue;
      }

      console.log(`✅ ${code}: ${data.matches.length} maç bulundu`);

      for (const m of data.matches) {
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
