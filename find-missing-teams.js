import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config(); // .env dosyasını okuyacak

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});

const db = admin.firestore();

async function findMissingTeams() {
  const matchesSnap = await db.collection("matches").get();
  const teamsSnap = await db.collection("teams").get();

  const existingTeams = new Set();
  teamsSnap.forEach(doc => existingTeams.add(doc.data().name.trim().toLowerCase()));

  const missingTeams = new Set();
  matchesSnap.forEach(doc => {
    const match = doc.data();
    const home = match.homeTeam?.trim().toLowerCase();
    const away = match.awayTeam?.trim().toLowerCase();

    if (home && !existingTeams.has(home)) missingTeams.add(match.homeTeam);
    if (away && !existingTeams.has(away)) missingTeams.add(match.awayTeam);
  });

  console.log("🔥 Eksik logolu takımlar:");
  console.log([...missingTeams]);
}

findMissingTeams();
