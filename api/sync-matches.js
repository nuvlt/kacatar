// api/sync-matches.js
const admin = require("firebase-admin");

// Use built-in fetch available in Vercel/Node 18+; avoid node-fetch ESM issues.
const fetchFn = (typeof fetch !== "undefined") ? fetch : (...args) => import("node-fetch").then(m => m.default(...args));

if (!admin.apps.length) {
  // Expect FIREBASE_SERVICE_ACCOUNT env to be JSON string
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) {
    console.error("FIREBASE_SERVICE_ACCOUNT missing");
  } else {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(svc)),
    });
  }
}
const db = admin.firestore();

function cleanName(name) {
  if (!name) return "";
  return String(name)
    .replace(/\s+FC$|\s+CF$|\s+AC$|\s+SC$|\s+UD$|\s+CF$|\s+ACF$|\s+SSC$|\s+FC\.$/i, "")
    .replace(/[^\w\s\-\&\.çğıöşüÇĞİÖŞÜ]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function sportmonksLogoLookup(name, key) {
  if (!key) return null;
  const q = encodeURIComponent(cleanName(name));
  const url = `https://api.sportmonks.com/v3/football/teams/search/${q}?api_token=${key}`;
  try {
    const r = await fetchFn(url);
    if (!r.ok) return null;
    const j = await r.json();
    if (j && j.data && j.data.length) {
      const team = j.data[0];
      // sportmonks may use different fields
      return team.image_path || team.logo || team.badge || null;
    }
  } catch (e) {
    console.warn("SportMonks lookup error:", e.message);
  }
  return null;
}

async function theSportsDbLookup(name, key) {
  if (!key) return null;
  const q = encodeURIComponent(cleanName(name));
  const url = `https://www.thesportsdb.com/api/v1/json/${key}/searchteams.php?t=${q}`;
  try {
    const r = await fetchFn(url);
    // sometimes TheSportsDB returns HTML (rate-limit / error) => handle gracefully
    const text = await r.text();
    if (text.startsWith("<")) {
      console.warn("TheSportsDB returned HTML for", name);
      return null;
    }
    const j = JSON.parse(text);
    if (j && j.teams && j.teams.length) {
      const t = j.teams[0];
      return t.strTeamBadge || t.strTeamLogo || t.strBadge || null;
    }
  } catch (e) {
    console.warn("TheSportsDB lookup error:", e.message);
  }
  return null;
}

module.exports = async (req, res) => {
  try {
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
    const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
    const THESPORTSDB_KEY = process.env.THESPORTSDB_KEY;

    console.log("ENV CHECK", {
      FOOTBALL_API_KEY: !!FOOTBALL_API_KEY,
      SPORTMONKS_API_KEY: !!SPORTMONKS_API_KEY,
      THESPORTSDB_KEY: !!THESPORTSDB_KEY,
    });

    if (!FOOTBALL_API_KEY) {
      return res.status(500).json({ error: "FOOTBALL_API_KEY missing" });
    }

    // delete old matches -> keep only upcoming window
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // midnight today
    const to = new Date(from.getTime() + 10 * 24 * 60 * 60 * 1000); // today +10 days
    const dateFrom = from.toISOString().split("T")[0];
    const dateTo = to.toISOString().split("T")[0];

    // remove existing matches (optional: you can tweak selector to only remove older ones)
    // We will delete all docs in matches collection and rewrite — simpler and ensures no stale entries.
    console.info("🧹 Eski maçlar siliniyor...");
    const snap = await db.collection("matches").get();
    const batch = db.batch();
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.info("🧹 Eski maçlar silindi.");

    const competitions = ["PL", "PD", "SA", "BL1", "FL1"];
    let total = 0, foundLogos = 0, missingLogos = 0;

    for (const comp of competitions) {
      const url = `https://api.football-data.org/v4/matches?competitions=${comp}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      console.info("📡 Fetch:", url);
      const resp = await fetchFn(url, { headers: { "X-Auth-Token": FOOTBALL_API_KEY } });
      if (!resp.ok) {
        console.warn("Football-data returned non-ok for", comp, resp.status);
        continue;
      }
      const data = await resp.json();
      if (!data.matches || !Array.isArray(data.matches)) continue;

      for (const m of data.matches) {
        // football-data fields
        // prefer .homeTeam.name or .homeTeam.shortName
        const home = m.homeTeam?.shortName || m.homeTeam?.name || m.homeTeam?.tla || m.homeTeam?.id || "bilinmiyor";
        const away = m.awayTeam?.shortName || m.awayTeam?.name || m.awayTeam?.tla || m.awayTeam?.id || "bilinmiyor";
        const utcDate = m.utcDate || m.matchday || null;
        const time = utcDate ? new Date(utcDate).toISOString() : null;

        // try SportMonks first, then TheSportsDB
        let homeLogo = await sportmonksLogoLookup(home, SPORTMONKS_API_KEY);
        if (!homeLogo) homeLogo = await theSportsDbLookup(home, THESPORTSDB_KEY);
        if (homeLogo) foundLogos++; else missingLogos++;

        let awayLogo = await sportmonksLogoLookup(away, SPORTMONKS_API_KEY);
        if (!awayLogo) awayLogo = await theSportsDbLookup(away, THESPORTSDB_KEY);
        if (awayLogo) foundLogos++; else missingLogos++;

        // WRITE to Firestore — write both legacy fields and new fields for compatibility
        const docData = {
          competition: comp,
          date: utcDate, // legacy: used by some frontends
          time: time,
          league: comp,
          // legacy-friendly top-level fields
          home: home,
          away: away,
          homeLogo: homeLogo || "",
          awayLogo: awayLogo || "",
          // new nested schema
          homeTeam: home,
          awayTeam: away,
          logos: { home: homeLogo || null, away: awayLogo || null },
          syncedAt: new Date().toISOString(),
        };

        // Use id if available, else auto-id
        const docId = m.id || (`${comp}-${m.utcDate}-${home}-${away}`).replace(/\s+/g, "_");
        await db.collection("matches").doc(String(docId)).set(docData, { merge: true });

        console.info(`🟢 Firestore: ${home} vs ${away}`);
        total++;
      }
    }

    const result = { ok: true, message: `${total} maç senkronize edildi.`, logos: { found: foundLogos, missing: missingLogos } };
    console.log("Result:", result);
    return res.status(200).json(result);
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
};
