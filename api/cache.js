// cache.js - LocalStorage ile API cache (5 dakika TTL)

class ApiCache {
  constructor(ttl = 5 * 60 * 1000) { // 5 dakika default
    this.ttl = ttl;
    this.prefix = 'kacatar_cache_';
  }
  
  // Cache key oluştur
  _getKey(endpoint, params = {}) {
    const paramStr = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return `${this.prefix}${endpoint}${paramStr ? '_' + paramStr : ''}`;
  }
  
  // Cache'den oku
  get(endpoint, params = {}) {
    try {
      const key = this._getKey(endpoint, params);
      const cached = localStorage.getItem(key);
      
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      
      // TTL kontrolü
      if (now - timestamp > this.ttl) {
        localStorage.removeItem(key);
        return null;
      }
      
      console.log(`✅ Cache HIT: ${endpoint}`, params);
      return data;
    } catch (error) {
      console.warn('Cache read error:', error);
      return null;
    }
  }
  
  // Cache'e yaz
  set(endpoint, params = {}, data) {
    try {
      const key = this._getKey(endpoint, params);
      const cacheData = {
        data: data,
        timestamp: Date.now()
      };
      
      localStorage.setItem(key, JSON.stringify(cacheData));
      console.log(`💾 Cache SAVED: ${endpoint}`, params);
    } catch (error) {
      console.warn('Cache write error:', error);
      // LocalStorage dolu olabilir, eski cache'leri temizle
      this.cleanup();
    }
  }
  
  // Belirli endpoint'i temizle
  clear(endpoint, params = {}) {
    try {
      const key = this._getKey(endpoint, params);
      localStorage.removeItem(key);
      console.log(`🗑️ Cache CLEARED: ${endpoint}`, params);
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  }
  
  // Tüm cache'i temizle
  clearAll() {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
      console.log('🗑️ All cache CLEARED');
    } catch (error) {
      console.warn('Cache clearAll error:', error);
    }
  }
  
  // Eski cache'leri temizle (TTL geçmiş)
  cleanup() {
    try {
      const now = Date.now();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.prefix)) {
          try {
            const cached = JSON.parse(localStorage.getItem(key));
            if (now - cached.timestamp > this.ttl) {
              localStorage.removeItem(key);
            }
          } catch (e) {
            localStorage.removeItem(key);
          }
        }
      });
      console.log('🧹 Old cache CLEANED');
    } catch (error) {
      console.warn('Cache cleanup error:', error);
    }
  }
  
  // Cache'li fetch
  async fetchWithCache(url, options = {}, params = {}) {
    // Cache kontrolü
    const cached = this.get(url, params);
    if (cached) {
      return cached;
    }
    
    // API'den çek
    console.log(`🌐 API REQUEST: ${url}`, params);
    const response = await fetch(url, options);
    const data = await response.json();
    
    // Cache'e kaydet
    if (response.ok) {
      this.set(url, params, data);
    }
    
    return data;
  }
}

// Global instance
window.apiCache = new ApiCache();

// Sayfa yüklendiğinde eski cache'leri temizle
window.addEventListener('load', () => {
  window.apiCache.cleanup();
});

// Export helper fonksiyonları
window.getCachedScores = async function(filter = 'today') {
  return await window.apiCache.fetchWithCache(
    '/api/live-scores',
    {},
    { filter }
  );
};

window.clearScoresCache = function() {
  window.apiCache.clear('/api/live-scores', { filter: 'today' });
  window.apiCache.clear('/api/live-scores', { filter: 'yesterday' });
  window.apiCache.clear('/api/live-scores', { filter: 'week' });
};
