// api/logo-service.js
// Logo bulma servisi - tüm API'leri yönetir

// Rate limit koruması için delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Manuel logo URL'leri (API'lerde bulunamayan takımlar için)
const MANUAL_LOGO_URLS = {
  // Büyük kulüpler
  "psg": "https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg",
  "paris saint-germain": "https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg",
  "paris saint germain": "https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg",
  
  "atleti": "https://upload.wikimedia.org/wikipedia/en/f/f4/Atletico_Madrid_2017_logo.svg",
  "atletico madrid": "https://upload.wikimedia.org/wikipedia/en/f/f4/Atletico_Madrid_2017_logo.svg",
  
  "barça": "https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg",
  "barcelona": "https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg",
  "fc barcelona": "https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg",
  
  "bayern": "https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg",
  "bayern munich": "https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg",
  
  "man united": "https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg",
  "manchester united": "https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg",
  
  "inter": "https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg",
  "inter milan": "https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg",
  
  // Fransız kulüpler
  "marseille": "https://upload.wikimedia.org/wikipedia/commons/d/d8/Olympique_Marseille_logo.svg",
  "olympique marseille": "https://upload.wikimedia.org/wikipedia/commons/d/d8/Olympique_Marseille_logo.svg",
  
  "lyon": "https://upload.wikimedia.org/wikipedia/en/e/e2/Olympique_Lyonnais_logo.svg",
  "olympique lyon": "https://upload.wikimedia.org/wikipedia/en/e/e2/Olympique_Lyonnais_logo.svg",
  
  "monaco": "https://upload.wikimedia.org/wikipedia/commons/c/c0/Logo_AS_Monaco_FC_%282013%29.svg",
  "as monaco": "https://upload.wikimedia.org/wikipedia/commons/c/c0/Logo_AS_Monaco_FC_%282013%29.svg",
  
  "lille": "https://upload.wikimedia.org/wikipedia/en/6/68/Lille_OSC_logo_%282018%29.svg",
  "lille osc": "https://upload.wikimedia.org/wikipedia/en/6/68/Lille_OSC_logo_%282018%29.svg",
  
  "nice": "https://upload.wikimedia.org/wikipedia/en/a/a5/OGC_Nice_logo.svg",
  "ogc nice": "https://upload.wikimedia.org/wikipedia/en/a/a5/OGC_Nice_logo.svg",
  
  "nantes": "https://upload.wikimedia.org/wikipedia/commons/8/8f/FC_Nantes_logo.svg",
  "fc nantes": "https://upload.wikimedia.org/wikipedia/commons/8/8f/FC_Nantes_logo.svg",
  
  "rc lens": "https://upload.wikimedia.org/wikipedia/en/d/d3/RC_Lens_logo.svg",
  "lens": "https://upload.wikimedia.org/wikipedia/en/d/d3/RC_Lens_logo.svg",
  
  "stade rennais": "https://upload.wikimedia.org/wikipedia/en/a/a2/Stade_Rennais_F.C._logo.svg",
  "rennes": "https://upload.wikimedia.org/wikipedia/en/a/a2/Stade_Rennais_F.C._logo.svg",
  
  "strasbourg": "https://upload.wikimedia.org/wikipedia/commons/7/77/Racing_Club_Strasbourg_Alsace_%28logo%2C_2020%29.svg",
  "rc strasbourg": "https://upload.wikimedia.org/wikipedia/commons/7/77/Racing_Club_Strasbourg_Alsace_%28logo%2C_2020%29.svg",
  
  "toulouse": "https://upload.wikimedia.org/wikipedia/commons/5/56/Toulouse_FC_2018_logo.svg",
  "toulouse fc": "https://upload.wikimedia.org/wikipedia/commons/5/56/Toulouse_FC_2018_logo.svg",
  
  "angers sco": "https://upload.wikimedia.org/wikipedia/en/3/30/Angers_SCO_%28logo%2C_2021%29.svg",
  "angers": "https://upload.wikimedia.org/wikipedia/en/3/30/Angers_SCO_%28logo%2C_2021%29.svg",
  
  "auxerre": "https://upload.wikimedia.org/wikipedia/en/2/22/AJ_Auxerre_Logo.svg",
  "aj auxerre": "https://upload.wikimedia.org/wikipedia/en/2/22/AJ_Auxerre_Logo.svg",
  
  "brest": "https://upload.wikimedia.org/wikipedia/en/9/90/Stade_Brestois_29_logo.svg",
  "stade brestois": "https://upload.wikimedia.org/wikipedia/en/9/90/Stade_Brestois_29_logo.svg",
  
  "le havre": "https://upload.wikimedia.org/wikipedia/commons/8/8c/Le_Havre_AC_logo.svg",
  "le havre ac": "https://upload.wikimedia.org/wikipedia/commons/8/8c/Le_Havre_AC_logo.svg",
  
  "paris fc": "https://upload.wikimedia.org/wikipedia/en/5/5e/Paris_FC_logo_%282020%29.svg",
  
  "lorient": "https://upload.wikimedia.org/wikipedia/commons/d/db/FC_Lorient_Logo.svg",
  "fc lorient": "https://upload.wikimedia.org/wikipedia/commons/d/db/FC_Lorient_Logo.svg",
  
  // Alman kulüpler
  "leverkusen": "https://upload.wikimedia.org/wikipedia/en/5/59/Bayer_04_Leverkusen_logo.svg",
  "bayer leverkusen": "https://upload.wikimedia.org/wikipedia/en/5/59/Bayer_04_Leverkusen_logo.svg",
  
  "bremen": "https://upload.wikimedia.org/wikipedia/commons/b/be/SV-Werder-Bremen-Logo.svg",
  "werder bremen": "https://upload.wikimedia.org/wikipedia/commons/b/be/SV-Werder-Bremen-Logo.svg",
  
  "frankfurt": "https://upload.wikimedia.org/wikipedia/commons/0/04/Eintracht_Frankfurt_Logo.svg",
  "eintracht frankfurt": "https://upload.wikimedia.org/wikipedia/commons/0/04/Eintracht_Frankfurt_Logo.svg",
  
  "m'gladbach": "https://upload.wikimedia.org/wikipedia/commons/8/81/Borussia_M%C3%B6nchengladbach_logo.svg",
  "borussia monchengladbach": "https://upload.wikimedia.org/wikipedia/commons/8/81/Borussia_M%C3%B6nchengladbach_logo.svg",
  
  "augsburg": "https://upload.wikimedia.org/wikipedia/en/2/2a/FC_Augsburg_logo.svg",
  "fc augsburg": "https://upload.wikimedia.org/wikipedia/en/2/2a/FC_Augsburg_logo.svg",
  
  "heidenheim": "https://upload.wikimedia.org/wikipedia/commons/3/34/1._FC_Heidenheim_1846_logo.svg",
  "fc heidenheim": "https://upload.wikimedia.org/wikipedia/commons/3/34/1._FC_Heidenheim_1846_logo.svg",
  
  "hoffenheim": "https://upload.wikimedia.org/wikipedia/commons/e/e7/TSG_1899_Hoffenheim_logo.svg",
  "tsg hoffenheim": "https://upload.wikimedia.org/wikipedia/commons/e/e7/TSG_1899_Hoffenheim_logo.svg",
  
  "stuttgart": "https://upload.wikimedia.org/wikipedia/commons/e/eb/VfB_Stuttgart_1893_Logo.svg",
  "vfb stuttgart": "https://upload.wikimedia.org/wikipedia/commons/e/eb/VfB_Stuttgart_1893_Logo.svg",
  
  "union berlin": "https://upload.wikimedia.org/wikipedia/commons/e/e9/FC_Union_Berlin_logo.svg",
  "fc union berlin": "https://upload.wikimedia.org/wikipedia/commons/e/e9/FC_Union_Berlin_logo.svg",
  
  "wolfsburg": "https://upload.wikimedia.org/wikipedia/commons/f/f3/Logo-VfL-Wolfsburg.svg",
  "vfl wolfsburg": "https://upload.wikimedia.org/wikipedia/commons/f/f3/Logo-VfL-Wolfsburg.svg",
  
  "hsv": "https://upload.wikimedia.org/wikipedia/commons/6/66/HSV-Logo.svg",
  "hamburger sv": "https://upload.wikimedia.org/wikipedia/commons/6/66/HSV-Logo.svg",
  
  "st. pauli": "https://upload.wikimedia.org/wikipedia/commons/e/e9/FC_St._Pauli_logo.svg",
  "fc st pauli": "https://upload.wikimedia.org/wikipedia/commons/e/e9/FC_St._Pauli_logo.svg",
  
  // İspanyol kulüpler
  "espanyol": "https://upload.wikimedia.org/wikipedia/en/a/a7/RCD_Espanyol_logo.svg",
  "rcd espanyol": "https://upload.wikimedia.org/wikipedia/en/a/a7/RCD_Espanyol_logo.svg",
  
  "rayo vallecano": "https://upload.wikimedia.org/wikipedia/en/c/c3/Rayo_Vallecano_logo.svg",
  
  "real betis": "https://upload.wikimedia.org/wikipedia/en/1/13/Real_Betis_logo.svg",
  
  "mallorca": "https://upload.wikimedia.org/wikipedia/en/e/e0/RCD_Mallorca_logo.svg",
  "rcd mallorca": "https://upload.wikimedia.org/wikipedia/en/e/e0/RCD_Mallorca_logo.svg",
  
  "osasuna": "https://upload.wikimedia.org/wikipedia/en/d/d0/Club_Atletico_Osasuna_logo.svg",
  "ca osasuna": "https://upload.wikimedia.org/wikipedia/en/d/d0/Club_Atletico_Osasuna_logo.svg",
  
  "celta": "https://upload.wikimedia.org/wikipedia/en/1/12/RC_Celta_de_Vigo_logo.svg",
  "celta vigo": "https://upload.wikimedia.org/wikipedia/en/1/12/RC_Celta_de_Vigo_logo.svg",
  
  "alavés": "https://upload.wikimedia.org/wikipedia/en/7/70/Deportivo_Alaves_logo.svg",
  "deportivo alaves": "https://upload.wikimedia.org/wikipedia/en/7/70/Deportivo_Alaves_logo.svg",
  
  // İngiliz kulüpler
  "tottenham": "https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg",
  "tottenham hotspur": "https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg",
  
  "west ham": "https://upload.wikimedia.org/wikipedia/en/c/c2/West_Ham_United_FC_logo.svg",
  "west ham united": "https://upload.wikimedia.org/wikipedia/en/c/c2/West_Ham_United_FC_logo.svg",
  
  "brighton hove": "https://upload.wikimedia.org/wikipedia/en/f/fd/Brighton_%26_Hove_Albion_logo.svg",
  "brighton": "https://upload.wikimedia.org/wikipedia/en/f/fd/Brighton_%26_Hove_Albion_logo.svg",
  
  // İtalyan kulüpler
  "verona": "https://upload.wikimedia.org/wikipedia/en/4/42/Hellas_Verona_FC_logo.svg",
  "hellas verona": "https://upload.wikimedia.org/wikipedia/en/4/42/Hellas_Verona_FC_logo.svg",
  
  "ac pisa": "https://upload.wikimedia.org/wikipedia/commons/4/47/Pisa_Sporting_Club_logo.svg",
  "pisa": "https://upload.wikimedia.org/wikipedia/commons/4/47/Pisa_Sporting_Club_logo.svg",
};

