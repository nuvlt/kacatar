// api/admin.js
// Tüm admin işlemlerini tek endpoint'te toplar
// Action parameter ile farklı işlemler yapılır

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

// ========== ADMIN AUTH CHECK ==========
async function checkAuth(req) {
  const { key, adminKey, username, password } = req.body || req.query;
  
  // Backend key kontrolü
  if (key && key === process.env.SECRET_KEY) return true;
  if (adminKey && adminKey === process.env.SECRET_KEY) return true;
  
  // Admin panel login kontrolü
  if (username && password) {
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'yonetici';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'logo123';
    return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
  }
  
  return false;
}

// ========== 1. CHECK AUTH (Admin Panel Login) ==========
async function handleCheckAuth(req) {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return { ok: false, message: 'Kullanıcı adı ve şifre gerekli' };
  }

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'logo123';
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'yonetici';

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return { ok: true, message: 'Giriş başarılı' };
  }
  
  return { ok: false, message: 'Kullanıcı adı veya şifre hatalı' };
}

// ========== 2. UPDATE LOGO ==========
async function handleUpdateLogo(req) {
  const { teamName, logoUrl } = req.body;

  if (!teamName || !logoUrl) {
    throw new Error('teamName ve logoUrl gerekli');
  }

  if (!logoUrl.startsWith('http://') && !logoUrl.startsWith('https://')) {
    throw new Error('Geçersiz URL formatı');
  }

  console.log(`🎨 Logo güncelleniyor: ${teamName}`);

  // Teams collection'a kaydet
  const teamDocId = teamName.toLowerCase().replace(/\s+/g, '-');
  await db.collection("teams").doc(teamDocId).set({
    name: teamName,
    nameLower: teamName.toLowerCase().trim(),
    logo: logoUrl,
    lastUpdated: new Date().toISOString(),
  }, { merge: true });

  // Bu takımın tüm maçlarını güncelle
  const matchesSnapshot = await db.collection("matches").get();
  const batch = db.batch();
  let updatedCount = 0;

  matchesSnapshot.forEach((doc) => {
    const match = doc.data();
    let needsUpdate = false;
    const updates = {};

    if ((match.home || match.homeTeam) === teamName) {
      updates.homeLogo = logoUrl;
      needsUpdate = true;
    }

    if ((match.away || match.awayTeam) === teamName) {
      updates.awayLogo = logoUrl;
      needsUpdate = true;
    }

    if (needsUpdate) {
      batch.update(doc.ref, updates);
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    await batch.commit();
  }

  return {
    ok: true,
    message: `✅ ${teamName} logosu güncellendi`,
    updatedMatches: updatedCount,
    logoUrl: logoUrl,
  };
}

// ========== 3. ADD SÜPER LIG MATCH ==========
async function handleAddSuperligMatch(req) {
  const { home, away, date, time } = req.body;

  if (!home || !away || !date) {
    throw new Error('Eksik bilgi: home, away, date gerekli');
  }

  console.log(`🇹🇷 Süper Lig maçı ekleniyor: ${home} vs ${away}`);

  // Logoları bul
  let homeLogo = "";
  let awayLogo = "";

  try {
    const homeSnap = await db.collection("teams")
      .where("nameLower", "==", home.toLowerCase().trim())
      .limit(1)
      .get();
    
    if (!homeSnap.empty) {
      homeLogo = homeSnap.docs[0].data().logo || "";
    }

    const awaySnap = await db.collection("teams")
      .where("nameLower", "==", away.toLowerCase().trim())
      .limit(1)
      .get();
    
    if (!awaySnap.empty) {
      awayLogo = awaySnap.docs[0].data().logo || "";
    }
  } catch (e) {
    console.warn('Logo fetch error:', e.message);
  }

  const fullDateTime = time ? `${date} ${time}` : date;
  const docId = `sl-${home}-${away}-${date}`.replace(/\s+/g, "_").replace(/:/g, "-");
  
  const matchData = {
    competition: "super-lig",
    league: "Süper Lig",
    home: home,
    away: away,
    homeTeam: home,
    awayTeam: away,
    homeLogo: homeLogo,
    awayLogo: awayLogo,
    date: fullDateTime,
    time: fullDateTime,
    votes: {},
    popularPrediction: null,
    voteCount: 0,
    syncedAt: new Date().toISOString(),
  };

  await db.collection("matches").doc(docId).set(matchData);

  return {
    ok: true,
    message: `✅ ${home} vs ${away} maçı eklendi`,
    matchId: docId,
    logos: {
      home: !!homeLogo,
      away: !!awayLogo,
    },
  };
}

// ========== 4. SYNC MATCHES LOGOS ==========
async function handleSyncMatchesLogos(req) {
  console.log("🔄 Matches logoları güncelleniyor...");

  // Teams map
  const teamsSnapshot = await db.collection("teams").get();
  const teamsMap = new Map();
  
  teamsSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.name) {
      const nameLower = data.name.toLowerCase().trim();
      teamsMap.set(nameLower, data.logo || null);
    }
    if (data.nameLower) {
      teamsMap.set(data.nameLower, data.logo || null);
    }
  });

  // Tüm maçları güncelle
  const matchesSnapshot = await db.collection("matches").get();
  let updated = 0;
  let notFound = [];
  
  for (const doc of matchesSnapshot.docs) {
    const data = doc.data();
    const home = data.home || data.homeTeam;
    const away = data.away || data.awayTeam;
    
    if (!home || !away) continue;
    
    const homeLogo = teamsMap.get(home.toLowerCase().trim());
    const awayLogo = teamsMap.get(away.toLowerCase().trim());
    
    if (!homeLogo) notFound.push(home);
    if (!awayLogo) notFound.push(away);
    
    await doc.ref.update({
      homeLogo: homeLogo || "",
      awayLogo: awayLogo || "",
    });
    
    updated++;
  }

  const uniqueNotFound = [...new Set(notFound)];

  return {
    ok: true,
    message: `✅ ${updated} maç güncellendi`,
    stats: {
      totalMatches: matchesSnapshot.size,
      updatedMatches: updated,
      teamsInMap: teamsMap.size,
      missingLogos: uniqueNotFound.length,
    },
    missingTeams: uniqueNotFound.length > 0 ? uniqueNotFound : undefined,
  };
}

