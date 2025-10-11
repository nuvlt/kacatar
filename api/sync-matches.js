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

function normalizeTeamName(name) {
  return name
    ?.replace(/ FC| CF| AC| SC| AFC| C\.F\.| S\.C\.| F\.C\.| Club/gi, "")
    ?.replace(/[^a-zA-Z0-9\s]/g, "")
    ?.trim();
}

async function getTeamLogo(team) {
  if (!team || !team.name) {
    console.log("⚠️ Takım bilgisi eksik:", team);
    return "";
  }

  if (team.crest) return team.crest;

  const key = process.env.THESPORTSDB_KEY || "3";
  const base = `https://www.thesportsdb.com/api/v1/json/${key}/searchteams.php`;

  const variants = [
    team.name,
    normalizeTeamName(team.name),
    normalizeTeamName(team.name)?.split(" ")[0],
  ].filter(Boolean);

  for (const name of variants) {
    try {
      console.log("🎯 Logo sorgulanıyor:", name);
      const resp = await fetchFn(`${base}?t=${encodeURIComponent(name)}`);
      const data = await resp.json();
      if (data?.teams?.[0]?.strTeamBadge) {
        console.log(`✅ Logo bulundu: ${team.name} → ${data.teams[0].strTeamBadge}`);
        return data.teams[0].strTeamBadge;
      }
    } catch (e) {
      console.log("❌ Logo ararken hata:", e.message);
    }
  }

  console.log("❌ Logo bulunamadı:", team.name);
  return "";
}

async function deleteOldMatches() {
  const now = new Date();
  const snapshot = await db.collection("matches").get();
  const batch = db.batch();
  let deleted = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    const matchDate = new Date(data.date);
    if (matchDate < now) {
      batch.delete(doc.ref);
      deleted++;
    }
  });

  if (deleted > 0) await batch.commit();
  return deleted;
}

module.exports = async (req, res) => {
  try {
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY)
      return res.status(403).json({ error: "Unauthorized" });

    const competitions = ["PL", "PD", "SA", "BL1", "FL1"];
    const today = new Date();
    const from = today.toISOString().split("T")[0];
    const to = new Date(today.getTime() + 5 * 86400000)
      .toISOString()
      .split("T")[0];

    const apiKey = process.env.FOOTBALL_DATA_KEY;

    let totalAdded = 0;
    let allMatches = [];

    for (const comp of competitions) {
      const url = `https://api.football-data.org/v4/matches?competitions=${comp}&dateFrom=${from}&dateTo=${to}`;
      console.log("📡 Fetch:", url);
      const response = await fetchFn(url, {
        headers: { "X-Auth-Token": apiKey },
      });
      const data = await response.json();
      if (Array.isArray(data.matches)) allMatches = allMatches.concat(data.matches);
    }

    const deletedCount = await deleteOldMatches();

    for (const match of allMatches) {
      const homeLogo = await getTeamLogo(match.homeTeam);
      const awayLogo = await getTeamLogo(match.awayTeam);

      const ref = db.collection("matches").doc(String(match.id));
      const matchData = {
        home: match.homeTeam.name,
        away: match.awayTeam.name,
        homeLogo,
        awayLogo,
        date: match.utcDate,
        league: match.competition.name,
        time: new Date(match.utcDate).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      await ref.set(matchData, { merge: true });
      totalAdded++;
    }

    return res.json({
      ok: true,
      message: `${totalAdded} maç senkronize edildi (${deletedCount} eski maç silindi).`,
    });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
};
