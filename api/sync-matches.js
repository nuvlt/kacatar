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

// ⚙️ Takım ismini normalize et
function normalizeTeamName(name) {
  if (!name) return "";
  return name
    .replace(/(FC|AFC|CF|Calcio|de Fútbol|Club|AS|AC|SSC|UD|CD|US|RC|1\.|190[0-9]|[0-9]{4})/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// 🔍 Logo çekme
async function getTeamLogo(teamName) {
  if (!teamName) return null;
  const normName = normalizeTeamName(teamName);

  const teamRef = db.collection("teams").doc(normName);
  const cached = await teamRef.get();
  if (cached.exists && cached.data().logo) {
    console.log(`🟢 Firestore: ${normName}`);
    return cached.data().logo;
  }

  let logo = null;

  // SportMonks
  try {
    const apiKey = process.env.SPORTMONKS_KEY;
    const url = `https://api.sportmonks.com/v3/football/teams/search/${encodeURIComponent(normName)}?api_token=${apiKey}`;
    const res = await fetchFn(url);
    const data = await res.json();
    logo = data?.data?.[0]?.image_path || null;

    if (logo) {
      console.log(`⚽ SportMonks: ${normName}`);
    }
  } catch (e) {
    console.log(`SportMonks hata (${normName}): ${e.message}`);
  }

  // TheSportsDB yedeği
  if (!logo) {
    try {
      const dbKey = process.env.THESPORTSDB_KEY || "3";
      const url = `https://www.thesportsdb.com/api/v1/json/${dbKey}/searchteams.php?t=${encodeURIComponent(normName)}`;
      const res = await fetchFn(url);
      const data = await res.json();
      logo = data?.teams?.[0]?.strBadge || null;
      if (logo) console.log(`🛟 TheSportsDB: ${normName}`);
    } catch (e) {
      console.log(`TheSportsDB hata (${normName}): ${e.message}`);
    }
  }

  if (logo) {
    await teamRef.set({ logo }, { merge: true });
  } else {
    console.log(`❌ Logo bulunamadı: ${normName}`);
  }

  return logo;
}

module.exports = async (req, res) => {
  try {
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) return res.status(403).json({ error: "Unauthorized" });

    const FOOTBALL_KEY = process.env.FOOTBALL_API_KEY;
    if (!FOOTBALL_KEY) return res.status(500).json({ error: "FOOTBALL_API_KEY eksik" });

    if (!fetchFn) fetchFn = (await import("node-fetch")).default;

    const competitions = ["PL", "PD", "SA", "BL1", "FL1"];
    const today = new Date();
    const dateFrom = today.toISOString().split("T")[0];
    const dateTo = new Date(today.getTime() + 10 * 86400000).toISOString().split("T")[0];

    let totalAdded = 0;
    let logoFound = 0;
    let logoMissing = 0;

    // 🔄 Eski maçları sil
    const old = await db.collection("matches").get();
    const batch = db.batch();
    old.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    console.log("🧹 Eski maçlar silindi.");

    // 🔄 Yeni maçlar
    for (const comp of competitions) {
      const url = `https://api.football-data.org/v4/matches?competitions=${comp}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      console.log("📡 Fetch:", url);
      const resp = await fetchFn(url, { headers: { "X-Auth-Token": FOOTBALL_KEY } });
      const data = await resp.json();

      for (const m of data.matches || []) {
        const home = m.homeTeam.name || "Bilinmiyor";
        const away = m.awayTeam.name || "Bilinmiyor";

        const [homeLogo, awayLogo] = await Promise.all([getTeamLogo(home), getTeamLogo(away)]);

        if (homeLogo || awayLogo) logoFound++;
        else logoMissing++;

        const matchData = {
          home,
          away,
          homeLogo: homeLogo || "",
          awayLogo: awayLogo || "",
          date: m.utcDate,
          league: m.competition.name,
          time: new Date(m.utcDate).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        };

        await db.collection("matches").doc(String(m.id)).set(matchData, { merge: true });
        totalAdded++;
      }
    }

    res.json({
      ok: true,
      message: `${totalAdded} maç senkronize edildi.`,
      logos: { found: logoFound, missing: logoMissing },
    });
  } catch (e) {
    console.error("Sync error:", e);
    res.status(500).json({ error: e.message });
  }
};
