// /api/sync-matches.js
import admin from "firebase-admin";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
  const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
  const THESPORTSDB_KEY = process.env.THESPORTSDB_KEY;

  if (!FOOTBALL_API_KEY || !SPORTMONKS_API_KEY || !THESPORTSDB_KEY) {
    console.error("❌ API anahtarları eksik");
    return res.status(500).json({
      error: "API anahtarları eksik (FOOTBALL_API_KEY veya SPORTMONKS_API_KEY veya THESPORTSDB_KEY)",
    });
  }

  console.log("ENV CHECK", {
    FOOTBALL_API_KEY: !!FOOTBALL_API_KEY,
    SPORTMONKS_API_KEY: !!SPORTMONKS_API_KEY,
    THESPORTSDB_KEY: !!THESPORTSDB_KEY,
  });

  const competitions = ["PL", "PD", "SA", "BL1", "FL1"];
  const dateFrom = new Date();
  const dateTo = new Date();
  dateTo.setDate(dateTo.getDate() + 10);

  const formatDate = (d) => d.toISOString().split("T")[0];
  const matchesRef = db.collection("matches");

  const foundLogos = [];
  const missingLogos = [];

  console.log("🧹 Eski maçlar silindi.");

  await matchesRef.get().then((snap) =>
    Promise.all(snap.docs.map((doc) => doc.ref.delete()))
  );

  for (const comp of competitions) {
    const url = `https://api.football-data.org/v4/matches?competitions=${comp}&dateFrom=${formatDate(
      dateFrom
    )}&dateTo=${formatDate(dateTo)}`;

    console.log("📡 Fetch:", url);

    const resp = await fetch(url, {
      headers: { "X-Auth-Token": FOOTBALL_API_KEY },
    });
    const data = await resp.json();
    const matches = data.matches || [];

    for (const match of matches) {
      const home = match.homeTeam.name || "Bilinmiyor";
      const away = match.awayTeam.name || "Bilinmiyor";

      const homeLogo = await findLogo(home, SPORTMONKS_API_KEY, THESPORTSDB_KEY);
      const awayLogo = await findLogo(away, SPORTMONKS_API_KEY, THESPORTSDB_KEY);

      if (homeLogo) foundLogos.push(home);
      else missingLogos.push(home);
      if (awayLogo) foundLogos.push(away);
      else missingLogos.push(away);

      await matchesRef.add({
        utcDate: match.utcDate,
        competition: match.competition?.name,
        homeTeam: home,
        awayTeam: away,
        homeLogo,
        awayLogo,
      });

      console.log(`🟢 Firestore: ${home} vs ${away}`);
    }
  }

  return res.json({
    ok: true,
    message: `${foundLogos.length / 2} maç senkronize edildi.`,
    logos: { found: foundLogos.length, missing: missingLogos.length },
  });
}

async function findLogo(teamName, sportmonksKey, sportsdbKey) {
  // 1️⃣ SportMonks dene
  try {
    const smUrl = `https://api.sportmonks.com/v3/football/teams/search/${encodeURIComponent(
      teamName
    )}?api_token=${sportmonksKey}`;
    const smRes = await fetch(smUrl);
    const smData = await smRes.json();
    const team = smData.data?.[0];
    if (team?.image_path) {
      console.log(`⚽ SportMonks: ${teamName}`);
      return team.image_path;
    }
  } catch (e) {
    console.warn(`SportMonks hata (${teamName}): ${e.message}`);
  }

  // 2️⃣ TheSportsDB fallback (1 sn bekleme ile)
  try {
    await new Promise((r) => setTimeout(r, 1000));
    const tsUrl = `https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(
      teamName
    )}`;
    const tsRes = await fetch(tsUrl);
    const text = await tsRes.text();
    if (text.startsWith("<")) {
      console.warn(`TheSportsDB HTML döndü: ${teamName}`);
      return null;
    }
    const tsData = JSON.parse(text);
    const logo =
      tsData.teams?.[0]?.strTeamBadge || tsData.teams?.[0]?.strLogo || null;
    if (logo) {
      console.log(`🛟 TheSportsDB: ${teamName}`);
      return logo;
    }
  } catch (e) {
    console.warn(`TheSportsDB hata (${teamName}): ${e.message}`);
  }

  console.log(`❌ Logo bulunamadı: ${teamName}`);
  return null;
}
