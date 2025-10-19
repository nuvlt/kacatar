// api/force-update-match-logos.js
// Mevcut tüm maçların logolarını logo-service.js'teki güncel URL'lerden günceller

import admin from "firebase-admin";

if (!admin.apps.length) {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (svc) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(svc)),
    });
  }
}
const db = admin.firestore();

// logo-service.js'teki MANUAL_LOGO_URLS'i buraya da ekleyelim
const MANUAL_LOGO_URLS = {
  // Büyük kulüpler
  "psg": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/100px-Paris_Saint-Germain_F.C..svg.png",
  "paris saint-germain": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/100px-Paris_Saint-Germain_F.C..svg.png",
  "paris saint germain": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/100px-Paris_Saint-Germain_F.C..svg.png",
  "atleti": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f4/Atletico_Madrid_2017_logo.svg/100px-Atletico_Madrid_2017_logo.svg.png",
  "atletico madrid": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f4/Atletico_Madrid_2017_logo.svg/100px-Atletico_Madrid_2017_logo.svg.png",
  "barça": "https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/100px-FC_Barcelona_%28crest%29.svg.png",
  "barcelona": "https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/100px-FC_Barcelona_%28crest%29.svg.png",
  "inter": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/FC_Internazionale_Milano_2021.svg/100px-FC_Internazionale_Milano_2021.svg.png",
  "augsburg": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/FC_Augsburg_logo.svg/100px-FC_Augsburg_logo.svg.png",
  "leverkusen": "https://upload.wikimedia.org/wikipedia/en/thumb/5/59/Bayer_04_Leverkusen_logo.svg/100px-Bayer_04_Leverkusen_logo.svg.png",
  "marseille": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Olympique_Marseille_logo.svg/100px-Olympique_Marseille_logo.svg.png",
  "nice": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a5/OGC_Nice_logo.svg/100px-OGC_Nice_logo.svg.png",
  "tottenham": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b4/Tottenham_Hotspur.svg/100px-Tottenham_Hotspur.svg.png",
  "west ham": "https://upload.wikimedia.org/wikipedia/en/thumb/c/c2/West_Ham_United_FC_logo.svg/100px-West_Ham_United_FC_logo.svg.png",
  "espanyol": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/RCD_Espanyol_logo.svg/100px-RCD_Espanyol_logo.svg.png",
  "rayo vallecano": "https://upload.wikimedia.org/wikipedia/en/thumb/c/c3/Rayo_Vallecano_logo.svg/100px-Rayo_Vallecano_logo.svg.png",
  "real betis": "https://upload.wikimedia.org/wikipedia/en/thumb/1/13/Real_Betis_logo_2019.svg/100px-Real_Betis_logo_2019.svg.png",
  "mallorca": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/RCD_Mallorca_logo.svg/100px-RCD_Mallorca_logo.svg.png",
  "osasuna": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d0/Club_Atletico_Osasuna_logo.svg/100px-Club_Atletico_Osasuna_logo.svg.png",
  "celta": "https://upload.wikimedia.org/wikipedia/en/thumb/1/12/RC_Celta_de_Vigo_logo.svg/100px-RC_Celta_de_Vigo_logo.svg.png",
  "alavés": "https://upload.wikimedia.org/wikipedia/en/thumb/7/70/Deportivo_Alaves_logo.svg/100px-Deportivo_Alaves_logo.svg.png",
  "verona": "https://upload.wikimedia.org/wikipedia/en/thumb/4/42/Hellas_Verona_FC_logo.svg/100px-Hellas_Verona_FC_logo.svg.png",
  "ac pisa": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Pisa_Sporting_Club_logo.svg/100px-Pisa_Sporting_Club_logo.svg.png",
  "pisa": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Pisa_Sporting_Club_logo.svg/100px-Pisa_Sporting_Club_logo.svg.png",
  
  // Fransız takımlar
  "auxerre": "https://upload.wikimedia.org/wikipedia/en/thumb/2/22/AJ_Auxerre_Logo.svg/100px-AJ_Auxerre_Logo.svg.png",
  "aj auxerre": "https://upload.wikimedia.org/wikipedia/en/thumb/2/22/AJ_Auxerre_Logo.svg/100px-AJ_Auxerre_Logo.svg.png",
  "le havre": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Le_Havre_AC_logo_%282024%29.svg/100px-Le_Havre_AC_logo_%282024%29.svg.png",
  "le havre ac": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Le_Havre_AC_logo_%282024%29.svg/100px-Le_Havre_AC_logo_%282024%29.svg.png",
  "lorient": "https://upload.wikimedia.org/wikipedia/fr/thumb/d/db/FC_Lorient_2010_logo.svg/100px-FC_Lorient_2010_logo.svg.png",
  "fc lorient": "https://upload.wikimedia.org/wikipedia/fr/thumb/d/db/FC_Lorient_2010_logo.svg/100px-FC_Lorient_2010_logo.svg.png",
  "angers": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Logo_Angers_SCO_2020.svg/100px-Logo_Angers_SCO_2020.svg.png",
  "angers sco": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Logo_Angers_SCO_2020.svg/100px-Logo_Angers_SCO_2020.svg.png",
  "toulouse": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Toulouse_FC_2018_logo.svg/100px-Toulouse_FC_2018_logo.svg.png",
  "toulouse fc": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Toulouse_FC_2018_logo.svg/100px-Toulouse_FC_2018_logo.svg.png",
  "brest": "https://upload.wikimedia.org/wikipedia/en/thumb/9/90/Stade_Brestois_29_logo.svg/100px-Stade_Brestois_29_logo.svg.png",
  "stade brestois": "https://upload.wikimedia.org/wikipedia/en/thumb/9/90/Stade_Brestois_29_logo.svg/100px-Stade_Brestois_29_logo.svg.png",
  "rc lens": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/RC_Lens_logo.svg/100px-RC_Lens_logo.svg.png",
  "lens": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/RC_Lens_logo.svg/100px-RC_Lens_logo.svg.png",
  "nantes": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/FC_Nantes_logo.svg/100px-FC_Nantes_logo.svg.png",
  "fc nantes": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/FC_Nantes_logo.svg/100px-FC_Nantes_logo.svg.png",
  "stade rennais": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/Stade_Rennais_F.C._logo.svg/100px-Stade_Rennais_F.C._logo.svg.png",
  "rennes": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/Stade_Rennais_F.C._logo.svg/100px-Stade_Rennais_F.C._logo.svg.png",
  "strasbourg": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Racing_Club_Strasbourg_Alsace_%28logo%2C_2020%29.svg/100px-Racing_Club_Strasbourg_Alsace_%28logo%2C_2020%29.svg.png",
  "rc strasbourg": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Racing_Club_Strasbourg_Alsace_%28logo%2C_2020%29.svg/100px-Racing_Club_Strasbourg_Alsace_%28logo%2C_2020%29.svg.png",
  "paris fc": "https://upload.wikimedia.org/wikipedia/en/thumb/5/5e/Paris_FC_logo.svg/100px-Paris_FC_logo.svg.png",
  "lille": "https://upload.wikimedia.org/wikipedia/en/thumb/6/68/Lille_OSC_%282018%29_logo.svg/100px-Lille_OSC_%282018%29_logo.svg.png",
  "lille osc": "https://upload.wikimedia.org/wikipedia/en/thumb/6/68/Lille_OSC_%282018%29_logo.svg/100px-Lille_OSC_%282018%29_logo.svg.png",
  "lyon": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e2/Olympique_Lyonnais_logo.svg/100px-Olympique_Lyonnais_logo.svg.png",
  "olympique lyon": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e2/Olympique_Lyonnais_logo.svg/100px-Olympique_Lyonnais_logo.svg.png",
  "monaco": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Logo_AS_Monaco_FC_%282013%29.svg/100px-Logo_AS_Monaco_FC_%282013%29.svg.png",
  "as monaco": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Logo_AS_Monaco_FC_%282013%29.svg/100px-Logo_AS_Monaco_FC_%282013%29.svg.png",
  
  // Alman takımlar - düzeltilmiş URL'ler
  "bremen": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/SV-Werder-Bremen-Logo.svg/100px-SV-Werder-Bremen-Logo.svg.png",
  "werder bremen": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/SV-Werder-Bremen-Logo.svg/100px-SV-Werder-Bremen-Logo.svg.png",
  "frankfurt": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Eintracht_Frankfurt_Logo.svg/100px-Eintracht_Frankfurt_Logo.svg.png",
  "eintracht frankfurt": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Eintracht_Frankfurt_Logo.svg/100px-Eintracht_Frankfurt_Logo.svg.png",
  "hoffenheim": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Logo_TSG_Hoffenheim.svg/100px-Logo_TSG_Hoffenheim.svg.png",
  "tsg hoffenheim": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Logo_TSG_Hoffenheim.svg/100px-Logo_TSG_Hoffenheim.svg.png",
  "stuttgart": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/VfB_Stuttgart_1893_Logo.svg/100px-VfB_Stuttgart_1893_Logo.svg.png",
  "vfb stuttgart": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/VfB_Stuttgart_1893_Logo.svg/100px-VfB_Stuttgart_1893_Logo.svg.png",
  "union berlin": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/FC_Union_Berlin_logo.svg/100px-FC_Union_Berlin_logo.svg.png",
  "fc union berlin": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/FC_Union_Berlin_logo.svg/100px-FC_Union_Berlin_logo.svg.png",
  "wolfsburg": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Logo-VfL-Wolfsburg.svg/100px-Logo-VfL-Wolfsburg.svg.png",
  "vfl wolfsburg": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Logo-VfL-Wolfsburg.svg/100px-Logo-VfL-Wolfsburg.svg.png",
  "m'gladbach": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Borussia_M%C3%B6nchengladbach_logo.svg/100px-Borussia_M%C3%B6nchengladbach_logo.svg.png",
  "borussia monchengladbach": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Borussia_M%C3%B6nchengladbach_logo.svg/100px-Borussia_M%C3%B6nchengladbach_logo.svg.png",
  "heidenheim": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/1._FC_Heidenheim_1846_logo.svg/100px-1._FC_Heidenheim_1846_logo.svg.png",
  "fc heidenheim": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/1._FC_Heidenheim_1846_logo.svg/100px-1._FC_Heidenheim_1846_logo.svg.png",
  "hsv": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/HSV-Logo.svg/100px-HSV-Logo.svg.png",
  "hamburger sv": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/HSV-Logo.svg/100px-HSV-Logo.svg.png",
  "st. pauli": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/FC_St._Pauli_logo.svg/100px-FC_St._Pauli_logo.svg.png",
  "fc st pauli": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/FC_St._Pauli_logo.svg/100px-FC_St._Pauli_logo.svg.png",
  "1. fc köln": "https://upload.wikimedia.org/wikipedia/en/thumb/1/19/1_FC_Koln_logo.svg/100px-1_FC_Koln_logo.svg.png",
  "fc koln": "https://upload.wikimedia.org/wikipedia/en/thumb/1/19/1_FC_Koln_logo.svg/100px-1_FC_Koln_logo.svg.png",
  
  // İngiliz takımlar
  "brighton": "https://upload.wikimedia.org/wikipedia/en/thumb/f/fd/Brighton_%26_Hove_Albion_logo.svg/100px-Brighton_%26_Hove_Albion_logo.svg.png",
  "brighton hove": "https://upload.wikimedia.org/wikipedia/en/thumb/f/fd/Brighton_%26_Hove_Albion_logo.svg/100px-Brighton_%26_Hove_Albion_logo.svg.png",
  "man united": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/Manchester_United_FC_crest.svg/100px-Manchester_United_FC_crest.svg.png",
  "manchester united": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/Manchester_United_FC_crest.svg/100px-Manchester_United_FC_crest.svg.png",
  "wolverhampton": "https://upload.wikimedia.org/wikipedia/en/thumb/f/fc/Wolverhampton_Wanderers.svg/100px-Wolverhampton_Wanderers.svg.png",
  "wolves": "https://upload.wikimedia.org/wikipedia/en/thumb/f/fc/Wolverhampton_Wanderers.svg/100px-Wolverhampton_Wanderers.svg.png",
};

