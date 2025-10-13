// /api/update-logos.js

const { Firestore } = require('@google-cloud/firestore');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Firestore ayarları
const firestore = new Firestore({
  projectId: process.env.FIREBASE_PROJECT_ID,
  credentials: process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : undefined,
});

// Alias eşleştirmeleri
const TEAM_ALIASES = {
  "FC Internazionale Milano": "Inter Milan",
  "Bayer 04 Leverkusen": "Leverkusen",
  "Borussia Mönchengladbach": "Gladbach",
  "1. FC Köln": "FC Koln",
  "RB Leipzig": "Red Bull Leipzig",
  "VfL Wolfsburg": "Wolfsburg",
  "1. FSV Mainz 05": "Mainz",
  "Eintracht Frankfurt": "Frankfurt",
  "Paris Saint-Germain FC": "PSG",
  "Olympique de Marseille": "Marseille",
  "AS Monaco FC": "Monaco",
  "Olympique Lyonnais": "Lyon",
  "Tottenham Hotspur FC": "Tottenham",
  "Manchester United FC": "Man United",
  "Manchester City FC": "Man City",
  "Arsenal FC": "Arsenal",
};

// Ana fonksiyon
module.exports = async (req, res) => {
  try {
    console.log("🚀 Logo güncelleme başlatıldı...");

    const GOOGLE_KEY = process.env.GOOGLE_SEARCH_KEY;
    const GOOGLE_CX = process.env.GOOGLE_SEARCH_CX;
    const THESPORTSDB_KEY = process.env.THESPORTSDB_KEY;
    const forceUpdate = req.query.forceUpdate === "true";

    if (!GOOGLE_KEY || !GOOGLE_CX || !THESPORTSDB_KEY) {
      throw new Error("API anahtarları eksik (Google veya TheSportsDB)");
    }

    const teamsSnap = await firestore.collection('teams').get();
    const teams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let updated = 0, skipped = 0, errors = 0;

    for (const team of teams) {
      const name = team.name || "bilinmiyor";
      const alias = TEAM_ALIASES[name] || name;

      // Eğer logo varsa ve forceUpdate kapalıysa atla
      if (team.logo && !forceUpdate) {
        console.log(`⏭️ Atlandı: ${alias} (logo zaten var)`);
        skipped++;
        continue;
      }

      // 1️⃣ Önce Google'dan ara
      let logoUrl = await fetchGoogleLogo(alias, GOOGLE_KEY, GOOGLE_CX);

      // 2️⃣ Olmazsa TheSportsDB'den dene
      if (!logoUrl) logoUrl = await fetchTheSportsDBLogo(alias, THESPORTSDB_KEY);

      if (logoUrl) {
        await firestore.collection('teams').doc(team.id).update({ logo: logoUrl });
        console.log(`🟢 Güncellendi: ${alias}`);
        updated++;
      } else {
        console.log(`❌ Logo bulunamadı: ${alias}`);
        errors++;
      }
    }

    console.log("🏁 Güncelleme tamamlandı.");
    res.status(200).json({
      ok: true,
      message: "Logo güncelleme tamamlandı.",
      summary: { updated, skipped, errors },
    });

  } catch (err) {
    console.error("❌ Hata:", err);
    res.status(500).json({ error: err.message });
  }
};

// Google Custom Search API
async function fetchGoogleLogo(teamName, key, cx) {
  try {
    const query = encodeURIComponent(`${teamName} football club logo site:wikipedia.org OR site:wikimedia.org`);
    const url = `https://www.googleapis.com/customsearch/v1?q=${query}&cx=${cx}&key=${key}&searchType=image&num=1`;
    const res = await fetch(url);
    const data = await res.json();
    return data?.items?.[0]?.link || null;
  } catch (err) {
    console.warn("Google hata:", err.message);
    return null;
  }
}

// TheSportsDB yedeği
async function fetchTheSportsDBLogo(teamName, key) {
  try {
    const url = `https://www.thesportsdb.com/api/v1/json/${key}/searchteams.php?t=${encodeURIComponent(teamName)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data?.teams?.[0]?.strBadge || data?.teams?.[0]?.strLogo || null;
  } catch {
    return null;
  }
}
