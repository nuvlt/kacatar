const admin = require("firebase-admin");
const axios = require("axios");

// Firebase init
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

module.exports = async (req, res) => {
  try {
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const FOOTBALL_KEY = process.env.FOOTBALL_DATA_KEY;
    const THESPORTSDB_KEY = process.env.THESPORTSDB_KEY || "3";

    // 🔹 5 büyük lig kodu
    const competitions = ["PL", "PD", "SA", "BL1", "FL1"];

    // 🔹 Tarih aralığı: bugünden +10 gün
    const today = new Date();
    const dateFrom = today.toISOString().split("T")[0];
    const dateTo = new Date(today.getTime() + 10 * 86400000)
      .toISOString()
      .split("T")[0];

    console.log(`📅 Tarih aralığı: ${dateFrom} → ${dateTo}`);

    // 🔹 Eski maçları temizle
    const oldMatches = await db.collection("matches").get();
    const batch = db.batch();
    oldMatches.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`🧹 Eski maçlar silindi (${oldMatches.size} adet)`);

    let totalAdded = 0;

    for (const comp of competitions) {
      const url = `https://api.football-data.org/v4/matches?competitions=${comp}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      console.log(`📡 Fetch: ${url}`);

      const response = await axios.get(url, {
        headers: { "X-Auth-Token": FOOTBALL_KEY },
      });
      const matches = response.data.matches || [];

      for (const m of matches) {
        const homeTeam = m.homeTeam.name;
        const awayTeam = m.awayTeam.name;

        // 🎯 TheSportsDB logoları al
        const homeLogo = await fetchTeamLogo(homeTeam, THESPORTSDB_KEY);
        const awayLogo = await fetchTeamLogo(awayTeam, THESPORTSDB_KEY);

        const matchData = {
          id: m.id,
          date: m.utcDate,
          time: new Date(m.utcDate).toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          home: homeTeam,
          away: awayTeam,
          homeLogo: homeLogo,
          awayLogo: awayLogo,
          league: m.competition?.name || comp,
        };

        await db.collection("matches").doc(String(m.id)).set(matchData);
        totalAdded++;
      }
    }

    return res.json({
      ok: true,
      message: `${totalAdded} maç senkronize edildi.`,
    });
  } catch (err) {
    console.error("🔥 Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// 🔍 TheSportsDB’den logo çekme
async function fetchTeamLogo(teamName, key) {
  if (!teamName) return "";
  try {
    const url = `https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(
      teamName
    )}`;
    const { data } = await axios.get(url);
    if (data.teams && data.teams.length > 0) {
      const team = data.teams.find((t) => t.strSport === "Soccer");
      if (team && team.strBadge) {
        console.log(`✅ Logo bulundu: ${teamName}`);
        return team.strBadge;
      }
    }
    console.log(`⚠️ Logo bulunamadı: ${teamName}`);
    return "";
  } catch (e) {
    console.log(`❌ Logo hatası: ${teamName} (${e.message})`);
    return "";
  }
}