// ========== 5. MIGRATE VOTES (TEK SEFERLIK) ==========
async function handleMigrateVotes(req) {
  console.log('🚀 Migrasyon başlatılıyor...');

  const matchesSnapshot = await db.collection("matches").get();
  
  let totalMigrated = 0;
  let totalSkipped = 0;
  const batch = db.batch();
  let batchCount = 0;

  for (const matchDoc of matchesSnapshot.docs) {
    const match = matchDoc.data();
    const matchId = matchDoc.id;
    const votes = match.votes || {};

    if (Object.keys(votes).length === 0) {
      totalSkipped++;
      continue;
    }

    console.log(`📊 ${matchId}: ${Object.keys(votes).length} oy bulundu`);

    for (const [userId, prediction] of Object.entries(votes)) {
      const predictionId = `${userId}_${matchId}`;
      const predictionRef = db.collection("predictions").doc(predictionId);

      // Önce var mı kontrol et
      const existingPred = await predictionRef.get();
      
      if (existingPred.exists) {
        console.log(`⏭️ Zaten var: ${predictionId}`);
        totalSkipped++;
        continue;
      }

      batch.set(predictionRef, {
        userId: userId,
        matchId: matchId,
        prediction: prediction,
        homeTeam: match.home || match.homeTeam,
        awayTeam: match.away || match.awayTeam,
        homeLogo: match.homeLogo || "",
        awayLogo: match.awayLogo || "",
        league: match.league || match.competition,
        matchDate: match.date || match.time,
        createdAt: match.lastVoteAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'pending',
        points: 0,
        migratedFrom: 'matches.votes'
      });

      batchCount++;
      totalMigrated++;

      // Her 500 işlemde bir commit
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`💾 ${batchCount} kayıt commit edildi`);
        batchCount = 0;
      }
    }
  }

  // Kalan kayıtları commit et
  if (batchCount > 0) {
    await batch.commit();
    console.log(`💾 Son ${batchCount} kayıt commit edildi`);
  }

  console.log(`✅ Migrasyon tamamlandı!`);

  return {
    ok: true,
    message: 'Migrasyon başarılı',
    stats: {
      totalMigrated,
      totalSkipped,
      totalMatches: matchesSnapshot.size
    }
  };
}

