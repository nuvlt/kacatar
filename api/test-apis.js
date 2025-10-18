// api/test-apis.js
// Tüm API'leri detaylı test eder

export default async function handler(req, res) {
  try {
    const { key, team = "PSG" } = req.query;
    
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const results = {
      team,
      apis: {},
      env: {
        sportmonks: !!process.env.SPORTMONKS_API_KEY,
        thesportsdb: !!process.env.THESPORTSDB_KEY,
        google: !!process.env.GOOGLE_SEARCH_KEY && !!process.env.GOOGLE_CX,
      }
    };

    // 1️⃣ Test SportMonks
    console.log("\n🔍 Testing SportMonks...");
    if (process.env.SPORTMONKS_API_KEY) {
      try {
        const url = `https://api.sportmonks.com/v3/football/teams/search/${encodeURIComponent("Paris Saint-Germain")}?api_token=${process.env.SPORTMONKS_API_KEY}`;
        console.log("URL:", url);
        
        const response = await fetch(url, { timeout: 10000 });
        const text = await response.text();
        
        results.apis.sportmonks = {
          status: response.status,
          ok: response.ok,
          responseLength: text.length,
          response: text.substring(0, 500), // İlk 500 karakter
        };
        
        if (response.ok) {
          try {
            const data = JSON.parse(text);
            results.apis.sportmonks.parsed = true;
            results.apis.sportmonks.hasData = !!data?.data;
            results.apis.sportmonks.dataCount = data?.data?.length || 0;
          } catch (e) {
            results.apis.sportmonks.parsed = false;
            results.apis.sportmonks.parseError = e.message;
          }
        }
      } catch (error) {
        results.apis.sportmonks = { error: error.message };
      }
    } else {
      results.apis.sportmonks = { error: "API key not set" };
    }

    // 2️⃣ Test TheSportsDB
    console.log("\n🔍 Testing TheSportsDB...");
    if (process.env.THESPORTSDB_KEY) {
      try {
        const url = `https://www.thesportsdb.com/api/v1/json/${process.env.THESPORTSDB_KEY}/searchteams.php?t=${encodeURIComponent("Paris Saint-Germain")}`;
        console.log("URL:", url);
        
        const response = await fetch(url, { timeout: 10000 });
        const text = await response.text();
        
        results.apis.thesportsdb = {
          status: response.status,
          ok: response.ok,
          isHTML: text.startsWith("<"),
          responseLength: text.length,
          response: text.substring(0, 500),
        };
        
        if (response.ok && !text.startsWith("<")) {
          try {
            const data = JSON.parse(text);
            results.apis.thesportsdb.parsed = true;
            results.apis.thesportsdb.hasTeams = !!data?.teams;
            results.apis.thesportsdb.teamsCount = data?.teams?.length || 0;
            if (data?.teams?.[0]) {
              results.apis.thesportsdb.logo = data.teams[0].strTeamBadge || data.teams[0].strTeamLogo;
            }
          } catch (e) {
            results.apis.thesportsdb.parsed = false;
            results.apis.thesportsdb.parseError = e.message;
          }
        }
      } catch (error) {
        results.apis.thesportsdb = { error: error.message };
      }
    } else {
      results.apis.thesportsdb = { error: "API key not set" };
    }

    // 3️⃣ Test Google
    console.log("\n🔍 Testing Google...");
    if (process.env.GOOGLE_SEARCH_KEY && process.env.GOOGLE_CX) {
      try {
        const query = "Paris Saint-Germain football club logo";
        const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&searchType=image&num=1&key=${process.env.GOOGLE_SEARCH_KEY}&cx=${process.env.GOOGLE_CX}`;
        console.log("URL:", url.replace(process.env.GOOGLE_SEARCH_KEY, "***"));
        
        const response = await fetch(url, { timeout: 10000 });
        const text = await response.text();
        
        results.apis.google = {
          status: response.status,
          ok: response.ok,
          responseLength: text.length,
          response: text.substring(0, 500),
        };
        
        if (response.ok) {
          try {
            const data = JSON.parse(text);
            results.apis.google.parsed = true;
            results.apis.google.hasItems = !!data?.items;
            results.apis.google.itemsCount = data?.items?.length || 0;
            if (data?.items?.[0]) {
              results.apis.google.logo = data.items[0].link;
            }
            if (data?.error) {
              results.apis.google.error = data.error;
            }
          } catch (e) {
            results.apis.google.parsed = false;
            results.apis.google.parseError = e.message;
          }
        }
      } catch (error) {
        results.apis.google = { error: error.message };
      }
    } else {
      results.apis.google = { error: "API key or CX not set" };
    }

    console.log("\n📊 Results:", JSON.stringify(results, null, 2));
    return res.status(200).json(results);

  } catch (error) {
    console.error("❌ Test error:", error);
    return res.status(500).json({
      error: error.message || String(error),
    });
  }
}
