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

    if (!FOOTBALL_API_KEY || !THESPORTSDB_KEY)
      return res.status(400).json({ error: "API anahtarları eksik (FOOTBALL_API_KEY veya THESPORTSDB_KEY)" });
    if (req.query.key !== SECRET_KEY) return res.status(401).json({ error: "Unauthorized" });

    const today = new Date();
    const dateFrom = today.toISOString().split("T")[0];
    const dateToObj = new Date(today);
    dateToObj.setDate(today.getDate() + 10);
    const dateTo = dateToObj.toISOString().split("T")[0];

    console.log(`📅 Tarih aralığı: ${dateFrom} → ${dateTo}`);

    let allMatches = [];

    // 1️⃣ Football Data’dan maçları çek
    for (const league of LEAGUES) {
      const url = `https://api.football-data.org/v4/matches?competitions=${league}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      console.log("📡 Fetch:", url);
      const resp = await fetchFn(url, { headers: { "X-Auth-Token": FOOTBALL_API_KEY } });
      const data = await resp.json();
      if (data.matches) allMatches = allMatches.concat(data.matches);
    }

    // 2️⃣ Eski maçları sil
    const old = await db.collection("matches").get();
    const batch = db.batch();
    old.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    // 3️⃣ Logo arama (TheSportsDB + Clearbit)
    const getLogo = async (teamName) => {
      if (!teamName) return null;

      const normalized = teamName
        .replace(/\bFC\b/gi, "")
        .replace(/\bCF\b/gi, "")
        .replace(/\bAC\b/gi, "")
        .replace(/\bSC\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      // 🥇 TheSportsDB
      try {
        const url = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_KEY}/searchteams.php?t=${encodeURIComponent(
          normalized
        )}`;
        const resp = await fetchFn(url);
        const data = await resp.json();
        const team = data?.teams?.find((t) => t.strSport === "Soccer") || data?.teams?.[0];
        if (team?.strBadge) return team.strBadge;
      } catch (_) {}

      // 🥈 Clearbit fallback
      try {
        const domain = normalized.replace(/\s+/g, "").toLowerCase();
        const clearbitUrl = `https://logo.clearbit.com/${domain}.com`;
        const resp = await fetchFn(clearbitUrl);
        if (resp.ok) return clearbitUrl;
      } catch (_) {}

      return null;
    };

    // 4️⃣ Firestore’a yaz
    let found = 0;
    let missing = 0;

    for (const m of allMatches) {
      const homeTeam =
        m?.homeTeam?.name ||
        m?.homeTeam?.shortName ||
        m?.homeTeam?.tla ||
        `Home-${m?.homeTeam?.id || "Unknown"}`;
      const awayTeam =
        m?.awayTeam?.name ||
        m?.awayTeam?.shortName ||
        m?.awayTeam?.tla ||
        `Away-${m?.awayTeam?.id || "Unknown"}`;

      const [homeLogo, awayLogo] = await Promise.all([getLogo(homeTeam), getLogo(awayTeam)]);

      if (homeLogo) found++;
      else missing++;
      if (awayLogo) found++;
      else missing++;

      await db.collection("matches").doc(String(m.id)).set({
        id: m.id,
        utcDate: m.utcDate,
        competition: m.competition?.name || "Unknown League",
        status: m.status,
        homeTeam,
        awayTeam,
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
