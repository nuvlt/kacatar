import fetch from "node-fetch";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!process.env.GOOGLE_SEARCH_KEY || !process.env.GOOGLE_SEARCH_CX) {
  throw new Error("Eksik Google Custom Search API bilgisi (GOOGLE_SEARCH_KEY, GOOGLE_SEARCH_CX)");
}
if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
  throw new Error("Firebase servis hesabı bilgileri eksik.");
}

// 🔥 Firebase başlatma
const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

// 🧠 Yardımcı: Google’dan logo arama
async function searchLogo(teamName) {
  const q = encodeURIComponent(`${teamName} football club logo`);
  const url = `https://www.googleapis.com/customsearch/v1?q=${q}&cx=${process.env.GOOGLE_SEARCH_CX}&key=${process.env.GOOGLE_SEARCH_KEY}&searchType=image&num=1`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.items || data.items.length === 0) {
    console.log(`❌ Google'da logo bulunamadı: ${teamName}`);
    return null;
  }

  const image = data.items[0].link;
  console.log(`✅ Logo bulundu: ${teamName} -> ${image}`);
  return image;
}

export default async function handler(req, res) {
  try {
    console.log("🔄 Logo güncelleme başlatıldı...");
    const teamsRef = db.collection("teams");
    const snapshot = await teamsRef.get();

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of snapshot.docs) {
      const team = doc.data();
      const teamName = team.name || "Bilinmeyen Takım";

      // Sadece logo boşsa veya "bilinmiyor" ise güncelle
      if (team.logo && team.logo !== "" && team.logo !== "bilinmiyor") {
        skipped++;
        continue;
      }

      try {
        const newLogo = await searchLogo(teamName);
        if (newLogo) {
          await doc.ref.update({ logo: newLogo });
          updated++;
        } else {
          errors++;
        }
      } catch (err) {
        console.error(`⚠️ ${teamName} için hata:`, err.message);
        errors++;
      }

      // 🔸 Rate limit koruması (Google limitini aşmamak için)
      await new Promise(r => setTimeout(r, 800));
    }

    res.status(200).json({
      ok: true,
      message: "Logo güncelleme tamamlandı.",
      summary: { updated, skipped, errors },
    });
  } catch (err) {
    console.error("🔥 Kritik hata:", err);
    res.status(500).json({ error: err.message });
  }
}
