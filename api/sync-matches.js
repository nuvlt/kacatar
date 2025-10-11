const admin = require("firebase-admin");
const axios = require("axios"); // ✅ fetch yerine axios

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// -----------------------
// Helper: normalize name
// -----------------------
function normalizeTeamName(name) {
  return name
    ?.replace(/\b(FC|CF|AC|SC|AFC|C\.F\.|S\.C\.|F\.C\.|Club)\b/gi, "")
    ?.replace(/[^a-zA-Z0-9\s]/g, "")
    ?.trim();
}

// -----------------------
// Fetch logo from TheSportsDB
// -----------------------
async function getTeamLogo(team) {
  if (!team?.name) return "";

  if (team.crest) {
    console.log(`✅ FootballData logosu var: ${team.name}`);
    return team.crest;
  }

  const key = process.env.THESPORTSDB_KEY || "3";
  const base = `https://www.thesportsdb.com/api/v1/json/${key}/searchteams.php`;

  const candidates = [
    team.name,
    normalizeTeamName(team.name),
    normalizeTeamName(team.name)?.split(" ")[0],
  ].filter(Boolean);

  for (const name of candidates) {
    const url = `${base}?t=${encodeURIComponent(name)}`;
    console.log(`🎯 Logo sorgulanıyor: ${url}`);
    try {
      const resp = await axios.get(url, { timeout: 8000 });
      const data = resp.data;
      if (data?.teams?.length && data.teams[0].strTeamBadge) {
        const logo = data.teams[0].strTeamBadge;
        console.log(`✅ Logo bulundu: ${team.name} → ${logo}`);
        return logo;
      }
    } catch (err) {
      console.log(`❌ Logo hatası (${team.name}): ${err.message}`);
    }
  }

  console.log(`⚠️ Logo bulunamadı: ${team.name}`);
  return "";
}

// -----------------------
// Eski maçları sil
// -----------------------
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

// -----------------------
// Ana fonksiyon
// -----------------------
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
      const response = await axios.get(url, {
        headers: { "X-Auth-Token": apiKey },
        timeout: 10000,
      });
      const data = response.data;
      if (Array.isArray(data.matches)) allMatches = allMatches.concat(data.matches);
    }

    const deletedCount = await deleteOldMatches();

    // 🔁 Maçları Firestore'a yaz
    for (const match of allMatches) {
      const homeLogo = await getTeamLogo(match.homeTeam);
      const awayLogo = await getTeamLogo(match.awayTeam);

      const ref = db.collection("matches").doc(String(match.id));
      await ref.set(
        {
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
        },
        { merge: true }
      );
      totalAdded++;
    }

    return res.json({
      ok: true,
      message: `${totalAdded} maç senkronize edildi (${deletedCount} eski maç silindi).`,
    });
  } catch (err) {
    console.error("🔥 Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
};
