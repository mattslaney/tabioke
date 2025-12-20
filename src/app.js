/**
 * Tabioke - Guitar Tab Practice App
 * Main application file that coordinates all components
 */

class TabiokeApp {
  constructor() {
    this.tabViewer = null;
    this.youtubePlayer = null;
    this.metronome = null;
    
    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    // Get component references
    this.tabViewer = document.querySelector('tab-viewer');
    this.youtubePlayer = document.querySelector('youtube-player');
    this.metronome = document.querySelector('metronome-app');

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Setup local storage persistence
    this.loadSavedState();
    this.setupAutoSave();

    console.log('Tabioke app initialized');
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key) {
        case ' ': // Spacebar - Play/Pause
          e.preventDefault();
          this.togglePlayPause();
          break;
        case 'm': // M - Toggle metronome
        case 'M':
          if (this.metronome) {
            const playBtn = this.metronome.shadowRoot.getElementById('play-btn');
            if (playBtn) playBtn.click();
          }
          break;
        case 'ArrowUp': // Increase tempo
          if (e.shiftKey && this.metronome) {
            e.preventDefault();
            this.metronome.setTempo(this.metronome.getTempo() + 5);
          }
          break;
        case 'ArrowDown': // Decrease tempo
          if (e.shiftKey && this.metronome) {
            e.preventDefault();
            this.metronome.setTempo(this.metronome.getTempo() - 5);
          }
          break;
      }
    });
  }

  togglePlayPause() {
    if (!this.youtubePlayer) return;

    const playerState = this.youtubePlayer.getPlayerState();
    
    // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
    if (playerState === 1) {
      this.youtubePlayer.pause();
    } else {
      this.youtubePlayer.play();
    }
  }

  loadSavedState() {
    try {
      const savedTab = localStorage.getItem('tabioke-tab');
      if (savedTab && this.tabViewer) {
        this.tabViewer.setContent(savedTab);
      }
    } catch (err) {
      // Ignore localStorage errors
    }
  }

  setupAutoSave() {
    // Save tab content when it changes
    window.addEventListener('tab-changed', (e) => {
      try {
        localStorage.setItem('tabioke-tab', e.detail.content);
      } catch (err) {
        // Ignore localStorage errors
      }
    });

    // Listen for tab metadata to configure other components
    window.addEventListener('tab-metadata-loaded', (e) => {
      this.applyMetadata(e.detail);
    });
  }

  /**
   * Apply parsed metadata to configure YouTube player and metronome
   * @param {Object} metadata - Parsed metadata object
   */
  applyMetadata(metadata) {
    console.log('Applying tab metadata:', metadata);

    // Configure YouTube player
    if (this.youtubePlayer && metadata.youtubeurl) {
      const urlInput = this.youtubePlayer.shadowRoot.getElementById('url-input');
      if (urlInput) {
        urlInput.value = metadata.youtubeurl;
        // Trigger video load
        setTimeout(() => {
          this.youtubePlayer.loadVideo();
        }, 100);
      }
    }

    // Configure metronome tempo
    if (this.metronome && metadata.tempo) {
      const tempo = parseInt(metadata.tempo);
      if (!isNaN(tempo) && tempo >= 30 && tempo <= 250) {
        this.metronome.setTempo(tempo);
      }
    }

    // Configure metronome time signature
    if (this.metronome && metadata.timing) {
      const timeSig = this.metronome.shadowRoot.getElementById('time-signature');
      if (timeSig) {
        // Check if the timing value is a valid option
        const options = Array.from(timeSig.options).map(o => o.value);
        if (options.includes(metadata.timing)) {
          timeSig.value = metadata.timing;
          timeSig.dispatchEvent(new Event('change'));
        }
      }
    }

    // Configure YouTube offset
    if (this.metronome && metadata.youtubeoffset) {
      const offset = parseFloat(metadata.youtubeoffset);
      if (!isNaN(offset)) {
        this.metronome.setOffset(offset);
      }
    }
  }
}

// Initialize the app
const app = new TabiokeApp();

export default app;

