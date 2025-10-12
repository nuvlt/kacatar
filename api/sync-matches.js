// /api/sync-matches.js
const admin = require("firebase-admin");

let fetchFn;
(async () => {
  fetchFn = (await import("node-fetch")).default;
})();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}

const db = admin.firestore();
const LEAGUES = ["PL", "PD", "SA", "BL1", "FL1"];

module.exports = async (req, res) => {
  try {
    const SECRET_KEY = process.env.SECRET_KEY;
    const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
    const THESPORTSDB_KEY = process.env.THESPORTSDB_KEY || "3";

    if (!FOOTBALL_API_KEY || !THESPORTSDB_KEY) {
      return res.status(400).json({ error: "API anahtarları eksik (FOOTBALL_API_KEY veya THESPORTSDB_KEY)" });
    }
    if (req.query.key !== SECRET_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const today = new Date();
    const dateFrom = today.toISOString().split("T")[0];
    const dateToObj = new Date(today);
    dateToObj.setDate(today.getDate() + 10);
    const dateTo = dateToObj.toISOString().split("T")[0];

    console.log(`📅 Tarih aralığı: ${dateFrom} → ${dateTo}`);

    let allMatches = [];

    for (const league of LEAGUES) {
      const url = `https://api.football-data.org/v4/matches?competitions=${league}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      console.log("📡 Fetch:", url);
      const resp = await fetchFn(url, {
        headers: { "X-Auth-Token": FOOTBALL_API_KEY },
      });
      const data = await resp.json();
      if (data.matches) allMatches = allMatches.concat(data.matches);
    }

    // Eski maçları sil
    const oldMatches = await db.collection("matches").get();
    const batch = db.batch();
    oldMatches.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    // Logo arama
    const getLogo = async (teamName) => {
      if (!teamName) return null;
      const normalized = teamName
        .replace(/\bFC\b/gi, "")
        .replace(/\bCF\b/gi, "")
        .replace(/\bAC\b/gi, "")
        .replace(/\bSC\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      // 1️⃣ TheSportsDB
      try {
        const url = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_KEY}/searchteams.php?t=${encodeURIComponent(normalized)}`;
        const resp = await fetchFn(url);
        const data = await resp.json();
        const teams = data.teams;
        if (teams && teams.length > 0) {
          const soccerTeam = teams.find((t) => t.strSport === "Soccer") || teams[0];
          if (soccerTeam?.strBadge) return soccerTeam.strBadge;
        }
      } catch (e) {
        console.warn("⚠️ TheSportsDB logo alınamadı:", teamName);
      }

      // 2️⃣ Clearbit fallback
      const fallbackLogo = `https://logo.clearbit.com/${normalized.replace(/\s+/g, "").toLowerCase()}.com`;
      try {
        const test = await fetchFn(fallbackLogo);
        if (test.ok) return fallbackLogo;
      } catch (_) {}

      return null;
    };

    // Maçları kaydet
    let found = 0;
    let missing = 0;

    for (const m of allMatches) {
      const homeTeam = m.homeTeam.name;
      const awayTeam = m.awayTeam.name;

      const [homeLogo, awayLogo] = await Promise.all([
        getLogo(homeTeam),
        getLogo(awayTeam),
      ]);

      if (homeLogo) found++;
      else missing++;
      if (awayLogo) found++;
      else missing++;

      await db.collection("matches").doc(String(m.id)).set({
        id: m.id,
        utcDate: m.utcDate,
        status: m.status,
        competition: m.competition.name,
        homeTeam: homeTeam,
        awayTeam: awayTeam,
        homeLogo: homeLogo || null,
        awayLogo: awayLogo || null,
      });
    }

    return res.json({
      ok: true,
      message: `${allMatches.length} maç senkronize edildi.`,
      logos: { found, missing },
    });
  } catch (err) {
    console.error("🔥 Hata:", err);
    return res.status(500).json({ error: err.message });
  }
};
