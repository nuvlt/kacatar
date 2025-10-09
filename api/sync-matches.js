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

module.exports = async (req, res) => {
  try {
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!fetchFn) fetchFn = (await import("node-fetch")).default;

    const apiKey = process.env.API_FOOTBALL_KEY;
    const leagueId = 203; // Süper Lig
    const season = 2025;

    // 🔹 URL doğrudan, encode etmeden yazılıyor:
    const url = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}`;

    console.log("Fetching URL:", url);

    const response = await fetchFn(url, {
      headers: { "x-apisports-key": apiKey },
    });

    const text = await response.text();
    console.log("Raw response:", text.slice(0, 500)); // ilk 500 karakteri logla
    const data = JSON.parse(text);

    if (!data.response || !Array.isArray(data.response)) {
      console.error("Invalid API response:", data);
      return res.status(500).json({ error: "Invalid API response" });
    }

    let totalAdded = 0;

    for (const ev of data.response) {
      const fixture = ev.fixture;
      const league = ev.league;
      const teams = ev.teams;

      const ref = db.collection("matches").doc(String(fixture.id));

      const matchData = {
        home: teams.home.name,
        away: teams.away.name,
        homeLogo: teams.home.logo || "",
        awayLogo: teams.away.logo || "",
        date: fixture.date,
        time: new Date(fixture.date).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        league: league.name,
      };

      await ref.set(matchData, { merge: true });
      totalAdded++;
    }

    return res.json({ ok: true, message: `${totalAdded} Süper Lig maçı senkronize edildi.` });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
};
