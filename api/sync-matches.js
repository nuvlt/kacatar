// api/sync-matches.js
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

// yardımcı: ayın ilk ve son günü (YYYY-MM-DD)
function monthRangeFor(offsetMonths = 0) {
  const now = new Date();
  now.setMonth(now.getMonth() + offsetMonths);
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-index
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0); // son gün
  const fmt = (d) => d.toISOString().split("T")[0];
  return { start: fmt(start), end: fmt(end) };
}

module.exports = async (req, res) => {
  try {
    // Auth: query key OR Authorization: Bearer <CRON_SECRET>
    const qkey = req.query.key || "";
    const authHeader = (req.headers.authorization || "").trim();
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const okKey = (qkey && qkey === process.env.SECRET_KEY) || (bearer && bearer === process.env.CRON_SECRET);
    if (!okKey) {
      console.log("Unauthorized attempt:", { qkeyProvided: !!qkey, hasAuthHeader: !!authHeader });
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!fetchFn) fetchFn = (await import("node-fetch")).default;

    const apiKey = process.env.API_FOOTBALL_KEY;
    const leagueId = process.env.LEAGUE_ID || "203"; // default 203; production için dashboard'dan kontrol edin
    const season = process.env.SEASON || new Date().getFullYear(); // örn 2025

    // 1) Öncelik: next=60 (önümüzdeki X maç)
    // 2) Eğer boş dönerse: ayın tüm maçları (from/to)
    // 3) Eğer boş dönerse: sezonun tüm upcoming (league+season)
    const { start: monthStart, end: monthEnd } = monthRangeFor(0);
    const attempts = [
      { name: "next_60", url: `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&next=60` },
      { name: "month_range", url: `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&from=${monthStart}&to=${monthEnd}` },
      { name: "season_all", url: `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}` },
    ];

    let chosen = null;
    let data = null;

    for (const a of attempts) {
      console.log("Trying:", a.name, a.url);
      const r = await fetchFn(a.url, { headers: { "x-apisports-key": apiKey } });
      const j = await r.json().catch(() => null);
      if (j && Array.isArray(j.response) && j.response.length > 0) {
        chosen = a;
        data = j;
        console.log("Chosen:", a.name, "count:", j.response.length);
        break;
      } else {
        console.log("No data for:", a.name, "respLen:", j && Array.isArray(j.response) ? j.response.length : "invalid");
      }
    }

    if (!chosen) {
      // hiçbir denemede veri yok
      return res.json({ ok: true, message: "0 Süper Lig maçı senkronize edildi.", tried: attempts.map(a => a.name) });
    }

    const fetchedIds = new Set();
    let totalAdded = 0;
    const nowIso = new Date().toISOString();

    for (const ev of data.response) {
      const fixture = ev.fixture || {};
      const teams = ev.teams || {};
      const league = ev.league || {};

      const id = String(fixture.id || fixture.fixture_id || (ev.id || Math.random().toString(36).slice(2)));
      fetchedIds.add(id);

      const matchData = {
        home: teams.home?.name || "Bilinmiyor",
        away: teams.away?.name || "Bilinmiyor",
        homeLogo: teams.home?.logo || "",
        awayLogo: teams.away?.logo || "",
        date: fixture.date || null,
        league: league.name || "",
        time: (fixture.date ? new Date(fixture.date).toISOString() : null),
        source: "api-football",
        fetchedAt: nowIso,
      };

      // merge:true ile kullanıcı oylarını koruyoruz
      await db.collection("matches").doc(id).set(matchData, { merge: true });
      totalAdded++;
    }

    // Opsiyonel temizlik: ?cleanup=true ile api-football kaynaklı eski maçları sil
    if (req.query.cleanup === "true") {
      console.log("Cleanup requested -> removing api-football docs not in fetched set");
      const snap = await db.collection("matches").where("source", "==", "api-football").get();
      for (const d of snap.docs) {
        if (!fetchedIds.has(d.id)) {
          // Uyarı: bu silme işlemi votes/popularPrediction gibi alanları da kaldırır.
          await db.collection("matches").doc(d.id).delete();
          console.log("Deleted stale doc:", d.id);
        }
      }
    }

    return res.json({ ok: true, message: `${totalAdded} Süper Lig maçı senkronize edildi.`, used: chosen.name, tried: attempts.map(a=>a.name) });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
};
