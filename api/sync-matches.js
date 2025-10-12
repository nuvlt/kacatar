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

// SportMonks'tan logo çekme fonksiyonu
async function getTeamLogo(teamName) {
  if (!teamName) return null;

  // Önce Firestore'da var mı kontrol et
  const teamRef = db.collection("teams").doc(teamName);
  const docSnap = await teamRef.get();
  if (docSnap.exists && docSnap.data().logo) {
    console.log(`🟢 Firestore'dan bulundu: ${teamName}`);
    return docSnap.data().logo;
  }

  // Yoksa SportMonks'tan al
  const apiKey = process.env.SPORTMONKS_KEY;
  const url = `https://api.sportmonks.com/v3/football/teams/search/${encodeURIComponent(
    teamName
  )}?api_token=${apiKey}`;

  try {
    const res = await fetchFn(url);
    const data = await res.json();

    const logo = data?.data?.[0]?.image_path || data?.data?.[0]?.logo_path || null;

    if (logo) {
      console.log(`⚽ SportMonks'tan bulundu: ${teamName}`);
      await teamRef.set({ logo }, { merge: true });
    } else {
      console.log(`❌ SportMonks'ta bulunamadı: ${teamName}`);
    }

    return logo;
  } catch (err) {
    console.error(`SportMonks logo hatası (${teamName}):`, err.message);
    return null;
  }
}

module.exports = async (req, res) => {
  try {
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const FOOTBALL_KEY = process.env.FOOTBALL_API_KEY;
    if (!FOOTBALL_KEY || !process.env.SPORTMONKS_KEY) {
      return res.status(500).json({
        error: "API anahtarları eksik (FOOTBALL_API_KEY veya SPORTMONKS_KEY)",
      });
    }

    if (!fetchFn) fetchFn = (await import("node-fetch")).default;

    const competitions = ["PL", "PD", "SA", "BL1", "FL1"];
    const today = new Date();
    const dateFrom = today.toISOString().split("T")[0];
    const dateTo = new Date(today.getTime() + 10 * 86400000)
      .toISOString()
      .split("T")[0];

    let totalAdded = 0;
    let logoFound = 0;
    let logoMissing = 0;

    // Eski maçları temizle
    const oldMatches = await db.collection("matches").get();
    const batch = db.batch();
    oldMatches.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log("🧹 Eski maçlar silindi.");

    // Yeni maçları çek
    for (const comp of competitions) {
      const url = `https://api.football-data.org/v4/matches?competitions=${comp}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      console.log("📡 Fetch:", url);

      const response = await fetchFn(url, {
        headers: { "X-Auth-Token": FOOTBALL_KEY },
      });

      const data = await response.json();
      const matches = data?.matches || [];

      for (const m of matches) {
        const home = m.homeTeam.name || "Bilinmiyor";
        const away = m.awayTeam.name || "Bilinmiyor";

        // 🔍 Logoları Firestore veya SportMonks'tan getir
        const [homeLogo, awayLogo] = await Promise.all([
          getTeamLogo(home),
          getTeamLogo(away),
        ]);

        if (homeLogo || awayLogo) logoFound++;
        else logoMissing++;

        const matchData = {
          home,
          away,
          homeLogo: homeLogo || "",
          awayLogo: awayLogo || "",
          date: m.utcDate,
          league: m.competition.name,
          time: new Date(m.utcDate).toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };

        await db.collection("matches").doc(String(m.id)).set(matchData, { merge: true });
        totalAdded++;
      }
    }

    return res.json({
      ok: true,
      message: `${totalAdded} maç senkronize edildi.`,
      logos: { found: logoFound, missing: logoMissing },
    });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
};
