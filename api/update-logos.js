import fetch from "node-fetch";
import admin from "firebase-admin";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const GOOGLE_SEARCH_KEY = process.env.GOOGLE_SEARCH_KEY;
const GOOGLE_CX = process.env.GOOGLE_CX;

export default async function handler(req, res) {
  console.log("🚀 update-logos çalışıyor");

  if (!GOOGLE_SEARCH_KEY || !GOOGLE_CX) {
    return res.status(500).json({
      error: "Google API bilgileri eksik (GOOGLE_SEARCH_KEY veya GOOGLE_CX).",
    });
  }

  const teamsSnap = await db.collection("teams").get();
  if (teamsSnap.empty) {
    return res.json({ ok: false, message: "Takım bulunamadı." });
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of teamsSnap.docs) {
    const team = doc.data();
    const teamName = team.name || "Bilinmiyor";

    // Zaten varsa atla
    if (team.logo && team.logo.includes("http")) {
      skipped++;
      continue;
    }

    // Firestore cache kontrolü
    const cached = await db.collection("logos").doc(teamName).get();
    if (cached.exists && cached.data().logo) {
      await doc.ref.update({ logo: cached.data().logo });
      console.log(`♻️ Cache'den logo: ${teamName}`);
      continue;
    }

    try {
      const logoUrl = await fetchGoogleLogo(teamName);
      if (logoUrl) {
        await doc.ref.update({ logo: logoUrl });
        await db.collection("logos").doc(teamName).set({
          logo: logoUrl,
          source: "google",
          lastChecked: new Date().toISOString(),
        });
        console.log(`🟢 Logo bulundu: ${teamName}`);
        updated++;
      } else {
        console.log(`❌ Logo bulunamadı: ${teamName}`);
      }
    } catch (err) {
      console.error(`⚠️ Hata: ${teamName}`, err.message);
      errors++;
    }
  }

  return res.json({
    ok: true,
    message: `Logo güncelleme tamamlandı.`,
    summary: { updated, skipped, errors },
  });
}

async function fetchGoogleLogo(teamName) {
  const encodedQuery = encodeURIComponent(
    `${teamName} football club logo site:wikipedia.org OR site:wikimedia.org`
  );

  const url = `https://www.googleapis.com/customsearch/v1?q=${encodedQuery}&cx=${GOOGLE_CX}&key=${GOOGLE_SEARCH_KEY}&searchType=image&num=1`;

  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`Google API yanıtı: ${response.status}`);
    return null;
  }

  const data = await response.json();
  if (data.items && data.items.length > 0) {
    return data.items[0].link;
  }

  // fallback arama
  const fallbackQuery = encodeURIComponent(`${teamName} logo transparent`);
  const fallbackUrl = `https://www.googleapis.com/customsearch/v1?q=${fallbackQuery}&cx=${GOOGLE_CX}&key=${GOOGLE_SEARCH_KEY}&searchType=image&num=1`;
  const fallbackRes = await fetch(fallbackUrl);
  const fallbackData = await fallbackRes.json();
  if (fallbackData.items && fallbackData.items.length > 0) {
    return fallbackData.items[0].link;
  }

  return null;
}
