const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

// Küçük gecikme için yardımcı fonksiyon
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Takım ismini normalize et
function normalizeTeamName(name) {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // aksanları kaldır
    .replace(/ß/g, "ss")
    .replace(/&/g, "and")
    .replace(/[-.]/g, " ")
    .replace(/\b(FC|AFC|CF|Calcio|Club|AS|AC|SSC|UD|CD|US|RC|1\.|190[0-9]|[0-9]{4})\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

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
  const sportmonksKey = process.env.SPORTMONKS_KEY;
  const thesportsKey = process.env.THESPORTSDB_KEY || "3";

  // 1️⃣ SportMonks tam isim
  try {
    const url = `https://api.sportmonks.com/v3/football/teams/search/${encodeURIComponent(
      normName
    )}?api_token=${sportmonksKey}`;
    const res = await fetch(url);
    const data = await res.json();
    logo = data?.data?.[0]?.image_path || null;
    if (logo) console.log(`⚽ SportMonks: ${normName}`);
  } catch {}

  // 2️⃣ SportMonks kısa isim
  if (!logo && normName.includes(" ")) {
    const shortName = normName.split(" ")[0];
    try {
      const url = `https://api.sportmonks.com/v3/football/teams/search/${encodeURIComponent(
        shortName
      )}?api_token=${sportmonksKey}`;
      const res = await fetch(url);
      const data = await res.json();
      logo = data?.data?.[0]?.image_path || null;
      if (logo) console.log(`⚽ SportMonks (short): ${shortName}`);
    } catch {}
  }

  // 3️⃣ TheSportsDB (rate limit korumalı)
  if (!logo) {
    await sleep(700);
    try {
      const url = `https://www.thesportsdb.com/api/v1/json/${thesportsKey}/searchteams.php?t=${encodeURIComponent(
        normName
      )}`;
      const res = await fetch(url);
      const text = await res.text();

      if (text.startsWith("<")) {
        throw new Error("HTML response");
      }

      const data = JSON.parse(text);
      logo = data?.teams?.[0]?.strBadge || null;
      if (logo) console.log(`🛟 TheSportsDB: ${normName}`);
    } catch (e) {
      console.log(`TheSportsDB hata (${normName}): ${e.message}`);
    }
  }

  // 4️⃣ Clearbit fallback (en son)
  if (!logo) {
    const domain = `${normName.replace(/\s+/g, "").toLowerCase()}.com`;
    logo = `https://logo.clearbit.com/${domain}`;
    console.log(`💡 Clearbit fallback: ${normName}`);
  }

  if (logo) {
    await teamRef.set({ logo }, { merge: true });
  } else {
    console.log(`❌ Logo bulunamadı: ${normName}`);
  }

  return logo;
}

export default async function handler(req, res) {
  const key = req.query.key;
  if (key !== process.env.SECRET_KEY) {
    return res.status(403).json({ error: "Yetkisiz erişim" });
  }

  const footballApiKey = process.env.FOOTBALL_API_KEY;
  const sportmonksKey = process.env.SPORTMONKS_KEY;

  if (!footballApiKey || !sportmonksKey) {
    return res.status(400).json({ error: "API anahtarları eksik." });
  }

  const leagues = ["PL", "PD", "SA", "BL1", "FL1"];
  const today = new Date();
  const dateFrom = today.toISOString().split("T")[0];
  const dateTo = new Date(today);
  dateTo.setDate(today.getDate() + 10);
  const dateToStr = dateTo.toISOString().split("T")[0];

  let totalMatches = 0;
  let foundLogos = 0;
  let missingLogos = 0;

  // Eski maçları temizle
  const oldMatches = await db.collection("matches").get();
  const batch = db.batch();
  oldMatches.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  console.log("🧹 Eski maçlar silindi.");

  for (const league of leagues) {
    const url = `https://api.football-data.org/v4/matches?competitions=${league}&dateFrom=${dateFrom}&dateTo=${dateToStr}`;
    console.log(`📡 Fetch: ${url}`);

    const resApi = await fetch(url, {
      headers: { "X-Auth-Token": footballApiKey },
    });

    const data = await resApi.json();
    const matches = data?.matches || [];

    for (const match of matches) {
      const homeTeam = match.homeTeam?.name || "Bilinmiyor";
      const awayTeam = match.awayTeam?.name || "Bilinmiyor";
      const homeLogo = await getTeamLogo(homeTeam);
      const awayLogo = await getTeamLogo(awayTeam);

      if (homeLogo || awayLogo) foundLogos++;
      else missingLogos++;

      await db.collection("matches").add({
        utcDate: match.utcDate,
        status: match.status,
        competition: match.competition?.name || league,
        homeTeam,
        awayTeam,
        homeLogo,
        awayLogo,
      });
    }

    totalMatches += matches.length;
  }

  return res.status(200).json({
    ok: true,
    message: `${totalMatches} maç senkronize edildi.`,
    logos: { found: foundLogos, missing: missingLogos },
  });
}
