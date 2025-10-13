// api/update-logos.js
const admin = require("firebase-admin");

const fetchFn = (typeof fetch !== "undefined") ? fetch : (...args) =>
  import("node-fetch").then(m => m.default(...args));

if (!admin.apps.length) {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) console.error("FIREBASE_SERVICE_ACCOUNT missing");
  else {
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
    const text = await r.text();
    if (text.startsWith("<")) return null;
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
    if (key !== process.env.SECRET_KEY)
      return res.status(403).json({ error: "Unauthorized" });

    const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
    const THESPORTSDB_KEY = process.env.THESPORTSDB_KEY;

    const matchesSnap = await db.collection("matches").get();
    let updated = 0, skipped = 0;

    for (const doc of matchesSnap.docs) {
      const data = doc.data();
      const home = data.home || data.homeTeam;
      const away = data.away || data.awayTeam;

      let updatedFields = {};

      async function fillLogo(side, teamName) {
        const currentLogo = data[`${side}Logo`] || data.logos?.[side];
        if (currentLogo) return; // already has one

        let logo = await sportmonksLogoLookup(teamName, SPORTMONKS_API_KEY);
        if (!logo) logo = await theSportsDbLookup(teamName, THESPORTSDB_KEY);
        if (logo) {
          updatedFields[`${side}Logo`] = logo;
          if (!updatedFields.logos) updatedFields.logos = {};
          updatedFields.logos[side] = logo;
        }
      }

      await fillLogo("home", home);
      await fillLogo("away", away);

      if (Object.keys(updatedFields).length > 0) {
        await doc.ref.update(updatedFields);
        console.info(`🟢 Güncellendi: ${home} - ${away}`);
        updated++;
      } else {
        skipped++;
      }
    }

    res.json({
      ok: true,
      message: `Logolar güncellendi. ${updated} belge değişti, ${skipped} atlandı.`,
    });
  } catch (err) {
    console.error("update-logos error:", err);
    res.status(500).json({ error: err.message });
  }
};
