// api/sync-matches.js
const admin = require("firebase-admin");

// Use built-in fetch available in Vercel/Node 18+; fallback to dynamic node-fetch import when needed
const fetchFn = (typeof fetch !== "undefined") ? fetch : (...args) => import("node-fetch").then(m => m.default(...args));

if (!admin.apps.length) {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) {
    console.error("FIREBASE_SERVICE_ACCOUNT missing");
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(svc)),
      });
    } catch (e) {
      console.error("FIREBASE init error:", e && e.message);
    }
  }
}
const db = admin.firestore();

// --- helpers ---
function cleanName(name) {
  if (!name) return "";
  return String(name)
    .replace(/\s+(FC|CF|AC|SC|UD|ACF|SSC|AF|AFC)\.?$/i, "") // common suffixes
    .replace(/[^\w\s\-\&\.çğıöşüÇĞİÖŞÜ]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function sportmonksLogoLookup(name, key) {
  if (!key || !name) return null;
  const q = encodeURIComponent(cleanName(name));
  // SportMonks has several endpoints depending on plan / version; try search endpoint pattern
  const url = `https://api.sportmonks.com/v3/football/teams/search/${q}?api_token=${key}`;
  try {
    const r = await fetchFn(url);
    if (!r.ok) return null;
    const j = await r.json();
    if (j && j.data && j.data.length) {
      const team = j.data[0];
      // different possible fields
      return team.image_path || team.logo || team.badge || team.logo_path || null;
    }
  } catch (e) {
    console.warn("SportMonks lookup error:", e && e.message);
  }
  return null;
}

async function theSportsDbLookup(name, key) {
  if (!key || !name) return null;
  const q = encodeURIComponent(cleanName(name));
  const url = `https://www.thesportsdb.com/api/v1/json/${key}/searchteams.php?t=${q}`;
  try {
    const r = await fetchFn(url);
    // TheSportsDB sometimes returns HTML (rate-limit or error) -> handle gracefully
    const text = await r.text();
    if (!text) return null;
    if (text.trim().startsWith("<")) {
      console.warn("TheSportsDB returned HTML for", name);
      return null;
    }
    const j = JSON.parse(text);
    if (j && j.teams && j.teams.length) {
      const t = j.teams[0];
      return t.strTeamBadge || t.strTeamLogo || t.strBadge || null;
    }
  } catch (e) {
    console.warn("TheSportsDB lookup error:", e && e.message);
  }
  return null;
}

// --- main handler ---
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

    // date window: today .. today + 10 days (change if you want 3/5 days)
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(from.getTime() + (10 * 24 * 60 * 60 * 1000));
    const dateFrom = from.toISOString().split("T")[0];
    const dateTo = to.toISOString().split("T")[0];

    // --- delete previous matches (keeps data consistent) ---
    console.info("🧹 Eski maçlar siliniyor...");
    const snap = await db.collection("matches").get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    console.info("🧹 Eski maçlar silindi.");

    const competitions = ["PL", "PD", "SA", "BL1", "FL1"]; // Premier, LaLiga, SerieA, Bundesliga, Ligue1
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
        // team names (prefer shortName -> name)
        const home = m.homeTeam?.shortName || m.homeTeam?.name || m.homeTeam?.tla || (m.homeTeam && m.homeTeam.id) || "bilinmiyor";
        const away = m.awayTeam?.shortName || m.awayTeam?.name || m.awayTeam?.tla || (m.awayTeam && m.awayTeam.id) || "bilinmiyor";
        const utcDate = m.utcDate || null;
        const time = utcDate ? new Date(utcDate).toISOString() : null;

        // Lookup logos: SportMonks first, then TheSportsDB
        let homeLogo = null, awayLogo = null;
        try {
          homeLogo = SPORTMONKS_API_KEY ? await sportmonksLogoLookup(home, SPORTMONKS_API_KEY) : null;
          if (!homeLogo && THESPORTSDB_KEY) homeLogo = await theSportsDbLookup(home, THESPORTSDB_KEY);
        } catch (e) {
          console.warn("Home logo lookup error:", e && e.message);
        }
        if (homeLogo) foundLogos++; else missingLogos++;

        try {
          awayLogo = SPORTMONKS_API_KEY ? await sportmonksLogoLookup(away, SPORTMONKS_API_KEY) : null;
          if (!awayLogo && THESPORTSDB_KEY) awayLogo = await theSportsDbLookup(away, THESPORTSDB_KEY);
        } catch (e) {
          console.warn("Away logo lookup error:", e && e.message);
        }
        if (awayLogo) foundLogos++; else missingLogos++;

        const docData = {
          competition: comp,
          date: utcDate,
          time: time,
          league: comp,
          home: home,
          away: away,
          homeLogo: homeLogo || "",
          awayLogo: awayLogo || "",
          homeTeam: home,
          awayTeam: away,
          logos: { home: homeLogo || null, away: awayLogo || null },
          syncedAt: new Date().toISOString(),
        };

        const docId = (m.id) ? String(m.id) : (`${comp}-${utcDate || Date.now()}-${home}-${away}`).replace(/\s+/g, "_");
        await db.collection("matches").doc(docId).set(docData, { merge: true });

        console.info(`🟢 Firestore: ${home} vs ${away}`);
        total++;
      }
    }

    const result = { ok: true, message: `${total} maç senkronize edildi.`, logos: { found: foundLogos, missing: missingLogos } };
    console.log("Result:", result);
    return res.status(200).json(result);

  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
};
