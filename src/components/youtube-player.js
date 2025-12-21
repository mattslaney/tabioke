/**
 * YouTube Player Web Component
 * Embeds YouTube video using the IFrame API with custom controls
 */
class YoutubePlayer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    this.player = null;
    this.videoId = null;
    this.isReady = false;
    this.progressInterval = null;
    
    // Playback settings
    this.playbackRate = 1;
    this.loopEnabled = false;
    this.loopStart = 0;
    this.loopEnd = 100; // percentage
    this.duration = 0;
    this.isMuted = false;
  }

  connectedCallback() {
    this.render();
    this.loadYouTubeAPI();
    this.setupEventListeners();
    this.loadFromStorage();
  }

  /**
   * Load saved settings from localStorage
   */
  loadFromStorage() {
    try {
      const savedUrl = localStorage.getItem('tabioke-youtube-url');
      const savedLoopEnabled = localStorage.getItem('tabioke-loop-enabled');
      const savedLoopStart = localStorage.getItem('tabioke-loop-start');
      const savedLoopEnd = localStorage.getItem('tabioke-loop-end');

      if (savedUrl) {
        const urlInput = this.shadowRoot.getElementById('url-input');
        if (urlInput) {
          urlInput.value = savedUrl;
          // Auto-load the video after a short delay to ensure API is ready
          setTimeout(() => this.loadVideo(), 500);
        }
      }

      if (savedLoopEnabled !== null) {
        this.loopEnabled = savedLoopEnabled === 'true';
        const loopToggle = this.shadowRoot.getElementById('loop-toggle');
        const loopStart = this.shadowRoot.getElementById('loop-start');
        const loopEnd = this.shadowRoot.getElementById('loop-end');
        if (loopToggle) loopToggle.checked = this.loopEnabled;
        if (loopStart) {
          loopStart.disabled = !this.loopEnabled;
          loopStart.style.display = this.loopEnabled ? 'block' : 'none';
        }
        if (loopEnd) {
          loopEnd.disabled = !this.loopEnabled;
          loopEnd.style.display = this.loopEnabled ? 'block' : 'none';
        }
      } else {
        // Default: loop is disabled, hide sliders
        const loopStart = this.shadowRoot.getElementById('loop-start');
        const loopEnd = this.shadowRoot.getElementById('loop-end');
        if (loopStart) loopStart.style.display = 'none';
        if (loopEnd) loopEnd.style.display = 'none';
      }

      if (savedLoopStart !== null) {
        this.loopStart = parseFloat(savedLoopStart);
        const loopStartSlider = this.shadowRoot.getElementById('loop-start');
        if (loopStartSlider) loopStartSlider.value = this.loopStart;
      }

      if (savedLoopEnd !== null) {
        this.loopEnd = parseFloat(savedLoopEnd);
        const loopEndSlider = this.shadowRoot.getElementById('loop-end');
        if (loopEndSlider) loopEndSlider.value = this.loopEnd;
      }

      const savedMuted = localStorage.getItem('tabioke-muted');
      if (savedMuted !== null) {
        this.isMuted = savedMuted === 'true';
      }

      this.updateRangeVisual();
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
    }
  }

  /**
   * Save settings to localStorage
   */
  saveToStorage() {
    try {
      const urlInput = this.shadowRoot.getElementById('url-input');
      if (urlInput && urlInput.value) {
        localStorage.setItem('tabioke-youtube-url', urlInput.value);
      }
      localStorage.setItem('tabioke-loop-enabled', this.loopEnabled.toString());
      localStorage.setItem('tabioke-loop-start', this.loopStart.toString());
      localStorage.setItem('tabioke-loop-end', this.loopEnd.toString());
      localStorage.setItem('tabioke-muted', this.isMuted.toString());
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  disconnectedCallback() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
    if (this.player) {
      this.player.destroy();
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          --bg-primary: #0d0d0d;
          --bg-secondary: #1a1a1a;
          --bg-tertiary: #252525;
          --bg-elevated: #2d2d2d;
          --text-primary: #f0e6d3;
          --text-secondary: #a89f8c;
          --text-muted: #6b6459;
          --accent-primary: #e07020;
          --accent-secondary: #c45c18;
          --accent-glow: rgba(224, 112, 32, 0.4);
          --border-color: #3a3a3a;
          --font-display: 'Outfit', sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
          --success: #4ade80;
          --error: #ef4444;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .title {
          font-family: var(--font-display);
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .title::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent-primary);
          box-shadow: 0 0 6px var(--accent-glow);
        }

        .url-input-container {
          display: flex;
          gap: 6px;
          padding: 6px 12px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .url-input {
          flex: 1;
          font-family: var(--font-display);
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 5px 8px;
          color: var(--text-primary);
          font-size: 0.75rem;
          min-width: 0;
        }

        .url-input:focus {
          outline: none;
          border-color: var(--accent-primary);
        }

        .url-input::placeholder {
          color: var(--text-muted);
        }

        .load-btn {
          font-family: var(--font-display);
          font-weight: 500;
          cursor: pointer;
          border: none;
          border-radius: 4px;
          background: var(--accent-primary);
          color: var(--bg-primary);
          padding: 5px 12px;
          font-size: 0.75rem;
          flex-shrink: 0;
        }

        .load-btn:hover {
          filter: brightness(1.1);
        }

        .content {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #000;
          position: relative;
          min-height: 0;
        }

        .player-container {
          flex: 1;
          position: relative;
          min-height: 80px;
        }

        #player-wrapper {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }

        #player-wrapper iframe {
          width: 100%;
          height: 100%;
        }

        .placeholder {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary);
          color: var(--text-muted);
          gap: 6px;
        }

        .placeholder-icon {
          font-size: 1.5rem;
          opacity: 0.5;
        }

        .placeholder-text {
          font-size: 0.7rem;
        }

        /* Custom Controls */
        .controls-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          background: var(--bg-tertiary);
          border-top: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .control-btn {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-elevated);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .control-btn:hover {
          background: var(--bg-tertiary);
          border-color: var(--accent-primary);
          color: var(--accent-primary);
        }

        .control-btn.active {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          color: var(--bg-primary);
        }

        .control-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .speed-control {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 4px;
        }

        .speed-label {
          font-size: 0.6rem;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .speed-select {
          font-family: var(--font-mono);
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 0.7rem;
          cursor: pointer;
          padding: 0;
        }

        .speed-select:focus {
          outline: none;
        }

        .speed-select option {
          background: var(--bg-tertiary);
        }

        .time-display {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--text-secondary);
          margin-left: auto;
          white-space: nowrap;
        }

        /* Loop Controls */
        .loop-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px 12px;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .loop-toggle {
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          flex-shrink: 0;
        }

        .loop-toggle input {
          display: none;
        }

        .loop-checkbox {
          width: 14px;
          height: 14px;
          border-radius: 3px;
          border: 2px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .loop-toggle input:checked + .loop-checkbox {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
        }

        .loop-checkbox::after {
          content: '✓';
          font-size: 9px;
          color: var(--bg-primary);
          opacity: 0;
        }

        .loop-toggle input:checked + .loop-checkbox::after {
          opacity: 1;
        }

        .loop-label {
          font-size: 0.65rem;
          color: var(--text-secondary);
          text-transform: uppercase;
        }

        .loop-times {
          font-family: var(--font-mono);
          font-size: 0.65rem;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        /* Range Slider */
        .range-slider-container {
          flex: 1;
          position: relative;
          height: 14px;
          min-width: 60px;
        }

        .range-track {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          left: 6px;
          right: 6px;
          height: 4px;
          background: var(--bg-primary);
          border-radius: 2px;
          cursor: pointer;
        }

        .range-selected {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          height: 4px;
          background: var(--accent-primary);
          border-radius: 2px;
          opacity: 0;
          left: 6px;
        }

        .range-progress {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          left: 6px;
          height: 4px;
          background: var(--success);
          border-radius: 2px;
          width: 0;
          opacity: 0.5;
        }

        .range-slider-container input[type="range"] {
          position: absolute;
          width: 100%;
          height: 14px;
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          pointer-events: none;
          top: 0;
          left: 0;
          margin: 0;
        }

        .range-slider-container input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--accent-primary);
          cursor: pointer;
          pointer-events: all;
          border: 2px solid var(--bg-primary);
          box-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }

        .range-slider-container input[type="range"]::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--accent-primary);
          cursor: pointer;
          pointer-events: all;
          border: 2px solid var(--bg-primary);
        }

        .range-slider-container input[type="range"]:disabled::-webkit-slider-thumb {
          background: var(--text-muted);
          cursor: default;
        }

        .range-slider-container input[type="range"]:disabled::-moz-range-thumb {
          background: var(--text-muted);
          cursor: default;
        }

        /* Status Bar */
        .status-bar {
          display: flex;
          align-items: center;
          padding: 3px 12px;
          background: var(--bg-tertiary);
          border-top: 1px solid var(--border-color);
          font-size: 0.6rem;
          color: var(--text-secondary);
          flex-shrink: 0;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .status-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--text-muted);
        }

        .status-dot.ready {
          background: var(--success);
        }

        .status-dot.playing {
          background: var(--accent-primary);
          animation: pulse 1s infinite;
        }

        .status-dot.error {
          background: var(--error);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .hidden {
          display: none !important;
        }
      </style>

      <div class="header">
        <span class="title">YouTube Video</span>
      </div>
      
      <div class="url-input-container">
        <input 
          type="url" 
          class="url-input" 
          id="url-input"
          placeholder="Paste YouTube URL here..."
        >
        <button class="load-btn" id="load-btn">Load</button>
      </div>

      <div class="content">
        <div class="player-container">
          <div id="player-wrapper"></div>
          <div class="placeholder" id="placeholder">
            <div class="placeholder-icon">▶</div>
            <div class="placeholder-text">Paste a YouTube URL above</div>
          </div>
        </div>
      </div>

      <!-- Custom Controls -->
      <div class="controls-bar">
        <button class="control-btn" id="play-pause-btn" title="Play/Pause" disabled>▶</button>
        <button class="control-btn" id="stop-btn" title="Stop" disabled>⬛</button>
        <button class="control-btn" id="mute-btn" title="Mute/Unmute" disabled>🔊</button>
        
        <div class="speed-control">
          <span class="speed-label">Speed</span>
          <select class="speed-select" id="speed-select" disabled>
            <option value="0.25">0.25×</option>
            <option value="0.5">0.5×</option>
            <option value="0.75">0.75×</option>
            <option value="1" selected>1×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
            <option value="1.75">1.75×</option>
            <option value="2">2×</option>
          </select>
        </div>

        <div class="time-display" id="time-display">0:00 / 0:00</div>
      </div>

      <!-- Loop Controls -->
      <div class="loop-bar">
        <label class="loop-toggle">
          <input type="checkbox" id="loop-toggle">
          <div class="loop-checkbox"></div>
          <span class="loop-label">Loop</span>
        </label>
        <div class="range-slider-container">
          <div class="range-track"></div>
          <div class="range-progress" id="range-progress"></div>
          <div class="range-selected" id="range-selected"></div>
          <input type="range" id="loop-start" min="0" max="100" value="0" step="0.1" disabled>
          <input type="range" id="loop-end" min="0" max="100" value="100" step="0.1" disabled>
        </div>
        <span class="loop-times" id="loop-times">0:00 - 0:00</span>
      </div>

      <div class="status-bar">
        <div class="status-indicator">
          <div class="status-dot" id="status-dot"></div>
          <span id="status-text">Ready</span>
        </div>
      </div>
    `;
  }

  loadYouTubeAPI() {
    if (window.YT && window.YT.Player) {
      this.isReady = true;
      return;
    }

    if (document.getElementById('youtube-iframe-api')) {
      window.addEventListener('youtube-api-ready', () => {
        this.isReady = true;
      });
      return;
    }

    const tag = document.createElement('script');
    tag.id = 'youtube-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      this.isReady = true;
      window.dispatchEvent(new CustomEvent('youtube-api-ready'));
    };
  }

  setupEventListeners() {
    const loadBtn = this.shadowRoot.getElementById('load-btn');
    const urlInput = this.shadowRoot.getElementById('url-input');
    const playPauseBtn = this.shadowRoot.getElementById('play-pause-btn');
    const stopBtn = this.shadowRoot.getElementById('stop-btn');
    const muteBtn = this.shadowRoot.getElementById('mute-btn');
    const speedSelect = this.shadowRoot.getElementById('speed-select');
    const loopToggle = this.shadowRoot.getElementById('loop-toggle');
    const loopStart = this.shadowRoot.getElementById('loop-start');
    const loopEnd = this.shadowRoot.getElementById('loop-end');

    // Load video
    loadBtn.addEventListener('click', () => this.loadVideo());
    urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.loadVideo();
    });
    urlInput.addEventListener('paste', () => {
      setTimeout(() => this.loadVideo(), 100);
    });

    // Play/Pause
    playPauseBtn.addEventListener('click', () => {
      if (this.player) {
        const state = this.player.getPlayerState();
        if (state === 1) {
          this.player.pauseVideo();
        } else {
          if (this.loopEnabled && this.duration > 0) {
            const currentTime = this.player.getCurrentTime();
            const startTime = (this.loopStart / 100) * this.duration;
            const endTime = (this.loopEnd / 100) * this.duration;
            
            if (currentTime < startTime || currentTime >= endTime) {
              this.player.seekTo(startTime, true);
            }
          }
          this.player.playVideo();
        }
      }
    });

    // Stop
    stopBtn.addEventListener('click', () => {
      if (this.player) {
        this.player.stopVideo();
        // Update play/pause button to show play icon
        playPauseBtn.textContent = '▶';
        // Update status to stopped
        this.setStatus('ready', 'Stopped');
        // Dispatch event so metronome can also stop if auto-start is enabled
        window.dispatchEvent(new CustomEvent('video-stopped'));
      }
    });

    // Mute/Unmute
    muteBtn.addEventListener('click', () => {
      if (this.player) {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
          this.player.mute();
          muteBtn.textContent = '🔇';
        } else {
          this.player.unMute();
          muteBtn.textContent = '🔊';
        }
        this.saveToStorage();
      }
    });

    // Playback Speed
    speedSelect.addEventListener('change', (e) => {
      const rate = parseFloat(e.target.value);
      this.setPlaybackRate(rate);
    });

    // Loop Toggle
    loopToggle.addEventListener('change', (e) => {
      this.loopEnabled = e.target.checked;
      loopStart.disabled = !this.loopEnabled;
      loopEnd.disabled = !this.loopEnabled;
      // Hide/show loop sliders
      loopStart.style.display = this.loopEnabled ? 'block' : 'none';
      loopEnd.style.display = this.loopEnabled ? 'block' : 'none';
      this.updateRangeVisual();
      this.saveToStorage();
    });

    // Loop Start Slider
    loopStart.addEventListener('input', (e) => {
      let val = parseFloat(e.target.value);
      if (val >= this.loopEnd - 1) {
        val = this.loopEnd - 1;
        e.target.value = val;
      }
      this.loopStart = val;
      this.updateRangeVisual();
      this.updateLoopTimes();
    });

    // Save loop start on change (mouseup)
    loopStart.addEventListener('change', () => {
      this.saveToStorage();
    });

    // Loop End Slider
    loopEnd.addEventListener('input', (e) => {
      let val = parseFloat(e.target.value);
      if (val <= this.loopStart + 1) {
        val = this.loopStart + 1;
        e.target.value = val;
      }
      this.loopEnd = val;
      this.updateRangeVisual();
      this.updateLoopTimes();
    });

    // Save loop end on change (mouseup)
    loopEnd.addEventListener('change', () => {
      this.saveToStorage();
    });

    // Click on range track to seek
    const rangeContainer = this.shadowRoot.querySelector('.range-slider-container');
    const rangeTrack = this.shadowRoot.querySelector('.range-track');
    
    rangeContainer.addEventListener('click', (e) => {
      if (!this.player || this.duration <= 0) return;
      
      // Calculate click position relative to track
      const rect = rangeTrack.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
      const seekTime = (percentage / 100) * this.duration;
      
      this.player.seekTo(seekTime, true);
    });
  }

  updateRangeVisual() {
    const rangeSelected = this.shadowRoot.getElementById('range-selected');
    const rangeTrack = this.shadowRoot.querySelector('.range-track');
    
    if (rangeSelected && rangeTrack) {
      if (this.loopEnabled) {
        const trackWidth = rangeTrack.offsetWidth;
        const left = (this.loopStart / 100) * trackWidth;
        const width = ((this.loopEnd - this.loopStart) / 100) * trackWidth;
        rangeSelected.style.left = `${6 + left}px`;
        rangeSelected.style.width = `${width}px`;
        rangeSelected.style.opacity = '0.6';
      } else {
        rangeSelected.style.opacity = '0';
      }
    }
  }

  updateLoopTimes() {
    const loopTimes = this.shadowRoot.getElementById('loop-times');
    if (loopTimes && this.duration > 0) {
      const startTime = (this.loopStart / 100) * this.duration;
      const endTime = (this.loopEnd / 100) * this.duration;
      loopTimes.textContent = `${this.formatTime(startTime)} - ${this.formatTime(endTime)}`;
    }
  }

  extractVideoId(url) {
    if (!url) return null;

    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  loadVideo() {
    const urlInput = this.shadowRoot.getElementById('url-input');
    const url = urlInput.value.trim();
    const videoId = this.extractVideoId(url);

    if (!videoId) {
      this.setStatus('error', 'Invalid YouTube URL');
      return;
    }

    this.videoId = videoId;
    this.setStatus('ready', 'Loading video...');

    const initPlayer = () => {
      const placeholder = this.shadowRoot.getElementById('placeholder');
      const playerWrapper = this.shadowRoot.getElementById('player-wrapper');

      placeholder.classList.add('hidden');

      if (this.player) {
        this.player.destroy();
      }

      playerWrapper.innerHTML = '<div id="yt-player"></div>';
      const playerDiv = playerWrapper.querySelector('#yt-player');

      this.player = new YT.Player(playerDiv, {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (event) => this.onPlayerReady(event),
          onStateChange: (event) => this.onPlayerStateChange(event),
          onError: (event) => this.onPlayerError(event),
          onPlaybackRateChange: (event) => this.onPlaybackRateChange(event)
        }
      });
    };

    if (this.isReady && window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.addEventListener('youtube-api-ready', initPlayer, { once: true });
    }
  }

  onPlayerReady(event) {
    this.setStatus('ready', 'Video loaded');
    this.duration = this.player.getDuration();
    this.updateTimeDisplay();
    this.enableControls();
    this.updateLoopTimes();

    // Apply saved mute state
    const muteBtn = this.shadowRoot.getElementById('mute-btn');
    if (this.isMuted) {
      this.player.mute();
      if (muteBtn) muteBtn.textContent = '🔇';
    } else {
      this.player.unMute();
      if (muteBtn) muteBtn.textContent = '🔊';
    }

    const rates = this.player.getAvailablePlaybackRates();
    this.updateSpeedOptions(rates);

    // Save URL to localStorage
    this.saveToStorage();

    this.dispatchEvent(new CustomEvent('video-loaded', {
      detail: { 
        duration: this.duration,
        videoId: this.videoId
      },
      bubbles: true,
      composed: true
    }));
  }

  updateSpeedOptions(rates) {
    const speedSelect = this.shadowRoot.getElementById('speed-select');
    speedSelect.innerHTML = '';
    
    rates.forEach(rate => {
      const option = document.createElement('option');
      option.value = rate;
      option.textContent = `${rate}×`;
      if (rate === 1) option.selected = true;
      speedSelect.appendChild(option);
    });
  }

  enableControls() {
    const controls = this.shadowRoot.querySelectorAll('.control-btn, .speed-select');
    controls.forEach(ctrl => ctrl.disabled = false);
  }

  onPlayerStateChange(event) {
    const states = {
      [-1]: 'unstarted',
      [0]: 'ended',
      [1]: 'playing',
      [2]: 'paused',
      [3]: 'buffering',
      [5]: 'cued'
    };

    const state = states[event.data] || 'unknown';
    const playPauseBtn = this.shadowRoot.getElementById('play-pause-btn');
    
    if (state === 'playing') {
      this.setStatus('playing', 'Playing');
      playPauseBtn.textContent = '⏸';
      this.startProgressTracking();
    } else if (state === 'paused') {
      this.setStatus('ready', 'Paused');
      playPauseBtn.textContent = '▶';
      this.stopProgressTracking();
    } else if (state === 'ended') {
      this.setStatus('ready', 'Ended');
      playPauseBtn.textContent = '▶';
      this.stopProgressTracking();
      
      // If loop is enabled, restart from loop start
      if (this.loopEnabled) {
        const startTime = (this.loopStart / 100) * this.duration;
        this.player.seekTo(startTime, true);
        this.player.playVideo();
      }
    } else if (state === 'buffering') {
      this.setStatus('ready', 'Buffering...');
    }

    window.dispatchEvent(new CustomEvent('video-state-change', {
      detail: { 
        state: state,
        currentTime: this.player.getCurrentTime(),
        duration: this.duration
      }
    }));
  }

  onPlaybackRateChange(event) {
    this.playbackRate = event.data;
    
    const speedSelect = this.shadowRoot.getElementById('speed-select');
    speedSelect.value = this.playbackRate;

    window.dispatchEvent(new CustomEvent('playback-rate-change', {
      detail: { rate: this.playbackRate }
    }));
  }

  onPlayerError(event) {
    const errorCodes = {
      2: 'Invalid video ID',
      5: 'HTML5 player error',
      100: 'Video not found',
      101: 'Embedding not allowed',
      150: 'Embedding not allowed'
    };

    const message = errorCodes[event.data] || 'Unknown error';
    this.setStatus('error', message);
  }

  startProgressTracking() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    this.progressInterval = setInterval(() => {
      if (this.player && this.player.getCurrentTime) {
        const currentTime = this.player.getCurrentTime();
        const progress = (currentTime / this.duration) * 100;
        
        this.updateTimeDisplay();
        this.updateProgressBar(progress);
        
        // Handle loop - when enabled, loop between A and B points
        if (this.loopEnabled) {
          const endTime = (this.loopEnd / 100) * this.duration;
          const startTime = (this.loopStart / 100) * this.duration;
          
          if (currentTime >= endTime) {
            this.player.seekTo(startTime, true);
          }
          
          if (currentTime < startTime - 0.5) {
            this.player.seekTo(startTime, true);
          }
        }
        
        window.dispatchEvent(new CustomEvent('video-progress', {
          detail: { currentTime, duration: this.duration }
        }));
      }
    }, 100);
  }

  stopProgressTracking() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  updateProgressBar(progress) {
    const rangeProgress = this.shadowRoot.getElementById('range-progress');
    const rangeTrack = this.shadowRoot.querySelector('.range-track');
    
    if (rangeProgress && rangeTrack) {
      const trackWidth = rangeTrack.offsetWidth;
      rangeProgress.style.width = `${(progress / 100) * trackWidth}px`;
    }
  }

  updateTimeDisplay() {
    if (!this.player || !this.player.getCurrentTime) return;

    const timeDisplay = this.shadowRoot.getElementById('time-display');
    const currentTime = this.player.getCurrentTime();

    timeDisplay.textContent = `${this.formatTime(currentTime)} / ${this.formatTime(this.duration)}`;
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  setStatus(type, message) {
    const statusDot = this.shadowRoot.getElementById('status-dot');
    const statusText = this.shadowRoot.getElementById('status-text');

    statusDot.className = 'status-dot';
    if (type === 'playing') {
      statusDot.classList.add('playing');
    } else if (type === 'ready') {
      statusDot.classList.add('ready');
    } else if (type === 'error') {
      statusDot.classList.add('error');
    }

    statusText.textContent = message;
  }

  setPlaybackRate(rate) {
    if (this.player && this.player.setPlaybackRate) {
      this.player.setPlaybackRate(rate);
    }
  }

  // Public API
  play() {
    if (this.player && this.player.playVideo) {
      this.player.playVideo();
    }
  }

  pause() {
    if (this.player && this.player.pauseVideo) {
      this.player.pauseVideo();
    }
  }

  seekTo(seconds) {
    if (this.player && this.player.seekTo) {
      this.player.seekTo(seconds, true);
    }
  }

  getCurrentTime() {
    return this.player ? this.player.getCurrentTime() : 0;
  }

  getDuration() {
    return this.duration;
  }

  getPlayerState() {
    return this.player ? this.player.getPlayerState() : -1;
  }

  getPlaybackRate() {
    return this.playbackRate;
  }
}

customElements.define('youtube-player', YoutubePlayer);

export default YoutubePlayer;
