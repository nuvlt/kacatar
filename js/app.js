// public/js/app.js - Main Application Logic (FIXED + Header Login Button)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInAnonymously, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDeCQtEWfOyE1hnJHb_W2ktSTqkfUjPJNc",
  authDomain: "kac-atar.firebaseapp.com",
  projectId: "kac-atar",
  storageBucket: "kac-atar.firebasestorage.app",
  messagingSenderId: "1070494452209",
  appId: "1:1070494452209:web:e24a9bbd0b4fb543a79c50",
  measurementId: "G-8ZMRLXBX7Z"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

let currentUser = null;
let isGoogleUser = false;
let allMatches = [];
let currentLeague = 'all';

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='32' fill='%239ca3af'%3E%3F%3C/text%3E%3C/svg%3E";

const leagueNames = {
  'PL': '⚽ Premier League',
  'PD': '⚽ La Liga',
  'SA': '⚽ Serie A',
  'BL1': '⚽ Bundesliga',
  'FL1': '⚽ Ligue 1',
  'CL': '🏆 Şampiyonlar Ligi',
  'super-lig': '🇹🇷 Süper Lig',
  'Süper Lig': '🇹🇷 Süper Lig',
};

// ========== GOOGLE LOGIN ==========
window.loginWithGoogle = async function() {
  try {
    console.log('🔐 Google login başlatılıyor...');
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    console.log('✅ Google login successful:', user.displayName);
    await saveUserProfile(user);
    window.closeLoginModal();
    showWelcomeMessage(user.displayName);
    
    // User info bar'ı güncelle
    updateUserInfoBar(user);
  } catch (error) {
    console.error('❌ Google login error:', error);
    if (error.code === 'auth/popup-closed-by-user') {
      console.log('Kullanıcı popup\'ı kapattı');
      return;
    }
    if (error.code === 'auth/cancelled-popup-request') {
      console.log('Popup isteği iptal edildi');
      return;
    }
    alert('❌ Giriş başarısız: ' + error.message);
  }
};

window.logout = async function() {
  if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
    try {
      await signOut(auth);
      await signInAnonymously(auth);
      
      // Header butonlarını güncelle
      updateUserInfoBar(null);
      
      isGoogleUser = false;
      alert('👋 Çıkış yapıldı. Misafir moduna geçildi.');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
};

async function saveUserProfile(user) {
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    
    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastLogin: new Date().toISOString(),
    };
    
    // Eğer kullanıcı daha önce yoksa stats başlat
    if (!userSnap.exists()) {
      userData.stats = {
        totalPredictions: 0,
        correctPredictions: 0,
        points: 0,
        streak: 0
      };
    }
    
    await setDoc(userRef, userData, { merge: true });
    console.log('✅ User profile saved');
  } catch (error) {
    console.error('❌ Save user error:', error);
  }
}

