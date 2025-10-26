// Basit in-memory rate limit (production için Redis kullanın)
const loginAttempts = new Map();

export default async function handler(req, res) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  // IP başına max 5 deneme / 15 dakika
  const key = `login:${ip}`;
  const attempts = loginAttempts.get(key) || { count: 0, resetAt: Date.now() + 15 * 60 * 1000 };
  
  if (Date.now() > attempts.resetAt) {
    attempts.count = 0;
    attempts.resetAt = Date.now() + 15 * 60 * 1000;
  }
  
  if (attempts.count >= 5) {
    return res.status(429).json({ 
      error: 'Çok fazla deneme. 15 dakika bekleyin.' 
    });
  }
  
  attempts.count++;
  loginAttempts.set(key, attempts);
  
  // ... normal auth logic
}
