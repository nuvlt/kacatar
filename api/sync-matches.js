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

const LEAGUES = ["PL", "PD", "SA", "BL1", "FL1"]; // Premier, LaLiga, SerieA, Bundesliga, Ligue 1

// basit logo önbellek
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

    // UTC bazlı tarih aralığı
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nowUTC = now.toISOString();
    const nextWeekUTC = nextWeek.toISOString();

    console.log("🧹 Tüm eski maçlar siliniyor...");
    const old = await db.collection("matches").get();
    for (const doc of old.docs) await doc.ref.delete();

    let totalAdded = 0;

    for (const code of LEAGUES) {
      const url = `https://api.football-data.org/v4/competitions/${code}/matches?status=SCHEDULED`;
      console.log(`⚽ Fetching ${code}...`);

      const resp = await fetchFn(url, {
        headers: { "X-Auth-Token": apiKey },
      });
      const data = await resp.json();

      if (!data.matches || !Array.isArray(data.matches)) continue;

      // 🔹 Tarih filtresi (UTC bazlı karşılaştırma)
      const filtered = data.matches.filter((m) => {
        const matchDate = new Date(m.utcDate);
        return matchDate >= now && matchDate <= nextWeek;
      });

      console.log(`➡️ ${code}: ${filtered.length} maç bulundu (haftalık)`);

      for (const m of filtered) {
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
          time: new Date(m.utcDate).toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };

        await ref.set(matchData, { merge: true });
        totalAdded++;
      }
    }

    console.log(`✅ ${totalAdded} maç eklendi (haftalık).`);
    return res.json({ ok: true, message: `${totalAdded} haftalık maç senkronize edildi.` });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
};
