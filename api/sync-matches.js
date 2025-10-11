const admin = require("firebase-admin");
const axios = require("axios");

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

function normalizeTeamName(name) {
  return name
    ?.replace(/\b(FC|CF|AC|SC|AFC|C\.F\.|S\.C\.|F\.C\.|Club)\b/gi, "")
    ?.replace(/[^a-zA-Z0-9\s]/g, "")
    ?.trim();
}

async function getTeamLogo(team) {
  if (!team || !team.name) {
    console.log("getTeamLogo: team invalid ->", team);
    return "";
  }

  // Eğer Football-Data'da crest alanı varsa önce onu dene
  if (team.crest) {
    console.log(`getTeamLogo: FootballData crest found for "${team.name}":`, team.crest);
    return team.crest;
  }

  // TheSportsDB fallback
  const key = process.env.THESPORTSDB_KEY || "3";
  const base = `https://www.thesportsdb.com/api/v1/json/${key}/searchteams.php`;

  const variants = [
    team.name,
    normalizeTeamName(team.name),
    normalizeTeamName(team.name)?.split(" ")[0],
  ].filter(Boolean);

  for (const name of variants) {
    const url = `${base}?t=${encodeURIComponent(name)}`;
    console.log("getTeamLogo: querying TheSportsDB ->", url);
    try {
      const r = await axios.get(url, { timeout: 10000 });
      if (r.data && r.data.teams && r.data.teams[0] && r.data.teams[0].strTeamBadge) {
        console.log(`getTeamLogo: found badge for "${team.name}" via "${name}":`, r.data.teams[0].strTeamBadge);
        return r.data.teams[0].strTeamBadge;
      } else {
        console.log(`getTeamLogo: No badge for "${team.name}" via variant "${name}". Response teams:`, Array.isArray(r.data?.teams) ? r.data.teams.map(t=>t.strTeam) : r.data?.teams);
      }
    } catch (err) {
      console.log(`getTeamLogo: request error for "${team.name}" via "${name}":`, err.message);
    }
  }

  console.log("getTeamLogo: final -> not found for", team.name);
  return "";
}

async function deleteOldMatches() {
  const now = new Date();
  const snapshot = await db.collection("matches").get();
  const batch = db.batch();
  let deleted = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    const matchDate = new Date(data.date);
    if (matchDate < now) {
      batch.delete(doc.ref);
      deleted++;
    }
  });

  if (deleted > 0) await batch.commit();
  return deleted;
}

module.exports = async (req, res) => {
  try {
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) return res.status(403).json({ error: "Unauthorized" });

    const competitions = ["PL", "PD", "SA", "BL1", "FL1"];
    const today = new Date();
    const from = today.toISOString().split("T")[0];
    const to = new Date(today.getTime() + 5 * 86400000).toISOString().split("T")[0];
    const apiKey = process.env.FOOTBALL_DATA_KEY;

    let allMatches = [];
    for (const comp of competitions) {
      const url = `https://api.football-data.org/v4/matches?competitions=${comp}&dateFrom=${from}&dateTo=${to}`;
      console.log("📡 Fetching", url);
      try {
        const r = await axios.get(url, { headers: { "X-Auth-Token": apiKey }, timeout: 12000 });
        const data = r.data;
        const count = Array.isArray(data.matches) ? data.matches.length : 0;
        console.log(`📥 ${comp} returned ${count} matches`);
        if (count > 0) {
          // log sample 3 matches raw (trim)
          console.log(`${comp} sample matches (up to 3):`, data.matches.slice(0,3).map(m => ({
            id: m.id, utcDate: m.utcDate, home: m.homeTeam?.name, away: m.awayTeam?.name
          })));
          allMatches = allMatches.concat(data.matches);
        } else {
          console.log(`${comp} -> no matches in range.`);
        }
      } catch (err) {
        console.error(`Error fetching ${comp}:`, err.message);
      }
    }

    console.log("Total matches collected:", allMatches.length);

    const deletedCount = await deleteOldMatches();
    console.log("Deleted old matches:", deletedCount);

    // If no matches returned, early respond but log it
    if (allMatches.length === 0) {
      console.log("No matches to process. Exiting.");
      return res.json({ ok: true, message: "No matches found in date range." });
    }

    // Process first N matches with verbose logging (test)
    for (let i = 0; i < Math.min(allMatches.length, 10); i++) {
      const match = allMatches[i];
      console.log(">>> Processing sample match:", { id: match.id, home: match.homeTeam?.name, away: match.awayTeam?.name, utcDate: match.utcDate });
      const homeLogo = await getTeamLogo(match.homeTeam);
      const awayLogo = await getTeamLogo(match.awayTeam);
      console.log("Sample logos resolved:", { id: match.id, homeLogo, awayLogo });
    }

    // Now write all matches (but log each write's logos)
    let totalAdded = 0;
    for (const match of allMatches) {
      const homeLogo = await getTeamLogo(match.homeTeam);
      const awayLogo = await getTeamLogo(match.awayTeam);

      const matchData = {
        home: match.homeTeam.name,
        away: match.awayTeam.name,
        homeLogo,
        awayLogo,
        date: match.utcDate,
        league: match.competition?.name || null,
        time: new Date(match.utcDate).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
      };

      console.log("Writing match to Firestore:", match.id, { homeLogo, awayLogo });
      await db.collection("matches").doc(String(match.id)).set(matchData, { merge: true });
      console.log("Wrote", match.id);
      totalAdded++;
    }

    return res.json({ ok: true, message: `${totalAdded} maç senkronize edildi (${deletedCount} eski maç silindi).` });

  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
};
