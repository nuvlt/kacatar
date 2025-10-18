// api/check-env.js
// Environment variable'ları kontrol eder

export default async function handler(req, res) {
  try {
    const { key } = req.query;
    
    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const envVars = {
      SECRET_KEY: !!process.env.SECRET_KEY,
      FIREBASE_SERVICE_ACCOUNT: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      FOOTBALL_API_KEY: !!process.env.FOOTBALL_API_KEY,
      SPORTMONKS_API_KEY: !!process.env.SPORTMONKS_API_KEY,
      THESPORTSDB_KEY: !!process.env.THESPORTSDB_KEY,
      GOOGLE_SEARCH_KEY: !!process.env.GOOGLE_SEARCH_KEY,
      GOOGLE_SEARCH_CX: !!process.env.GOOGLE_SEARCH_CX,
      GOOGLE_CX: !!process.env.GOOGLE_CX,
    };

    const envDetails = {
      GOOGLE_SEARCH_KEY_length: process.env.GOOGLE_SEARCH_KEY?.length || 0,
      GOOGLE_SEARCH_CX_length: process.env.GOOGLE_SEARCH_CX?.length || 0,
      GOOGLE_CX_length: process.env.GOOGLE_CX?.length || 0,
      GOOGLE_SEARCH_KEY_prefix: process.env.GOOGLE_SEARCH_KEY?.substring(0, 10) || null,
      GOOGLE_SEARCH_CX_prefix: process.env.GOOGLE_SEARCH_CX?.substring(0, 10) || null,
      GOOGLE_CX_prefix: process.env.GOOGLE_CX?.substring(0, 10) || null,
    };

    const allEnvKeys = Object.keys(process.env).filter(key => 
      key.includes('GOOGLE') || 
      key.includes('SEARCH') || 
      key.includes('CX')
    );

    const result = {
      ok: true,
      envVars,
      envDetails,
      allGoogleRelatedKeys: allEnvKeys,
      timestamp: new Date().toISOString(),
    };

    console.log("\n📊 Environment Variables:", JSON.stringify(result, null, 2));
    return res.status(200).json(result);

  } catch (error) {
    console.error("❌ Check env error:", error);
    return res.status(500).json({
      error: error.message || String(error),
    });
  }
}
