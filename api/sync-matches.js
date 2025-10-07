// ESM modül desteği için dynamic import kullan
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

    if (!fetchFn) {
      fetchFn = (await import("node-fetch")).default;
    }

    const thesportsdbKey = process.env.THESPORTSDB_KEY;
    const url = `https://www.thesportsdb.com/api/v1/json/123/eventsnextleague.php?id=4339`;

    console.log("Fetching from:", url);
    const response = await fetchFn(url);
    const data = await response.json();

    if (!data.events || !Array.isArray(data.events)) {
      return res.status(500).json({ error: "Invalid API response" });
    }

    let added = 0;

    for (const ev of data.events) {
      const matchId = ev.idEvent;
      const ref = db.collection("matches").doc(matchId);

      const matchData = {
        home: ev.strHomeTeam,
        away: ev.strAwayTeam,
        date: ev.dateEvent,
        time: ev.strTime,
        league: ev.strLeague,
      };

      await ref.set(matchData, { merge: true });
      added++;
    }

    return res.json({ ok: true, message: `${added} maç senkronize edildi.` });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
};
