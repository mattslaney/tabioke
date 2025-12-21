/**
 * Tab Viewer Web Component
 * Displays guitar tablature with synchronized scrolling
 */
class TabViewer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    this.tabContent = '';
    this.scrollPosition = 0;
    this.isAutoScrolling = false;
    this.scrollSpeed = 1; // pixels per second
    this.totalDuration = 0;
    this.currentTime = 0;
    this.highlightEnabled = true;
    this.syncEnabled = true;
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  /**
   * Parse timestamps from tab content
   * Supports formats: @mm:ss, @m:ss, @h:mm:ss, @hh:mm:ss
   * @param {string} content - Tab content
   * @returns {Array} - Array of { time: seconds, lineNumber: number }
   */
  parseTimestamps(content) {
    const lines = content.split('\n');
    const timestamps = [];
    const timestampRegex = /@(\d{1,2}):(\d{2})(?::(\d{2}))?/g;
    
    lines.forEach((line, index) => {
      const matches = [...line.matchAll(timestampRegex)];
      matches.forEach(match => {
        let seconds = 0;
        
        if (match[3]) {
          // Format: @h:mm:ss or @hh:mm:ss
          const hours = parseInt(match[1]);
          const minutes = parseInt(match[2]);
          const secs = parseInt(match[3]);
          seconds = hours * 3600 + minutes * 60 + secs;
        } else {
          // Format: @m:ss or @mm:ss
          const minutes = parseInt(match[1]);
          const secs = parseInt(match[2]);
          seconds = minutes * 60 + secs;
        }
        
        timestamps.push({
          time: seconds,
          lineNumber: index
        });
      });
    });
    
    // Sort by time
    return timestamps.sort((a, b) => a.time - b.time);
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
          --accent-glow: rgba(224, 112, 32, 0.4);
          --border-color: #3a3a3a;
          --font-mono: 'JetBrains Mono', monospace;
          --font-display: 'Outfit', sans-serif;
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

        .controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .btn {
          font-family: var(--font-display);
          font-weight: 500;
          cursor: pointer;
          border: none;
          border-radius: 6px;
          background: var(--bg-elevated);
          color: var(--text-primary);
          padding: 6px 12px;
          font-size: 0.75rem;
          border: 1px solid var(--border-color);
          transition: all 0.2s ease;
        }

        .btn:hover {
          background: var(--bg-tertiary);
          border-color: var(--accent-primary);
          color: var(--accent-primary);
        }

        .btn.active {
          background: var(--accent-primary);
          color: var(--bg-primary);
          border-color: var(--accent-primary);
        }

        .format-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .format-toggle {
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          font-size: 0.7rem;
          color: var(--text-secondary);
        }

        .format-toggle input {
          display: none;
        }

        .format-checkbox {
          width: 14px;
          height: 14px;
          border-radius: 3px;
          border: 2px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .format-toggle input:checked + .format-checkbox {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
        }

        .format-checkbox::after {
          content: '✓';
          font-size: 9px;
          color: var(--bg-primary);
          opacity: 0;
        }

        .format-toggle input:checked + .format-checkbox::after {
          opacity: 1;
        }

        .content {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .editor-container {
          position: relative;
          width: 100%;
          height: 100%;
          flex: 1;
          min-height: 0;
        }

        .highlight-layer {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          padding: 20px;
          font-family: var(--font-mono);
          font-size: 14px;
          line-height: 1.6;
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-x: hidden;
          overflow-y: auto;
          pointer-events: none;
          box-sizing: border-box;
        }

        .tab-area {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: transparent;
          border: none;
          resize: none;
          padding: 20px;
          font-family: var(--font-mono);
          font-size: 14px;
          line-height: 1.6;
          color: transparent;
          caret-color: var(--text-primary);
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-x: hidden;
          overflow-y: auto;
          box-sizing: border-box;
        }

        .tab-area:focus {
          outline: none;
        }

        .tab-area::placeholder {
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        /* Syntax highlighting colors */
        .line-chord {
          color: #f59e0b; /* Amber/gold for chords */
        }

        .line-tab {
          color: #22d3ee; /* Cyan for tablature */
        }

        .line-lyric {
          color: #a78bfa; /* Purple for lyrics */
        }

        .line-section {
          color: #4ade80; /* Green for section markers like [Chorus] */
          font-weight: 600;
        }

        .line-metadata {
          color: #94a3b8; /* Slate/gray for metadata headers like Title: */
          font-style: italic;
        }

        .line-blank {
          color: transparent;
        }

        .timestamp {
          color: #6b7280; /* Subdued grey for timestamps */
        }

        .comment {
          color: #16a34a; /* Dark green for comments */
          font-style: italic;
        }

        /* When highlighting is disabled */
        .tab-area.no-highlight {
          color: var(--text-primary);
        }

        .highlight-layer.hidden {
          display: none;
        }

        .scroll-indicator {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          padding: 8px 12px;
          font-size: 0.7rem;
          color: var(--text-secondary);
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }

        .scroll-indicator.visible {
          opacity: 1;
        }

        .font-controls {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .font-btn {
          width: 28px;
          height: 28px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.875rem;
        }

        .progress-bar {
          height: 3px;
          background: var(--bg-primary);
          position: relative;
        }

        .progress-fill {
          height: 100%;
          background: var(--accent-primary);
          width: 0%;
          transition: width 0.1s linear;
        }

        /* URL Input Bar */
        .url-bar {
          display: flex;
          gap: 6px;
          padding: 6px 12px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .url-input {
          flex: 1;
          font-family: var(--font-mono);
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

        .load-url-btn {
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

        .load-url-btn:hover {
          filter: brightness(1.1);
        }

        .load-url-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .browse-repo-btn {
          font-family: var(--font-display);
          font-weight: 500;
          cursor: pointer;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          padding: 5px 12px;
          font-size: 0.75rem;
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .browse-repo-btn:hover {
          background: var(--bg-elevated);
          border-color: var(--accent-primary);
        }

        /* Metadata display */
        .metadata-bar {
          display: none;
          padding: 6px 12px;
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
          font-size: 0.7rem;
          color: var(--text-secondary);
          gap: 12px;
          flex-wrap: wrap;
        }

        .metadata-bar.visible {
          display: flex;
        }

        .metadata-item {
          display: flex;
          gap: 4px;
        }

        .metadata-label {
          color: var(--text-muted);
        }

        .metadata-value {
          color: var(--text-primary);
          font-weight: 500;
        }
      </style>

      <div class="header">
        <span class="title">Guitar Tab</span>
        <div class="controls">
          <div class="format-controls">
            <button class="btn" id="format-btn" title="Remove extra blank lines">Format</button>
            <label class="format-toggle" title="Format pasted content automatically">
              <input type="checkbox" id="format-on-paste" checked>
              <div class="format-checkbox"></div>
              <span>Auto-format</span>
            </label>
            <label class="format-toggle" title="Syntax highlighting for chords, tabs, and lyrics">
              <input type="checkbox" id="highlight-toggle" checked>
              <div class="format-checkbox"></div>
              <span>Highlight</span>
            </label>
            <label class="format-toggle" title="Sync metadata to YouTube and metronome on edit">
              <input type="checkbox" id="sync-toggle" checked>
              <div class="format-checkbox"></div>
              <span>Sync</span>
            </label>
          </div>
          <div class="font-controls">
            <button class="btn font-btn" id="font-decrease" title="Decrease font size">−</button>
            <button class="btn font-btn" id="font-increase" title="Increase font size">+</button>
          </div>
          <button class="btn" id="clear-btn">Clear</button>
        </div>
      </div>
      <div class="url-bar">
        <input 
          type="url" 
          class="url-input" 
          id="tab-url-input"
          placeholder="Enter URL to load tab from..."
        >
        <button class="load-url-btn" id="load-url-btn">Load</button>
        <button class="browse-repo-btn" id="browse-repo-btn" title="Browse repository">📂 Browse</button>
      </div>
      <div class="metadata-bar" id="metadata-bar">
        <div class="metadata-item" id="meta-title" style="display:none">
          <span class="metadata-label">Title:</span>
          <span class="metadata-value" id="meta-title-value"></span>
        </div>
        <div class="metadata-item" id="meta-artist" style="display:none">
          <span class="metadata-label">Artist:</span>
          <span class="metadata-value" id="meta-artist-value"></span>
        </div>
        <div class="metadata-item" id="meta-tempo" style="display:none">
          <span class="metadata-label">Tempo:</span>
          <span class="metadata-value" id="meta-tempo-value"></span>
        </div>
        <div class="metadata-item" id="meta-timing" style="display:none">
          <span class="metadata-label">Timing:</span>
          <span class="metadata-value" id="meta-timing-value"></span>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" id="progress-fill"></div>
      </div>
      <div class="content">
        <div class="editor-container">
          <div class="highlight-layer" id="highlight-layer"></div>
          <textarea 
            class="tab-area" 
            id="tab-area"
            placeholder="Paste your guitar tab here...

Example format:
    G                    C
e|--3-----------------3--3----|
B|--0--------------0-----0----|
G|--0-----------0--------0----|
D|--0--------0-----------0----|
A|--2-----2--------------2----|
E|--3--3-----------------3----|

Or chord progressions:
G           D            A
Some lyrics here to sing along with"
            spellcheck="false"
          ></textarea>
        </div>
        <div class="scroll-indicator" id="scroll-indicator">
          Auto-scrolling...
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    const tabArea = this.shadowRoot.getElementById('tab-area');
    const highlightLayer = this.shadowRoot.getElementById('highlight-layer');
    const clearBtn = this.shadowRoot.getElementById('clear-btn');
    const fontIncrease = this.shadowRoot.getElementById('font-increase');
    const fontDecrease = this.shadowRoot.getElementById('font-decrease');
    const formatBtn = this.shadowRoot.getElementById('format-btn');
    const formatOnPaste = this.shadowRoot.getElementById('format-on-paste');
    const highlightToggle = this.shadowRoot.getElementById('highlight-toggle');

    // Load highlight preference from localStorage
    const savedHighlight = localStorage.getItem('tabioke-highlight-enabled');
    if (savedHighlight !== null) {
      this.highlightEnabled = savedHighlight === 'true';
      highlightToggle.checked = this.highlightEnabled;
      this.applyHighlightState();
    } else {
      this.highlightEnabled = true;
    }

    // Highlight toggle
    highlightToggle.addEventListener('change', (e) => {
      this.highlightEnabled = e.target.checked;
      this.applyHighlightState();
      localStorage.setItem('tabioke-highlight-enabled', this.highlightEnabled.toString());
    });

    // Sync toggle
    const syncToggle = this.shadowRoot.getElementById('sync-toggle');
    const savedSync = localStorage.getItem('tabioke-sync-enabled');
    if (savedSync !== null) {
      this.syncEnabled = savedSync === 'true';
      syncToggle.checked = this.syncEnabled;
    }

    syncToggle.addEventListener('change', (e) => {
      this.syncEnabled = e.target.checked;
      localStorage.setItem('tabioke-sync-enabled', this.syncEnabled.toString());
      // Immediately sync if enabled
      if (this.syncEnabled) {
        this.syncMetadataFromContent();
      }
    });

    // URL loading
    const tabUrlInput = this.shadowRoot.getElementById('tab-url-input');
    const loadUrlBtn = this.shadowRoot.getElementById('load-url-btn');
    const browseRepoBtn = this.shadowRoot.getElementById('browse-repo-btn');

    loadUrlBtn.addEventListener('click', () => this.loadFromUrl());
    tabUrlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.loadFromUrl();
    });

    // Browse repository button
    browseRepoBtn.addEventListener('click', () => {
      // Open the repo browser modal
      const repoBrowser = document.querySelector('repo-browser');
      if (repoBrowser) {
        repoBrowser.open();
      }
    });

    // Listen for tab selection from repo browser
    window.addEventListener('tab-selected-from-repo', (e) => {
      const { url, token } = e.detail;
      tabUrlInput.value = url;
      this.loadFromUrl(url, token);
    });

    // Check for URL parameter on load
    this.checkUrlParameter();

    // Store tab content on input and update highlighting
    tabArea.addEventListener('input', () => {
      this.tabContent = tabArea.value;
      this.updateHighlighting();
      // Sync metadata if enabled (debounced)
      if (this.syncEnabled) {
        this.debouncedSync();
      }
      this.dispatchEvent(new CustomEvent('tab-changed', {
        detail: { content: this.tabContent },
        bubbles: true,
        composed: true
      }));
    });

    // Sync scroll between textarea and highlight layer
    tabArea.addEventListener('scroll', () => {
      highlightLayer.scrollTop = tabArea.scrollTop;
      highlightLayer.scrollLeft = tabArea.scrollLeft;
    });

    // Format button
    formatBtn.addEventListener('click', () => {
      this.formatContent();
    });

    // Format on paste
    tabArea.addEventListener('paste', (e) => {
      if (formatOnPaste.checked) {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');
        const formattedText = this.formatText(pastedText);
        
        // Insert at cursor position
        const start = tabArea.selectionStart;
        const end = tabArea.selectionEnd;
        const before = tabArea.value.substring(0, start);
        const after = tabArea.value.substring(end);
        
        tabArea.value = before + formattedText + after;
        
        // Move cursor to end of pasted content
        const newCursorPos = start + formattedText.length;
        tabArea.setSelectionRange(newCursorPos, newCursorPos);
        
        // Trigger input event and update highlighting
        this.tabContent = tabArea.value;
        this.updateHighlighting();
        
        // Sync metadata if enabled
        if (this.syncEnabled) {
          this.syncMetadataFromContent();
        }
        
        this.dispatchEvent(new CustomEvent('tab-changed', {
          detail: { content: this.tabContent },
          bubbles: true,
          composed: true
        }));
      }
    });

    // Clear button
    clearBtn.addEventListener('click', () => {
      tabArea.value = '';
      this.tabContent = '';
      this.updateHighlighting();
    });

    // Font size controls
    let fontSize = 14;
    fontIncrease.addEventListener('click', () => {
      fontSize = Math.min(fontSize + 2, 24);
      tabArea.style.fontSize = `${fontSize}px`;
      highlightLayer.style.fontSize = `${fontSize}px`;
    });

    fontDecrease.addEventListener('click', () => {
      fontSize = Math.max(fontSize - 2, 10);
      tabArea.style.fontSize = `${fontSize}px`;
      highlightLayer.style.fontSize = `${fontSize}px`;
    });

    // Listen for video sync events
    window.addEventListener('video-progress', (e) => {
      this.syncScroll(e.detail);
    });

    window.addEventListener('video-state-change', (e) => {
      if (e.detail.state === 'playing') {
        this.startAutoScroll();
      } else {
        this.stopAutoScroll();
      }
    });
  }

  /**
   * Apply the current highlight state to the UI
   */
  applyHighlightState() {
    const tabArea = this.shadowRoot.getElementById('tab-area');
    const highlightLayer = this.shadowRoot.getElementById('highlight-layer');
    
    if (!tabArea || !highlightLayer) return;
    
    if (this.highlightEnabled) {
      tabArea.classList.remove('no-highlight');
      highlightLayer.classList.remove('hidden');
      this.updateHighlighting();
    } else {
      tabArea.classList.add('no-highlight');
      highlightLayer.classList.add('hidden');
    }
  }

  /**
   * Debounced sync - waits for user to stop typing
   */
  debouncedSync() {
    if (this._syncTimeout) {
      clearTimeout(this._syncTimeout);
    }
    this._syncTimeout = setTimeout(() => {
      this.syncMetadataFromContent();
    }, 500); // Wait 500ms after last keystroke
  }

  /**
   * Parse and sync metadata from current tab content
   */
  syncMetadataFromContent() {
    const tabArea = this.shadowRoot.getElementById('tab-area');
    if (!tabArea) return;
    
    const { metadata } = this.parseMetadata(tabArea.value);
    
    // Display in metadata bar
    this.displayMetadata(metadata);
    
    // Dispatch event for other components
    if (Object.keys(metadata).length > 0) {
      window.dispatchEvent(new CustomEvent('tab-metadata-loaded', {
        detail: metadata
      }));
    }
  }

  /**
   * Update the syntax highlighting layer
   */
  updateHighlighting() {
    if (!this.highlightEnabled) return;
    
    const tabArea = this.shadowRoot.getElementById('tab-area');
    const highlightLayer = this.shadowRoot.getElementById('highlight-layer');
    
    if (!tabArea || !highlightLayer) return;
    
    const text = tabArea.value;
    const lines = text.split('\n');
    
    const highlightedLines = lines.map(line => {
      // Check for timestamps and comments first
      const timestampRegex = /@\d{1,2}:\d{2}(?::\d{2})?/g;
      const commentIndex = line.indexOf('//');
      
      let processedLine = line;
      let htmlLine = '';
      
      // Handle comments (but not in metadata lines)
      if (commentIndex !== -1 && !this.isMetadataLine(line)) {
        const beforeComment = processedLine.substring(0, commentIndex);
        const comment = processedLine.substring(commentIndex);
        
        // Process the part before comment
        htmlLine = this.highlightLineContent(beforeComment);
        // Add the comment
        htmlLine += `<span class="comment">${this.escapeHtml(comment)}</span>`;
        
        return htmlLine;
      }
      
      // Handle timestamps
      if (timestampRegex.test(line)) {
        const escaped = this.escapeHtml(line);
        return `<span class="timestamp">${escaped}</span>`;
      }
      
      // Regular highlighting
      return this.highlightLineContent(line);
    });
    
    highlightLayer.innerHTML = highlightedLines.join('\n');
  }

  /**
   * Apply syntax highlighting to line content
   * @param {string} line - Line to highlight
   * @returns {string} - HTML string with highlighting
   */
  highlightLineContent(line) {
    const escaped = this.escapeHtml(line);
    
    if (line.trim() === '') {
      return `<span class="line-blank">${escaped || ' '}</span>`;
    } else if (this.isMetadataLine(line)) {
      return `<span class="line-metadata">${escaped}</span>`;
    } else if (this.isSectionMarker(line)) {
      return `<span class="line-section">${escaped}</span>`;
    } else if (this.isTablatureLine(line)) {
      return `<span class="line-tab">${escaped}</span>`;
    } else if (this.isChordLine(line)) {
      return `<span class="line-chord">${escaped}</span>`;
    } else {
      return `<span class="line-lyric">${escaped}</span>`;
    }
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Sync scroll position with video progress
   * @param {Object} detail - Contains currentTime and duration
   */
  syncScroll(detail) {
    const { currentTime, duration } = detail;
    this.currentTime = currentTime;
    this.totalDuration = duration;

    const tabArea = this.shadowRoot.getElementById('tab-area');
    const highlightLayer = this.shadowRoot.getElementById('highlight-layer');
    const progressFill = this.shadowRoot.getElementById('progress-fill');
    
    if (tabArea && duration > 0) {
      const scrollHeight = tabArea.scrollHeight - tabArea.clientHeight;
      const progress = currentTime / duration;
      
      // Update progress bar
      if (progressFill) {
        progressFill.style.width = `${progress * 100}%`;
      }

      // Only auto-scroll if we're in auto-scroll mode
      if (this.isAutoScrolling) {
        // Parse timestamps from content
        const timestamps = this.parseTimestamps(tabArea.value);
        
        if (timestamps.length > 0) {
          // Timestamp-based smooth scrolling with variable speed
          const lines = tabArea.value.split('\n');
          const lineHeight = tabArea.scrollHeight / lines.length;
          const middleThirdStart = tabArea.clientHeight / 3;
          
          // Find current and next timestamps
          let currentTimestampIndex = -1;
          let nextTimestampIndex = -1;
          
          for (let i = 0; i < timestamps.length; i++) {
            if (timestamps[i].time <= currentTime) {
              currentTimestampIndex = i;
            } else {
              nextTimestampIndex = i;
              break;
            }
          }
          
          let scrollPos;
          
          if (nextTimestampIndex !== -1) {
            // We have a next timestamp - interpolate between current and next
            const currentTimestamp = currentTimestampIndex >= 0 ? timestamps[currentTimestampIndex] : { time: 0, lineNumber: 0 };
            const nextTimestamp = timestamps[nextTimestampIndex];
            
            // Calculate positions for both timestamps (positioned at top of middle third)
            const currentPos = (currentTimestamp.lineNumber * lineHeight) - middleThirdStart;
            const nextPos = (nextTimestamp.lineNumber * lineHeight) - middleThirdStart;
            
            // Calculate progress between timestamps
            const timeDiff = nextTimestamp.time - currentTimestamp.time;
            const timeProgress = timeDiff > 0 ? (currentTime - currentTimestamp.time) / timeDiff : 0;
            
            // Smoothly interpolate scroll position
            scrollPos = currentPos + (nextPos - currentPos) * timeProgress;
          } else if (currentTimestampIndex >= 0) {
            // Past the last timestamp - stay at the last timestamp position
            const lastTimestamp = timestamps[currentTimestampIndex];
            scrollPos = (lastTimestamp.lineNumber * lineHeight) - middleThirdStart;
          } else {
            // Before first timestamp - scroll from top to first timestamp
            const firstTimestamp = timestamps[0];
            const firstPos = (firstTimestamp.lineNumber * lineHeight) - middleThirdStart;
            const timeProgress = firstTimestamp.time > 0 ? currentTime / firstTimestamp.time : 0;
            scrollPos = firstPos * timeProgress;
          }
          
          // Clamp to valid scroll range
          scrollPos = Math.max(0, Math.min(scrollPos, scrollHeight));
          
          tabArea.scrollTop = scrollPos;
          if (highlightLayer) {
            highlightLayer.scrollTop = scrollPos;
          }
        } else {
          // No timestamps - use normal time-based scrolling
          const scrollPos = scrollHeight * progress;
          tabArea.scrollTop = scrollPos;
          if (highlightLayer) {
            highlightLayer.scrollTop = scrollPos;
          }
        }
      }
    }
  }

  startAutoScroll() {
    this.isAutoScrolling = true;
    const indicator = this.shadowRoot.getElementById('scroll-indicator');
    if (indicator) {
      indicator.classList.add('visible');
      setTimeout(() => indicator.classList.remove('visible'), 2000);
    }
  }

  stopAutoScroll() {
    this.isAutoScrolling = false;
  }

  /**
   * Set tab content programmatically
   * @param {string} content - Tab content
   */
  setContent(content) {
    const tabArea = this.shadowRoot.getElementById('tab-area');
    if (tabArea) {
      tabArea.value = content;
      this.tabContent = content;
      this.updateHighlighting();
    }
  }

  /**
   * Get current tab content
   * @returns {string}
   */
  getContent() {
    return this.tabContent;
  }

  /**
   * Check if a line is a section marker like [Chorus], [Verse], [Bridge], etc.
   * @param {string} line - Line to check
   * @returns {boolean}
   */
  isSectionMarker(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    
    // Section markers are text in square brackets, possibly with other text
    // e.g., "[Chorus]", "[Verse 1]", "[Bridge]", "[Pre-Chorus]"
    return /^\[.+\]/.test(trimmed);
  }

  /**
   * Check if a line is a metadata header line like "Title:", "Artist:", etc.
   * @param {string} line - Line to check
   * @returns {boolean}
   */
  isMetadataLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    
    // Known metadata keys (case-insensitive)
    const metadataPattern = /^(Title|Artist|Album|Tempo|Timing|YouTubeURL|YouTubeOffset|Capo|Tuning|Key):\s*.*/i;
    return metadataPattern.test(trimmed);
  }

  /**
   * Check if a word looks like a chord
   * Matches patterns like: A, Am, C#, Dm7, Fmaj7, Gsus4, Bb/D, etc.
   * @param {string} word - Single word to check
   * @returns {boolean}
   */
  isChord(word) {
    // Chord pattern: Root note (A-G) + optional sharp/flat + optional quality + optional number + optional bass note
    const chordPattern = /^[A-Ga-g][#b♯♭]?(m|M|maj|min|dim|aug|sus|add|dom)?[0-9]*(\/[A-Ga-g][#b♯♭]?)?$/;
    return chordPattern.test(word);
  }

  /**
   * Check if a line is a chord line (every word on the line is a chord)
   * @param {string} line - Line to check
   * @returns {boolean}
   */
  isChordLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    
    // Split by whitespace
    const words = trimmed.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return false;
    
    // Every word must be a chord
    return words.every(word => this.isChord(word));
  }

  /**
   * Check if a line is a tablature line
   * Matches patterns like: e|---5---| or |---5---|
   * Works with any tuning (any letter or no letter before |)
   * @param {string} line - Line to check
   * @returns {boolean}
   */
  isTablatureLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    
    // Tab pattern: optional single letter (any tuning) followed by |
    // Then must contain at least some dashes (characteristic of tabs)
    // Content can be anything (numbers, text annotations, etc.)
    const startsLikeTab = /^[A-Za-z]?\|/.test(trimmed);
    const hasDashes = trimmed.includes('-');
    
    return startsLikeTab && hasDashes;
  }

  /**
   * Format the text to remove extra blank lines and add proper spacing
   * - Removes all blank/whitespace-only lines
   * - Adds two blank lines before section markers like [Chorus]
   * - Adds a blank line before chord lines
   * - Adds a blank line before tablature sections (6-string groups)
   * @param {string} text - Text to format
   * @returns {string} - Formatted text
   */
  formatText(text) {
    if (!text) return text;
    
    // Split into lines and filter out blank lines
    const lines = text.split('\n');
    const nonBlankLines = lines.filter(line => line.trim() !== '');
    
    if (nonBlankLines.length === 0) return '';
    
    const result = [];
    const STRINGS_PER_TAB = 6; // Assuming standard 6-string guitar
    const timestampRegex = /@\d{1,2}:\d{2}(?::\d{2})?/;
    let consecutiveTabLines = 0;
    
    for (let i = 0; i < nonBlankLines.length; i++) {
      const line = nonBlankLines[i];
      const isSection = this.isSectionMarker(line);
      const isChord = this.isChordLine(line);
      const isTab = this.isTablatureLine(line);
      const isTimestamp = timestampRegex.test(line);
      const prevLine = i > 0 ? nonBlankLines[i - 1] : null;
      const prevWasChord = prevLine ? this.isChordLine(prevLine) : false;
      const prevWasTab = prevLine ? this.isTablatureLine(prevLine) : false;
      const prevWasSection = prevLine ? this.isSectionMarker(prevLine) : false;
      
      // Add blank line before timestamps (unless after section marker or first line)
      if (isTimestamp && i > 0 && !prevWasSection) {
        result.push('');
        consecutiveTabLines = 0;
      }
      // Add two blank lines before section markers (unless first line)
      else if (isSection && i > 0) {
        result.push('');
        result.push('');
        consecutiveTabLines = 0;
      }
      // Add blank line before chord lines (unless first line)
      else if (isChord && i > 0) {
        result.push('');
        consecutiveTabLines = 0;
      }
      // Handle tablature lines
      else if (isTab) {
        if (i > 0) {
          if (!prevWasChord && !prevWasTab) {
            // First tab line after non-tab content - add blank line
            result.push('');
            consecutiveTabLines = 0;
          } else if (prevWasTab && consecutiveTabLines >= STRINGS_PER_TAB) {
            // Starting a new 6-string section - add blank line
            result.push('');
            consecutiveTabLines = 0;
          }
        }
        consecutiveTabLines++;
      } else {
        // Non-tab, non-chord line - reset counter
        consecutiveTabLines = 0;
      }
      
      result.push(line);
    }
    
    return result.join('\n');
  }

  /**
   * Format the current content in the textarea
   */
  formatContent() {
    const tabArea = this.shadowRoot.getElementById('tab-area');
    if (tabArea) {
      tabArea.value = this.formatText(tabArea.value);
      this.tabContent = tabArea.value;
      this.updateHighlighting();
      this.dispatchEvent(new CustomEvent('tab-changed', {
        detail: { content: this.tabContent },
        bubbles: true,
        composed: true
      }));
    }
  }

  /**
   * Check for 'tab' URL parameter and load if present
   */
  checkUrlParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    const tabUrl = urlParams.get('tab');
    if (tabUrl) {
      const tabUrlInput = this.shadowRoot.getElementById('tab-url-input');
      if (tabUrlInput) {
        tabUrlInput.value = tabUrl;
      }
      this.loadFromUrl(tabUrl);
    }
  }

  /**
   * Load tab content from a URL
   * @param {string} url - Optional URL, uses input field if not provided
   * @param {string} token - Optional authentication token for private repos
   */
  async loadFromUrl(url, token = null) {
    const tabUrlInput = this.shadowRoot.getElementById('tab-url-input');
    const loadUrlBtn = this.shadowRoot.getElementById('load-url-btn');
    const tabArea = this.shadowRoot.getElementById('tab-area');
    
    const targetUrl = url || tabUrlInput.value.trim();
    
    if (!targetUrl) return;

    // Disable button during load
    loadUrlBtn.disabled = true;
    loadUrlBtn.textContent = 'Loading...';

    try {
      // Prepare fetch options with authentication if token provided
      const fetchOptions = {};
      let fetchUrl = targetUrl;
      
      if (token) {
        // For GitHub private repos, use the API endpoint instead of raw URL
        if (targetUrl.includes('raw.githubusercontent.com')) {
          // Convert raw URL to API URL
          // raw.githubusercontent.com/owner/repo/branch/path -> api.github.com/repos/owner/repo/contents/path?ref=branch
          const urlParts = targetUrl.replace('https://raw.githubusercontent.com/', '').split('/');
          const owner = urlParts[0];
          const repo = urlParts[1];
          const branch = urlParts[2];
          const path = urlParts.slice(3).join('/');
          fetchUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
          fetchOptions.headers = {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.raw'
          };
        } else if (targetUrl.includes('gitlab')) {
          fetchOptions.headers = {
            'PRIVATE-TOKEN': token
          };
        }
      }
      
      const response = await fetch(fetchUrl, fetchOptions);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      
      // Parse metadata from the content (but keep full text in editor)
      const { metadata } = this.parseMetadata(text);
      
      // Set the full tab content (including metadata headers)
      tabArea.value = text;
      this.tabContent = text;
      this.updateHighlighting();
      
      // Display metadata in the UI
      this.displayMetadata(metadata);
      
      // Dispatch event with metadata for other components
      if (Object.keys(metadata).length > 0) {
        window.dispatchEvent(new CustomEvent('tab-metadata-loaded', {
          detail: metadata
        }));
      }
      
      // Save URL to localStorage
      localStorage.setItem('tabioke-tab-url', targetUrl);
      
      this.dispatchEvent(new CustomEvent('tab-changed', {
        detail: { content: this.tabContent },
        bubbles: true,
        composed: true
      }));
      
    } catch (error) {
      console.error('Failed to load tab:', error);
      alert(`Failed to load tab: ${error.message}`);
    } finally {
      loadUrlBtn.disabled = false;
      loadUrlBtn.textContent = 'Load';
    }
  }

  /**
   * Parse metadata headers from tab content
   * Supports: Title, Artist, Album, Tempo, Timing, YouTubeURL, YouTubeOffset
   * @param {string} text - Raw tab content
   * @returns {Object} - { metadata: {}, content: string }
   */
  parseMetadata(text) {
    const lines = text.split('\n');
    const metadata = {};
    const contentLines = [];
    let inMetadata = true;
    
    // Known metadata keys (case-insensitive)
    const metadataKeys = [
      'title', 'artist', 'album', 'tempo', 'timing', 
      'youtubeurl', 'youtubeoffset', 'capo', 'tuning', 'key'
    ];
    
    for (const line of lines) {
      if (inMetadata) {
        const trimmed = line.trim();
        
        // Check if this is a metadata line (Key: Value format)
        const match = trimmed.match(/^([A-Za-z]+):\s*(.*)$/);
        if (match) {
          const key = match[1].toLowerCase();
          const value = match[2].trim();
          
          if (metadataKeys.includes(key) && value) {
            metadata[key] = value;
            continue; // Don't add to content
          }
        }
        
        // Empty lines at the start are skipped
        if (trimmed === '') {
          continue;
        }
        
        // First non-metadata, non-empty line ends metadata section
        inMetadata = false;
      }
      
      contentLines.push(line);
    }
    
    return {
      metadata,
      content: contentLines.join('\n')
    };
  }

  /**
   * Display parsed metadata in the UI
   * @param {Object} metadata - Parsed metadata object
   */
  displayMetadata(metadata) {
    const metadataBar = this.shadowRoot.getElementById('metadata-bar');
    
    // Update each metadata field
    const fields = ['title', 'artist', 'tempo', 'timing'];
    let hasAny = false;
    
    for (const field of fields) {
      const container = this.shadowRoot.getElementById(`meta-${field}`);
      const valueEl = this.shadowRoot.getElementById(`meta-${field}-value`);
      
      if (container && valueEl) {
        if (metadata[field]) {
          valueEl.textContent = metadata[field];
          container.style.display = 'flex';
          hasAny = true;
        } else {
          container.style.display = 'none';
        }
      }
    }
    
    // Show/hide the metadata bar
    if (hasAny) {
      metadataBar.classList.add('visible');
    } else {
      metadataBar.classList.remove('visible');
    }
  }
}

customElements.define('tab-viewer', TabViewer);

export default TabViewer;

