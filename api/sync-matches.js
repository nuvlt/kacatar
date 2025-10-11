// ================================
// 🔹 Kaç Atar - Match Sync Script
// Football-Data.org + TheSportsDB
// ================================

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

// 🔸 TheSportsDB üzerinden logo bulucu
async function getTeamLogo(teamName) {
  try {
    if (!fetchFn) fetchFn = (await import("node-fetch")).default;
    const encoded = encodeURIComponent(teamName);
    const resp = await fetchFn(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encoded}`);
    const data = await resp.json();
    return data?.teams?.[0]?.strTeamBadge || "";
  } catch (e) {
    console.warn(`Logo bulunamadı: ${teamName}`);
    return "";
  }
}

module.exports = async (req, res) => {
  try {
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!fetchFn) fetchFn = (await import("node-fetch")).default;

    const apiKey = process.env.FOOTBALL_DATA_KEY;
    const leagues = ["PL", "BL1", "PD", "SA", "FL1"]; // Premier, Bundesliga, LaLiga, SerieA, Ligue1

    // 🔸 Gelecek 1 haftalık periyot: 5 gün sonradan itibaren 5 gün
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() + 5);
    const toDate = new Date();
    toDate.setDate(fromDate.getDate() + 5);

    const from = fromDate.toISOString().split("T")[0];
    const to = toDate.toISOString().split("T")[0];

    console.log(`🔹 Tarih aralığı: ${from} → ${to}`);

    // 🔸 Tüm eski maçları sil
    const oldDocs = await db.collection("matches").listDocuments();
    for (const doc of oldDocs) await doc.delete();
    console.log(`🗑️ ${oldDocs.length} eski maç silindi.`);

    let totalAdded = 0;

    // 🔸 Her lig için çek ve kaydet
    for (const league of leagues) {
      const url = `https://api.football-data.org/v4/matches?competitions=${league}&dateFrom=${from}&dateTo=${to}`;
      console.log(`📡 Fetching ${league}...`);
      const resp = await fetchFn(url, { headers: { "X-Auth-Token": apiKey } });
      const data = await resp.json();

      if (!data.matches || !Array.isArray(data.matches)) {
        console.warn(`⚠️ Hatalı response ${league}:`, data);
        continue;
      }

      for (const match of data.matches) {
        const home = match.homeTeam?.name || "Bilinmiyor";
        const away = match.awayTeam?.name || "Bilinmiyor";

        // 🔸 Logo bul (TheSportsDB)
        const [homeLogo, awayLogo] = await Promise.all([
          getTeamLogo(home),
          getTeamLogo(away),
        ]);

        const matchData = {
          home,
          away,
          homeLogo,
          awayLogo,
          date: match.utcDate,
          time: new Date(match.utcDate).toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          league: match.competition?.name || "Bilinmiyor",
        };

        await db.collection("matches").doc(String(match.id)).set(matchData, { merge: true });
        totalAdded++;
      }
    }

    console.log(`✅ ${totalAdded} maç eklendi.`);
    return res.json({ ok: true, message: `${totalAdded} maç senkronize edildi.` });

  } catch (err) {
    console.error("❌ Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
};
