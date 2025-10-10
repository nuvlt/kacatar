const admin = require("firebase-admin");

// fetch için dynamic import
let fetchFn;
(async () => {
  fetchFn = (await import("node-fetch")).default;
})();

// Firebase init
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Basit logo cache
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
  } catch (err) {
    console.error("Logo fetch error:", teamName, err);
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
    const leagues = ["PL", "PD", "SA", "BL1", "FL1"]; // 5 büyük lig
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 86400000);

    console.log("🧹 Deleting old matches...");
    const matchesRef = db.collection("matches");
    const oldMatches = await matchesRef.get();
    for (const doc of oldMatches.docs) {
      await doc.ref.delete();
    }
    console.log("✅ Old matches deleted.");

    let totalAdded = 0;

    for (const code of leagues) {
      const url = `https://api.football-data.org/v4/competitions/${code}/matches?status=SCHEDULED`;
      console.log(`⚽ Fetching ${code}...`);

      const response = await fetchFn(url, {
        headers: { "X-Auth-Token": apiKey },
      });

      const data = await response.json();

      if (!data.matches || !Array.isArray(data.matches)) continue;

      for (const m of data.matches) {
        const matchDate = new Date(m.utcDate);
        if (matchDate < now || matchDate > nextWeek) continue; // sadece bu hafta

        const ref = db.collection("matches").doc(String(m.id));

        const homeLogo = await getTeamLogo(m.homeTeam.name);
        const awayLogo = await getTeamLogo(m.awayTeam.name);

        const matchData = {
          league: data.competition.name,
          home: m.homeTeam.name,
          away: m.awayTeam.name,
          homeLogo,
          awayLogo,
          date: m.utcDate,
          time: matchDate.toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };

        await ref.set(matchData, { merge: true });
        totalAdded++;
      }
    }

    return res.json({ ok: true, message: `${totalAdded} haftalık maç senkronize edildi.` });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
};
