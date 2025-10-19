// api/check-admin-auth.js
// Admin şifresini kontrol eder (Vercel env variables)

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    // Environment variable'dan şifre al
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'logo123';
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'yonetici';

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      return res.status(200).json({ 
        ok: true, 
        message: 'Giriş başarılı' 
      });
    } else {
      return res.status(401).json({ 
        ok: false, 
        message: 'Kullanıcı adı veya şifre hatalı' 
      });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ 
      error: error.message || String(error) 
    });
  }
}
