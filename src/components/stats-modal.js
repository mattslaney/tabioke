/**
 * Statistics Modal Web Component
 * Displays practice statistics including leaderboard, time tracking, and session counts
 */
class StatsModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    this.isOpen = false;
    this.currentPeriod = 'all'; // 'week', 'month', 'year', 'all'
    
    // Time tracking state
    this.isPageVisible = true;
    this.currentSongKey = null;
    this.sessionStartTime = null;
    this.tabViewStartTime = null;
    this.videoPlayStartTime = null;
    this.isVideoPlaying = false;
    
    // Bind methods
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleVideoStateChange = this.handleVideoStateChange.bind(this);
    this.handleTabMetadataLoaded = this.handleTabMetadataLoaded.bind(this);
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.startTracking();
  }

  disconnectedCallback() {
    this.stopTracking();
  }

  /**
   * Get the storage key for stats
   */
  getStorageKey() {
    return 'tabioke-practice-stats';
  }

  /**
   * Load stats from localStorage
   */
  loadStats() {
    try {
      const stored = localStorage.getItem(this.getStorageKey());
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load stats:', e);
    }
    return { songs: {}, lastUpdated: Date.now() };
  }

  /**
   * Save stats to localStorage
   */
  saveStats(stats) {
    try {
      stats.lastUpdated = Date.now();
      localStorage.setItem(this.getStorageKey(), JSON.stringify(stats));
    } catch (e) {
      console.warn('Failed to save stats:', e);
    }
  }

  /**
   * Generate a key for a song based on title and artist
   */
  generateSongKey(title, artist) {
    const t = (title || 'Unknown').toLowerCase().trim();
    const a = (artist || 'Unknown').toLowerCase().trim();
    return `${t}|${a}`;
  }

  /**
   * Get or create song stats entry
   */
  getSongStats(stats, songKey) {
    if (!stats.songs[songKey]) {
      const [title, artist] = songKey.split('|');
      stats.songs[songKey] = {
        title: title || 'Unknown',
        artist: artist || 'Unknown',
        totalTabTime: 0, // Time with tab open (page visible)
        totalVideoTime: 0, // Time with video playing
        sessions: [], // Array of session timestamps
        practiceSessionCount: 0 // Sessions >= 5 minutes
      };
    }
    return stats.songs[songKey];
  }

  /**
   * Start tracking time and events
   */
  startTracking() {
    // Track page visibility
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Track video state
    window.addEventListener('video-state-change', this.handleVideoStateChange);
    
    // Track when a new tab is loaded
    window.addEventListener('tab-metadata-loaded', this.handleTabMetadataLoaded);
    
    // Start tab view timer if page is visible
    if (document.visibilityState === 'visible') {
      this.tabViewStartTime = Date.now();
    }
    
    // Periodic save (every 30 seconds)
    this.saveInterval = setInterval(() => {
      this.saveCurrentProgress();
    }, 30000);
  }

  /**
   * Stop tracking
   */
  stopTracking() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('video-state-change', this.handleVideoStateChange);
    window.removeEventListener('tab-metadata-loaded', this.handleTabMetadataLoaded);
    
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    
    // Save final progress
    this.saveCurrentProgress();
  }

  /**
   * Handle page visibility changes
   */
  handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      // Page is now hidden - save progress and pause tracking
      this.saveCurrentProgress();
      this.isPageVisible = false;
      this.tabViewStartTime = null;
      this.videoPlayStartTime = null;
    } else {
      // Page is now visible - resume tracking
      this.isPageVisible = true;
      this.tabViewStartTime = Date.now();
      
      // Resume video time tracking if video was playing
      if (this.isVideoPlaying) {
        this.videoPlayStartTime = Date.now();
      }
    }
  }

  /**
   * Handle video state changes
   */
  handleVideoStateChange(e) {
    const { state } = e.detail;
    
    if (state === 'playing') {
      this.isVideoPlaying = true;
      if (this.isPageVisible) {
        this.videoPlayStartTime = Date.now();
      }
    } else {
      // Video paused, ended, or buffering
      if (this.isVideoPlaying && this.videoPlayStartTime && this.isPageVisible) {
        // Save the video time
        this.saveVideoTime();
      }
      this.isVideoPlaying = false;
      this.videoPlayStartTime = null;
    }
  }

  /**
   * Handle when a new tab is loaded
   */
  handleTabMetadataLoaded(e) {
    const { title, artist } = e.detail;
    
    // Save progress for previous song
    this.saveCurrentProgress();
    
    // Switch to new song
    const newKey = this.generateSongKey(title, artist);
    
    // Check if this is a new session for this song
    if (this.currentSongKey !== newKey) {
      this.currentSongKey = newKey;
      this.sessionStartTime = Date.now();
      
      // Record session start
      const stats = this.loadStats();
      const songStats = this.getSongStats(stats, newKey);
      songStats.sessions.push({
        start: Date.now(),
        end: null
      });
      this.saveStats(stats);
    }
    
    // Reset timers for new song
    if (this.isPageVisible) {
      this.tabViewStartTime = Date.now();
    }
    if (this.isVideoPlaying && this.isPageVisible) {
      this.videoPlayStartTime = Date.now();
    }
  }

  /**
   * Save video time progress
   */
  saveVideoTime() {
    if (!this.currentSongKey || !this.videoPlayStartTime) return;
    
    const elapsed = Date.now() - this.videoPlayStartTime;
    if (elapsed > 0) {
      const stats = this.loadStats();
      const songStats = this.getSongStats(stats, this.currentSongKey);
      songStats.totalVideoTime += elapsed;
      this.saveStats(stats);
    }
  }

  /**
   * Save current progress (called periodically and on visibility change)
   */
  saveCurrentProgress() {
    if (!this.currentSongKey) return;
    
    const stats = this.loadStats();
    const songStats = this.getSongStats(stats, this.currentSongKey);
    
    // Save tab view time
    if (this.tabViewStartTime && this.isPageVisible) {
      const elapsed = Date.now() - this.tabViewStartTime;
      if (elapsed > 0) {
        songStats.totalTabTime += elapsed;
        this.tabViewStartTime = Date.now(); // Reset for next interval
      }
    }
    
    // Save video time if playing
    if (this.videoPlayStartTime && this.isVideoPlaying && this.isPageVisible) {
      const elapsed = Date.now() - this.videoPlayStartTime;
      if (elapsed > 0) {
        songStats.totalVideoTime += elapsed;
        this.videoPlayStartTime = Date.now(); // Reset for next interval
      }
    }
    
    // Update session end time and check for practice sessions
    if (this.sessionStartTime && songStats.sessions.length > 0) {
      const currentSession = songStats.sessions[songStats.sessions.length - 1];
      currentSession.end = Date.now();
      
      // Count practice sessions (5 minutes or more)
      const sessionDuration = currentSession.end - currentSession.start;
      const fiveMinutes = 5 * 60 * 1000;
      
      // Recalculate practice session count
      songStats.practiceSessionCount = songStats.sessions.filter(s => {
        if (!s.end) return false;
        return (s.end - s.start) >= fiveMinutes;
      }).length;
    }
    
    this.saveStats(stats);
  }

  /**
   * Format milliseconds as human-readable time
   */
  formatTime(ms) {
    if (!ms || ms < 0) return '0m';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get start of period date
   */
  getPeriodStart(period) {
    const now = new Date();
    
    switch (period) {
      case 'today':
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        return todayStart.getTime();
      
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        weekStart.setHours(0, 0, 0, 0);
        return weekStart.getTime();
      
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return monthStart.getTime();
      
      case 'year':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        return yearStart.getTime();
      
      default:
        return 0; // All time
    }
  }

  /**
   * Filter stats by period
   */
  getStatsForPeriod(period) {
    const stats = this.loadStats();
    const periodStart = this.getPeriodStart(period);
    
    const result = {};
    
    for (const [key, song] of Object.entries(stats.songs)) {
      // Filter sessions to this period
      const periodSessions = song.sessions.filter(s => s.start >= periodStart);
      
      if (periodSessions.length === 0 && period !== 'all') {
        continue; // Skip songs with no activity in this period
      }
      
      // Calculate time in this period based on sessions
      let periodTabTime = 0;
      let periodVideoTime = 0;
      
      if (period === 'all') {
        periodTabTime = song.totalTabTime;
        periodVideoTime = song.totalVideoTime;
      } else {
        // Estimate time based on session proportion
        const totalSessionTime = song.sessions.reduce((sum, s) => {
          if (s.end) return sum + (s.end - s.start);
          return sum;
        }, 0);
        
        const periodSessionTime = periodSessions.reduce((sum, s) => {
          if (s.end) return sum + (s.end - s.start);
          return sum;
        }, 0);
        
        if (totalSessionTime > 0) {
          const ratio = periodSessionTime / totalSessionTime;
          periodTabTime = song.totalTabTime * ratio;
          periodVideoTime = song.totalVideoTime * ratio;
        }
      }
      
      const fiveMinutes = 5 * 60 * 1000;
      const periodPracticeSessions = periodSessions.filter(s => {
        if (!s.end) return false;
        return (s.end - s.start) >= fiveMinutes;
      }).length;
      
      result[key] = {
        title: song.title,
        artist: song.artist,
        tabTime: Math.round(periodTabTime),
        videoTime: Math.round(periodVideoTime),
        practiceSessions: periodPracticeSessions
      };
    }
    
    return result;
  }

  /**
   * Get leaderboard data (sorted by video time)
   */
  getLeaderboard(period) {
    const periodStats = this.getStatsForPeriod(period);
    
    return Object.entries(periodStats)
      .map(([key, data]) => ({
        key,
        ...data
      }))
      .sort((a, b) => b.videoTime - a.videoTime)
      .slice(0, 10); // Top 10
  }

  /**
   * Get totals for period
   */
  getTotals(period) {
    const periodStats = this.getStatsForPeriod(period);
    
    let totalTabTime = 0;
    let totalVideoTime = 0;
    let totalPracticeSessions = 0;
    
    for (const song of Object.values(periodStats)) {
      totalTabTime += song.tabTime;
      totalVideoTime += song.videoTime;
      totalPracticeSessions += song.practiceSessions;
    }
    
    return {
      tabTime: totalTabTime,
      videoTime: totalVideoTime,
      practiceSessions: totalPracticeSessions,
      songCount: Object.keys(periodStats).length
    };
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --bg-primary: #0a0a0a;
          --bg-secondary: #141414;
          --bg-tertiary: #1a1a1a;
          --bg-elevated: #1f1f1f;
          --text-primary: #fafafa;
          --text-secondary: #a1a1aa;
          --text-muted: #71717a;
          --border-color: #27272a;
          --accent-primary: #e07020;
          --accent-glow: rgba(224, 112, 32, 0.4);
          --success-color: #10b981;
          --font-display: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
        }

        .modal-overlay {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          z-index: 2000;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }

        .modal-overlay.open {
          display: flex;
        }

        .modal {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          width: 100%;
          max-width: 600px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px;
          border-bottom: 1px solid var(--border-color);
        }

        .modal-title {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .modal-title::before {
          content: '📊';
        }

        .close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 1.5rem;
          cursor: pointer;
          padding: 4px 8px;
          line-height: 1;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .close-btn:hover {
          color: var(--text-primary);
          background: var(--bg-tertiary);
        }

        .modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }

        .period-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }

        .period-tab {
          font-family: var(--font-display);
          font-size: 0.8rem;
          font-weight: 500;
          padding: 8px 16px;
          border: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .period-tab:hover {
          background: var(--bg-elevated);
          border-color: var(--accent-primary);
        }

        .period-tab.active {
          background: var(--accent-primary);
          color: var(--bg-primary);
          border-color: var(--accent-primary);
        }

        .stats-overview {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }

        .stat-value {
          font-family: var(--font-mono);
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--accent-primary);
          margin-bottom: 4px;
        }

        .stat-label {
          font-family: var(--font-display);
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .leaderboard-section {
          margin-top: 20px;
        }

        .section-title {
          font-family: var(--font-display);
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .section-title::before {
          content: '🏆';
        }

        .leaderboard {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          overflow: hidden;
        }

        .leaderboard-item {
          display: grid;
          grid-template-columns: 32px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .leaderboard-item:last-child {
          border-bottom: none;
        }

        .leaderboard-rank {
          font-family: var(--font-mono);
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-muted);
          text-align: center;
        }

        .leaderboard-rank.gold {
          color: #fbbf24;
        }

        .leaderboard-rank.silver {
          color: #9ca3af;
        }

        .leaderboard-rank.bronze {
          color: #d97706;
        }

        .leaderboard-song {
          overflow: hidden;
        }

        .song-title {
          font-family: var(--font-display);
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .song-artist {
          font-family: var(--font-display);
          font-size: 0.75rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .leaderboard-stats {
          display: flex;
          gap: 16px;
          font-family: var(--font-mono);
          font-size: 0.75rem;
        }

        .leaderboard-stat {
          text-align: right;
        }

        .leaderboard-stat-value {
          color: var(--text-primary);
          font-weight: 500;
        }

        .leaderboard-stat-label {
          color: var(--text-muted);
          font-size: 0.65rem;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: var(--text-muted);
        }

        .empty-state-icon {
          font-size: 2.5rem;
          margin-bottom: 12px;
        }

        .empty-state-text {
          font-family: var(--font-display);
          font-size: 0.9rem;
        }

        .clear-section {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid var(--border-color);
          text-align: center;
        }

        .clear-stats-btn {
          font-family: var(--font-display);
          font-size: 0.8rem;
          font-weight: 500;
          padding: 10px 20px;
          border: 1px solid #ef4444;
          background: transparent;
          color: #ef4444;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .clear-stats-btn:hover {
          background: #ef4444;
          color: white;
        }
      </style>

      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Practice Statistics</h2>
            <button class="close-btn" id="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <div class="period-tabs">
              <button class="period-tab" data-period="today">Today</button>
              <button class="period-tab" data-period="week">This Week</button>
              <button class="period-tab" data-period="month">This Month</button>
              <button class="period-tab" data-period="year">This Year</button>
              <button class="period-tab active" data-period="all">All Time</button>
            </div>
            
            <div class="stats-overview" id="stats-overview">
              <div class="stat-card">
                <div class="stat-value" id="total-tab-time">0m</div>
                <div class="stat-label">Time on Tab</div>
              </div>
              <div class="stat-card">
                <div class="stat-value" id="total-video-time">0m</div>
                <div class="stat-label">Video Practice</div>
              </div>
              <div class="stat-card">
                <div class="stat-value" id="total-sessions">0</div>
                <div class="stat-label">Practice Sessions</div>
              </div>
            </div>

            <div class="leaderboard-section">
              <h3 class="section-title">Most Practiced Songs</h3>
              <div class="leaderboard" id="leaderboard">
                <!-- Leaderboard items will be populated here -->
              </div>
            </div>

            <div class="clear-section">
              <button class="clear-stats-btn" id="clear-stats-btn">🗑️ Clear All Statistics</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    const overlay = this.shadowRoot.querySelector('.modal-overlay');
    const closeBtn = this.shadowRoot.getElementById('close-btn');
    const periodTabs = this.shadowRoot.querySelectorAll('.period-tab');
    
    // Close on X button
    closeBtn.addEventListener('click', () => this.close());
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });
    
    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
    
    // Period tab switching
    periodTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        periodTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentPeriod = tab.dataset.period;
        this.updateDisplay();
      });
    });
    
    // Clear stats button
    const clearBtn = this.shadowRoot.getElementById('clear-stats-btn');
    clearBtn.addEventListener('click', () => this.confirmClearStats());
    
    // Listen for open event
    window.addEventListener('show-stats-modal', () => this.open());
  }

  /**
   * Open the modal
   */
  open() {
    // Save current progress before showing stats
    this.saveCurrentProgress();
    
    this.isOpen = true;
    this.shadowRoot.querySelector('.modal-overlay').classList.add('open');
    this.updateDisplay();
  }

  /**
   * Close the modal
   */
  close() {
    this.isOpen = false;
    this.shadowRoot.querySelector('.modal-overlay').classList.remove('open');
  }

  /**
   * Update the display with current stats
   */
  updateDisplay() {
    const totals = this.getTotals(this.currentPeriod);
    const leaderboard = this.getLeaderboard(this.currentPeriod);
    
    // Update overview stats
    this.shadowRoot.getElementById('total-tab-time').textContent = 
      this.formatTime(totals.tabTime);
    this.shadowRoot.getElementById('total-video-time').textContent = 
      this.formatTime(totals.videoTime);
    this.shadowRoot.getElementById('total-sessions').textContent = 
      totals.practiceSessions.toString();
    
    // Update leaderboard
    const leaderboardEl = this.shadowRoot.getElementById('leaderboard');
    
    if (leaderboard.length === 0) {
      leaderboardEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎸</div>
          <div class="empty-state-text">No practice data yet.<br>Start practicing to see your stats!</div>
        </div>
      `;
      return;
    }
    
    leaderboardEl.innerHTML = leaderboard.map((item, index) => {
      const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
      
      return `
        <div class="leaderboard-item">
          <div class="leaderboard-rank ${rankClass}">${index + 1}</div>
          <div class="leaderboard-song">
            <div class="song-title">${this.escapeHtml(this.capitalizeWords(item.title))}</div>
            <div class="song-artist">${this.escapeHtml(this.capitalizeWords(item.artist))}</div>
          </div>
          <div class="leaderboard-stats">
            <div class="leaderboard-stat">
              <div class="leaderboard-stat-value">${this.formatTime(item.videoTime)}</div>
              <div class="leaderboard-stat-label">practiced</div>
            </div>
            <div class="leaderboard-stat">
              <div class="leaderboard-stat-value">${item.practiceSessions}</div>
              <div class="leaderboard-stat-label">sessions</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Capitalize words in a string
   */
  capitalizeWords(str) {
    if (!str) return str;
    return str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Confirm and clear all statistics
   */
  confirmClearStats() {
    const confirmed = confirm(
      'Are you sure you want to clear all practice statistics?\n\n' +
      'This will permanently delete:\n' +
      '• All time tracking data\n' +
      '• All practice session records\n' +
      '• The entire leaderboard\n\n' +
      'This action cannot be undone.'
    );
    
    if (confirmed) {
      this.clearAllStats();
    }
  }

  /**
   * Clear all statistics
   */
  clearAllStats() {
    // Reset localStorage
    localStorage.removeItem(this.getStorageKey());
    
    // Reset current session tracking
    this.currentSongKey = null;
    this.sessionStartTime = null;
    
    // Dispatch event so stopwatch can reset
    window.dispatchEvent(new CustomEvent('stats-cleared'));
    
    // Update display
    this.updateDisplay();
  }

  /**
   * Get current session time for stopwatch display
   */
  getCurrentSessionTime() {
    if (!this.tabViewStartTime || !this.isPageVisible) {
      return 0;
    }
    return Date.now() - this.tabViewStartTime;
  }
}

customElements.define('stats-modal', StatsModal);

export default StatsModal;
