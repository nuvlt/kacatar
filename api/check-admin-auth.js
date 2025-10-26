// api/check-admin-auth.js
// Admin şifresini kontrol eder + Rate limiting

// In-memory rate limiting (basit, production için Redis önerilir)
const loginAttempts = new Map();

// Temizleme: Her 30 dakikada bir eski kayıtları sil
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of loginAttempts.entries()) {
    if (now > data.resetAt) {
      loginAttempts.delete(key);
    }
  }
}, 30 * 60 * 1000);

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

    // IP bazlı rate limiting
    const ip = req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.socket?.remoteAddress || 
               'unknown';
    
    const key = `login:${ip}`;
    const now = Date.now();
    
    // Mevcut denemeler
    let attempts = loginAttempts.get(key);
    
    if (!attempts) {
      attempts = {
        count: 0,
        resetAt: now + 15 * 60 * 1000, // 15 dakika
        lastAttempt: now
      };
    }
    
    // Reset süresi geçtiyse sıfırla
    if (now > attempts.resetAt) {
      attempts.count = 0;
      attempts.resetAt = now + 15 * 60 * 1000;
    }
    
    // Max 5 deneme kontrolü
    if (attempts.count >= 5) {
      const remainingTime = Math.ceil((attempts.resetAt - now) / 1000 / 60);
      console.warn(`⚠️ Rate limit: ${ip} - ${attempts.count} deneme`);
      
      return res.status(429).json({ 
        ok: false,
        error: 'rate_limit',
        message: `Çok fazla başarısız deneme. ${remainingTime} dakika sonra tekrar deneyin.`
      });
    }
    
    // Validation
    if (!username || !password) {
      attempts.count++;
      attempts.lastAttempt = now;
      loginAttempts.set(key, attempts);
      
      return res.status(400).json({ 
        ok: false,
        message: 'Kullanıcı adı ve şifre gerekli' 
      });
    }

    // Environment variable'dan şifre al
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'logo123';
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'yonetici';

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // Başarılı giriş - sayacı sıfırla
      loginAttempts.delete(key);
      
      console.log(`✅ Admin login başarılı: ${ip}`);
      
      return res.status(200).json({ 
        ok: true, 
        message: 'Giriş başarılı' 
      });
    } else {
      // Başarısız giriş - sayacı artır
      attempts.count++;
      attempts.lastAttempt = now;
      loginAttempts.set(key, attempts);
      
      console.warn(`❌ Admin login başarısız: ${ip} (${attempts.count}/5)`);
      
      return res.status(401).json({ 
        ok: false, 
        message: 'Kullanıcı adı veya şifre hatalı',
        remainingAttempts: Math.max(0, 5 - attempts.count)
      });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ 
      ok: false,
      error: error.message || String(error) 
    });
  }
}
