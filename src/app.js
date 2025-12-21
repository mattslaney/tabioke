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
      // Check the actual focused element, including through shadow DOM
      const composedPath = e.composedPath ? e.composedPath() : [e.target];
      const actualTarget = composedPath[0];
      const isInput = actualTarget && (actualTarget.tagName === 'INPUT' || actualTarget.tagName === 'TEXTAREA');
      const isEditable = actualTarget && actualTarget.isContentEditable;
      
      // Check if media is playing
      const isPlaying = this.youtubePlayer && this.youtubePlayer.getPlayerState() === 1;

      // Page Up/Down always scrolls tab editor (even when in inputs)
      if (e.key === 'PageUp' || e.key === 'PageDown') {
        e.preventDefault();
        this.scrollTabEditor(e.key === 'PageUp' ? -1 : 1);
        return;
      }

      // For other shortcuts, skip if typing in inputs/textareas
      if (isInput || isEditable) {
        return;
      }

      switch (e.key) {
        case ' ': // Spacebar - Play/Pause (only when playing)
          if (isPlaying) {
            e.preventDefault();
            this.togglePlayPause();
          }
          // Otherwise, let default behavior happen
          break;
        case 'm': // M - Toggle metronome
        case 'M':
          if (this.metronome) {
            const playBtn = this.metronome.shadowRoot.getElementById('play-btn');
            if (playBtn) playBtn.click();
          }
          break;
        case 'ArrowLeft': // Seek backward when playing
          if (isPlaying) {
            e.preventDefault();
            this.seekVideo(-5); // 5 seconds backward
          }
          break;
        case 'ArrowRight': // Seek forward when playing
          if (isPlaying) {
            e.preventDefault();
            this.seekVideo(5); // 5 seconds forward
          }
          break;
        case 'ArrowUp': // Increase speed when playing, or tempo with Shift
          if (isPlaying) {
            e.preventDefault();
            this.adjustPlaybackRate(0.25); // Increase by 0.25x
          } else if (e.shiftKey && this.metronome) {
            e.preventDefault();
            this.metronome.setTempo(this.metronome.getTempo() + 5);
          }
          // Otherwise, let default behavior happen (cursor movement in editor)
          break;
        case 'ArrowDown': // Decrease speed when playing, or tempo with Shift
          if (isPlaying) {
            e.preventDefault();
            this.adjustPlaybackRate(-0.25); // Decrease by 0.25x
          } else if (e.shiftKey && this.metronome) {
            e.preventDefault();
            this.metronome.setTempo(this.metronome.getTempo() - 5);
          }
          // Otherwise, let default behavior happen (cursor movement in editor)
          break;
      }
    });
  }

  /**
   * Scroll the tab editor by a page
   * @param {number} direction - 1 for down, -1 for up
   */
  scrollTabEditor(direction) {
    if (!this.tabViewer) return;

    const tabArea = this.tabViewer.shadowRoot.getElementById('tab-area');
    const highlightLayer = this.tabViewer.shadowRoot.getElementById('highlight-layer');
    
    if (tabArea) {
      const scrollAmount = tabArea.clientHeight * 0.9; // 90% of viewport height
      const newScrollTop = tabArea.scrollTop + (scrollAmount * direction);
      
      tabArea.scrollTop = newScrollTop;
      if (highlightLayer) {
        highlightLayer.scrollTop = newScrollTop;
      }
    }
  }

  /**
   * Seek video forward or backward
   * @param {number} seconds - Positive for forward, negative for backward
   */
  seekVideo(seconds) {
    if (!this.youtubePlayer) return;

    const currentTime = this.youtubePlayer.getCurrentTime();
    const newTime = Math.max(0, currentTime + seconds);
    this.youtubePlayer.seekTo(newTime);
  }

  /**
   * Adjust playback rate
   * @param {number} delta - Amount to change (e.g., 0.25, -0.25)
   */
  adjustPlaybackRate(delta) {
    if (!this.youtubePlayer || !this.youtubePlayer.player) return;

    const currentRate = this.youtubePlayer.player.getPlaybackRate();
    const newRate = Math.max(0.25, Math.min(2, currentRate + delta)); // Clamp between 0.25x and 2x
    this.youtubePlayer.setPlaybackRate(newRate);
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

