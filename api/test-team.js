// api/test-team.js
// Tek bir takım için logo arama testi

import { findTeamLogo, cleanTeamName } from "./logo-service.js";

export default async function handler(req, res) {
  try {
    const { key, team } = req.query;
    
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!team) {
      return res.status(400).json({ error: "?team=PSG şeklinde takım adı girin" });
    }

    const apiKeys = {
      sportmonks: process.env.SPORTMONKS_API_KEY,
      thesportsdb: process.env.THESPORTSDB_KEY,
      googleKey: process.env.GOOGLE_SEARCH_KEY,
      googleCx: process.env.GOOGLE_CX,
    };

    console.log("\n🔍 Test başlatılıyor...");
    console.log("📊 Takım:", team);
    console.log("📊 Temizlenmiş isim:", cleanTeamName(team));
    console.log("📊 API Keys:", {
      sportmonks: !!apiKeys.sportmonks,
      thesportsdb: !!apiKeys.thesportsdb,
      google: !!apiKeys.googleKey && !!apiKeys.googleCx,
    });

    const startTime = Date.now();
    const logo = await findTeamLogo(team, apiKeys);
    const duration = Date.now() - startTime;

    const result = {
      ok: true,
      input: team,
      cleaned: cleanTeamName(team),
      logo: logo,
      found: !!logo,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };

    console.log("\n📊 Sonuç:", result);
    return res.status(200).json(result);

  } catch (error) {
    console.error("❌ Test error:", error);
    return res.status(500).json({
      error: error.message || String(error),
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}
