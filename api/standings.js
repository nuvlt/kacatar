// api/standings.js
// Lig puan durumunu getirir

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
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { league } = req.query;
    const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;

    if (!FOOTBALL_API_KEY) {
      return res.status(500).json({ error: 'API key missing' });
    }

    if (!league) {
      return res.status(400).json({ error: 'League parameter required' });
    }

    console.log(`📊 Fetching standings for: ${league}`);

    // API-Football standings endpoint
    const url = `https://api.football-data.org/v4/competitions/${league}/standings`;
    
    const response = await fetch(url, {
      headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();

    // Teams map (logolar için)
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

    // Parse standings
    const standings = data.standings[0]?.table || [];
    
    const formattedStandings = standings.map(team => {
      const teamName = team.team?.shortName || team.team?.name || 'Unknown';
      const logo = teamsMap.get(teamName.toLowerCase().trim()) || team.team?.crest || '';

      return {
        position: team.position,
        name: teamName,
        logo: logo,
        playedGames: team.playedGames,
        won: team.won,
        draw: team.draw,
        lost: team.lost,
        points: team.points,
        goalsFor: team.goalsFor,
        goalsAgainst: team.goalsAgainst,
        goalDifference: team.goalDifference
      };
    });

    console.log(`✅ ${formattedStandings.length} takım sıralaması alındı`);

    return res.status(200).json({
      ok: true,
      league: league,
      standings: formattedStandings,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Standings error:', error);
    return res.status(500).json({ 
      ok: false,
      error: error.message || 'Failed to fetch standings'
    });
  }
}
