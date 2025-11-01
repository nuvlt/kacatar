// api/live-scores.js - Optimize edilmiş versiyon
// Match ID filtresi eklenmiş

import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  } catch (e) {
    console.error("Firebase init error:", e);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  try {
    const { filter = 'today', matchIds = '' } = req.query;
    const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;

    if (!FOOTBALL_API_KEY) {
      return res.status(500).json({ error: 'API key missing' });
    }

    // Eğer matchIds varsa, sadece o maçları getir
    if (matchIds) {
      console.log(`🎯 Specific match IDs requested: ${matchIds}`);
      return await getSpecificMatches(matchIds, res);
    }

    // Normal tarih bazlı sorgulama
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from, to;

    if (filter === 'today') {
      from = today;
      to = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    } else if (filter === 'yesterday') {
      from = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      to = today;
    } else if (filter === 'week') {
      from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      to = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    }

    const dateFrom = from.toISOString().split('T')[0];
    const dateTo = to.toISOString().split('T')[0];

    const competitions = ['PL', 'PD', 'SA', 'BL1', 'FL1', 'CL'];
    const allMatches = [];

    // Teams collection'ı bir map'e al
    const teamsSnapshot = await db.collection("teams").get();
    const teamsMap = new Map();
    
    teamsSnapshot.forEach(doc => {
      const team = doc.data();
      if (team.name && team.logo) {
        teamsMap.set(team.name.toLowerCase().trim(), team.logo);
      }
      if (team.nameLower && team.logo) {
        teamsMap.set(team.nameLower, team.logo);
      }
    });

    console.log(`📊 Teams map: ${teamsMap.size} entries`);

    // API-Football Ligleri
    for (const comp of competitions) {
      const url = `https://api.football-data.org/v4/matches?competitions=${comp}&dateFrom=${dateFrom}&dateTo=${dateTo}&status=FINISHED,IN_PLAY`;
      
      const response = await fetch(url, {
        headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.matches) {
          for (const m of data.matches) {
            const homeTeam = m.homeTeam?.shortName || m.homeTeam?.name;
            const awayTeam = m.awayTeam?.shortName || m.awayTeam?.name;
            
            const homeLogo = teamsMap.get(homeTeam?.toLowerCase().trim()) || "";
            const awayLogo = teamsMap.get(awayTeam?.toLowerCase().trim()) || "";
            
            allMatches.push({
              id: m.id,
              homeTeam: homeTeam,
              awayTeam: awayTeam,
              homeLogo: homeLogo,
              awayLogo: awayLogo,
              homeScore: m.score?.fullTime?.home ?? m.score?.halfTime?.home,
              awayScore: m.score?.fullTime?.away ?? m.score?.halfTime?.away,
              status: m.status,
              league: comp,
              utcDate: m.utcDate,
            });
          }
        }
      }
    }

    console.log(`✅ ${allMatches.length} maç bulundu`);

    return res.status(200).json({
      ok: true,
      count: allMatches.length,
      matches: allMatches,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Live scores error:', error);
    return res.status(500).json({ 
      ok: false,
      error: error.message,
      count: 0,
      matches: [],
    });
  }
}

// Belirli match ID'leri için sorgulama
async function getSpecificMatches(matchIds, res) {
  try {
    const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
    const ids = matchIds.split(',').map(id => id.trim()).filter(Boolean);
    
    console.log(`🎯 Fetching ${ids.length} specific matches`);

    // Teams map
    const teamsSnapshot = await admin.firestore().collection("teams").get();
    const teamsMap = new Map();
    
    teamsSnapshot.forEach(doc => {
      const team = doc.data();
      if (team.name && team.logo) {
        teamsMap.set(team.name.toLowerCase().trim(), team.logo);
      }
      if (team.nameLower && team.logo) {
        teamsMap.set(team.nameLower, team.logo);
      }
    });

    const allMatches = [];

    // Her match ID için API sorgusu (paralel)
    const promises = ids.map(async (matchId) => {
      try {
        const url = `https://api.football-data.org/v4/matches/${matchId}`;
        const response = await fetch(url, {
          headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
        });

        if (response.ok) {
          const m = await response.json();
          
          const homeTeam = m.homeTeam?.shortName || m.homeTeam?.name;
          const awayTeam = m.awayTeam?.shortName || m.awayTeam?.name;
          
          const homeLogo = teamsMap.get(homeTeam?.toLowerCase().trim()) || "";
          const awayLogo = teamsMap.get(awayTeam?.toLowerCase().trim()) || "";
          
          return {
            id: m.id,
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            homeLogo: homeLogo,
            awayLogo: awayLogo,
            homeScore: m.score?.fullTime?.home ?? m.score?.halfTime?.home,
            awayScore: m.score?.fullTime?.away ?? m.score?.halfTime?.away,
            status: m.status,
            league: m.competition?.code || '',
            utcDate: m.utcDate,
          };
        }
        return null;
      } catch (e) {
        console.error(`Error fetching match ${matchId}:`, e.message);
        return null;
      }
    });

    const results = await Promise.all(promises);
    allMatches.push(...results.filter(Boolean));

    console.log(`✅ ${allMatches.length} maç bilgisi alındı`);

    return res.status(200).json({
      ok: true,
      count: allMatches.length,
      matches: allMatches,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Specific matches error:', error);
    return res.status(500).json({ 
      ok: false,
      error: error.message,
      count: 0,
      matches: [],
    });
  }
}
