// api/live-scores.js
// Canlı skorları döner (API key gizli kalır)

export default async function handler(req, res) {
  try {
    const { filter = 'today' } = req.query;
    const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;

    if (!FOOTBALL_API_KEY) {
      return res.status(500).json({ error: 'API key missing' });
    }

    // Tarih aralığı
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

    const competitions = ['PL', 'PD', 'SA', 'BL1', 'FL1'];
    const allMatches = [];

    for (const comp of competitions) {
      const url = `https://api.football-data.org/v4/matches?competitions=${comp}&dateFrom=${dateFrom}&dateTo=${dateTo}&status=FINISHED,IN_PLAY`;
      
      const response = await fetch(url, {
        headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.matches) {
          allMatches.push(...data.matches.map(m => ({
            id: m.id,
            homeTeam: m.homeTeam?.shortName || m.homeTeam?.name,
            awayTeam: m.awayTeam?.shortName || m.awayTeam?.name,
            homeScore: m.score?.fullTime?.home ?? m.score?.halfTime?.home,
            awayScore: m.score?.fullTime?.away ?? m.score?.halfTime?.away,
            status: m.status,
            league: comp,
            utcDate: m.utcDate,
          })));
        }
      }
    }

    return res.status(200).json({
      ok: true,
      count: allMatches.length,
      matches: allMatches,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Live scores error:', error);
    return res.status(500).json({ error: error.message });
  }
}
