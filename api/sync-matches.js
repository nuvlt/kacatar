// ESM-CJS uyumlu fetch tanımı
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const admin = require("firebase-admin");

// --- 🔧 ENV Variables ---
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const THESPORTSDB_KEY = process.env.THESPORTSDB_KEY;
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;

// --- 🔥 Firestore Init ---
if (!admin.apps.length) {
  if (!FIREBASE_SERVICE_ACCOUNT)
    throw new Error("FIREBASE_SERVICE_ACCOUNT tanımlı değil.");

  const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// --- 🧹 Eski maçları sil ---
async function clearOldMatches() {
  const matchesRef = db.collection("matches");
  const snapshot = await matchesRef.get();
  const batch = db.batch();
  snapshot.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  console.info("🧹 Eski maçlar silindi.");
}

// --- 🧩 Takım ismini normalize et ---
function normalizeTeamName(name) {
  return name
    .replace(/FC|CF|AC|AS|SC|US|SV|AFC|SS|1\.|Club|de|Calcio|Balompié/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// --- 🏷️ Logo bulma fonksiyonu ---
async function findTeamLogo(teamName) {
  if (!teamName) return null;

  const teamRef = db.collection("teams").doc(teamName);
  const existing = await teamRef.get();
  if (existing.exists && existing.data().logo) {
    console.info(`🟢 Firestore: ${teamName}`);
    return existing.data().logo;
  }

  const cleanName = normalizeTeamName(teamName);

  // --- ⚽ SPORTMONKS ---
  try {
    const sportUrl = `https://api.sportmonks.com/v3/football/teams/search/${encodeURIComponent(
      cleanName
    )}?api_token=${SPORTMONKS_API_KEY}`;

    const sportRes = await fetch(sportUrl);
    const sportData = await sportRes.json();

    const logo =
      sportData?.data?.[0]?.image_path ||
      sportData?.data?.[0]?.logo ||
      sportData?.data?.[0]?.image_url ||
      null;

    if (logo) {
      console.info(`⚽ SportMonks: ${cleanName}`);
      await teamRef.set({ logo }, { merge: true });
      return logo;
    } else {
      console.info(`❌ SportMonks'ta bulunamadı: ${cleanName}`);
    }
  } catch (err) {
    console.warn(`⚠️ SportMonks hata (${cleanName}): ${err.message}`);
  }

  // --- 🛟 TheSportsDB Fallback ---
  try {
    const tsUrl = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_KEY}/searchteams.php?t=${encodeURIComponent(
      cleanName
    )}`;
    const tsRes = await fetch(tsUrl);
    const text = await tsRes.text();

    // Bazı durumlarda HTML dönebiliyor
    if (text.trim().startsWith("<")) {
      console.warn(`TheSportsDB HTML döndü: ${cleanName}`);
      return null;
    }

    const tsData = JSON.parse(text);
    const logo =
      tsData?.teams?.[0]?.strTeamBadge || tsData?.teams?.[0]?.strBadge || null;
    if (logo) {
      console.info(`🛟 TheSportsDB: ${cleanName}`);
      await teamRef.set({ logo }, { merge: true });
      return logo;
    }
  } catch (err) {
    console.warn(`TheSportsDB hata (${teamName}): ${err.message}`);
  }

  console.info(`❌ Logo bulunamadı: ${cleanName}`);
  return null;
}

// --- ⚡ Ana handler ---
module.exports = async (req, res) => {
  try {
    if (!FOOTBALL_API_KEY || !SPORTMONKS_API_KEY || !THESPORTSDB_KEY) {
      throw new Error(
        "API anahtarları eksik (FOOTBALL_API_KEY veya SPORTMONKS_API_KEY veya THESPORTSDB_KEY)"
      );
    }

    await clearOldMatches();

    const today = new Date();
    const dateFrom = today.toISOString().split("T")[0];
    const dateTo = new Date(today.setDate(today.getDate() + 10))
      .toISOString()
      .split("T")[0];

    const competitions = ["PL", "PD", "SA", "BL1", "FL1"];
    const foundLogos = [];
    const missingLogos = [];

    for (const comp of competitions) {
      const url = `https://api.football-data.org/v4/matches?competitions=${comp}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      console.info(`📡 Fetch: ${url}`);

      const resFD = await fetch(url, {
        headers: { "X-Auth-Token": FOOTBALL_API_KEY },
      });

      const data = await resFD.json();
      if (!data.matches) continue;

      for (const match of data.matches) {
        const homeTeam = match.homeTeam?.name || "Bilinmiyor";
        const awayTeam = match.awayTeam?.name || "Bilinmiyor";

        const [homeLogo, awayLogo] = await Promise.all([
          findTeamLogo(homeTeam),
          findTeamLogo(awayTeam),
        ]);

        if (homeLogo || awayLogo) foundLogos.push(homeTeam, awayTeam);
        else missingLogos.push(homeTeam, awayTeam);

        await db.collection("matches").doc(`${match.id}`).set(
          {
            utcDate: match.utcDate,
            competition: comp,
            homeTeam,
            awayTeam,
            homeLogo: homeLogo || null,
            awayLogo: awayLogo || null,
          },
          { merge: true }
        );
      }
    }

    res.status(200).json({
      ok: true,
      message: `${foundLogos.length / 2} maç senkronize edildi.`,
      logos: {
        found: foundLogos.length,
        missing: missingLogos.length,
      },
    });
  } catch (error) {
    console.error("❌ Hata:", error);
    res.status(500).json({ error: error.message });
  }
};
