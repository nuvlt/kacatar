// (Önceki require ve fetch initialization olduğu gibi kalsın)
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

    const thesportsdbKey = process.env.THESPORTSDB_KEY || "123";
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

      // 1) Tarih/parsing: öncelik strTimestamp, sonra dateEvent+strTime
      let dateObj = null;
      if (ev.strTimestamp) {
        // örn "2025-10-18T17:00:00"
        const d = new Date(ev.strTimestamp);
        if (!isNaN(d)) dateObj = d;
      }
      if (!dateObj && ev.dateEvent) {
        const timePart = ev.strTime || "00:00:00";
        const iso = `${ev.dateEvent}T${timePart}`; // no timezone, treated consistently by Date
        const d = new Date(iso);
        if (!isNaN(d)) dateObj = d;
      }

      // 2) Firestore Timestamp (null ise yazma veya null bırak)
      const dateTimestamp = dateObj ? admin.firestore.Timestamp.fromDate(dateObj) : null;

      const matchData = {
        home: ev.strHomeTeam || "Bilinmiyor",
        away: ev.strAwayTeam || "Bilinmiyor",
        date: dateTimestamp,          // Firestore Timestamp veya null
        time: ev.strTime || null,
        league: ev.strLeague || null,
        coverImage: ev.strThumb || null,
        source: "thesportsdb",
        sourceId: ev.idEvent
      };

      // merge: true -> mevcut votes vb. korunur
      await ref.set(matchData, { merge: true });
      added++;
    }

    return res.json({ ok: true, message: `${added} maç senkronize edildi.` });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
};
