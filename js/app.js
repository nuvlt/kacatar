// js/app.js - SADECE DEĞİŞEN KISIM (updateUserInfoBar fonksiyonu)

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
