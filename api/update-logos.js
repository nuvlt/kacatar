// /api/update-logos.js
import fetch from "node-fetch";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ✅ Firestore bağlantısı
let db;
if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  const app = initializeApp({ credential: cert(serviceAccount) });
  db = getFirestore(app);
} else {
  db = getFirestore();
}

// ✅ Yardımcı fonksiyon: log yazıcı
function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

// ✅ Google Custom Search üzerinden logo bulucu
async function searchLogo(teamName) {
  try {
    const query = `${teamName} football club logo`;
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
      query
    )}&cx=${process.env.GOOGLE_CX}&key=${process.env.GOOGLE_SEARCH_KEY}&searchType=image&num=1`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.items && data.items.length > 0) {
      return data.items[0].link; // en üstteki görsel
    } else {
      return null;
    }
  } catch (err) {
    log("❌ Logo arama hatası:", err.message);
    return null;
  }
}

// ✅ Ana fonksiyon
export default async function handler(req, res) {
  try {
    log("🚀 Logo güncelleme başladı...");

    const snapshot = await db.collection("teams").get();
    if (snapshot.empty) {
      return res.status(404).json({ error: "Takım bulunamadı (Firestore boş)" });
    }

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of snapshot.docs) {
      const team = doc.data();
      const teamName = team.name;

      if (!teamName) {
        skipped++;
        continue;
      }

      // Eğer Firestore'da logo varsa tekrar arama yapma
      if (team.logo) {
        skipped++;
        continue;
      }

      const logoUrl = await searchLogo(teamName);
      if (logoUrl) {
        await db.collection("teams").doc(doc.id).update({ logo: logoUrl });
        updated++;
        log(`🟢 ${teamName}: Logo bulundu.`);
      } else {
        log(`❌ ${teamName}: Logo bulunamadı.`);
        errors++;
      }
    }

    const result = {
      ok: true,
      message: "Logo güncelleme tamamlandı.",
      summary: { updated, skipped, errors },
    };

    log("✅", result);
    return res.status(200).json(result);
  } catch (err) {
    console.error("🔥 Hata:", err);
    return res.status(500).json({ error: err.message });
  }
}
