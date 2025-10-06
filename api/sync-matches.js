import admin from "firebase-admin";

// Firebase Admin başlatma (Vercel ortamında)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

function parseEventDate(ev) {
  try {
    const datePart = ev.dateEvent || "";
    const timePart = ev.strTime || "00:00:00";
    const iso = `${datePart}T${timePart}Z`;
    return admin.firestore.Timestamp.fromDate(new Date(iso));
  } catch {
    return admin.firestore.Timestamp.now();
  }
}

export default async function handler(req, res) {
  try {
    // Basit güvenlik: URL param key kontrolü
    if (req.query.key !== process.env.SECRET_KEY) {
      return res.status(403).json({ ok: false, error: "Unauthorized" });
    }

    const apiKey = process.env.THESPORTSDB_KEY;
    const endpoint = `https://www.thesportsdb.com/api/v1/json/123/eventsnextleague.php?id=4339`;

    const response = await fetch(endpoint);
    const data = await response.json();
    const events = data.events || [];

    let added = 0;
    const batch = db.batch();

    for (const ev of events) {
      const docId = `ts_${ev.idEvent}`;
      const docRef = db.collection("matches").doc(docId);
      batch.set(
        docRef,
        {
          home: ev.strHomeTeam,
          away: ev.strAwayTeam,
          date: parseEventDate(ev),
          coverImage: ev.strThumb || null,
          source: "thesportsdb",
          sourceId: ev.idEvent
        },
        { merge: true }
      );
      added++;
    }

    await batch.commit();

    res.json({ ok: true, message: `${added} maç eklendi` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