function updateUserInfoBar(user) {
  try {
    // Header'daki user info (desktop)
    const headerUserInfo = document.getElementById('headerUserInfo');
    const headerLoginBtn = document.getElementById('headerLoginBtn');
    const headerAvatar = document.getElementById('headerUserAvatar');
    const headerName = document.getElementById('headerUserName');
    const headerPoints = document.getElementById('headerUserPoints');
    
    // Mobile user info
    const mobileUserInfo = document.getElementById('mobileUserInfo');
    const mobileLoginBtn = document.getElementById('mobileLoginBtn');
    const mobileAvatar = document.getElementById('mobileUserAvatar');
    const mobileName = document.getElementById('mobileUserName');
    const mobilePoints = document.getElementById('mobileUserPoints');
    
    if (user) {
      const avatarUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}`;
      
      // Desktop
      if (headerAvatar && headerName && headerPoints && headerUserInfo && headerLoginBtn) {
        headerAvatar.src = avatarUrl;
        headerName.textContent = user.displayName;
        
        // Puanları getir
        getDoc(doc(db, "users", user.uid)).then(userDoc => {
          if (userDoc.exists()) {
            const points = userDoc.data().stats?.points || 0;
            if (headerPoints) headerPoints.textContent = `${points} puan`;
            if (mobilePoints) mobilePoints.textContent = `${points} puan`;
          }
        }).catch(e => console.error('Points fetch error:', e));
        
        headerUserInfo.classList.remove('hidden');
        headerLoginBtn.classList.add('hidden');
      }
      
      // Mobile
      if (mobileAvatar && mobileName && mobilePoints && mobileUserInfo && mobileLoginBtn) {
        mobileAvatar.src = avatarUrl;
        mobileName.textContent = user.displayName;
        
        mobileUserInfo.classList.remove('hidden');
        mobileLoginBtn.classList.add('hidden');
      }
      
      console.log('✅ Header user info updated');
    } else {
      // Logged out - show login buttons
      if (headerLoginBtn && headerUserInfo) {
        headerLoginBtn.classList.remove('hidden');
        headerUserInfo.classList.add('hidden');
      }
      if (mobileLoginBtn && mobileUserInfo) {
        mobileLoginBtn.classList.remove('hidden');
        mobileUserInfo.classList.add('hidden');
      }
    }
  } catch (error) {
    console.error('❌ Update user info bar error:', error);
  }
}

function showWelcomeMessage(name) {
  const message = document.createElement('div');
  message.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white; padding: 2rem 3rem; border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3); z-index: 10000;
    text-align: center; animation: successPop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  `;
  message.innerHTML = `
    <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
    <div style="font-size: 1.5rem; font-weight: bold;">Hoş Geldin!</div>
    <div style="font-size: 1.2rem; margin-top: 0.5rem;">${name}</div>
    <div style="font-size: 0.9rem; margin-top: 1rem; opacity: 0.9;">Artık tahminlerin kayıt altında!</div>
  `;
  document.body.appendChild(message);
  setTimeout(() => {
    message.style.transition = 'opacity 0.3s';
    message.style.opacity = '0';
    setTimeout(() => message.remove(), 300);
  }, 3000);
}

// ========== AUTH STATE LISTENER ==========
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    isGoogleUser = user.providerData.some(p => p.providerId === 'google.com');
    
    console.log(`👤 User authenticated: ${isGoogleUser ? 'Google' : 'Anonymous'}`);
    
    if (isGoogleUser) {
      updateUserInfoBar(user);
      
      // Login prompt'u bir daha gösterme
      localStorage.setItem('loginPromptShown', 'true');
    } else {
      // Anonymous user - show login buttons
      updateUserInfoBar(null);
    }
  } else {
    console.log('👤 No user, signing in anonymously...');
    await signInAnonymously(auth);
  }
});

// ========== LOGIN PROMPT (5 saniye sonra) ==========
setTimeout(() => {
  if (!isGoogleUser && !localStorage.getItem('loginPromptShown')) {
    console.log('📢 Showing login prompt...');
    window.openLoginModal();
    localStorage.setItem('loginPromptShown', 'true');
  }
}, 5000);

// ========== DATE HELPERS ==========
function parseDateField(dateField, timeField) {
  if (!dateField) return null;
  if (typeof dateField === "object" && typeof dateField.seconds === "number")
    return new Date(dateField.seconds * 1000);
  if (typeof dateField === "string") {
    let s = dateField;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s) && timeField) s = `${s}T${timeField}`;
    const d = new Date(s);
    if (!isNaN(d)) return d;
  }
  return null;
}

