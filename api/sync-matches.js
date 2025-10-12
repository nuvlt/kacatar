import admin from "firebase-admin";

// Firestore bağlantısı (güvenli ve Vercel uyumlu)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id, // 🔥 Zorunlu satır
  });
}
const db = admin.firestore();

// node-fetch'i dinamik import ile çağırıyoruz (require hatasını çözer)
const fetchFn = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
const THESPORTSDB_KEY = process.env.THESPORTSDB_KEY;
const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

// Lig kodları
const LEAGUES = ["PL", "PD", "SA", "BL1", "FL1"];

// Yardımcı: takım logosunu bulma
async function findTeamLogo(teamName) {
  if (!teamName) return null;

  // Önce Firestore'da kayıtlı mı bakalım
  const teamRef = db.collection("teams").doc(teamName);
  const existing = await teamRef.get();
  if (existing.exists && existing.data().logo) {
    console.info(`🟢 Firestore: ${teamName}`);
    return existing.data().logo;
  }

  // SportMonks'tan dene
  try {
    const sportMonksUrl = `https://api.sportmonks.com/v3/football/teams/search/${encodeURIComponent(
      teamName
    )}?api_token=${SPORTMONKS_API_KEY}`;
    const sportRes = await fetchFn(sportMonksUrl);
    const sportData = await sportRes.json();

    const logo = sportData?.data?.[0]?.image_path || null;
    if (logo) {
      console.info(`⚽ SportMonks: ${teamName}`);
      await teamRef.set({ logo }, { merge: true });
      return logo;
    }
  } catch (err) {
    console.warn(`⚠️ SportMonks hata (${teamName}): ${err.message}`);
  }

  // TheSportsDB fallback
  try {
    const tsdbUrl = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_KEY}/searchteams.php?t=${encodeURIComponent(
      teamName
    )}`;
    const tsRes = await fetchFn(tsdbUrl);
    const tsData = await tsRes.json();

    const logo = tsData?.teams?.[0]?.strTeamBadge || null;
    if (logo) {
      console.info(`🛟 TheSportsDB: ${teamName}`);
      await teamRef.set({ logo }, { merge: true });
      return logo;
    }
  } catch (err) {
    console.warn(`TheSportsDB hata (${teamName}): ${err.message}`);
  }

  console.info(`❌ Logo bulunamadı: ${teamName}`);
  return null;
}

// Asıl senkronizasyon handler'ı
export default async function handler(req, res) {
  try {
    console.info("🧹 Eski maçlar silindi.");

    const today = new Date();
    const dateFrom = today.toISOString().split("T")[0];
    const dateTo = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    let totalMatches = 0;
    let foundLogos = 0;
    let missingLogos = 0;

    for (const league of LEAGUES) {
      const url = `https://api.football-data.org/v4/matches?competitions=${league}&dateFrom=${dateFrom}&dateTo=${dateTo}`;

      console.info(`📡 Fetch: ${url}`);
      const response = await fetchFn(url, {
        headers: { "X-Auth-Token": FOOTBALL_API_KEY },
      });

      const data = await response.json();
      if (!data.matches) continue;

      for (const match of data.matches) {
        const homeTeam = match.homeTeam?.name || "Bilinmiyor";
        const awayTeam = match.awayTeam?.name || "Bilinmiyor";

        const [homeLogo, awayLogo] = await Promise.all([
          findTeamLogo(homeTeam),
          findTeamLogo(awayTeam),
        ]);

        if (homeLogo) foundLogos++;
        else missingLogos++;
        if (awayLogo) foundLogos++;
        else missingLogos++;

        const matchData = {
          utcDate: match.utcDate,
          status: match.status,
          competition: league,
          homeTeam: { name: homeTeam, logo: homeLogo },
          awayTeam: { name: awayTeam, logo: awayLogo },
        };

        await db.collection("matches").doc(`${league}_${match.id}`).set(matchData);
        totalMatches++;
      }
    }

    return res.status(200).json({
      ok: true,
      message: `${totalMatches} maç senkronize edildi.`,
      logos: { found: foundLogos, missing: missingLogos },
    });
  } catch (error) {
    console.error("🚨 Genel hata:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