// Takım adını normalize et
function normalizeTeamName(name) {
  if (!name) return null;
  return name.toLowerCase().trim();
}

// Logo URL'i bul
function findLogoUrl(teamName) {
  const normalized = normalizeTeamName(teamName);
  
  // Manuel URL'lerde ara
  if (MANUAL_LOGO_URLS[normalized]) {
    return MANUAL_LOGO_URLS[normalized];
  }
  
  // Bazı varyasyonları dene
  const variants = [
    normalized,
    normalized.replace(/\s+fc$/i, ""),
    normalized.replace(/\s+cf$/i, ""),
    normalized.replace(/^fc\s+/i, ""),
    normalized.replace(/\s+/g, " "),
  ];
  
  for (const variant of variants) {
    if (MANUAL_LOGO_URLS[variant]) {
      return MANUAL_LOGO_URLS[variant];
    }
  }
  
  return null;
}

export default async function handler(req, res) {
  try {
    const { key } = req.query;
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    console.log("\n🔄 Tüm maçların logoları güncelleniyor...\n");

    const matchesSnapshot = await db.collection("matches").get();
    let updated = 0;
    let unchanged = 0;
    let notFound = [];

    for (const doc of matchesSnapshot.docs) {
      const data = doc.data();
      const home = data.home || data.homeTeam;
      const away = data.away || data.awayTeam;
      
      if (!home || !away) {
        console.log(`⚠️ Eksik takım bilgisi: ${doc.id}`);
        continue;
      }

      // Logo URL'lerini bul
      const homeLogo = findLogoUrl(home);
      const awayLogo = findLogoUrl(away);

      // Değişiklik var mı?
      if (homeLogo !== data.homeLogo || awayLogo !== data.awayLogo) {
        await doc.ref.update({
          homeLogo: homeLogo || "",
          awayLogo: awayLogo || "",
        });
        
        console.log(`✅ Güncellendi: ${home} (${homeLogo ? "✓" : "✗"}) vs ${away} (${awayLogo ? "✓" : "✗"})`);
        updated++;
      } else {
        unchanged++;
      }

      // Eksikleri track et
      if (!homeLogo) notFound.push(home);
      if (!awayLogo) notFound.push(away);
    }

    // Unique not found
    const uniqueNotFound = [...new Set(notFound)];

    const result = {
      ok: true,
      message: `✅ Logo güncelleme tamamlandı`,
      stats: {
        totalMatches: matchesSnapshot.size,
        updated: updated,
        unchanged: unchanged,
        missingLogos: uniqueNotFound.length,
      },
      missingTeams: uniqueNotFound.length > 0 ? uniqueNotFound.sort() : undefined,
      timestamp: new Date().toISOString(),
    };

    console.log("\n📊 Sonuç:", JSON.stringify(result, null, 2));
    return res.status(200).json(result);

  } catch (error) {
    console.error("❌ Force update error:", error);
    return res.status(500).json({
      error: error.message || String(error),
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}
