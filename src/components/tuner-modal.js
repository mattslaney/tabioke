/**
 * Tuner Modal Web Component
 * A guitar tuner using the Web Audio API with pitch detection
 * Supports standard and alternate tunings
 */
class TunerModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isOpen = false;
    
    // Audio context and analysis
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
    this.isListening = false;
    this.animationFrame = null;
    
    // Pitch detection state
    this.detectedFrequency = null;
    this.detectedString = null;
    this.centsOff = 0;
    this.smoothedFrequency = null;
    this.frequencyHistory = [];
    
    // Display preferences
    this.reverseStrings = localStorage.getItem('tabioke-tuner-reverse') === 'true';
    
    // Standard tuning frequencies (low to high: E2, A2, D3, G3, B3, E4)
    this.standardTuning = [
      { note: 'E', octave: 2, frequency: 82.41, stringNum: 6 },
      { note: 'A', octave: 2, frequency: 110.00, stringNum: 5 },
      { note: 'D', octave: 3, frequency: 146.83, stringNum: 4 },
      { note: 'G', octave: 3, frequency: 196.00, stringNum: 3 },
      { note: 'B', octave: 3, frequency: 246.94, stringNum: 2 },
      { note: 'E', octave: 4, frequency: 329.63, stringNum: 1 }
    ];
    
    // Current tuning (will be updated based on song metadata)
    this.currentTuning = this.standardTuning.map((s, i) => ({ ...s, stringNum: 6 - i }));
    this.tuningName = 'Standard';
    
    // Note frequency reference (A4 = 440Hz based)
    this.noteFrequencies = {
      'C': 261.63,
      'C#': 277.18, 'Db': 277.18,
      'D': 293.66,
      'D#': 311.13, 'Eb': 311.13,
      'E': 329.63,
      'F': 349.23,
      'F#': 369.99, 'Gb': 369.99,
      'G': 392.00,
      'G#': 415.30, 'Ab': 415.30,
      'A': 440.00,
      'A#': 466.16, 'Bb': 466.16,
      'B': 493.88
    };
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.listenForTuningChanges();
  }

  disconnectedCallback() {
    this.stopListening();
  }

  /**
   * Listen for tuning changes from tab metadata
   */
  listenForTuningChanges() {
    window.addEventListener('tab-metadata-loaded', (e) => {
      const metadata = e.detail;
      if (metadata.tuning) {
        this.parseTuning(metadata.tuning);
        this.updateTuningDisplay();
      } else {
        // Reset to standard tuning
        this.currentTuning = this.standardTuning.map((s, i) => ({ ...s, stringNum: 6 - i }));
        this.tuningName = 'Standard';
        this.updateTuningDisplay();
      }
    });
  }

  /**
   * Parse a tuning string into note frequencies
   * Supports formats: "E A D G B E", "EADGBE", "D-A-D-G-A-D", "Drop D", etc.
   * @param {string} tuningStr - The tuning string from metadata
   */
  parseTuning(tuningStr) {
    if (!tuningStr || typeof tuningStr !== 'string') {
      this.currentTuning = this.standardTuning.map((s, i) => ({ ...s, stringNum: 6 - i }));
      this.tuningName = 'Standard';
      return;
    }

    const trimmed = tuningStr.trim();
    this.tuningName = trimmed;

    // Check for common named tunings
    const namedTunings = {
      'standard': this.standardTuning,
      'e standard': this.standardTuning,
      'drop d': [
        { note: 'D', octave: 2, frequency: 73.42 },
        { note: 'A', octave: 2, frequency: 110.00 },
        { note: 'D', octave: 3, frequency: 146.83 },
        { note: 'G', octave: 3, frequency: 196.00 },
        { note: 'B', octave: 3, frequency: 246.94 },
        { note: 'E', octave: 4, frequency: 329.63 }
      ],
      'dadgad': [
        { note: 'D', octave: 2, frequency: 73.42 },
        { note: 'A', octave: 2, frequency: 110.00 },
        { note: 'D', octave: 3, frequency: 146.83 },
        { note: 'G', octave: 3, frequency: 196.00 },
        { note: 'A', octave: 3, frequency: 220.00 },
        { note: 'D', octave: 4, frequency: 293.66 }
      ],
      'open g': [
        { note: 'D', octave: 2, frequency: 73.42 },
        { note: 'G', octave: 2, frequency: 98.00 },
        { note: 'D', octave: 3, frequency: 146.83 },
        { note: 'G', octave: 3, frequency: 196.00 },
        { note: 'B', octave: 3, frequency: 246.94 },
        { note: 'D', octave: 4, frequency: 293.66 }
      ],
      'open d': [
        { note: 'D', octave: 2, frequency: 73.42 },
        { note: 'A', octave: 2, frequency: 110.00 },
        { note: 'D', octave: 3, frequency: 146.83 },
        { note: 'F#', octave: 3, frequency: 185.00 },
        { note: 'A', octave: 3, frequency: 220.00 },
        { note: 'D', octave: 4, frequency: 293.66 }
      ],
      'half step down': [
        { note: 'Eb', octave: 2, frequency: 77.78 },
        { note: 'Ab', octave: 2, frequency: 103.83 },
        { note: 'Db', octave: 3, frequency: 138.59 },
        { note: 'Gb', octave: 3, frequency: 185.00 },
        { note: 'Bb', octave: 3, frequency: 233.08 },
        { note: 'Eb', octave: 4, frequency: 311.13 }
      ],
      'eb standard': [
        { note: 'Eb', octave: 2, frequency: 77.78 },
        { note: 'Ab', octave: 2, frequency: 103.83 },
        { note: 'Db', octave: 3, frequency: 138.59 },
        { note: 'Gb', octave: 3, frequency: 185.00 },
        { note: 'Bb', octave: 3, frequency: 233.08 },
        { note: 'Eb', octave: 4, frequency: 311.13 }
      ],
      'd standard': [
        { note: 'D', octave: 2, frequency: 73.42 },
        { note: 'G', octave: 2, frequency: 98.00 },
        { note: 'C', octave: 3, frequency: 130.81 },
        { note: 'F', octave: 3, frequency: 174.61 },
        { note: 'A', octave: 3, frequency: 220.00 },
        { note: 'D', octave: 4, frequency: 293.66 }
      ]
    };

    const lowerTuning = trimmed.toLowerCase();
    if (namedTunings[lowerTuning]) {
      const tuning = namedTunings[lowerTuning];
      this.currentTuning = tuning.map((s, i) => ({ ...s, stringNum: tuning.length - i }));
      return;
    }

    // Parse note-by-note tuning (e.g., "E A D G B E" or "EADGBE" or "D-A-D-G-A-D")
    let notes = [];
    
    if (trimmed.includes(' ') || trimmed.includes('-')) {
      // Split by space or hyphen
      notes = trimmed.split(/[\s-]+/).filter(n => n.length > 0);
    } else {
      // No separators - try to parse individual notes
      const notePattern = /[A-Ga-g][#b♯♭]?/g;
      const matches = trimmed.match(notePattern);
      if (matches) {
        notes = matches;
      }
    }

    if (notes.length >= 4 && notes.length <= 12) {
      // Valid number of strings - convert to tuning array
      this.currentTuning = notes.map((noteStr, index) => {
        const note = this.normalizeNote(noteStr);
        const frequency = this.calculateFrequency(note, index, notes.length);
        const octave = this.estimateOctave(index, notes.length);
        return { note, octave, frequency, stringNum: notes.length - index };
      });
    } else {
      // Fallback to standard tuning
      this.currentTuning = this.standardTuning.map((s, i) => ({ ...s, stringNum: 6 - i }));
    }
  }

  /**
   * Normalize a note name to uppercase with proper sharp/flat
   */
  normalizeNote(noteStr) {
    if (!noteStr) return 'E';
    let note = noteStr.toUpperCase();
    // Convert flat/sharp symbols
    note = note.replace('♯', '#').replace('♭', 'b');
    // Ensure first letter is A-G
    if (!/^[A-G]/.test(note)) {
      return 'E';
    }
    return note.substring(0, 2).replace(/[^A-G#b]/g, '');
  }

  /**
   * Calculate frequency for a note at a given string position
   */
  calculateFrequency(note, stringIndex, totalStrings) {
    // Get base frequency from reference (octave 4 for most notes)
    const baseNote = note.replace('b', '').replace('#', '');
    let baseFreq = this.noteFrequencies[note] || this.noteFrequencies[baseNote] || 329.63;
    
    // Adjust octave based on string position (lower strings = lower octave)
    const octaveOffset = this.estimateOctave(stringIndex, totalStrings) - 4;
    return baseFreq * Math.pow(2, octaveOffset);
  }

  /**
   * Estimate the octave for a string based on position
   */
  estimateOctave(stringIndex, totalStrings) {
    // For 6-string guitar: strings go from E2 to E4
    // Lower index = lower pitch string
    if (totalStrings === 6) {
      const octaves = [2, 2, 3, 3, 3, 4];
      return octaves[stringIndex] || 3;
    } else if (totalStrings === 4) {
      // Bass guitar
      const octaves = [1, 1, 2, 2];
      return octaves[stringIndex] || 2;
    } else if (totalStrings === 7) {
      const octaves = [1, 2, 2, 3, 3, 3, 4];
      return octaves[stringIndex] || 3;
    }
    return 3;
  }

  /**
   * Initialize audio context and microphone
   */
  async initAudio() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    return this.audioContext;
  }

  /**
   * Start listening to microphone input
   */
  async startListening() {
    try {
      await this.initAudio();
      
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      
      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 4096;
      this.analyser.smoothingTimeConstant = 0.8;
      
      // Connect microphone to analyser
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);
      
      this.isListening = true;
      this.updateListeningUI();
      
      // Start pitch detection loop
      this.detectPitch();
      
    } catch (err) {
      console.error('Error accessing microphone:', err);
      this.showError('Microphone access denied. Please allow microphone access to use the tuner.');
    }
  }

  /**
   * Stop listening to microphone
   */
  stopListening() {
    this.isListening = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    this.detectedFrequency = null;
    this.detectedString = null;
    this.centsOff = 0;
    this.frequencyHistory = [];
    
    this.updateListeningUI();
    this.updatePitchDisplay();
  }

  /**
   * Pitch detection using autocorrelation algorithm
   */
  detectPitch() {
    if (!this.isListening || !this.analyser) return;
    
    const bufferLength = this.analyser.fftSize;
    const buffer = new Float32Array(bufferLength);
    this.analyser.getFloatTimeDomainData(buffer);
    
    // Check if there's a signal (not silence)
    let rms = 0;
    for (let i = 0; i < bufferLength; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / bufferLength);
    
    if (rms < 0.01) {
      // Too quiet, no signal
      this.detectedFrequency = null;
      this.detectedString = null;
      this.updatePitchDisplay();
      this.animationFrame = requestAnimationFrame(() => this.detectPitch());
      return;
    }
    
    // Autocorrelation
    const correlations = new Float32Array(bufferLength);
    for (let lag = 0; lag < bufferLength; lag++) {
      let sum = 0;
      for (let i = 0; i < bufferLength - lag; i++) {
        sum += buffer[i] * buffer[i + lag];
      }
      correlations[lag] = sum;
    }
    
    // Find the first peak after the initial drop
    let foundPeak = false;
    let peakLag = 0;
    let peakValue = 0;
    
    // Start looking after some minimum lag (to skip the peak at 0)
    const minLag = Math.floor(this.audioContext.sampleRate / 500); // Max 500Hz
    const maxLag = Math.floor(this.audioContext.sampleRate / 60);  // Min 60Hz
    
    // First, find where correlations start increasing
    let startSearching = false;
    for (let lag = minLag; lag < maxLag; lag++) {
      if (!startSearching && correlations[lag] < correlations[lag - 1]) {
        continue;
      }
      startSearching = true;
      
      if (correlations[lag] > correlations[lag - 1] && correlations[lag] > correlations[lag + 1]) {
        if (correlations[lag] > peakValue) {
          peakValue = correlations[lag];
          peakLag = lag;
          foundPeak = true;
        }
      }
    }
    
    if (foundPeak && peakValue > correlations[0] * 0.5) {
      // Parabolic interpolation for better accuracy
      const y1 = correlations[peakLag - 1];
      const y2 = correlations[peakLag];
      const y3 = correlations[peakLag + 1];
      const refinedLag = peakLag + (y3 - y1) / (2 * (2 * y2 - y1 - y3));
      
      const frequency = this.audioContext.sampleRate / refinedLag;
      
      // Smooth the frequency
      this.frequencyHistory.push(frequency);
      if (this.frequencyHistory.length > 5) {
        this.frequencyHistory.shift();
      }
      
      // Use median for stability
      const sorted = [...this.frequencyHistory].sort((a, b) => a - b);
      this.smoothedFrequency = sorted[Math.floor(sorted.length / 2)];
      this.detectedFrequency = this.smoothedFrequency;
      
      // Find closest string by frequency (not by note name)
      this.findClosestString(this.detectedFrequency);
    } else {
      this.frequencyHistory = [];
      this.detectedFrequency = null;
      this.detectedString = null;
    }
    
    this.updatePitchDisplay();
    this.animationFrame = requestAnimationFrame(() => this.detectPitch());
  }

  /**
   * Find the closest string based on detected frequency
   * Uses frequency matching to handle duplicate note names
   */
  findClosestString(frequency) {
    if (!frequency || frequency < 50 || frequency > 500) {
      this.detectedString = null;
      this.centsOff = 0;
      return;
    }
    
    let closestString = null;
    let smallestCents = Infinity;
    
    for (let i = 0; i < this.currentTuning.length; i++) {
      const string = this.currentTuning[i];
      const cents = this.frequencyToCents(frequency, string.frequency);
      
      // Only match if within reasonable range (100 cents = 1 semitone)
      // We use 80 cents as threshold to allow for significant detuning
      if (Math.abs(cents) < Math.abs(smallestCents) && Math.abs(cents) < 80) {
        smallestCents = cents;
        closestString = i;
      }
    }
    
    this.detectedString = closestString;
    this.centsOff = closestString !== null ? smallestCents : 0;
  }

  /**
   * Calculate cents difference between two frequencies
   */
  frequencyToCents(detected, target) {
    return 1200 * Math.log2(detected / target);
  }

  /**
   * Update the pitch display and indicators
   */
  updatePitchDisplay() {
    const freqDisplay = this.shadowRoot.getElementById('detected-freq');
    const centsDisplay = this.shadowRoot.getElementById('cents-display');
    const tuningIndicator = this.shadowRoot.getElementById('tuning-indicator');
    const indicatorNeedle = this.shadowRoot.getElementById('indicator-needle');
    const statusText = this.shadowRoot.getElementById('tuning-status');
    
    // Update string highlights
    this.updateStringHighlights();
    
    if (!this.isListening) {
      if (freqDisplay) freqDisplay.textContent = '-- Hz';
      if (centsDisplay) centsDisplay.textContent = '';
      if (tuningIndicator) tuningIndicator.className = 'tuning-indicator';
      if (indicatorNeedle) indicatorNeedle.style.transform = 'translateX(-50%) rotate(0deg)';
      if (statusText) statusText.textContent = 'Click Start to begin tuning';
      return;
    }
    
    if (this.detectedFrequency === null) {
      if (freqDisplay) freqDisplay.textContent = '-- Hz';
      if (centsDisplay) centsDisplay.textContent = '';
      if (tuningIndicator) tuningIndicator.className = 'tuning-indicator';
      if (indicatorNeedle) indicatorNeedle.style.transform = 'translateX(-50%) rotate(0deg)';
      if (statusText) statusText.textContent = 'Play a string...';
      return;
    }
    
    if (freqDisplay) {
      freqDisplay.textContent = `${this.detectedFrequency.toFixed(1)} Hz`;
    }
    
    if (this.detectedString !== null) {
      const string = this.currentTuning[this.detectedString];
      const absCents = Math.abs(this.centsOff);
      
      // Update cents display
      if (centsDisplay) {
        const sign = this.centsOff > 0 ? '+' : '';
        centsDisplay.textContent = `${sign}${Math.round(this.centsOff)} cents`;
      }
      
      // Update indicator class and needle position
      if (tuningIndicator) {
        if (absCents < 3) {
          tuningIndicator.className = 'tuning-indicator in-tune';
        } else if (absCents < 10) {
          tuningIndicator.className = 'tuning-indicator almost';
        } else if (this.centsOff > 0) {
          tuningIndicator.className = 'tuning-indicator sharp';
        } else {
          tuningIndicator.className = 'tuning-indicator flat';
        }
      }
      
      // Move needle (-45 to +45 degrees based on cents off, clamped)
      if (indicatorNeedle) {
        const clampedCents = Math.max(-50, Math.min(50, this.centsOff));
        const rotation = (clampedCents / 50) * 45;
        indicatorNeedle.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
      }
      
      // Status text
      if (statusText) {
        const stringLabel = `${string.note}${string.octave} (String ${string.stringNum})`;
        if (absCents < 3) {
          statusText.textContent = `✓ ${stringLabel} - In Tune!`;
        } else if (absCents < 10) {
          statusText.textContent = `${stringLabel} - Almost there!`;
        } else if (this.centsOff > 0) {
          statusText.textContent = `${stringLabel} - Tune Down ↓`;
        } else {
          statusText.textContent = `${stringLabel} - Tune Up ↑`;
        }
      }
    } else {
      if (centsDisplay) centsDisplay.textContent = '';
      if (tuningIndicator) tuningIndicator.className = 'tuning-indicator';
      if (indicatorNeedle) indicatorNeedle.style.transform = 'translateX(-50%) rotate(0deg)';
      if (statusText) statusText.textContent = 'No matching string found';
    }
  }

  /**
   * Update string button highlights based on detected string
   */
  updateStringHighlights() {
    const stringButtons = this.shadowRoot.querySelectorAll('.string-btn');
    stringButtons.forEach(btn => {
      const index = parseInt(btn.dataset.index);
      btn.classList.remove('detected', 'in-tune', 'sharp', 'flat');
      
      if (index === this.detectedString && this.isListening) {
        btn.classList.add('detected');
        
        const absCents = Math.abs(this.centsOff);
        if (absCents < 3) {
          btn.classList.add('in-tune');
        } else if (this.centsOff > 0) {
          btn.classList.add('sharp');
        } else {
          btn.classList.add('flat');
        }
      }
    });
  }

  /**
   * Update the listening state in the UI
   */
  updateListeningUI() {
    const startBtn = this.shadowRoot.getElementById('start-btn');
    const stopBtn = this.shadowRoot.getElementById('stop-btn');
    const indicator = this.shadowRoot.querySelector('.listening-indicator');
    
    if (this.isListening) {
      if (startBtn) startBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'block';
      if (indicator) indicator.classList.add('active');
    } else {
      if (startBtn) startBtn.style.display = 'block';
      if (stopBtn) stopBtn.style.display = 'none';
      if (indicator) indicator.classList.remove('active');
    }
  }

  /**
   * Show an error message
   */
  showError(message) {
    const statusText = this.shadowRoot.getElementById('tuning-status');
    if (statusText) {
      statusText.textContent = message;
      statusText.style.color = '#ef4444';
    }
  }

  /**
   * Update the tuning display when tuning changes
   */
  updateTuningDisplay() {
    if (!this.isOpen) return;
    
    const tuningLabel = this.shadowRoot.querySelector('.tuning-label');
    const stringsContainer = this.shadowRoot.querySelector('.strings-container');
    
    if (tuningLabel) {
      tuningLabel.textContent = this.tuningName;
    }
    
    if (stringsContainer) {
      stringsContainer.innerHTML = this.renderStrings();
    }
  }

  /**
   * Toggle string display order
   */
  toggleStringOrder() {
    this.reverseStrings = !this.reverseStrings;
    localStorage.setItem('tabioke-tuner-reverse', this.reverseStrings.toString());
    this.updateTuningDisplay();
    this.updateReverseToggle();
  }

  /**
   * Update the reverse toggle checkbox state
   */
  updateReverseToggle() {
    const toggle = this.shadowRoot.getElementById('reverse-toggle');
    if (toggle) {
      toggle.checked = this.reverseStrings;
    }
  }

  /**
   * Render the string buttons HTML
   */
  renderStrings() {
    // Get strings in display order
    let stringsToRender = [...this.currentTuning];
    
    if (this.reverseStrings) {
      // Tab notation order: high strings at top (string 1 first)
      stringsToRender = stringsToRender.slice().reverse();
    }
    // Default: low strings at top (traditional tuner order)
    
    return stringsToRender.map((string) => {
      // Find the actual index in currentTuning for this string
      const actualIndex = this.currentTuning.findIndex(s => s === string);
      const thickness = 1 + (this.currentTuning.length - 1 - actualIndex) * 0.5;
      
      return `
        <div class="string-btn" data-index="${actualIndex}">
          <span class="string-number">${string.stringNum}</span>
          <span class="string-note">${string.note}<sub>${string.octave}</sub></span>
          <span class="string-freq">${string.frequency.toFixed(1)} Hz</span>
          <div class="string-visual">
            <div class="string-line" style="height: ${thickness}px"></div>
          </div>
        </div>
      `;
    }).join('');
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
          --warning-color: #f59e0b;
          --error-color: #ef4444;
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
          max-width: 460px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .modal-title {
          font-family: var(--font-display);
          font-size: 1.2rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .modal-title::before {
          content: '🎸';
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
          padding: 16px 20px;
          overflow-y: auto;
          flex: 1;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge */
        }

        .modal-body::-webkit-scrollbar {
          display: none; /* Chrome/Safari */
        }

        .tuning-info {
          text-align: center;
          margin-bottom: 12px;
        }

        .tuning-title {
          font-family: var(--font-display);
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 4px;
        }

        .tuning-label {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--accent-primary);
        }

        /* Pitch Display */
        .pitch-display {
          background: var(--bg-tertiary);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          text-align: center;
        }

        .tuning-indicator {
          position: relative;
          height: 60px;
          margin-bottom: 12px;
          overflow: hidden;
        }

        .indicator-scale {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          height: 30px;
          padding: 0 20px;
        }

        .scale-mark {
          width: 2px;
          background: var(--border-color);
        }

        .scale-mark.center {
          height: 30px;
          background: var(--text-muted);
        }

        .scale-mark:not(.center) {
          height: 15px;
        }

        .indicator-needle {
          position: absolute;
          bottom: 0;
          left: 50%;
          width: 4px;
          height: 50px;
          background: var(--text-secondary);
          border-radius: 2px;
          transform-origin: bottom center;
          transform: translateX(-50%) rotate(0deg);
          transition: transform 0.1s ease-out, background 0.2s;
        }

        .tuning-indicator.in-tune .indicator-needle {
          background: var(--success-color);
          box-shadow: 0 0 10px var(--success-color);
        }

        .tuning-indicator.almost .indicator-needle {
          background: var(--warning-color);
        }

        .tuning-indicator.sharp .indicator-needle,
        .tuning-indicator.flat .indicator-needle {
          background: var(--error-color);
        }

        .indicator-labels {
          display: flex;
          justify-content: space-between;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--text-muted);
          margin-top: 4px;
          padding: 0 10px;
        }

        .detected-freq {
          font-family: var(--font-mono);
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .cents-display {
          font-family: var(--font-mono);
          font-size: 0.9rem;
          color: var(--text-secondary);
          height: 1.2em;
        }

        .tuning-status {
          font-family: var(--font-display);
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin-top: 8px;
        }

        .tuning-indicator.in-tune + .detected-freq,
        .tuning-indicator.in-tune ~ .tuning-status {
          color: var(--success-color);
        }

        /* Controls */
        .controls-row {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .control-btn {
          flex: 1;
          padding: 12px;
          border-radius: 8px;
          font-family: var(--font-display);
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: 2px solid var(--border-color);
          background: var(--bg-elevated);
          color: var(--text-primary);
        }

        .control-btn:hover {
          border-color: var(--accent-primary);
        }

        .control-btn.primary {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          color: var(--bg-primary);
        }

        .control-btn.primary:hover {
          filter: brightness(1.1);
        }

        #stop-btn {
          display: none;
          background: var(--bg-tertiary);
        }

        .listening-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--text-muted);
          margin-right: 8px;
          transition: all 0.2s;
        }

        .listening-indicator.active {
          background: var(--success-color);
          box-shadow: 0 0 8px var(--success-color);
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* String Display Toggle */
        .display-options {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          margin-bottom: 8px;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-display);
          font-size: 0.75rem;
          color: var(--text-secondary);
          cursor: pointer;
        }

        .toggle-label input {
          display: none;
        }

        .toggle-checkbox {
          width: 14px;
          height: 14px;
          border-radius: 3px;
          border: 2px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .toggle-label input:checked + .toggle-checkbox {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
        }

        .toggle-checkbox::after {
          content: '✓';
          font-size: 9px;
          color: var(--bg-primary);
          opacity: 0;
        }

        .toggle-label input:checked + .toggle-checkbox::after {
          opacity: 1;
        }

        /* Strings Container */
        .strings-container {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .string-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          /*width: 100%;*/
          padding: 8px 14px;
          background: var(--bg-tertiary);
          border: 2px solid var(--border-color);
          border-radius: 8px;
          transition: all 0.2s ease;
          font-family: var(--font-display);
        }

        .string-btn.detected {
          border-color: var(--accent-primary);
          background: var(--bg-elevated);
        }

        .string-btn.detected.in-tune {
          border-color: var(--success-color);
          background: rgba(16, 185, 129, 0.1);
          box-shadow: 0 0 15px rgba(16, 185, 129, 0.2);
        }

        .string-btn.detected.sharp {
          border-color: var(--error-color);
          background: rgba(239, 68, 68, 0.1);
        }

        .string-btn.detected.flat {
          border-color: var(--warning-color);
          background: rgba(245, 158, 11, 0.1);
        }

        .string-number {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--text-muted);
          width: 16px;
          text-align: center;
        }

        .string-note {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
          width: 45px;
        }

        .string-note sub {
          font-size: 0.65rem;
          color: var(--text-muted);
        }

        .string-btn.detected .string-note {
          color: var(--accent-primary);
        }

        .string-btn.detected.in-tune .string-note {
          color: var(--success-color);
        }

        .string-freq {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--text-muted);
          width: 65px;
        }

        .string-visual {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 16px;
        }

        .string-line {
          width: 100%;
          background: linear-gradient(
            to right,
            var(--text-muted),
            var(--text-secondary),
            var(--text-muted)
          );
          border-radius: 1px;
          transition: all 0.2s ease;
        }

        .string-btn.detected .string-line {
          background: linear-gradient(
            to right,
            var(--accent-primary),
            var(--text-primary),
            var(--accent-primary)
          );
        }

        .string-btn.detected.in-tune .string-line {
          background: var(--success-color);
          animation: vibrate 0.08s ease-in-out infinite;
        }

        @keyframes vibrate {
          0%, 100% { transform: translateY(0); }
          25% { transform: translateY(-1px); }
          75% { transform: translateY(1px); }
        }

        /* Instructions */
        .instructions {
          margin-top: 12px;
          padding: 10px 12px;
          background: var(--bg-tertiary);
          border-radius: 8px;
          border-left: 3px solid var(--accent-primary);
        }

        .instructions-title {
          font-family: var(--font-display);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--accent-primary);
          margin-bottom: 6px;
        }

        .instructions-text {
          font-family: var(--font-display);
          font-size: 0.75rem;
          color: var(--text-secondary);
          line-height: 1.4;
          margin: 0;
        }
      </style>

      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Guitar Tuner</h2>
            <button class="close-btn" id="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <div class="tuning-info">
              <div class="tuning-title">Current Tuning</div>
              <div class="tuning-label">${this.tuningName}</div>
            </div>
            
            <div class="pitch-display">
              <div class="tuning-indicator" id="tuning-indicator">
                <div class="indicator-scale">
                  <div class="scale-mark"></div>
                  <div class="scale-mark"></div>
                  <div class="scale-mark"></div>
                  <div class="scale-mark center"></div>
                  <div class="scale-mark"></div>
                  <div class="scale-mark"></div>
                  <div class="scale-mark"></div>
                </div>
                <div class="indicator-needle" id="indicator-needle"></div>
              </div>
              <div class="indicator-labels">
                <span>♭ Flat</span>
                <span>Sharp ♯</span>
              </div>
              <div class="detected-freq" id="detected-freq">-- Hz</div>
              <div class="cents-display" id="cents-display"></div>
              <div class="tuning-status" id="tuning-status">Click Start to begin tuning</div>
            </div>
            
            <div class="controls-row">
              <button class="control-btn primary" id="start-btn">
                <span class="listening-indicator"></span>Start Tuner
              </button>
              <button class="control-btn" id="stop-btn">
                ⏹ Stop
              </button>
            </div>
            
            <div class="display-options">
              <label class="toggle-label" title="Match tab notation (high strings at top)">
                <input type="checkbox" id="reverse-toggle" ${this.reverseStrings ? 'checked' : ''}>
                <div class="toggle-checkbox"></div>
                <span>Tab notation order</span>
              </label>
            </div>
            
            <div class="strings-container">
              ${this.renderStrings()}
            </div>
            
            <div class="instructions">
              <div class="instructions-title">💡 How to use</div>
              <p class="instructions-text">
                Click Start and play a string on your guitar. The tuner will detect which string you're playing 
                and show if it's sharp (♯) or flat (♭). Adjust until the needle is centered and green.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    const overlay = this.shadowRoot.querySelector('.modal-overlay');
    const closeBtn = this.shadowRoot.getElementById('close-btn');
    const startBtn = this.shadowRoot.getElementById('start-btn');
    const stopBtn = this.shadowRoot.getElementById('stop-btn');
    const reverseToggle = this.shadowRoot.getElementById('reverse-toggle');
    
    // Start button
    startBtn.addEventListener('click', () => this.startListening());
    
    // Stop button
    stopBtn.addEventListener('click', () => this.stopListening());
    
    // Reverse toggle
    reverseToggle.addEventListener('change', () => this.toggleStringOrder());
    
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
    
    // Listen for open event
    window.addEventListener('show-tuner-modal', () => this.open());
  }

  /**
   * Open the modal
   */
  open() {
    this.isOpen = true;
    this.shadowRoot.querySelector('.modal-overlay').classList.add('open');
    this.updateTuningDisplay();
    this.updateReverseToggle();
  }

  /**
   * Close the modal
   */
  close() {
    this.stopListening();
    this.isOpen = false;
    this.shadowRoot.querySelector('.modal-overlay').classList.remove('open');
  }
}

customElements.define('tuner-modal', TunerModal);

export default TunerModal;
