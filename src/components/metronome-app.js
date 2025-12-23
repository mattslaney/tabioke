/**
 * Metronome Web Component
 * A full-featured metronome with tempo, time signature, and accent controls
 * Now includes tabbed panel with Info (chords/strumming) and Metronome tabs
 */
class MetronomeApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // Tab state
    this.activeTab = 'info'; // 'info' or 'metronome'
    
    // Info tab state
    this.strummingPattern = '';
    this.chords = []; // Array of { name, frets, fingering }
    this.songMetadata = {}; // { title, artist, tempo, timing, tuning, key, capo }
    
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
    this.startTime = 0; // Absolute reference time for beat calculations
    this.totalBeatsScheduled = 0; // Total beats scheduled from start
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
    this.listenForTabMetadata();
  }

  /**
   * Listen for tab metadata events from tab-viewer
   */
  listenForTabMetadata() {
    window.addEventListener('tab-metadata-loaded', (e) => {
      const metadata = e.detail;
      
      // Store all song metadata
      this.songMetadata = {
        title: metadata.title || '',
        artist: metadata.artist || '',
        tempo: metadata.tempo || '',
        timing: metadata.timing || '',
        tuning: metadata.tuning || '',
        key: metadata.key || '',
        capo: metadata.capo || ''
      };
      
      // Update strumming pattern
      if (metadata.strummingpattern) {
        this.strummingPattern = metadata.strummingpattern;
      } else {
        this.strummingPattern = '';
      }
      
      // Update chords
      if (metadata.chords && Array.isArray(metadata.chords)) {
        this.chords = metadata.chords.map(chordLine => {
          const parts = chordLine.split('-').map(p => p.trim());
          return {
            name: parts[0] || '',
            frets: parts[1] || '',
            fingering: parts[2] || ''
          };
        }).filter(c => c.name && c.frets);
      } else {
        this.chords = [];
      }
      
      // Re-render info tab if it's active
      this.renderInfoTab();
    });
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
    if (this._offsetWaiter) {
      clearInterval(this._offsetWaiter);
    }
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
          padding: 0;
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .tab-buttons {
          display: flex;
          flex: 1;
        }

        .tab-btn {
          flex: 1;
          padding: 10px 16px;
          font-family: var(--font-display);
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .tab-btn:hover {
          color: var(--text-secondary);
          background: var(--bg-elevated);
        }

        .tab-btn.active {
          color: var(--accent-primary);
          border-bottom-color: var(--accent-primary);
          background: var(--bg-secondary);
        }

        .tab-btn::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.5;
        }

        .tab-btn.active::before {
          opacity: 1;
          box-shadow: 0 0 6px var(--accent-glow);
        }

        .tab-content {
          flex: 1;
          display: none;
          flex-direction: column;
          overflow: hidden;
        }

        .tab-content.active {
          display: flex;
        }

        /* Info Tab Styles */
        .info-content {
          flex: 1;
          padding: 12px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .info-section {
          background: var(--bg-primary);
          border-radius: 8px;
          border: 1px solid var(--border-color);
          padding: 12px;
        }

        .info-section-title {
          font-family: var(--font-display);
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 10px;
        }

        .strumming-pattern {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          font-family: var(--font-mono);
          font-size: 1.1rem;
        }

        .strum-char {
          width: 24px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-elevated);
          border-radius: 4px;
          color: var(--text-primary);
          font-weight: 600;
        }

        .strum-char.down {
          color: var(--accent-primary);
        }

        .strum-char.up {
          color: var(--success);
        }

        .strum-char.bass {
          color: #60a5fa;
        }

        .strum-char.root {
          color: #f472b6;
        }

        .strum-char.rest {
          color: var(--text-muted);
        }

        .strum-char.number {
          color: #a78bfa;
        }

        .chord-diagrams {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          justify-content: flex-start;
        }

        .chord-diagram {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .chord-name {
          font-family: var(--font-display);
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--accent-primary);
        }

        .empty-state {
          color: var(--text-muted);
          font-size: 0.8rem;
          font-style: italic;
          text-align: center;
          padding: 20px;
        }

        /* Song Info Section */
        .song-info {
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-color);
        }

        .song-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--accent-primary);
          margin-bottom: 2px;
        }

        .song-artist {
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin-bottom: 10px;
        }

        .song-info-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 16px;
        }

        .song-info-item {
          display: flex;
          gap: 6px;
          font-size: 0.8rem;
        }

        .info-label {
          color: var(--text-muted);
          font-weight: 500;
        }

        .info-value {
          color: var(--text-primary);
          font-weight: 600;
        }

        /* Metronome Tab Content */
        .metronome-content {
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

        /* Mobile and Tablet Portrait - Compact 2-line layout */
        @media (max-width: 768px) {
          .header {
            padding: 0;
          }

          .tab-btn {
            padding: 6px 10px;
            font-size: 0.7rem;
          }

          .info-content {
            padding: 6px 8px;
            gap: 8px;
          }

          .info-section {
            padding: 8px;
          }

          .chord-diagrams {
            gap: 8px;
          }

          .metronome-content {
            padding: 6px 8px;
            gap: 6px;
            overflow: visible;
          }

          /* Hide beat visualization on mobile */
          .beat-display {
            display: none;
          }

          /* Compact tempo display - single line */
          .tempo-display {
            padding: 6px 8px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .tempo-row {
            gap: 4px;
            flex: 0 0 auto;
          }

          .tempo-value {
            font-size: 1.5rem;
            width: 60px;
            min-width: 60px;
          }

          .tempo-label {
            font-size: 0.6rem;
          }

          .tempo-adjusted {
            font-size: 0.6rem;
          }

          .tempo-slider {
            flex: 1;
            margin: 0;
          }

          /* Hide extra controls */
          .controls-row,
          .checkbox-row {
            display: none;
          }

          /* Compact play section */
          .play-section {
            gap: 4px;
          }

          .play-btn {
            padding: 6px 10px;
            font-size: 0.75rem;
          }

          .tap-btn {
            width: 44px;
            padding: 6px;
            font-size: 0.65rem;
          }

          .play-icon {
            width: 12px;
            height: 12px;
          }

          .play-icon.play-triangle {
            border-left-width: 8px;
            border-top-width: 5px;
            border-bottom-width: 5px;
          }

          .play-icon.stop-square {
            width: 10px;
            height: 10px;
          }
        }
      </style>

      <div class="header">
        <div class="tab-buttons">
          <button class="tab-btn active" id="tab-info" data-tab="info">Info</button>
          <button class="tab-btn" id="tab-metronome" data-tab="metronome">Metronome</button>
        </div>
      </div>

      <!-- Info Tab -->
      <div class="tab-content active" id="content-info">
        <div class="info-content">
          <div class="song-info" id="song-info">
            <div class="song-title" id="song-title"></div>
            <div class="song-artist" id="song-artist"></div>
            <div class="song-info-grid" id="song-info-grid"></div>
          </div>
          <div class="info-section" id="strumming-section">
            <div class="info-section-title">Strumming Pattern</div>
            <div class="strumming-pattern" id="strumming-display">
              <div class="empty-state">Load a tab with a strumming pattern</div>
            </div>
          </div>
          <div class="info-section" id="chords-section">
            <div class="info-section-title">Chord Diagrams</div>
            <div class="chord-diagrams" id="chord-diagrams">
              <div class="empty-state">Load a tab with chord definitions</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Metronome Tab -->
      <div class="tab-content" id="content-metronome">
        <div class="metronome-content">
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
      </div>
    `;

    this.updateBeatDisplay();
    this.renderInfoTab();
  }

  /**
   * Parse the tuning header to determine the number of strings
   * Supports formats: EADGBE, E A D G B E, E-A-D-G-B-E, etc.
   * @param {string} tuning - Tuning string (e.g., "EADGBE", "E A D G B E", "E-A-D-G-B-E")
   * @returns {number} - Number of strings (defaults to 6 if not determinable)
   */
  parseStringCount(tuning) {
    if (!tuning || typeof tuning !== 'string') {
      return 6; // Default to 6-string guitar
    }
    
    const trimmed = tuning.trim();
    if (!trimmed) {
      return 6;
    }
    
    // Check if tuning uses separators (spaces or hyphens)
    if (trimmed.includes(' ') || trimmed.includes('-')) {
      // Split by space or hyphen and count non-empty parts
      const parts = trimmed.split(/[\s-]+/).filter(p => p.length > 0);
      return parts.length > 0 ? parts.length : 6;
    }
    
    // No separators - count individual note letters (A-G with optional # or b)
    // Match patterns like: E, A, D, G, B, E or D#, Bb, etc.
    const notePattern = /[A-Ga-g][#b\u266f\u266d]?/g;
    const matches = trimmed.match(notePattern);
    return matches ? matches.length : 6;
  }

  /**
   * Render the Info tab content (strumming pattern and chord diagrams)
   */
  renderInfoTab() {
    this.renderSongInfo();
    this.renderStrummingPattern();
    this.renderChordDiagrams();
  }

  /**
   * Render the song info section
   */
  renderSongInfo() {
    const titleEl = this.shadowRoot.getElementById('song-title');
    const artistEl = this.shadowRoot.getElementById('song-artist');
    const gridEl = this.shadowRoot.getElementById('song-info-grid');
    const containerEl = this.shadowRoot.getElementById('song-info');
    
    if (!titleEl || !artistEl || !gridEl || !containerEl) return;
    
    const meta = this.songMetadata || {};
    
    // Check if we have any data to show
    const hasData = meta.title || meta.artist || meta.tempo || meta.timing || 
                    meta.tuning || meta.key || meta.capo;
    
    if (!hasData) {
      containerEl.style.display = 'none';
      return;
    }
    
    containerEl.style.display = 'block';
    
    // Set title and artist
    titleEl.textContent = meta.title || '';
    artistEl.textContent = meta.artist || '';
    
    // Build info grid items
    const infoItems = [];
    if (meta.tempo) infoItems.push({ label: 'Tempo', value: `${meta.tempo} BPM` });
    if (meta.timing) infoItems.push({ label: 'Time', value: meta.timing });
    if (meta.tuning) infoItems.push({ label: 'Tuning', value: meta.tuning });
    if (meta.key) infoItems.push({ label: 'Key', value: meta.key });
    if (meta.capo) infoItems.push({ label: 'Capo', value: `Fret ${meta.capo}` });
    
    gridEl.innerHTML = infoItems.map(item => `
      <div class="song-info-item">
        <span class="info-label">${item.label}</span>
        <span class="info-value">${item.value}</span>
      </div>
    `).join('');
  }

  /**
   * Render the strumming pattern display
   */
  renderStrummingPattern() {
    const container = this.shadowRoot.getElementById('strumming-display');
    if (!container) return;

    if (!this.strummingPattern) {
      container.innerHTML = '<div class="empty-state">Load a tab with a strumming pattern</div>';
      return;
    }

    container.innerHTML = '';
    
    for (const char of this.strummingPattern) {
      const div = document.createElement('div');
      div.className = 'strum-char';
      div.textContent = char;
      
      // Apply color classes based on character
      const upperChar = char.toUpperCase();
      if (upperChar === 'D') {
        div.classList.add('down');
        div.textContent = '↓';
        div.title = 'Down stroke';
      } else if (upperChar === 'U') {
        div.classList.add('up');
        div.textContent = '↑';
        div.title = 'Up stroke';
      } else if (upperChar === 'B') {
        div.classList.add('bass');
        div.title = 'Bass string';
      } else if (upperChar === 'R') {
        div.classList.add('root');
        div.title = 'Root note';
      } else if (char === '-') {
        div.classList.add('rest');
        div.textContent = '·';
        div.title = 'Rest/pause';
      } else if (char === '_') {
        div.classList.add('rest');
        div.textContent = '·';
        div.title = 'Skip (no strum)';
      } else if (char === ' ') {
        div.classList.add('rest');
        div.textContent = '·';
        div.title = 'Rest';
      } else if (/[1-6]/.test(char)) {
        div.classList.add('number');
        div.title = `String ${char}`;
      }
      
      container.appendChild(div);
    }
  }

  /**
   * Render chord diagrams as SVGs
   */
  renderChordDiagrams() {
    const container = this.shadowRoot.getElementById('chord-diagrams');
    if (!container) return;

    if (!this.chords || this.chords.length === 0) {
      container.innerHTML = '<div class="empty-state">Load a tab with chord definitions</div>';
      return;
    }

    container.innerHTML = '';
    
    for (const chord of this.chords) {
      const diagram = document.createElement('div');
      diagram.className = 'chord-diagram';
      
      const name = document.createElement('div');
      name.className = 'chord-name';
      name.textContent = chord.name;
      
      const svg = this.createChordSVG(chord.frets, chord.fingering);
      
      diagram.appendChild(name);
      diagram.appendChild(svg);
      container.appendChild(diagram);
    }
  }

  /**
   * Create an SVG chord diagram
   * @param {string} frets - Fret positions (e.g., "022000", "x32010")
   * @param {string} fingering - Optional fingering pattern (e.g., "012000", "x21030")
   * @returns {SVGElement}
   */
  createChordSVG(frets, fingering) {
    // Get string count from tuning, default to 6 for standard guitar
    const numStrings = this.parseStringCount(this.songMetadata?.tuning);
    
    const stringSpacing = 8;
    const fretSpacing = 14;
    const leftPadding = 12;
    const topPadding = 16;
    const numFrets = 4;
    
    // Calculate dynamic width based on number of strings
    const width = leftPadding * 2 + (numStrings - 1) * stringSpacing;
    const height = 80;

    // Parse frets
    const fretValues = frets.split('').map(f => f.toLowerCase() === 'x' ? -1 : parseInt(f));
    const fingerValues = fingering ? fingering.split('').map(f => {
      if (f.toLowerCase() === 'x') return null;
      if (f === '0') return null;
      return f.toUpperCase();
    }) : [];

    // Calculate min/max frets to determine if we need a position marker
    const playedFrets = fretValues.filter(f => f > 0);
    const minFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 0;
    const maxFret = playedFrets.length > 0 ? Math.max(...playedFrets) : 0;
    
    // If all frets are within first 4, show from nut. Otherwise, show from minFret
    let startFret = 0;
    let showNut = true;
    if (maxFret > 4) {
      startFret = minFret - 1;
      showNut = false;
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', width);
    bg.setAttribute('height', height);
    bg.setAttribute('fill', '#1a1a1a');
    bg.setAttribute('rx', '4');
    svg.appendChild(bg);

    // Nut (thick line at top) or position marker
    if (showNut) {
      const nut = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      nut.setAttribute('x', leftPadding - 1);
      nut.setAttribute('y', topPadding - 2);
      nut.setAttribute('width', (numStrings - 1) * stringSpacing + 2);
      nut.setAttribute('height', 3);
      nut.setAttribute('fill', '#f0e6d3');
      svg.appendChild(nut);
    } else {
      // Position marker
      const posText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      posText.setAttribute('x', 2);
      posText.setAttribute('y', topPadding + fretSpacing / 2 + 3);
      posText.setAttribute('font-size', '8');
      posText.setAttribute('fill', '#a89f8c');
      posText.setAttribute('font-family', 'sans-serif');
      posText.textContent = startFret + 1;
      svg.appendChild(posText);
    }

    // Fret lines
    for (let i = 0; i <= numFrets; i++) {
      const fret = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      fret.setAttribute('x1', leftPadding);
      fret.setAttribute('y1', topPadding + i * fretSpacing);
      fret.setAttribute('x2', leftPadding + (numStrings - 1) * stringSpacing);
      fret.setAttribute('y2', topPadding + i * fretSpacing);
      fret.setAttribute('stroke', '#4a4a4a');
      fret.setAttribute('stroke-width', '1');
      svg.appendChild(fret);
    }

    // Strings
    for (let i = 0; i < numStrings; i++) {
      const string = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      string.setAttribute('x1', leftPadding + i * stringSpacing);
      string.setAttribute('y1', topPadding);
      string.setAttribute('x2', leftPadding + i * stringSpacing);
      string.setAttribute('y2', topPadding + numFrets * fretSpacing);
      string.setAttribute('stroke', '#6b6459');
      string.setAttribute('stroke-width', '1');
      svg.appendChild(string);
    }

    // Finger positions and markers
    for (let i = 0; i < numStrings; i++) {
      const fretVal = fretValues[i];
      const fingerVal = fingerValues[i];
      const x = leftPadding + i * stringSpacing;

      if (fretVal === -1) {
        // X marker (muted string)
        const xMark = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        xMark.setAttribute('x', x);
        xMark.setAttribute('y', topPadding - 5);
        xMark.setAttribute('text-anchor', 'middle');
        xMark.setAttribute('font-size', '8');
        xMark.setAttribute('fill', '#6b6459');
        xMark.setAttribute('font-family', 'sans-serif');
        xMark.textContent = '×';
        svg.appendChild(xMark);
      } else if (fretVal === 0) {
        // Open string (O marker)
        const oMark = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        oMark.setAttribute('cx', x);
        oMark.setAttribute('cy', topPadding - 6);
        oMark.setAttribute('r', '3');
        oMark.setAttribute('stroke', '#a89f8c');
        oMark.setAttribute('stroke-width', '1');
        oMark.setAttribute('fill', 'none');
        svg.appendChild(oMark);
      } else {
        // Fretted note
        const displayFret = fretVal - startFret;
        const y = topPadding + (displayFret - 0.5) * fretSpacing;
        
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', x);
        dot.setAttribute('cy', y);
        dot.setAttribute('r', '4');
        dot.setAttribute('fill', fingerVal ? '#e07020' : '#f0e6d3');
        svg.appendChild(dot);

        // Finger number
        if (fingerVal) {
          const fingerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          fingerText.setAttribute('x', x);
          fingerText.setAttribute('y', y + 3);
          fingerText.setAttribute('text-anchor', 'middle');
          fingerText.setAttribute('font-size', '7');
          fingerText.setAttribute('fill', '#0d0d0d');
          fingerText.setAttribute('font-weight', 'bold');
          fingerText.setAttribute('font-family', 'sans-serif');
          fingerText.textContent = fingerVal;
          svg.appendChild(fingerText);
        }
      }
    }

    return svg;
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
    // Tab switching
    const tabInfo = this.shadowRoot.getElementById('tab-info');
    const tabMetronome = this.shadowRoot.getElementById('tab-metronome');
    const contentInfo = this.shadowRoot.getElementById('content-info');
    const contentMetronome = this.shadowRoot.getElementById('content-metronome');

    const switchTab = (tab) => {
      this.activeTab = tab;
      
      // Update button states
      tabInfo.classList.toggle('active', tab === 'info');
      tabMetronome.classList.toggle('active', tab === 'metronome');
      
      // Update content visibility
      contentInfo.classList.toggle('active', tab === 'info');
      contentMetronome.classList.toggle('active', tab === 'metronome');
    };

    tabInfo.addEventListener('click', () => switchTab('info'));
    tabMetronome.addEventListener('click', () => switchTab('metronome'));

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
            // Poll video time until offset is reached
            this.waitForOffset(e.detail.currentTime);
          } else if (this.offset < 0) {
            // Negative offset - start immediately (video is already past offset point)
            this.resume();
          } else {
            // No offset
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

    // Listen for video loop restart - reset beat position
    window.addEventListener('video-loop-restart', () => {
      if (this.autoStartWithVideo && this.isPlaying) {
        // Reset to beat 1 when loop restarts
        this.resetToBeat(0);
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

  /**
   * Wait for video to reach the offset time before starting metronome
   * @param {number} startTime - Video time when play was pressed
   */
  waitForOffset(startTime) {
    // Clear any existing offset waiter
    if (this._offsetWaiter) {
      clearInterval(this._offsetWaiter);
    }

    // Get reference to YouTube player
    const youtubePlayer = document.querySelector('youtube-player');
    if (!youtubePlayer) {
      // No player found, fall back to immediate start
      this.resume();
      return;
    }

    // Poll every 100ms to check if we've reached offset
    this._offsetWaiter = setInterval(() => {
      const currentTime = youtubePlayer.getCurrentTime();
      const playerState = youtubePlayer.getPlayerState();
      
      // Check if video is still playing
      if (playerState !== 1) {
        // Video stopped/paused - cancel waiting
        clearInterval(this._offsetWaiter);
        this._offsetWaiter = null;
        return;
      }
      
      if (currentTime >= this.offset) {
        // Offset reached - start metronome
        clearInterval(this._offsetWaiter);
        this._offsetWaiter = null;
        this.resume();
      }
    }, 100);
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
    this.totalBeatsScheduled = 0;
    this.startTime = this.audioContext.currentTime;
    this.nextBeatTime = this.startTime;
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
      // Update start time to maintain absolute timing reference
      const secondsPerBeat = 60.0 / this.tempo;
      this.startTime = this.nextBeatTime - (this.totalBeatsScheduled * secondsPerBeat);
    } else {
      // Fresh start
      this.currentBeat = 0;
      this.totalBeatsScheduled = 0;
      this.startTime = this.audioContext.currentTime;
      this.nextBeatTime = this.startTime;
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
    this.totalBeatsScheduled = 0;
    
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
    this.totalBeatsScheduled++;
    // Calculate next beat time from absolute start time to prevent drift
    this.nextBeatTime = this.startTime + (this.totalBeatsScheduled * secondsPerBeat);
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
