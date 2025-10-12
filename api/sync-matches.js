// api/sync-matches.js
const { Firestore } = require("@google-cloud/firestore");

module.exports = async (req, res) => {
  console.log("🚀 sync-matches başlatıldı");

  try {
    // 🔑 Environment kontrolü
    const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
    const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
    const THESPORTSDB_KEY = process.env.THESPORTSDB_KEY;
    const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;

    console.log("🔑 ENV CHECK", {
      FOOTBALL_API_KEY: !!FOOTBALL_API_KEY,
      SPORTMONKS_API_KEY: !!SPORTMONKS_API_KEY,
      THESPORTSDB_KEY: !!THESPORTSDB_KEY,
      FIREBASE_SERVICE_ACCOUNT: !!FIREBASE_SERVICE_ACCOUNT,
    });

    if (!FOOTBALL_API_KEY || !SPORTMONKS_API_KEY || !THESPORTSDB_KEY) {
      throw new Error(
        "API anahtarları eksik (FOOTBALL_API_KEY veya SPORTMONKS_API_KEY veya THESPORTSDB_KEY)"
      );
    }

    // 🔥 Firestore bağlantısı
    const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const firestore = new Firestore({
      projectId: serviceAccount.project_id,
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
    });

    const competitions = ["PL", "PD", "SA", "BL1", "FL1"];
    const today = new Date().toISOString().split("T")[0];
    const dateTo = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    let totalMatches = 0;
    let foundLogos = 0;
    let missingLogos = 0;

    // 🎯 Yardımcı: Takım adı düzeltici
    const cleanName = (name) => {
      if (!name) return "";
      return name
        .replace(/FC|CF|AC|SSC|ASD|U19|U21|AFC|SC|FK|BK|B|C|D|E|G|H|J|K|L|M|N|P|R|S|T|U|V|X|Y|Z$/gi, "")
        .trim()
        .replace(/\s{2,}/g, " ");
    };

    // ⚽ Logo bulucu
    async function getTeamLogo(teamName) {
      if (!teamName) return null;
      const cleanTeam = cleanName(teamName);

      // 1️⃣ SportMonks
      const sportmonksUrl = `https://api.sportmonks.com/v3/football/teams/search/${encodeURIComponent(
        cleanTeam
      )}?api_token=${SPORTMONKS_API_KEY}`;

      try {
        const smRes = await fetch(sportmonksUrl);
        if (smRes.ok) {
          const smData = await smRes.json();
          if (smData.data && smData.data.length > 0) {
            const team = smData.data[0];
            const logo = team.image_path || team.logo;
            if (logo) {
              console.log(`⚽ SportMonks: ${cleanTeam}`);
              return logo;
            }
          }
        }
      } catch (err) {
        console.warn(`SportMonks hata (${cleanTeam}):`, err.message);
      }

      // 2️⃣ TheSportsDB fallback
      const tsdbUrl = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_KEY}/searchteams.php?t=${encodeURIComponent(
        cleanTeam
      )}`;
      try {
        const tsRes = await fetch(tsdbUrl);
        if (tsRes.ok) {
          const text = await tsRes.text();
          if (text.startsWith("<")) {
            console.warn(`TheSportsDB HTML döndü: ${cleanTeam}`);
            return null;
          }
          const tsData = JSON.parse(text);
          if (tsData.teams && tsData.teams.length > 0) {
            const logo =
              tsData.teams[0].strTeamBadge ||
              tsData.teams[0].strTeamLogo ||
              tsData.teams[0].strBadge;
            if (logo) {
              console.log(`🛟 TheSportsDB: ${cleanTeam}`);
              return logo;
            }
          }
        }
      } catch (err) {
        console.warn(`TheSportsDB hata (${cleanTeam}):`, err.message);
      }

      console.log(`❌ Logo bulunamadı: ${cleanTeam}`);
      return null;
    }

    // 🔁 Lig bazında döngü
    for (const competition of competitions) {
      const url = `https://api.football-data.org/v4/matches?competitions=${competition}&dateFrom=${today}&dateTo=${dateTo}`;
      console.log("📡 Fetch:", url);

      const fdRes = await fetch(url, {
        headers: { "X-Auth-Token": FOOTBALL_API_KEY },
      });
      const fdData = await fdRes.json();
      if (!fdData.matches) continue;

      for (const match of fdData.matches) {
        // 👉 Takım isimleri için doğru alan
        const home = match.homeTeam?.shortName || match.homeTeam?.name || "bilinmiyor";
        const away = match.awayTeam?.shortName || match.awayTeam?.name || "bilinmiyor";
        totalMatches++;

        const homeLogo = await getTeamLogo(home);
        const awayLogo = await getTeamLogo(away);
        if (homeLogo) foundLogos++;
        else missingLogos++;
        if (awayLogo) foundLogos++;
        else missingLogos++;

        await firestore.collection("matches").add({
          competition,
          utcDate: match.utcDate,
          homeTeam: home,
          awayTeam: away,
          logos: { home: homeLogo, away: awayLogo },
          createdAt: new Date().toISOString(),
        });
      }
    }

    const result = {
      ok: true,
      message: `${totalMatches} maç senkronize edildi.`,
      logos: { found: foundLogos, missing: missingLogos },
    };
    console.log(result);
    return res.status(200).json(result);
  } catch (err) {
    console.error("❌ Hata:", err);
    return res.status(500).json({ error: err.message });
  }
};
