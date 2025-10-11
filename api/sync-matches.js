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

    const apiKey = process.env.FOOTBALL_DATA_KEY;
    if (!apiKey) throw new Error("Missing FOOTBALL_DATA_KEY");

    if (!fetchFn) fetchFn = (await import("node-fetch")).default;

    const leagues = ["PL", "BL1", "PD", "SA", "FL1"];

    const today = new Date();
    const dateFrom = today.toISOString().split("T")[0];
    const dateTo = new Date(today.getTime() + 10 * 86400000)
      .toISOString()
      .split("T")[0];

    console.log(`Fetching matches from ${dateFrom} to ${dateTo}...`);

    const matchesRef = db.collection("matches");
    const snapshot = await matchesRef.get();
    const deletePromises = [];
    snapshot.forEach((doc) => deletePromises.push(doc.ref.delete()));
    await Promise.all(deletePromises);
    console.log(`Deleted ${snapshot.size} old matches.`);

    let totalAdded = 0;
    for (const league of leagues) {
      const url = `https://api.football-data.org/v4/matches?competitions=${league}&dateFrom=${dateFrom}&dateTo=${dateTo}&status=SCHEDULED`;
      const response = await fetchFn(url, {
        headers: { "X-Auth-Token": apiKey },
      });

      const data = await response.json();
      if (!data.matches) continue;

      for (const match of data.matches) {
        const ref = matchesRef.doc(String(match.id));
        await ref.set(
          {
            home: match.homeTeam.name,
            away: match.awayTeam.name,
            date: match.utcDate,
            time: new Date(match.utcDate).toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            league: match.competition.name,
          },
          { merge: true }
        );
        totalAdded++;
      }
    }

    return res.json({ ok: true, message: `${totalAdded} haftalık maç senkronize edildi.` });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
};
