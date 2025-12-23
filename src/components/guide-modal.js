/**
 * Guide Modal Web Component
 * Displays a comprehensive guide to using the Tabioke app
 */
class GuideModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isOpen = false;
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
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
          max-width: 700px;
          max-height: 85vh;
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
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }

        .section {
          margin-bottom: 28px;
        }

        .section:last-child {
          margin-bottom: 0;
        }

        .section-title {
          font-family: var(--font-display);
          font-size: 1rem;
          font-weight: 600;
          color: var(--accent-primary);
          margin: 0 0 12px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .section-content {
          font-family: var(--font-display);
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.7;
        }

        .section-content p {
          margin: 0 0 10px 0;
        }

        .section-content p:last-child {
          margin-bottom: 0;
        }

        .feature-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .feature-list li {
          padding: 8px 0;
          padding-left: 24px;
          position: relative;
          border-bottom: 1px solid var(--border-color);
        }

        .feature-list li:last-child {
          border-bottom: none;
        }

        .feature-list li::before {
          content: '▸';
          position: absolute;
          left: 0;
          color: var(--accent-primary);
        }

        .kbd {
          font-family: var(--font-mono);
          font-size: 0.8rem;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 2px 6px;
          color: var(--text-primary);
        }

        .highlight {
          color: var(--accent-primary);
          font-weight: 500;
        }

        .metadata-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 0.85rem;
        }

        .metadata-table th,
        .metadata-table td {
          text-align: left;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border-color);
        }

        .metadata-table th {
          color: var(--text-muted);
          font-weight: 500;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .metadata-table td {
          color: var(--text-secondary);
        }

        .metadata-table td:first-child {
          font-family: var(--font-mono);
          color: var(--accent-primary);
        }

        .tip {
          background: var(--bg-tertiary);
          border-left: 3px solid var(--accent-primary);
          padding: 12px 16px;
          margin: 12px 0;
          border-radius: 0 6px 6px 0;
        }

        .tip-title {
          font-weight: 600;
          color: var(--accent-primary);
          margin-bottom: 4px;
          font-size: 0.8rem;
        }

        .color-sample {
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 2px;
          vertical-align: middle;
          margin-right: 6px;
        }

        .color-chord { background: #f59e0b; }
        .color-tab { background: #22d3ee; }
        .color-lyric { background: #a78bfa; }
        .color-section { background: #4ade80; }
        .color-metadata { background: #94a3b8; }
        .color-timestamp { background: #6b7280; }
        .color-comment { background: #16a34a; }
      </style>

      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Tabioke Guide</h2>
            <button class="close-btn" id="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            
            <div class="section">
              <h3 class="section-title">📋 Overview</h3>
              <div class="section-content">
                <p>Tabioke is a guitar practice app that syncs your tabs with YouTube videos. Load a tab, load a video, and practice along with synchronized scrolling and a built-in metronome.</p>
              </div>
            </div>

            <div class="section">
              <h3 class="section-title">📄 Tab Format</h3>
              <div class="section-content">
                <p>Tabs can include metadata headers at the top that automatically configure the app:</p>
                <table class="metadata-table">
                  <tr><th>Header</th><th>Description</th></tr>
                  <tr><td>Title:</td><td>Song title</td></tr>
                  <tr><td>Artist:</td><td>Artist/band name</td></tr>
                  <tr><td>YoutubeUrl:</td><td>YouTube video URL (auto-loads)</td></tr>
                  <tr><td>YoutubeOffset:</td><td>Seconds to offset video sync (e.g., 2.5)</td></tr>
                  <tr><td>Tempo:</td><td>BPM for metronome (auto-sets)</td></tr>
                  <tr><td>Timing:</td><td>Time signature (e.g., 4/4, 3/4, 6/8)</td></tr>
                  <tr><td>Tuning:</td><td>Guitar tuning (e.g., E A D G B E)</td></tr>
                  <tr><td>Key:</td><td>Musical key of the song</td></tr>
                  <tr><td>Capo:</td><td>Capo position (0 for none)</td></tr>
                </table>
              </div>
            </div>

            <div class="section">
              <h3 class="section-title">🎨 Syntax Highlighting</h3>
              <div class="section-content">
                <p>The tab viewer automatically highlights different content types:</p>
                <ul class="feature-list">
                  <li><span class="color-sample color-chord"></span><strong>Chords</strong> — Lines with only chord names (Am, G, C#m7, etc.)</li>
                  <li><span class="color-sample color-tab"></span><strong>Tablature</strong> — Lines starting with a string letter and | (e.g., e|---)</li>
                  <li><span class="color-sample color-lyric"></span><strong>Lyrics</strong> — Regular text lines</li>
                  <li><span class="color-sample color-section"></span><strong>Sections</strong> — Markers like [Chorus], [Verse 1], [Bridge]</li>
                  <li><span class="color-sample color-metadata"></span><strong>Metadata</strong> — Header lines like Title:, Artist:</li>
                  <li><span class="color-sample color-timestamp"></span><strong>Timestamps</strong> — Time markers like @1:30 or @0:45</li>
                  <li><span class="color-sample color-comment"></span><strong>Comments</strong> — Text after // on a line</li>
                </ul>
              </div>
            </div>

            <div class="section">
              <h3 class="section-title">⏱️ Timestamps & Scrolling</h3>
              <div class="section-content">
                <p>Add timestamps to your tab using the <span class="highlight">@mm:ss</span> format (e.g., @0:00, @1:30, @2:45). When the video plays, the tab will automatically scroll to keep the current section visible.</p>
                <div class="tip">
                  <div class="tip-title">💡 Pro Tip</div>
                  Place timestamps at the start of each section or verse. The viewer smoothly interpolates scroll position between timestamps.
                </div>
              </div>
            </div>

            <div class="section">
              <h3 class="section-title">🎬 YouTube Player</h3>
              <div class="section-content">
                <ul class="feature-list">
                  <li><strong>Speed Control</strong> — Slow down playback (0.25x to 2x) for learning</li>
                  <li><strong>Loop Section</strong> — Enable looping and set A/B points to repeat difficult parts</li>
                  <li><strong>Keyboard Shortcuts</strong> — <span class="kbd">Space</span> to play/pause, <span class="kbd">←</span> <span class="kbd">→</span> to seek</li>
                </ul>
              </div>
            </div>

            <div class="section">
              <h3 class="section-title">🥁 Metronome</h3>
              <div class="section-content">
                <ul class="feature-list">
                  <li>Automatically syncs to the <span class="highlight">Tempo</span> and <span class="highlight">Timing</span> from tab metadata</li>
                  <li>Click the tempo number to manually adjust</li>
                  <li>Supports various time signatures (4/4, 3/4, 6/8, etc.)</li>
                  <li>Accented first beat helps keep track of measures</li>
                </ul>
              </div>
            </div>

            <div class="section">
              <h3 class="section-title">📂 Repository Integration</h3>
              <div class="section-content">
                <p>Store your tabs in GitHub or GitLab repositories:</p>
                <ul class="feature-list">
                  <li><strong>Browse</strong> — Click 📂 Browse to navigate your repositories</li>
                  <li><strong>Load</strong> — Select any .txt or .tab file to load it</li>
                  <li><strong>Save</strong> — Edit tabs and commit changes back with 💾 Save</li>
                  <li><strong>New File</strong> — Create new tab files directly in your repo</li>
                </ul>
                <div class="tip">
                  <div class="tip-title">🔐 Private Repos</div>
                  For private repositories, set the repo type to "Private" and add your personal access token.
                </div>
              </div>
            </div>

            <div class="section">
              <h3 class="section-title">📊 Practice Statistics</h3>
              <div class="section-content">
                <ul class="feature-list">
                  <li><strong>Time on Tab</strong> — Total time spent viewing tabs (only when tab is active)</li>
                  <li><strong>Video Practice</strong> — Time spent practicing with video playing</li>
                  <li><strong>Practice Sessions</strong> — Sessions lasting 5+ minutes</li>
                  <li><strong>Leaderboard</strong> — See your most practiced songs</li>
                  <li><strong>Time Filters</strong> — View stats for Today, This Week, Month, Year, or All Time</li>
                </ul>
              </div>
            </div>

            <div class="section">
              <h3 class="section-title">⌨️ Keyboard Shortcuts</h3>
              <div class="section-content">
                <table class="metadata-table">
                  <tr><th>Shortcut</th><th>Action</th></tr>
                  <tr><td><span class="kbd">Space</span></td><td>Play/Pause video</td></tr>
                  <tr><td><span class="kbd">←</span> / <span class="kbd">→</span></td><td>Seek backward/forward 5 seconds</td></tr>
                  <tr><td><span class="kbd">Ctrl</span> + <span class="kbd">S</span></td><td>Save tab to repository</td></tr>
                </table>
              </div>
            </div>

            <div class="section">
              <h3 class="section-title">✨ Tips & Tricks</h3>
              <div class="section-content">
                <ul class="feature-list">
                  <li>Use the <strong>Format</strong> button to clean up pasted tabs automatically</li>
                  <li>Enable <strong>Auto-format</strong> to format content as you paste</li>
                  <li>Toggle <strong>Highlight</strong> off if you prefer plain text</li>
                  <li>Enable <strong>Sync</strong> to auto-update YouTube URL and metronome when editing metadata</li>
                  <li>Use <span class="kbd">+</span> / <span class="kbd">−</span> buttons to adjust tab font size</li>
                  <li>Add <strong>//</strong> comments to annotate tricky sections</li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    const overlay = this.shadowRoot.querySelector('.modal-overlay');
    const closeBtn = this.shadowRoot.getElementById('close-btn');
    
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
    window.addEventListener('show-guide-modal', () => this.open());
  }

  /**
   * Open the modal
   */
  open() {
    this.isOpen = true;
    this.shadowRoot.querySelector('.modal-overlay').classList.add('open');
  }

  /**
   * Close the modal
   */
  close() {
    this.isOpen = false;
    this.shadowRoot.querySelector('.modal-overlay').classList.remove('open');
  }
}

customElements.define('guide-modal', GuideModal);

export default GuideModal;
