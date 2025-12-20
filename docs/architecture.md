# Tabioke Architecture

## Overview

Tabioke is a guitar tab practice application that synchronizes a YouTube video with scrolling guitar tablature and a metronome. Built using vanilla HTML, CSS, and JavaScript with Web Components.

## Directory Structure

```
src/
├── index.html          # Main HTML with 3-panel layout
├── style.css           # Global styles and CSS variables
├── app.js              # Main app coordinator
└── components/
    ├── tab-viewer.js   # Guitar tab display component
    ├── youtube-player.js # YouTube iframe API wrapper
    ├── metronome-app.js  # Metronome with audio scheduling
    └── repo-browser.js   # Repository browser modal for GitHub/GitLab
```

## Web Components

### `<tab-viewer>`
- Full-height text area for pasting guitar tabs
- **URL loading**: Fetch tabs from remote URLs
  - URL input bar with Load button
  - Supports `?tab=URL` query parameter for direct linking
- **Metadata parsing**: Extracts headers from tab files
  - Supported: Title, Artist, Album, Tempo, Timing, YouTubeURL, YouTubeOffset, Capo, Tuning, Key
  - Automatically configures YouTube player and metronome
- **Sync toggle**: Auto-syncs metadata when editing/pasting (debounced)
- **Syntax highlighting** (toggleable):
  - Metadata headers `Title:`, `Artist:`: Slate/gray (#94a3b8, italic)
  - Section markers `[Chorus]`: Green (#4ade80)
  - Chord lines: Amber/gold (#f59e0b)
  - Tablature lines: Cyan (#22d3ee)
  - Lyric lines: Purple (#a78bfa)
- Monospace font for proper tab alignment
- Font size controls (+/-)
- **Format button**: Removes blank lines and adds proper spacing
  - Detects section markers (`[Chorus]`, `[Verse]`, etc.)
  - Detects chord lines (regex: every word matches chord pattern like Am, Dm7, F#, Gsus4, Bb/D)
  - Detects tablature lines (any letter + `|` + dashes, works with any tuning)
  - Adds **two blank lines** before section markers
  - Adds blank line before chord lines
  - Adds blank line before tablature (unless directly after chords)
  - Adds blank line between 6-string tablature sections
- **Auto-format on paste**: Checkbox to automatically format pasted content (enabled by default)
- Auto-scroll synchronized with video progress
- Progress bar showing video position
- Persists tab content to localStorage

### `<youtube-player>`
- URL input for any YouTube video link
- Extracts video ID from various YouTube URL formats
- Uses YouTube IFrame API for playback control
- **Custom playback controls**: Play/Pause, Stop buttons
- **Playback speed selector**: 0.25× to 2× speed options
- **Loop section**: Double-ended slider to loop a specific portion (A-B loop)
- **Click-to-seek**: Click anywhere on the range track to seek to that position
- Progress bar showing current position within loop section
- Broadcasts events for state changes, progress, and rate changes
- Displays current time and status

### `<metronome-app>`
- Visual beat indicators with accent highlighting
- Tempo control: slider and tap tempo
- Time signature selection (2/4, 3/4, 4/4, 5/4, 6/8, 7/8, 12/8)
- Accent first beat toggle
- **Editable offset input**: Type or use +/- buttons for offset (0.1s increments, 2 decimal precision)
- **Auto-start with video toggle** (default: OFF)
- **Sync tempo with playback speed**: Adjusts BPM to match video speed
- Uses Web Audio API for precise timing

### `<repo-browser>`
- **Modal dialog** for browsing GitHub/GitLab repositories
- URL input supporting multiple formats:
  - `https://github.com/owner/repo`
  - `https://github.com/owner/repo/tree/branch`
  - `https://github.com/owner/repo/tree/branch/path`
  - Same patterns for GitLab
- **Auto-detect provider** from URL (GitHub or GitLab)
- **Access token support** for private repositories:
  - Optional token input field (password type)
  - GitHub: Personal Access Token (classic or fine-grained)
  - GitLab: Personal Access Token or Project Access Token
  - Token stored in localStorage and included in API requests
  - Automatically adds appropriate auth headers (Bearer for GitHub, PRIVATE-TOKEN for GitLab)
- **Breadcrumb navigation** for directory traversal
- **File tree view** with folder/file icons
- Click folder to navigate, click `.tab` file to load
- Uses GitHub Contents API / GitLab Repository Tree API
- Persists last used repo URL and access token to localStorage

## Event System

Components communicate via custom events on the window object:

- `video-progress` - Fired every 100ms during playback with currentTime and duration
- `video-state-change` - Fired when video state changes (playing, paused, ended, etc.)
- `video-stopped` - Fired when stop button is clicked (resets metronome if auto-start enabled)
- `video-loaded` - Fired when a new video is loaded
- `playback-rate-change` - Fired when playback speed changes (for metronome sync)
- `tab-changed` - Fired when tab content is modified
- `tab-metadata-loaded` - Fired when a tab is loaded from URL with parsed metadata
- `tab-selected-from-repo` - Fired when a tab file is selected from repository browser

## Styling

Uses CSS custom properties for consistent theming:
- Dark theme with vintage amp aesthetics
- Orange accent color (#e07020)
- JetBrains Mono for code/tabs
- Outfit for UI text

## Keyboard Shortcuts

- `Space` - Play/Pause video
- `M` - Toggle metronome
- `Shift+Up` - Increase tempo
- `Shift+Down` - Decrease tempo

## Local Storage Persistence

Settings are automatically saved and restored from localStorage:

### YouTube Player
- `tabioke-youtube-url` - Last loaded video URL
- `tabioke-loop-enabled` - Loop toggle state
- `tabioke-loop-start` - Loop start position (%)
- `tabioke-loop-end` - Loop end position (%)

### Metronome
- `tabioke-tempo` - Base tempo (BPM)
- `tabioke-time-signature` - Time signature (e.g., "4/4")
- `tabioke-offset` - Offset in seconds
- `tabioke-accent-first` - Accent first beat toggle
- `tabioke-auto-start` - Auto-start with video toggle
- `tabioke-sync-tempo` - Sync tempo with playback speed toggle

### Tab Viewer
- `tabioke-highlight-enabled` - Syntax highlighting toggle
- `tabioke-sync-enabled` - Metadata sync toggle

### Repository Browser
- `tabioke-repo-url` - Last used repository URL

