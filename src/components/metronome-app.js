/**
 * Metronome Web Component
 * A full-featured metronome with tempo, time signature, and accent controls
 */
class MetronomeApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // Metronome state
    this.isPlaying = false;
    this.tempo = 120;
    this.baseTempo = 120; // Original tempo before playback rate adjustment
    this.beatsPerMeasure = 4;
    this.beatUnit = 4;
    this.accentFirstBeat = true;
    this.currentBeat = 0;
    this.offset = 0; // Offset in seconds for sync
    this.syncWithVideo = false;
    this.autoStartWithVideo = false;
    
    // Audio context
    this.audioContext = null;
    this.nextBeatTime = 0;
    this.schedulerTimer = null;
    this.lookahead = 25.0; // How frequently to call scheduling function (ms)
    this.scheduleAheadTime = 0.1; // How far ahead to schedule audio (s)
    
    // For pause/resume timing preservation
    this.pausedTimeRemaining = 0; // Time remaining until next beat when paused
    this.wasPaused = false;
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.initAudio();
    this.loadFromStorage();
  }

  /**
   * Load saved settings from localStorage
   */
  loadFromStorage() {
    try {
      const savedTempo = localStorage.getItem('tabioke-tempo');
      const savedTimeSignature = localStorage.getItem('tabioke-time-signature');
      const savedOffset = localStorage.getItem('tabioke-offset');
      const savedAccentFirst = localStorage.getItem('tabioke-accent-first');
      const savedAutoStart = localStorage.getItem('tabioke-auto-start');
      const savedSyncTempo = localStorage.getItem('tabioke-sync-tempo');

      if (savedTempo !== null) {
        this.tempo = parseInt(savedTempo);
        this.baseTempo = this.tempo;
        const tempoSlider = this.shadowRoot.getElementById('tempo-slider');
        const tempoValue = this.shadowRoot.getElementById('tempo-value');
        if (tempoSlider) tempoSlider.value = this.tempo;
        if (tempoValue) tempoValue.value = this.tempo;
      }

      if (savedTimeSignature !== null) {
        const [beats, unit] = savedTimeSignature.split('/').map(Number);
        this.beatsPerMeasure = beats;
        this.beatUnit = unit;
        const timeSig = this.shadowRoot.getElementById('time-signature');
        if (timeSig) timeSig.value = savedTimeSignature;
        this.updateBeatDisplay();
      }

      if (savedOffset !== null) {
        this.offset = parseFloat(savedOffset);
        const offsetInput = this.shadowRoot.getElementById('offset-input');
        if (offsetInput) offsetInput.value = this.offset.toFixed(2);
      }

      if (savedAccentFirst !== null) {
        this.accentFirstBeat = savedAccentFirst === 'true';
        const accentCheckbox = this.shadowRoot.getElementById('accent-first');
        if (accentCheckbox) accentCheckbox.checked = this.accentFirstBeat;
        this.updateBeatDisplay();
      }

      if (savedAutoStart !== null) {
        this.autoStartWithVideo = savedAutoStart === 'true';
        const autoStartCheckbox = this.shadowRoot.getElementById('auto-start');
        if (autoStartCheckbox) autoStartCheckbox.checked = this.autoStartWithVideo;
      }

      if (savedSyncTempo !== null) {
        this.syncWithVideo = savedSyncTempo === 'true';
        const syncTempoCheckbox = this.shadowRoot.getElementById('sync-tempo');
        if (syncTempoCheckbox) syncTempoCheckbox.checked = this.syncWithVideo;
      }
    } catch (e) {
      console.warn('Failed to load metronome settings from localStorage:', e);
    }
  }

  /**
   * Save settings to localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem('tabioke-tempo', this.baseTempo.toString());
      localStorage.setItem('tabioke-time-signature', `${this.beatsPerMeasure}/${this.beatUnit}`);
      localStorage.setItem('tabioke-offset', this.offset.toString());
      localStorage.setItem('tabioke-accent-first', this.accentFirstBeat.toString());
      localStorage.setItem('tabioke-auto-start', this.autoStartWithVideo.toString());
      localStorage.setItem('tabioke-sync-tempo', this.syncWithVideo.toString());
    } catch (e) {
      console.warn('Failed to save metronome settings to localStorage:', e);
    }
  }

  disconnectedCallback() {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
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
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .title {
          font-family: var(--font-display);
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .title::before {
          content: '';
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent-primary);
          box-shadow: 0 0 8px var(--accent-glow);
        }

        .content {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 12px;
          gap: 12px;
          overflow-y: auto;
        }

        /* Beat Visualization */
        .beat-display {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          padding: 16px;
          background: var(--bg-primary);
          border-radius: 8px;
          border: 1px solid var(--border-color);
        }

        .beat-indicator {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--bg-elevated);
          border: 2px solid var(--border-color);
          transition: all 0.1s ease;
          cursor: pointer;
        }

        .beat-indicator:hover {
          border-color: var(--accent-primary);
          transform: scale(1.1);
        }

        .beat-indicator.active {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          box-shadow: 0 0 20px var(--accent-glow);
          transform: scale(1.2);
        }

        .beat-indicator.accent {
          width: 26px;
          height: 26px;
        }

        .beat-indicator.accent.active {
          background: var(--success);
          border-color: var(--success);
          box-shadow: 0 0 20px rgba(74, 222, 128, 0.4);
        }

        /* Tempo Display */
        .tempo-display {
          text-align: center;
          padding: 12px;
          background: var(--bg-primary);
          border-radius: 8px;
          border: 1px solid var(--border-color);
        }

        .tempo-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .tempo-value {
          font-family: var(--font-mono);
          font-size: 2.5rem;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1;
          min-width: 80px;
          width: 100px;
          background: transparent;
          border: none;
          text-align: center;
          padding: 0;
          margin: 0;
          -moz-appearance: textfield;
        }

        .tempo-value::-webkit-outer-spin-button,
        .tempo-value::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .tempo-value:focus {
          outline: none;
          background: var(--bg-elevated);
          border-radius: 4px;
        }

        .tempo-label {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .tempo-adjusted {
          font-size: 0.7rem;
          color: var(--accent-primary);
          margin-top: 2px;
        }

        .tempo-slider {
          width: 100%;
          margin-top: 10px;
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          background: var(--bg-elevated);
          border-radius: 3px;
          outline: none;
        }

        .tempo-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent-primary);
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 8px var(--accent-glow);
        }

        .tempo-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent-primary);
          cursor: pointer;
          border: none;
        }

        /* Controls */
        .controls-row {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .control-group {
          background: var(--bg-primary);
          border-radius: 8px;
          border: 1px solid var(--border-color);
          padding: 10px;
        }

        .control-label {
          font-size: 0.65rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 6px;
          display: block;
        }

        .control-select {
          width: 100%;
          font-family: var(--font-display);
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 6px 10px;
          color: var(--text-primary);
          font-size: 0.8rem;
          cursor: pointer;
        }

        .control-select:focus {
          outline: none;
          border-color: var(--accent-primary);
        }

        /* Offset control with editable input */
        .offset-control {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .offset-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          font-weight: bold;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--bg-elevated);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .offset-btn:hover {
          background: var(--bg-tertiary);
          border-color: var(--accent-primary);
        }

        .offset-input {
          flex: 1;
          min-width: 0;
          text-align: center;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 4px 6px;
          color: var(--text-primary);
        }

        .offset-input:focus {
          outline: none;
          border-color: var(--accent-primary);
        }

        /* Checkbox controls */
        .checkbox-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .checkbox-control {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          background: var(--bg-primary);
          border-radius: 6px;
          border: 1px solid var(--border-color);
          cursor: pointer;
          transition: border-color 0.2s ease;
        }

        .checkbox-control:hover {
          border-color: var(--text-muted);
        }

        .checkbox-control input {
          display: none;
        }

        .checkbox-visual {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 2px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .checkbox-control input:checked + .checkbox-visual {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
        }

        .checkbox-visual::after {
          content: '✓';
          font-size: 10px;
          color: var(--bg-primary);
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .checkbox-control input:checked + .checkbox-visual::after {
          opacity: 1;
        }

        .checkbox-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        /* Play Button */
        .play-section {
          display: flex;
          gap: 8px;
        }

        .play-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          font-family: var(--font-display);
          font-size: 0.9rem;
          font-weight: 600;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .play-btn.start {
          background: var(--accent-primary);
          color: var(--bg-primary);
        }

        .play-btn.start:hover {
          background: var(--accent-secondary);
          transform: translateY(-2px);
          box-shadow: 0 4px 20px var(--accent-glow);
        }

        .play-btn.stop {
          background: #dc2626;
          color: white;
        }

        .play-btn.stop:hover {
          background: #b91c1c;
        }

        .play-btn:active {
          transform: translateY(0);
        }

        .play-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
        }

        .play-icon.play-triangle {
          width: 0;
          height: 0;
          border-left: 10px solid currentColor;
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
        }

        .play-icon.stop-square {
          width: 12px;
          height: 12px;
          background: currentColor;
          border-radius: 2px;
        }

        .tap-btn {
          width: 56px;
          padding: 12px;
          font-family: var(--font-display);
          font-size: 0.7rem;
          font-weight: 600;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          cursor: pointer;
          background: var(--bg-elevated);
          color: var(--text-primary);
          transition: all 0.2s ease;
          text-transform: uppercase;
        }

        .tap-btn:hover {
          background: var(--bg-tertiary);
          border-color: var(--accent-primary);
        }

        .tap-btn:active {
          background: var(--accent-primary);
          color: var(--bg-primary);
        }
      </style>

      <div class="header">
        <span class="title">Metronome</span>
      </div>

      <div class="content">
        <!-- Beat Visualization -->
        <div class="beat-display" id="beat-display">
          <!-- Beats will be generated dynamically -->
        </div>

        <!-- Tempo Display -->
        <div class="tempo-display">
          <div class="tempo-row">
            <input 
              type="number" 
              class="tempo-value" 
              id="tempo-value"
              value="${this.tempo}"
              min="30"
              max="250"
            >
            <div>
              <div class="tempo-label">BPM</div>
              <div class="tempo-adjusted" id="tempo-adjusted"></div>
            </div>
          </div>
          <input 
            type="range" 
            class="tempo-slider" 
            id="tempo-slider"
            min="30" 
            max="250" 
            value="${this.tempo}"
          >
        </div>

        <!-- Time Signature & Offset -->
        <div class="controls-row">
          <div class="control-group">
            <label class="control-label">Time Signature</label>
            <select class="control-select" id="time-signature">
              <option value="2/4">2/4</option>
              <option value="3/4">3/4</option>
              <option value="4/4" selected>4/4</option>
              <option value="5/4">5/4</option>
              <option value="6/8">6/8</option>
              <option value="7/8">7/8</option>
              <option value="12/8">12/8</option>
            </select>
          </div>

          <div class="control-group">
            <label class="control-label">Offset (sec)</label>
            <div class="offset-control">
              <button class="offset-btn" id="offset-decrease">−</button>
              <input 
                type="number" 
                class="offset-input" 
                id="offset-input" 
                value="0.00" 
                step="0.01" 
                min="-10" 
                max="60"
              >
              <button class="offset-btn" id="offset-increase">+</button>
            </div>
          </div>
        </div>

        <!-- Checkboxes -->
        <div class="checkbox-row">
          <label class="checkbox-control">
            <input type="checkbox" id="accent-first" checked>
            <div class="checkbox-visual"></div>
            <span class="checkbox-label">Accent first beat</span>
          </label>

          <label class="checkbox-control">
            <input type="checkbox" id="auto-start">
            <div class="checkbox-visual"></div>
            <span class="checkbox-label">Auto-start with video</span>
          </label>

          <label class="checkbox-control">
            <input type="checkbox" id="sync-tempo">
            <div class="checkbox-visual"></div>
            <span class="checkbox-label">Sync tempo with playback speed</span>
          </label>
        </div>

        <!-- Play/Stop Button -->
        <div class="play-section">
          <button class="play-btn start" id="play-btn">
            <span class="play-icon play-triangle" id="play-icon"></span>
            <span id="play-text">Start</span>
          </button>
          <button class="tap-btn" id="tap-btn">Tap</button>
        </div>
      </div>
    `;

    this.updateBeatDisplay();
  }

  initAudio() {
    const initContext = () => {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      document.removeEventListener('click', initContext);
      document.removeEventListener('keydown', initContext);
    };

    document.addEventListener('click', initContext);
    document.addEventListener('keydown', initContext);
  }

  setupEventListeners() {
    // Tempo slider and input
    const tempoSlider = this.shadowRoot.getElementById('tempo-slider');
    const tempoValue = this.shadowRoot.getElementById('tempo-value');
    
    // Slider updates tempo
    tempoSlider.addEventListener('input', (e) => {
      this.tempo = parseInt(e.target.value);
      this.baseTempo = this.tempo;
      tempoValue.value = this.tempo;
      this.updateTempoAdjustedDisplay(1);
    });

    // Save tempo on slider change (mouseup)
    tempoSlider.addEventListener('change', () => {
      this.saveToStorage();
    });

    // Direct BPM input
    tempoValue.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (!isNaN(val) && val >= 30 && val <= 250) {
        this.tempo = val;
        this.baseTempo = val;
        tempoSlider.value = val;
        this.updateTempoAdjustedDisplay(1);
      }
    });

    // Validate and save on blur
    tempoValue.addEventListener('blur', () => {
      const val = parseInt(tempoValue.value);
      if (isNaN(val) || val < 30) {
        this.tempo = 30;
      } else if (val > 250) {
        this.tempo = 250;
      } else {
        this.tempo = val;
      }
      this.baseTempo = this.tempo;
      tempoValue.value = this.tempo;
      tempoSlider.value = this.tempo;
      this.saveToStorage();
    });

    // Handle Enter key
    tempoValue.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        tempoValue.blur();
      }
    });

    // Time signature
    const timeSig = this.shadowRoot.getElementById('time-signature');
    timeSig.addEventListener('change', (e) => {
      const [beats, unit] = e.target.value.split('/').map(Number);
      this.beatsPerMeasure = beats;
      this.beatUnit = unit;
      this.updateBeatDisplay();
      this.saveToStorage();
    });

    // Accent first beat
    const accentCheckbox = this.shadowRoot.getElementById('accent-first');
    accentCheckbox.addEventListener('change', (e) => {
      this.accentFirstBeat = e.target.checked;
      this.updateBeatDisplay();
      this.saveToStorage();
    });

    // Auto-start with video - also enables sync tempo
    const autoStartCheckbox = this.shadowRoot.getElementById('auto-start');
    const syncTempoCheckbox = this.shadowRoot.getElementById('sync-tempo');
    
    autoStartCheckbox.addEventListener('change', (e) => {
      this.autoStartWithVideo = e.target.checked;
      // When auto-start is enabled, also enable sync tempo
      if (e.target.checked && !syncTempoCheckbox.checked) {
        syncTempoCheckbox.checked = true;
        this.syncWithVideo = true;
      }
      this.saveToStorage();
    });

    // Sync tempo with playback speed
    syncTempoCheckbox.addEventListener('change', (e) => {
      this.syncWithVideo = e.target.checked;
      this.saveToStorage();
    });

    // Offset controls
    const offsetDecrease = this.shadowRoot.getElementById('offset-decrease');
    const offsetIncrease = this.shadowRoot.getElementById('offset-increase');
    const offsetInput = this.shadowRoot.getElementById('offset-input');

    offsetDecrease.addEventListener('click', () => {
      this.offset = Math.max(-10, parseFloat((this.offset - 0.1).toFixed(2)));
      offsetInput.value = this.offset.toFixed(2);
      this.saveToStorage();
    });

    offsetIncrease.addEventListener('click', () => {
      this.offset = Math.min(60, parseFloat((this.offset + 0.1).toFixed(2)));
      offsetInput.value = this.offset.toFixed(2);
      this.saveToStorage();
    });

    offsetInput.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        this.offset = Math.max(-10, Math.min(60, parseFloat(val.toFixed(2))));
        this.saveToStorage();
      }
    });

    offsetInput.addEventListener('blur', () => {
      offsetInput.value = this.offset.toFixed(2);
    });

    // Play/Stop button
    const playBtn = this.shadowRoot.getElementById('play-btn');
    playBtn.addEventListener('click', () => {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.resume();
      }
    });

    // Tap tempo
    const tapBtn = this.shadowRoot.getElementById('tap-btn');
    let tapTimes = [];
    
    tapBtn.addEventListener('click', () => {
      const now = performance.now();
      tapTimes.push(now);
      
      if (tapTimes.length > 5) {
        tapTimes.shift();
      }
      
      if (tapTimes.length >= 2) {
        let totalInterval = 0;
        for (let i = 1; i < tapTimes.length; i++) {
          totalInterval += tapTimes[i] - tapTimes[i - 1];
        }
        const avgInterval = totalInterval / (tapTimes.length - 1);
        const newTempo = Math.round(60000 / avgInterval);
        
        if (newTempo >= 30 && newTempo <= 250) {
          this.tempo = newTempo;
          this.baseTempo = newTempo;
          tempoSlider.value = this.tempo;
          tempoValue.value = this.tempo;
        }
      }

      setTimeout(() => {
        if (performance.now() - tapTimes[tapTimes.length - 1] > 2000) {
          tapTimes = [];
        }
      }, 2100);
    });

    // Listen for video state changes
    window.addEventListener('video-state-change', (e) => {
      if (this.autoStartWithVideo) {
        if (e.detail.state === 'playing') {
          if (this.offset > 0) {
            setTimeout(() => this.resume(), this.offset * 1000);
          } else {
            this.resume();
          }
        } else if (e.detail.state === 'paused' || e.detail.state === 'ended') {
          this.pause();
        }
      }
    });

    // Listen for video stop button - stop and reset metronome
    window.addEventListener('video-stopped', () => {
      if (this.autoStartWithVideo) {
        this.stop();
      }
    });

    // Listen for playback rate changes
    window.addEventListener('playback-rate-change', (e) => {
      if (this.syncWithVideo) {
        const rate = e.detail.rate;
        this.adjustTempoForPlaybackRate(rate);
      }
    });
  }

  adjustTempoForPlaybackRate(rate) {
    const newTempo = Math.round(this.baseTempo * rate);
    this.tempo = Math.max(30, Math.min(250, newTempo));
    
    const tempoSlider = this.shadowRoot.getElementById('tempo-slider');
    const tempoValue = this.shadowRoot.getElementById('tempo-value');
    
    if (tempoSlider) tempoSlider.value = this.tempo;
    if (tempoValue) tempoValue.value = this.tempo;
    
    this.updateTempoAdjustedDisplay(rate);
  }

  updateTempoAdjustedDisplay(rate) {
    const tempoAdjusted = this.shadowRoot.getElementById('tempo-adjusted');
    if (tempoAdjusted) {
      if (rate !== 1) {
        tempoAdjusted.textContent = `(${this.baseTempo} × ${rate}x)`;
      } else {
        tempoAdjusted.textContent = '';
      }
    }
  }

  updateBeatDisplay() {
    const beatDisplay = this.shadowRoot.getElementById('beat-display');
    beatDisplay.innerHTML = '';

    for (let i = 0; i < this.beatsPerMeasure; i++) {
      const indicator = document.createElement('div');
      indicator.className = 'beat-indicator';
      if (i === 0 && this.accentFirstBeat) {
        indicator.classList.add('accent');
      }
      indicator.dataset.beat = i;
      
      // Click to reset beat position
      indicator.addEventListener('click', () => {
        this.resetToBeat(i);
      });
      
      beatDisplay.appendChild(indicator);
    }
  }

  /**
   * Reset the metronome to start from a specific beat
   * @param {number} beatNumber - The beat to start from (0-indexed)
   */
  resetToBeat(beatNumber) {
    this.currentBeat = beatNumber;
    this.wasPaused = false;
    this.pausedTimeRemaining = 0;
    
    // If playing, reset timing to start this beat immediately
    if (this.isPlaying && this.audioContext) {
      this.nextBeatTime = this.audioContext.currentTime;
    }
    
    // Visual feedback
    this.highlightBeat(beatNumber);
  }

  /**
   * Start the metronome fresh (resets all timing)
   */
  start() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.isPlaying = true;
    this.currentBeat = 0;
    this.nextBeatTime = this.audioContext.currentTime;
    this.wasPaused = false;
    this.pausedTimeRemaining = 0;
    
    this.scheduler();
    this.updateUI();
  }

  /**
   * Resume from pause, preserving beat timing
   */
  resume() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.isPlaying = true;
    
    // If we were paused mid-beat, resume with preserved timing
    if (this.wasPaused && this.pausedTimeRemaining > 0) {
      this.nextBeatTime = this.audioContext.currentTime + this.pausedTimeRemaining;
    } else {
      // Fresh start
      this.currentBeat = 0;
      this.nextBeatTime = this.audioContext.currentTime;
    }
    
    this.wasPaused = false;
    this.scheduler();
    this.updateUI();
  }

  /**
   * Pause the metronome, preserving timing for resume
   */
  pause() {
    if (this.isPlaying && this.audioContext) {
      // Calculate time remaining until next beat
      this.pausedTimeRemaining = Math.max(0, this.nextBeatTime - this.audioContext.currentTime);
      this.wasPaused = true;
    }
    
    this.isPlaying = false;
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.clearBeatIndicators();
    this.updateUI();
  }

  /**
   * Stop the metronome completely (resets timing)
   */
  stop() {
    this.isPlaying = false;
    this.wasPaused = false;
    this.pausedTimeRemaining = 0;
    this.currentBeat = 0;
    
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.clearBeatIndicators();
    this.updateUI();
  }

  scheduler() {
    if (!this.isPlaying) return;

    while (this.nextBeatTime < this.audioContext.currentTime + this.scheduleAheadTime) {
      this.scheduleBeat(this.currentBeat, this.nextBeatTime);
      this.advanceBeat();
    }

    this.schedulerTimer = setTimeout(() => this.scheduler(), this.lookahead);
  }

  scheduleBeat(beatNumber, time) {
    const osc = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();

    osc.connect(envelope);
    envelope.connect(this.audioContext.destination);

    if (beatNumber === 0 && this.accentFirstBeat) {
      osc.frequency.value = 1000;
      envelope.gain.value = 0.5;
    } else {
      osc.frequency.value = 800;
      envelope.gain.value = 0.3;
    }

    osc.type = 'sine';
    
    envelope.gain.setValueAtTime(envelope.gain.value, time);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.05);

    const timeUntilBeat = (time - this.audioContext.currentTime) * 1000;
    setTimeout(() => this.highlightBeat(beatNumber), Math.max(0, timeUntilBeat));
  }

  advanceBeat() {
    const secondsPerBeat = 60.0 / this.tempo;
    this.nextBeatTime += secondsPerBeat;
    this.currentBeat = (this.currentBeat + 1) % this.beatsPerMeasure;
  }

  highlightBeat(beatNumber) {
    if (!this.isPlaying) return;

    const indicators = this.shadowRoot.querySelectorAll('.beat-indicator');
    
    indicators.forEach(ind => ind.classList.remove('active'));
    
    if (indicators[beatNumber]) {
      indicators[beatNumber].classList.add('active');
    }
  }

  clearBeatIndicators() {
    const indicators = this.shadowRoot.querySelectorAll('.beat-indicator');
    indicators.forEach(ind => ind.classList.remove('active'));
  }

  updateUI() {
    const playBtn = this.shadowRoot.getElementById('play-btn');
    const playIcon = this.shadowRoot.getElementById('play-icon');
    const playText = this.shadowRoot.getElementById('play-text');

    if (this.isPlaying) {
      playBtn.classList.remove('start');
      playBtn.classList.add('stop');
      playIcon.className = 'play-icon stop-square';
      playText.textContent = 'Stop';
    } else {
      playBtn.classList.remove('stop');
      playBtn.classList.add('start');
      playIcon.className = 'play-icon play-triangle';
      playText.textContent = 'Start';
    }
  }

  // Public API
  setTempo(bpm) {
    this.tempo = Math.max(30, Math.min(250, bpm));
    this.baseTempo = this.tempo;
    const tempoSlider = this.shadowRoot.getElementById('tempo-slider');
    const tempoValue = this.shadowRoot.getElementById('tempo-value');
    if (tempoSlider) tempoSlider.value = this.tempo;
    if (tempoValue) tempoValue.value = this.tempo;
  }

  getTempo() {
    return this.tempo;
  }

  getBaseTempo() {
    return this.baseTempo;
  }

  setOffset(seconds) {
    this.offset = Math.max(-10, Math.min(60, parseFloat(seconds.toFixed(2))));
    const offsetInput = this.shadowRoot.getElementById('offset-input');
    if (offsetInput) offsetInput.value = this.offset.toFixed(2);
  }
}

customElements.define('metronome-app', MetronomeApp);

export default MetronomeApp;
