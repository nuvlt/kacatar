// confetti.js - Basit confetti efekti (bağımlılık yok)

function createConfetti() {
  const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
  const confettiCount = 50;
  const container = document.createElement('div');
  
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
    overflow: hidden;
  `;
  
  document.body.appendChild(container);
  
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    const size = Math.random() * 10 + 5;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.random() * 100;
    const animationDuration = Math.random() * 3 + 2;
    const delay = Math.random() * 0.5;
    
    confetti.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      top: -10px;
      left: ${left}%;
      opacity: 1;
      transform: rotate(${Math.random() * 360}deg);
      animation: confettiFall ${animationDuration}s linear ${delay}s forwards;
    `;
    
    container.appendChild(confetti);
  }
  
  // CSS animation ekle
  if (!document.getElementById('confetti-styles')) {
    const style = document.createElement('style');
    style.id = 'confetti-styles';
    style.textContent = `
      @keyframes confettiFall {
        0% {
          transform: translateY(0) rotate(0deg);
          opacity: 1;
        }
        100% {
          transform: translateY(100vh) rotate(720deg);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  // 5 saniye sonra temizle
  setTimeout(() => {
    container.remove();
  }, 5000);
}

// Success mesajı ile birlikte
function showSuccessMessage(prediction) {
  const message = document.createElement('div');
  message.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem 3rem;
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    z-index: 10000;
    font-size: 1.5rem;
    font-weight: bold;
    text-align: center;
    animation: successPop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  `;
  
  message.innerHTML = `
    <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
    <div>Tahminin Kaydedildi!</div>
    <div style="font-size: 2rem; margin-top: 1rem; color: #ffd700;">${prediction}</div>
  `;
  
  // Animation ekle
  if (!document.getElementById('success-styles')) {
    const style = document.createElement('style');
    style.id = 'success-styles';
    style.textContent = `
      @keyframes successPop {
        0% {
          transform: translate(-50%, -50%) scale(0);
          opacity: 0;
        }
        50% {
          transform: translate(-50%, -50%) scale(1.1);
        }
        100% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(message);
  
  // 2 saniye sonra kaldır
  setTimeout(() => {
    message.style.transition = 'opacity 0.3s, transform 0.3s';
    message.style.opacity = '0';
    message.style.transform = 'translate(-50%, -50%) scale(0.8)';
    setTimeout(() => message.remove(), 300);
  }, 2000);
}

// Export (global scope'a ekle)
window.celebrateVote = function(prediction) {
  createConfetti();
  showSuccessMessage(prediction);
};
