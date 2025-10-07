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

    // ✅ Lig ID listesi
    const leagues = [
      { id: 4339, name: "Turkish Super Lig" },
      { id: 4328, name: "Premier League" },
      { id: 4335, name: "La Liga" },
      { id: 4331, name: "Bundesliga" },
      { id: 4332, name: "Serie A" },
    ];

    let totalAdded = 0;

    for (const league of leagues) {
      const url = `https://www.thesportsdb.com/api/v1/json/123/eventsnextleague.php?id=${league.id}`;
      console.log(`Fetching ${league.name}...`);

      const response = await fetchFn(url);
      const data = await response.json();

      if (!data.events || !Array.isArray(data.events)) continue;

      for (const ev of data.events) {
        const matchId = ev.idEvent;
        const ref = db.collection("matches").doc(matchId);

        const matchData = {
          home: ev.strHomeTeam || "Bilinmiyor",
          away: ev.strAwayTeam || "Bilinmiyor",
          homeLogo:
            ev.strHomeTeamBadge ||
            `https://placehold.co/40x40?text=${encodeURIComponent(ev.strHomeTeam || "H")}`,
          awayLogo:
            ev.strAwayTeamBadge ||
            `https://placehold.co/40x40?text=${encodeURIComponent(ev.strAwayTeam || "A")}`,
          date: ev.dateEvent || null,
          time: ev.strTime || null,
          league: ev.strLeague || league.name,
          updatedAt: new Date().toISOString(),
        };

        // merge: false → eski verileri tamamen yeniler
        await ref.set(matchData, { merge: false });
        totalAdded++;
      }
    }

    return res.json({ ok: true, message: `${totalAdded} maç senkronize edildi.` });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
};
