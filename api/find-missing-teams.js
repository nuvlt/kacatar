import admin from "firebase-admin";

let app;
if (!admin.apps.length) {
  app = admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
} else {
  app = admin.app();
}

const db = admin.firestore();

function normalizeName(name) {
  return name
    ?.toString()
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöç\s]/gi, "")
    .replace(/\b(fc|cf|sc|ac|afc|club|deportivo|calcio|athletic|sporting|real|olympique|atleti)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSimilar(a, b) {
  if (!a || !b) return false;
  a = normalizeName(a);
  b = normalizeName(b);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // man city vs manchester city gibi
  const aFirst = a.split(" ")[0];
  const bFirst = b.split(" ")[0];
  if (aFirst && bFirst && (aFirst === bFirst)) return true;
  return false;
}

function isValidLogoValue(v) {
  if (!v && v !== "") return false;
  const s = String(v).trim();
  if (!s) return false;
  const sl = s.toLowerCase();
  if (sl === "null" || sl === "undefined" || sl === "n/a") return false;
  // Basit URL kontrol
  if (/^https?:\/\/.+\.(png|jpg|jpeg|svg|gif|webp)(\?.*)?$/i.test(s)) return true;
  // bazen direkt cdn linkleri veya img proxyler olabilir (uzantı yok) -> kabul etme, daha güvenli olsun:
  // return /^https?:\/\/.+/.test(s);
  return false;
}

export default async function handler(req, res) {
  try {
    const matchesSnap = await db.collection("matches").get();
    const teamsSnap = await db.collection("teams").get();

    const teams = teamsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || data.teamName || data.title || "",
        // birden fazla olası alanı kontrol edelim
        logo: data.logo || data.badge || data.crest || data.strBadge || data.image || "",
        raw: data,
      };
    });

    const missingSet = new Set();
    const debugMatches = []; // eşleşen örnekleri görebilmek için

    matchesSnap.forEach(doc => {
      const m = doc.data();
      const home = m.homeTeam || m.home || m.home_name || m.homeTeamName;
      const away = m.awayTeam || m.away || m.away_name || m.awayTeamName;
      [home, away].forEach(teamName => {
        if (!teamName) return;

        // teams koleksiyonunda isme göre uygun bir takım var mı ve logosu geçerli mi?
        let matched = false;
        for (const t of teams) {
          if (isSimilar(t.name, teamName)) {
            const okLogo = isValidLogoValue(t.logo);
            if (okLogo) {
              matched = true;
              debugMatches.push({
                matchTeam: teamName,
                matchedTeamId: t.id,
                matchedTeamName: t.name,
                logo: t.logo,
              });
              break;
            } else {
              // Bu takım bulundu ama logosu geçersiz; treat as missing
              matched = false;
              // don't break; maybe başka team record matches with valid logo
            }
          }
        }

        if (!matched) missingSet.add(teamName);
      });
    });

    // Opsiyonel: missing listesini firestore'a kaydet (inceleme/manuel düzeltme için)
    const missingList = [...missingSet].sort();
    try {
      await db.collection("missing_teams").add({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        count: missingList.length,
        missing: missingList,
      });
    } catch (e) {
      console.warn("missing_teams write failed:", e.message || e);
    }

    // debug: eşleşen örnekleri console'a bastıralım (Vercel logs'da görürsün)
    console.info("DEBUG matched examples (first 10):", debugMatches.slice(0, 10));

    res.status(200).json({
      ok: true,
      message: "Eksik logo tespiti tamamlandı",
      count: missingList.length,
      missing: missingList,
      debugSampleMatches: debugMatches.slice(0, 10),
    });
  } catch (err) {
    console.error("Error in find-missing-teams:", err);
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}
