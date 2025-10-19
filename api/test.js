// api/test.js
// Basit test endpoint

export default async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    message: "API çalışıyor! 🚀",
    timestamp: new Date().toISOString(),
    env: {
      hasFirebase: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      hasFootballApi: !!process.env.FOOTBALL_API_KEY,
      hasTheSportsDB: !!process.env.THESPORTSDB_KEY,
      hasSecretKey: !!process.env.SECRET_KEY,
    }
  });
}
