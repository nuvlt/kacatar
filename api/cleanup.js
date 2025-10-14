import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
apiKey: "AIzaSyDeCQtEWfOyE1hnJHb_W2ktSTqkfUjPJNc",
    authDomain: "kac-atar.firebaseapp.com",
    projectId: "kac-atar",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanupTeams() {
  const snap = await getDocs(collection(db, "teams"));
  const seen = new Set();
  let deleted = 0,
    updated = 0;

  for (const d of snap.docs) {
    const data = d.data();
    const name = (data.name || "").trim().toLowerCase();

    if (!name) {
      await deleteDoc(doc(db, "teams", d.id));
      deleted++;
      continue;
    }

    if (seen.has(name)) {
      await deleteDoc(doc(db, "teams", d.id));
      deleted++;
    } else {
      seen.add(name);
      if (!data.logo)
        await updateDoc(doc(db, "teams", d.id), {
          logo: "https://via.placeholder.com/80?text=No+Logo",
        });
      updated++;
    }
  }

  console.log(`Temizlik tamamlandı. Silinen: ${deleted}, Güncellenen: ${updated}`);
}

cleanupTeams();