// Manuel isim düzeltmeleri (API'lerde farklı isimlerle kayıtlı takımlar)
const TEAM_NAME_MAPPINGS = {
  // İtalyan takımlar
  "como 1907": "Como",
  "ac milan": "Milan",
  "ac pisa": "Pisa",
  "hellas verona": "Hellas Verona",
  "verona": "Hellas Verona",
  "inter": "Inter Milan",
  "atalanta": "Atalanta BC",
  "fiorentina": "ACF Fiorentina",
  "lazio": "SS Lazio",
  "torino": "Torino FC",
  "parma": "Parma Calcio",
  "genoa": "Genoa CFC",
  "cremonese": "US Cremonese",
  "udinese": "Udinese Calcio",
  "sassuolo": "US Sassuolo",
  "juventus": "Juventus FC",
  
  // İspanyol takımlar
  "atleti": "Atletico Madrid",
  "barça": "Barcelona",
  "alavés": "Deportivo Alaves",
  "celta": "Celta Vigo",
  "espanyol": "Espanyol Barcelona",
  "mallorca": "RCD Mallorca",
  "osasuna": "CA Osasuna",
  "rayo vallecano": "Rayo Vallecano",
  "real betis": "Real Betis",
  
  // İngiliz takımlar
  "man united": "Manchester United",
  "tottenham": "Tottenham Hotspur",
  "west ham": "West Ham United",
  "wolverhampton": "Wolverhampton Wanderers",
  "brighton hove": "Brighton Hove Albion",
  
  // Fransız takımlar
  "psg": "Paris Saint-Germain",
  "marseille": "Olympique Marseille",
  "olympique lyon": "Lyon",
  "monaco": "AS Monaco",
  "lille": "Lille OSC",
  "nice": "OGC Nice",
  "nantes": "FC Nantes",
  "rc lens": "RC Lens",
  "stade rennais": "Rennes",
  "strasbourg": "RC Strasbourg",
  "toulouse": "Toulouse FC",
  "angers sco": "Angers SCO",
  "auxerre": "AJ Auxerre",
  "brest": "Stade Brestois",
  "le havre": "Le Havre AC",
  "fc metz": "FC Metz",
  "paris fc": "Paris FC",
  "lorient": "FC Lorient",
  
  // Alman takımlar
  "bayern": "Bayern Munich",
  "leverkusen": "Bayer Leverkusen",
  "bremen": "Werder Bremen",
  "frankfurt": "Eintracht Frankfurt",
  "m'gladbach": "Borussia Monchengladbach",
  "augsburg": "FC Augsburg",
  "heidenheim": "FC Heidenheim",
  "hoffenheim": "TSG Hoffenheim",
  "stuttgart": "VfB Stuttgart",
  "union berlin": "Union Berlin",
  "wolfsburg": "VfL Wolfsburg",
  "hsv": "Hamburger SV",
  "st. pauli": "FC St Pauli",
  "1. fc köln": "FC Koln",
};

