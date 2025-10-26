// countdown.js - Maça countdown timer

function createCountdown(matchDate, container) {
  const now = new Date();
  const matchTime = new Date(matchDate);
  const diff = matchTime - now;
  
  // 6 saatten fazla ise countdown gösterme
  if (diff > 6 * 60 * 60 * 1000 || diff < 0) {
    return null;
  }
  
  const countdownElement = document.createElement('div');
  countdownElement.className = 'countdown-timer';
  countdownElement.style.cssText = `
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    color: white;
    padding: 0.75rem;
    border-radius: 12px;
    text-align: center;
    font-weight: bold;
    margin-bottom: 1rem;
    box-shadow: 0 4px 12px rgba(245, 87, 108, 0.3);
  `;
  
  function updateCountdown() {
    const now = new Date();
    const diff = matchTime - now;
    
    if (diff <= 0) {
      countdownElement.innerHTML = `
        <div style="font-size: 1.2rem;">🔴 MAÇ BAŞLADI!</div>
      `;
      return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    let timeText = '';
    if (hours > 0) {
      timeText = `${hours} saat ${minutes} dakika`;
    } else if (minutes > 0) {
      timeText = `${minutes} dakika ${seconds} saniye`;
    } else {
      timeText = `${seconds} saniye`;
    }
    
    countdownElement.innerHTML = `
      <div style="font-size: 0.75rem; opacity: 0.9; margin-bottom: 0.25rem;">⏰ Maça Kalan Süre</div>
      <div style="font-size: 1.2rem; letter-spacing: 1px;">${timeText}</div>
    `;
  }
  
  updateCountdown();
  const interval = setInterval(updateCountdown, 1000);
  
  // Cleanup için interval ID'yi sakla
  countdownElement.dataset.intervalId = interval;
  
  return countdownElement;
}

// Tüm countdown'ları temizle (sayfa yenilenince)
function cleanupCountdowns() {
  document.querySelectorAll('.countdown-timer').forEach(el => {
    const intervalId = el.dataset.intervalId;
    if (intervalId) {
      clearInterval(Number(intervalId));
    }
  });
}

// Export
window.createCountdown = createCountdown;
window.cleanupCountdowns = cleanupCountdowns;