function formatMatchDate(match) {
  const d = parseDateField(match.date, match.time);
  if (d) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const matchDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrowDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    
    if (matchDate.getTime() === todayDate.getTime()) {
      return '🔴 Bugün ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } else if (matchDate.getTime() === tomorrowDate.getTime()) {
      return '🟢 Yarın ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  return "Tarih bilinmiyor";
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ========== LOAD MATCHES ==========
async function loadMatches() {
  const container = document.getElementById('matchesContainer');

  try {
    console.log('🔄 Loading matches...');
    const querySnapshot = await getDocs(collection(db, "matches"));
    allMatches = [];
    
    querySnapshot.forEach((docSnap) => {
      const m = docSnap.data() || {};
      m._id = docSnap.id;
      allMatches.push(m);
    });

    // 🇹🇷 ÖNCE TARİHE GÖRE SIRALA, SONRA SÜPER LİG'İ ÖNE ÇEK
    allMatches.sort((a, b) => {
      const da = parseDateField(a.date, a.time);
      const db = parseDateField(b.date, b.time);
      
      // Tarihe göre sırala
      if (da && db) {
        const timeDiff = da - db;
        
        // Eğer aynı gün içindeyse (veya 6 saat fark varsa)
        if (Math.abs(timeDiff) < 6 * 60 * 60 * 1000) {
          // Süper Lig önceliği
          const aIsSuperLig = (a.league === 'super-lig' || a.league === 'Süper Lig' || a.competition === 'super-lig');
          const bIsSuperLig = (b.league === 'super-lig' || b.league === 'Süper Lig' || b.competition === 'super-lig');
          
          if (aIsSuperLig && !bIsSuperLig) return -1;
          if (!aIsSuperLig && bIsSuperLig) return 1;
        }
        
        return timeDiff;
      }
      
      if (da) return -1;
      if (db) return 1;
      return 0;
    });

    console.log(`✅ ${allMatches.length} matches loaded`);
    updateStats();
    renderMatches();
  } catch (error) {
    console.error("❌ Matches load error:", error);
    container.innerHTML = '<div class="col-span-full text-center text-red-500 py-8">❌ Maçlar yüklenemedi</div>';
  }
}

function updateStats() {
  const totalVotes = allMatches.reduce((sum, m) => sum + (m.voteCount || 0), 0);
  document.getElementById('totalMatchesCount').textContent = allMatches.length;
  document.getElementById('totalVotesCount').textContent = totalVotes;
}

function renderMatches() {
  const container = document.getElementById('matchesContainer');
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();

  window.cleanupCountdowns();

  let filtered = allMatches.filter(match => {
    const matchDate = parseDateField(match.date, match.time);
    if (matchDate) {
      const now = new Date();
      const hoursSinceMatch = (now - matchDate) / (1000 * 60 * 60);
      if (hoursSinceMatch > 3) return false;
    }

    if (currentLeague !== 'all') {
      const matchLeague = match.league || match.competition;
      if (currentLeague === 'super-lig') {
        const isSuperlig = matchLeague === 'super-lig' || matchLeague === 'Süper Lig' || match.competition === 'super-lig';
        if (!isSuperlig) return false;
      } else {
        if (matchLeague !== currentLeague) return false;
      }
    }

    if (searchTerm) {
      const home = (match.home || "").toLowerCase();
      const away = (match.away || "").toLowerCase();
      return home.includes(searchTerm) || away.includes(searchTerm);
    }

    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center text-gray-500 py-16"><div class="text-6xl mb-4">😔</div><p class="text-xl">Maç bulunamadı</p></div>';
    return;
  }

  container.innerHTML = filtered.map(match => {
    const matchId = match._id;
    const home = match.home || "Bilinmiyor";
    const away = match.away || "Bilinmiyor";
    const homeLogo = (match.homeLogo && match.homeLogo !== "") ? match.homeLogo : PLACEHOLDER;
    const awayLogo = (match.awayLogo && match.awayLogo !== "") ? match.awayLogo : PLACEHOLDER;
    const dateText = formatMatchDate(match);
    const leagueName = leagueNames[match.league] || match.league || "";
    const popularText = match.popularPrediction || "—";
    const voteCount = match.voteCount || 0;
    
    const matchDate = parseDateField(match.date, match.time);

    return `
      <div class="match-card bg-white rounded-2xl shadow-md overflow-hidden" data-id="${matchId}" data-match-date="${matchDate ? matchDate.toISOString() : ''}">
        <div class="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-white text-sm font-semibold flex justify-between items-center">
          <div class="flex items-center gap-2">
            <span>${leagueName}</span>
            <span class="countdown-container-inline"></span>
          </div>
          <span class="text-xs opacity-90">${dateText}</span>
        </div>

        <div class="p-6">
          <div class="grid grid-cols-3 gap-4 items-center mb-6">
            <div class="text-center">
              <img src="${homeLogo}" alt="${escapeHtml(home)}" class="w-16 h-16 mx-auto mb-2 object-contain" onerror="this.src='${PLACEHOLDER}'">
              <p class="font-bold text-sm text-gray-800">${escapeHtml(home)}</p>
            </div>
            <div class="text-center">
              <span class="text-2xl font-bold text-gray-300">VS</span>
            </div>
            <div class="text-center">
              <img src="${awayLogo}" alt="${escapeHtml(away)}" class="w-16 h-16 mx-auto mb-2 object-contain" onerror="this.src='${PLACEHOLDER}'">
              <p class="font-bold text-sm text-gray-800">${escapeHtml(away)}</p>
            </div>
          </div>

          <div class="flex items-center justify-center gap-3 mb-4">
            <input type="number" min="0" max="10" placeholder="0" class="score-input home-score w-16 h-16 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl">
            <span class="text-3xl font-bold text-gray-400">-</span>
            <input type="number" min="0" max="10" placeholder="0" class="score-input away-score w-16 h-16 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl">
          </div>

          <button class="vote-button w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-bold hover:shadow-lg transition transform hover:scale-105">
            🎯 Tahmin Et
          </button>

          <div class="mt-4 p-3 bg-gray-50 rounded-xl text-center">
            <p class="text-xs text-gray-500 mb-1">En Popüler Tahmin</p>
            <p class="font-bold text-lg text-purple-600">${escapeHtml(popularText)}</p>
            <p class="text-xs text-gray-400 mt-1">${voteCount} kişi tahmin yaptı</p>
          </div>

          <button onclick="window.shareMatchFunc('${matchId}', '${escapeHtml(home)}', '${escapeHtml(away)}')" class="mt-3 w-full px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-semibold hover:bg-blue-200 transition text-sm">
            📤 Maçı Paylaş
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  document.querySelectorAll('.match-card').forEach(card => {
    const matchDate = card.dataset.matchDate;
    const countdownContainer = card.querySelector('.countdown-container-inline');
    if (matchDate && countdownContainer) {
      const countdown = window.createCountdown(matchDate);
      if (countdown) countdownContainer.appendChild(countdown);
    }
  });
}

// ========== FILTER BY LEAGUE ==========
window.filterByLeague = function(league) {
  currentLeague = league;
  document.querySelectorAll('.league-btn').forEach(btn => {
    btn.classList.remove('bg-purple-600', 'text-white', 'shadow-lg');
    btn.classList.add('bg-gray-100');
  });
  event.target.classList.remove('bg-gray-100');
  event.target.classList.add('bg-purple-600', 'text-white', 'shadow-lg');
  renderMatches();
};

// ========== SHARE MATCH ==========
window.shareMatchFunc = function(matchId, home, away) {
  const url = `${window.location.origin}/mac-detay.html?id=${matchId}`;
  if (navigator.share) {
    navigator.share({ title: `${home} vs ${away}`, text: `${home} - ${away} maçı için skor tahmini yap!`, url: url })
      .catch(() => copyToClipboard(url));
  } else {
    copyToClipboard(url);
  }
};

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('✅ Maç linki kopyalandı!');
  }).catch(() => {
    prompt('Linki kopyalayın:', text);
  });
}

// ========== SEARCH ==========
document.getElementById('searchInput').addEventListener('input', renderMatches);

// ========== VOTE HANDLER ==========
document.addEventListener("click", async (e) => {
  if (e.target.closest(".vote-button")) {
    const btn = e.target.closest(".vote-button");
    const card = e.target.closest(".match-card");
    const matchId = card.dataset.id;
    const homeScore = card.querySelector(".home-score").value;
    const awayScore = card.querySelector(".away-score").value;

    if (!homeScore || !awayScore) {
      alert("⚠️ Lütfen her iki takım için de skor girin!");
      return;
    }

    if (!currentUser) {
      alert("⚠️ Lütfen bekleyin, giriş yapılıyor...");
      return;
    }

    const prediction = `${homeScore}-${awayScore}`;
    btn.disabled = true;
    btn.textContent = "⏳ Kaydediliyor...";

    try {
      const response = await fetch('/api/submit-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, prediction, userId: currentUser.uid })
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        console.log('✅ Vote submitted:', result);
        window.celebrateVote(prediction);
        setTimeout(async () => { await loadMatches(); }, 2500);
      } else {
        alert(`❌ ${result.error || result.message || 'Tahmin kaydedilemedi'}`);
      }
    } catch (err) {
      console.error("❌ Vote error:", err);
      alert("❌ Bağlantı hatası: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "🎯 Tahmin Et";
    }
  }
});

// ========== INITIAL LOAD ==========
loadMatches();

// ========== AUTO REFRESH (5 dakika) ==========
setInterval(() => {
  console.log('🔄 Auto-refreshing...');
  renderMatches();
}, 5 * 60 * 1000);
