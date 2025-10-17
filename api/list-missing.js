// api/logo-service.js
// Logo bulma servisi - tüm API'leri yönetir

const fetchFn = (typeof fetch !== "undefined") ? fetch : (...args) => import("node-fetch").then(m => m.default(...args));

// Rate limit koruması için delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Manuel isim düzeltmeleri (API'lerde farklı isimlerle kayıtlı takımlar)
const TEAM_NAME_MAPPINGS = {
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
};

// Takım adını temizle ve mapping uygula
function cleanTeamName(name) {
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
async function tryPortMonks(teamName, apiKey) {
  if (!apiKey) return null;
  
  try {
    const cleanName = cleanTeamName(teamName);
    const url = `https://api.sportmonks.com/v3/football/teams/search/${encodeURIComponent(cleanName)}?api_token=${apiKey}`;
    
    console.log(`🔍 SportMonks: ${teamName}`);
    const response = await fetchFn(url, { timeout: 8000 });
    
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
    const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/searchteams.php?t=${encodeURIComponent(cleanName)}`;
    
    console.log(`🔍 TheSportsDB: ${teamName}`);
    const response = await fetchFn(url, { timeout: 8000 });
    
    const text = await response.text();
    
    // HTML dönerse (rate limit) skip et
    if (text.startsWith("<") || text.startsWith("<!")) {
      console.warn(`⚠️ TheSportsDB HTML döndü: ${teamName}`);
      return null;
    }
    
    const data = JSON.parse(text);
    
    if (data?.teams?.[0]) {
      const logo = data.teams[0].strTeamBadge || data.teams[0].strTeamLogo || data.teams[0].strBadge;
      if (logo) {
        console.log(`✅ TheSportsDB buldu: ${teamName}`);
        return logo;
      }
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
    
    const query = `${teamName} football club logo`;
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&searchType=image&num=1&key=${apiKey}&cx=${cx}`;
    
    console.log(`🔍 Google Search: ${teamName}`);
    const response = await fetchFn(url, { timeout: 10000 });
    
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
async function findTeamLogo(teamName, apiKeys) {
  const { sportmonks, thesportsdb, googleKey, googleCx } = apiKeys;
  
  console.log(`\n🎯 Logo aranıyor: ${teamName}`);
  
  // 1. SportMonks
  let logo = await tryPortMonks(teamName, sportmonks);
  if (logo) return logo;
  
  // 2. TheSportsDB
  logo = await trySportsDB(teamName, thesportsdb);
  if (logo) return logo;
  
  // 3. Google (son çare)
  logo = await tryGoogleSearch(teamName, googleKey, googleCx);
  if (logo) return logo;
  
  console.log(`❌ Logo bulunamadı: ${teamName}`);
  return null;
}

module.exports = {
  findTeamLogo,
  cleanTeamName,
};
