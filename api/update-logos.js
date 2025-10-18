// api/logo-service.js
// Logo bulma servisi - tüm API'leri yönetir

// Rate limit koruması için delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Manuel logo URL'leri (PNG versiyonları - SVG'ler tarayıcıda sorun çıkarıyor)
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
  "real betis": "https://upload.wikimedia.org/wikipedia/en/thumb/1/13/Real_Betis_logo.svg/100px-Real_Betis_logo.svg.png",
  "mallorca": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e0/RCD_Mallorca_logo.svg/100px-RCD_Mallorca_logo.svg.png",
  "osasuna": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d0/Club_Atletico_Osasuna_logo.svg/100px-Club_Atletico_Osasuna_logo.svg.png",
  "celta": "https://upload.wikimedia.org/wikipedia/en/thumb/1/12/RC_Celta_de_Vigo_logo.svg/100px-RC_Celta_de_Vigo_logo.svg.png",
  "alavés": "https://upload.wikimedia.org/wikipedia/en/thumb/7/70/Deportivo_Alaves_logo.svg/100px-Deportivo_Alaves_logo.svg.png",
  "verona": "https://upload.wikimedia.org/wikipedia/en/thumb/4/42/Hellas_Verona_FC_logo.svg/100px-Hellas_Verona_FC_logo.svg.png",
  "ac pisa": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Pisa_Sporting_Club_logo.svg/100px-Pisa_Sporting_Club_logo.svg.png",
  "pisa": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Pisa_Sporting_Club_logo.svg/100px-Pisa_Sporting_Club_logo.svg.png",
};

// Manuel isim düzeltmeleri (API'lerde farklı isimlerle kayıtlı takımlar)
const TEAM_NAME_MAPPINGS = {
  // İtalyan takımlar
  "como 1907": "Como",
  "ac milan": "Milan",
  "ac pisa": "Pisa",
  "hellas verona": "Verona",
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
    await delay(300);
    
    const cleanName = cleanTeamName(teamName);
    const namesToTry = [
      cleanName,
      cleanName.replace(/-/g, " "),
      cleanName.replace(/ /g, "-"),
    ];
    
    for (const searchName of namesToTry) {
      const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/searchteams.php?t=${encodeURIComponent(searchName)}`;
      
      console.log(`🔍 TheSportsDB: ${teamName} → ${searchName}`);
      const response = await fetch(url, { timeout: 8000 });
      
      const text = await response.text();
      
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
    await delay(1000);
    
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