// ========== 6. UPDATE POPULAR PREDICTIONS ==========
async function handleUpdatePopularPredictions(req) {
  console.log('🔄 Popüler tahminler güncelleniyor...');

  const matchesSnapshot = await db.collection("matches").get();
  
  let updatedCount = 0;
  const batch = db.batch();
  let batchCount = 0;

  for (const matchDoc of matchesSnapshot.docs) {
    const matchId = matchDoc.id;

    // Bu maç için tüm tahminleri getir
    const predictionsQuery = await db.collection("predictions")
      .where("matchId", "==", matchId)
      .get();

    if (predictionsQuery.empty) {
      batch.update(matchDoc.ref, {
        popularPrediction: null,
        voteCount: 0,
        votes: {}
      });
      batchCount++;
      continue;
    }

    // Tahminleri say
    const counts = {};
    predictionsQuery.forEach(predDoc => {
      const pred = predDoc.data().prediction;
      counts[pred] = (counts[pred] || 0) + 1;
    });

    // En popüleri bul
    let popular = null;
    let maxCount = 0;
    for (let [score, count] of Object.entries(counts)) {
      if (count > maxCount) {
        popular = score;
        maxCount = count;
      }
    }

    batch.update(matchDoc.ref, {
      popularPrediction: popular,
      voteCount: maxCount,
      votes: {}
    });

    batchCount++;
    updatedCount++;

    if (batchCount >= 500) {
      await batch.commit();
      console.log(`💾 ${batchCount} maç commit edildi`);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return {
    ok: true,
    message: `✅ ${updatedCount} maç güncellendi`,
    stats: {
      totalMatches: matchesSnapshot.size,
      updated: updatedCount
    }
  };
}

// ========== 7. FORCE UPDATE SCORES (Bekleyen Maçları Güncelle) ==========
async function handleForceUpdateScores(req) {
  console.log('🔄 Bekleyen maçların skorları kontrol ediliyor...');

  // Tüm pending predictions'ları getir
  const predictionsQuery = await db.collection("predictions")
    .where("status", "==", "pending")
    .get();

  if (predictionsQuery.empty) {
    return {
      ok: true,
      message: 'Bekleyen maç yok',
      updated: 0
    };
  }

  console.log(`📊 ${predictionsQuery.size} bekleyen tahmin bulundu`);

  // Numeric match ID'leri topla
  const numericMatchIds = [];
  predictionsQuery.forEach(doc => {
    const matchId = doc.data().matchId;
    if (/^\d+$/.test(matchId) && !numericMatchIds.includes(matchId)) {
      numericMatchIds.push(matchId);
    }
  });

  if (numericMatchIds.length === 0) {
    return {
      ok: true,
      message: 'Numeric match ID yok (Süper Lig maçları için API yok)',
      updated: 0
    };
  }

  console.log(`🎯 ${numericMatchIds.length} maç için skorlar isteniyor...`);

  // API'den skorları al
  const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
  const liveScores = {};

  for (const matchId of numericMatchIds) {
    try {
      const url = `https://api.football-data.org/v4/matches/${matchId}`;
      const response = await fetch(url, {
        headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
      });

      if (response.ok) {
        const m = await response.json();
        
        if (m.status === 'FINISHED' && m.score?.fullTime) {
          liveScores[matchId] = {
            homeScore: m.score.fullTime.home,
            awayScore: m.score.fullTime.away,
            status: 'FINISHED'
          };
          console.log(`✅ ${matchId}: ${m.score.fullTime.home}-${m.score.fullTime.away}`);
        }
      }
    } catch (e) {
      console.warn(`⚠️ ${matchId}: ${e.message}`);
    }
  }

  console.log(`📊 ${Object.keys(liveScores).length} maç skoru bulundu`);

  if (Object.keys(liveScores).length === 0) {
    return {
      ok: true,
      message: 'API\'den skor alınamadı (maçlar çok eski olabilir)',
      updated: 0
    };
  }

  // Predictions'ları güncelle
  let updatedCount = 0;
  let correctCount = 0;
  const batch = db.batch();
  let batchCount = 0;

  predictionsQuery.forEach(predDoc => {
    const pred = predDoc.data();
    const score = liveScores[pred.matchId];

    if (score) {
      // Zaten hesaplanmış mı kontrol et
      if (pred.calculatedAt) {
        console.log(`⏭️ Zaten hesaplanmış: ${predDoc.id}`);
        return;
      }
      
      const actualScore = `${score.homeScore}-${score.awayScore}`;
      const status = pred.prediction === actualScore ? 'correct' : 'wrong';
      const points = status === 'correct' ? 10 : 0;

      // Prediction güncelle
      batch.update(predDoc.ref, {
        status: status,
        actualScore: actualScore,
        points: points,
        updatedAt: new Date().toISOString(),
        calculatedAt: new Date().toISOString()
      });

      // User stats güncelle (sadece Google kullanıcıları için)
      const userId = pred.userId;
      if (userId && !userId.startsWith('anon-')) {
        const userRef = db.collection("users").doc(userId);
        
        batch.update(userRef, {
          'stats.points': admin.firestore.FieldValue.increment(points),
          'stats.totalPredictions': admin.firestore.FieldValue.increment(1),
          'stats.correctPredictions': admin.firestore.FieldValue.increment(status === 'correct' ? 1 : 0),
          'stats.lastUpdated': new Date().toISOString()
        });

        // Point History kaydet
        const pointHistoryRef = db.collection("pointHistory").doc();
        batch.set(pointHistoryRef, {
          userId: userId,
          matchId: pred.matchId,
          prediction: pred.prediction,
          actualScore: actualScore,
          points: points,
          timestamp: new Date().toISOString(),
          homeTeam: pred.homeTeam,
          awayTeam: pred.awayTeam,
          league: pred.league
        });

        if (status === 'correct') correctCount++;
      }

      batchCount++;
      updatedCount++;

      if (batchCount >= 450) {
        batch.commit();
        batchCount = 0;
      }
    }
  });

  if (batchCount > 0) {
    await batch.commit();
  }

  return {
    ok: true,
    message: `✅ ${updatedCount} tahmin güncellendi (${correctCount} doğru)`,
    stats: {
      totalPending: predictionsQuery.size,
      scoresFound: Object.keys(liveScores).length,
      updated: updatedCount,
      correctPredictions: correctCount
    }
  };
}

// ========== 8. MANUAL SUPERLIG SCORES (Tüm Kullanıcılar İçin) ==========
async function handleManualSuperligScores(req) {
  const { matchId, actualScore } = req.body;

  if (!matchId || !actualScore) {
    throw new Error('matchId ve actualScore gerekli');
  }

  // Skor formatı kontrolü
  if (!/^\d+-\d+$/.test(actualScore)) {
    throw new Error('Geçersiz skor formatı. Örnek: "2-1"');
  }

  console.log(`🎯 Manuel skor girişi: ${matchId} → ${actualScore}`);

  // Bu maç için TÜM kullanıcıların tahminlerini bul
  const predictionsQuery = await db.collection("predictions")
    .where("matchId", "==", matchId)
    .get();

  if (predictionsQuery.empty) {
    return {
      ok: true,
      message: 'Bu maç için tahmin bulunamadı',
      updated: 0
    };
  }

  console.log(`📊 ${predictionsQuery.size} tahmin bulundu`);

  // Tüm tahminleri güncelle ve user stats'ı güncelle
  let updatedCount = 0;
  let correctCount = 0;
  const batch = db.batch();
  let batchCount = 0;

  predictionsQuery.forEach(predDoc => {
    const pred = predDoc.data();
    
    // Zaten hesaplanmış mı kontrol et (double counting önleme)
    if (pred.calculatedAt) {
      console.log(`⏭️ Zaten hesaplanmış: ${predDoc.id}`);
      return;
    }
    
    const status = pred.prediction === actualScore ? 'correct' : 'wrong';
    const points = status === 'correct' ? 10 : 0;

    // Prediction güncelle
    batch.update(predDoc.ref, {
      status: status,
      actualScore: actualScore,
      points: points,
      updatedAt: new Date().toISOString(),
      calculatedAt: new Date().toISOString()
    });

    // User stats güncelle (sadece Google kullanıcıları için)
    const userId = pred.userId;
    if (userId && !userId.startsWith('anon-')) {
      const userRef = db.collection("users").doc(userId);
      
      // Stats artır
      batch.update(userRef, {
        'stats.points': admin.firestore.FieldValue.increment(points),
        'stats.totalPredictions': admin.firestore.FieldValue.increment(1),
        'stats.correctPredictions': admin.firestore.FieldValue.increment(status === 'correct' ? 1 : 0),
        'stats.lastUpdated': new Date().toISOString()
      });

      // Point History kaydet
      const pointHistoryRef = db.collection("pointHistory").doc();
      batch.set(pointHistoryRef, {
        userId: userId,
        matchId: matchId,
        prediction: pred.prediction,
        actualScore: actualScore,
        points: points,
        timestamp: new Date().toISOString(),
        homeTeam: pred.homeTeam,
        awayTeam: pred.awayTeam,
        league: pred.league
      });

      if (status === 'correct') correctCount++;
    }

    batchCount++;
    updatedCount++;

    if (batchCount >= 450) { // 500 yerine 450 (user updates dahil)
      batch.commit();
      batchCount = 0;
    }
  });

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`✅ ${updatedCount} tahmin güncellendi (${correctCount} doğru)`);

  return {
    ok: true,
    message: `✅ ${updatedCount} tahmin güncellendi (${correctCount} doğru)`,
    matchId: matchId,
    actualScore: actualScore,
    totalUpdated: updatedCount,
    correctPredictions: correctCount
  };
}

// ========== 9. GET PENDING SUPERLIG MATCHES (Admin Panel İçin) ==========
async function handleGetPendingSuperligMatches(req) {
  console.log('📋 Bekleyen Süper Lig maçları listeleniyor...');

  try {
    const predictionsQuery = await db.collection("predictions")
      .where("status", "==", "pending")
      .get();

    const superligMatches = new Map();

    predictionsQuery.forEach(doc => {
      const data = doc.data();
      
      // Sadece Süper Lig maçları
      if (data.matchId && data.matchId.startsWith('sl-')) {
        if (!superligMatches.has(data.matchId)) {
          superligMatches.set(data.matchId, {
            matchId: data.matchId,
            home: data.homeTeam || 'Bilinmiyor',
            away: data.awayTeam || 'Bilinmiyor',
            homeLogo: data.homeLogo || '',
            awayLogo: data.awayLogo || '',
            date: data.matchDate,
            count: 0
          });
        }
        superligMatches.get(data.matchId).count++;
      }
    });

    const matches = Array.from(superligMatches.values());
    
    // Tarihe göre sırala
    matches.sort((a, b) => new Date(a.date) - new Date(b.date));

    console.log(`✅ ${matches.length} bekleyen Süper Lig maçı bulundu`);

    return {
      ok: true,
      matches: matches,
      count: matches.length
    };

  } catch (error) {
    console.error('Get pending matches error:', error);
    return {
      ok: false,
      error: error.message,
      matches: []
    };
  }
}

// ========== MAIN HANDLER ==========
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const action = req.query.action || req.body?.action;

    if (!action) {
      return res.status(400).json({ 
        error: 'Action parameter gerekli',
        availableActions: [
          'check-auth',
          'update-logo',
          'add-superlig-match',
          'sync-matches-logos',
          'migrate-votes',
          'update-popular-predictions',
          'force-update-scores',
          'manual-superlig-scores',
          'get-pending-superlig'
        ]
      });
    }

    // Auth kontrolü (check-auth hariç)
    if (action !== 'check-auth' && action !== 'get-pending-superlig') {
      const isAuthorized = await checkAuth(req);
      if (!isAuthorized) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    }

    // get-pending-superlig için özel auth kontrolü
    if (action === 'get-pending-superlig') {
      const { key } = req.body || req.query;
      if (!key || key !== process.env.SECRET_KEY) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    }

    // Action'a göre işlem yap
    let result;
    
    switch (action) {
      case 'check-auth':
        result = await handleCheckAuth(req);
        break;
      
      case 'update-logo':
        result = await handleUpdateLogo(req);
        break;
      
      case 'add-superlig-match':
        result = await handleAddSuperligMatch(req);
        break;
      
      case 'sync-matches-logos':
        result = await handleSyncMatchesLogos(req);
        break;
      
      case 'migrate-votes':
        result = await handleMigrateVotes(req);
        break;
      
      case 'update-popular-predictions':
        result = await handleUpdatePopularPredictions(req);
        break;
      
      case 'force-update-scores':
        result = await handleForceUpdateScores(req);
        break;
      
      case 'manual-superlig-scores':
        result = await handleManualSuperligScores(req);
        break;
      
      case 'get-pending-superlig':
        result = await handleGetPendingSuperligMatches(req);
        break;
      
      default:
        return res.status(400).json({ 
          error: 'Geçersiz action',
          received: action
        });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({ 
      ok: false,
      error: error.message || 'Internal server error' 
    });
  }
}