// Takım adını temizle ve mapping uygula
export function cleanTeamName(name) {
  if (!name) return "";
  
  // Önce normalize et
  let cleaned = String(name)
    .replace(/\s+FC$|\s+CF$|\s+AC$|\s+SC$|\s+UD$|\s+ACF$|\s+SSC$/i, "")
    .replace(/[^\w\s\-\&\.çğıöşüÇĞİÖŞÜ]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  
  // Manuel mapping kontrol et
  const lowerName = cleaned.toLowerCase();
  if (TEAM_NAME_MAPPINGS[lowerName]) {
    return TEAM_NAME_MAPPINGS[lowerName];
  }
  
  return cleaned;
}

// 1️⃣ SportMonks API
async function trySportMonks(teamName, apiKey) {
  if (!apiKey) return null;
  
  try {
    const cleanName = cleanTeamName(teamName);
    const url = `https://api.sportmonks.com/v3/football/teams/search/${encodeURIComponent(cleanName)}?api_token=${apiKey}`;
    
    console.log(`🔍 SportMonks: ${teamName} → ${cleanName}`);
    const response = await fetch(url, { timeout: 8000 });
    
    if (!response.ok) {
      console.warn(`⚠️ SportMonks ${response.status}: ${teamName}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data?.data?.[0]) {
      const logo = data.data[0].image_path || data.data[0].logo || data.data[0].badge;
      if (logo) {
        console.log(`✅ SportMonks buldu: ${teamName}`);
        return logo;
      }
    }
  } catch (error) {
    console.warn(`❌ SportMonks error: ${teamName}`, error.message);
  }
  
  return null;
}

// 2️⃣ TheSportsDB API
async function trySportsDB(teamName, apiKey) {
  if (!apiKey) return null;
  
  try {
    await delay(300); // Rate limit koruması
    
    const cleanName = cleanTeamName(teamName);
    
    // Birden fazla isim varyasyonu dene
    const namesToTry = [
      cleanName,
      cleanName.replace(/-/g, " "), // Tire yerine boşluk
      cleanName.replace(/ /g, "-"),  // Boşluk yerine tire
    ];
    
    for (const searchName of namesToTry) {
      const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/searchteams.php?t=${encodeURIComponent(searchName)}`;
      
      console.log(`🔍 TheSportsDB: ${teamName} → ${searchName}`);
      const response = await fetch(url, { timeout: 8000 });
      
      const text = await response.text();
      
      // HTML dönerse (rate limit) skip et
      if (text.startsWith("<") || text.startsWith("<!")) {
        console.warn(`⚠️ TheSportsDB HTML döndü: ${teamName}`);
        continue;
      }
      
      const data = JSON.parse(text);
      
      if (data?.teams?.[0]) {
        const logo = data.teams[0].strTeamBadge || data.teams[0].strTeamLogo || data.teams[0].strBadge;
        if (logo) {
          console.log(`✅ TheSportsDB buldu: ${teamName} (${searchName})`);
          return logo;
        }
      }
      
      // Bulunamazsa bir sonraki varyasyonu dene
      await delay(200);
    }
    
  } catch (error) {
    console.warn(`❌ TheSportsDB error: ${teamName}`, error.message);
  }
  
  return null;
}

// 3️⃣ Google Custom Search API (son çare)
async function tryGoogleSearch(teamName, apiKey, cx) {
  if (!apiKey || !cx) return null;
  
  try {
    await delay(1000); // Google için daha uzun delay
    
    const cleanName = cleanTeamName(teamName);
    const query = `${cleanName} football club logo`;
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&searchType=image&num=1&key=${apiKey}&cx=${cx}`;
    
    console.log(`🔍 Google Search: ${teamName} → ${cleanName}`);
    const response = await fetch(url, { timeout: 10000 });
    
    if (!response.ok) {
      console.warn(`⚠️ Google ${response.status}: ${teamName}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data?.items?.[0]?.link) {
      console.log(`✅ Google buldu: ${teamName}`);
      return data.items[0].link;
    }
  } catch (error) {
    console.warn(`❌ Google error: ${teamName}`, error.message);
  }
  
  return null;
}

// Ana logo bulma fonksiyonu - sırayla tüm API'leri dener
export async function findTeamLogo(teamName, apiKeys) {
  const { sportmonks, thesportsdb, googleKey, googleCx } = apiKeys;
  
  console.log(`\n🎯 Logo aranıyor: ${teamName}`);
  
  // 0. Manuel URL'lere bak
  const lowerName = teamName.toLowerCase().trim();
  const cleanedLower = cleanTeamName(teamName).toLowerCase();
  
  if (MANUAL_LOGO_URLS[lowerName]) {
    console.log(`✅ Manuel URL bulundu: ${teamName}`);
    return MANUAL_LOGO_URLS[lowerName];
  }
  
  if (MANUAL_LOGO_URLS[cleanedLower]) {
    console.log(`✅ Manuel URL bulundu (cleaned): ${teamName}`);
    return MANUAL_LOGO_URLS[cleanedLower];
  }
  
  // 1. SportMonks (free plan'da çalışmıyor, skip)
  // let logo = await trySportMonks(teamName, sportmonks);
  // if (logo) return logo;
  
  // 2. TheSportsDB
  let logo = await trySportsDB(teamName, thesportsdb);
  if (logo) return logo;
  
  // 3. Google (son çare)
  logo = await tryGoogleSearch(teamName, googleKey, googleCx);
  if (logo) return logo;
  
  console.log(`❌ Logo bulunamadı: ${teamName}`);
  return null;
}
