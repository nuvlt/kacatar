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

    const apiKey = process.env.FOOTBALL_DATA_KEY;

    // 5 büyük lig
    const leagues = ["PL", "PD", "SA", "BL1", "FL1"];

    let totalAdded = 0;

    for (const code of leagues) {
      const url = `https://api.football-data.org/v4/competitions/${code}/matches?status=SCHEDULED`;
      console.log(`Fetching ${code}...`);

      const response = await fetchFn(url, {
        headers: { "X-Auth-Token": apiKey },
      });

      const data = await response.json();

      if (!data.matches || !Array.isArray(data.matches)) continue;

      for (const m of data.matches) {
        const ref = db.collection("matches").doc(String(m.id));

        const matchData = {
          league: data.competition.name,
          home: m.homeTeam.name,
          away: m.awayTeam.name,
          date: m.utcDate,
          time: new Date(m.utcDate).toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          homeLogo: "",
          awayLogo: "",
        };

        await ref.set(matchData, { merge: true });
        totalAdded++;
      }
    }

    return res.json({ ok: true, message: `${totalAdded} maç senkronize edildi.` });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
};
