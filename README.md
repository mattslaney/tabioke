# Tabioke 🎸

Tabioke is a lightweight web app for practicing guitar using synchronized tablature and YouTube videos ▶️. It combines a tab viewer, a metronome 🥁, and a video player, and can load tabs directly from GitHub 🐙 or GitLab 🦊 repositories (public or private).

## Features

- **Tab Viewer** 🎸: Load and display guitar tablature with syntax highlighting
- **YouTube Player** ▶️: Synchronized video playback with custom controls and A-B looping
- **Metronome** 🥁: Precise timing with various time signatures and tempo sync
- **Repository Browser** 📁: Browse and load tabs from GitHub 🐙 or GitLab 🦊 repositories (public or private)

## Tab File Format (.tab)

Tabioke supports simple text-based tab files with an optional header block at the top. Headers are key/value pairs in the form `Header: value`. The header block should appear at the top of the file; a single blank line separates headers from the tab/notation content.

- Header syntax: `HeaderName: value` (case-insensitive header names are accepted). Unknown headers are ignored by the app.
- Header order does not matter. If a header appears multiple times, the first occurrence is used.
- Use a blank line after the header block to start the tab body.

**Common headers and meaning**

- **Title:** Song title (string). Example: `Title: AmE`
- **Artist:** Artist name (string). Example: `Artist: No-one`
- **Tempo:** Tempo in beats per minute (integer). Example: `Tempo: 90` (default: `120` if not provided)
- **Timing:** Time signature (e.g., `4/4`, `3/4`). Example: `Timing: 4/4` (default: `4/4`)
- **YouTubeURL:** Full YouTube watch URL for the backing/sync video. Example: `YouTubeURL: https://www.youtube.com/watch?v=VIDEO_ID`
- **YouTubeOffset:** Offset in seconds (can be fractional, positive or negative) used to sync the video to the tab. Positive values delay the video relative to the tab (the tab leads); negative values start the video earlier (the video leads). Example: `YouTubeOffset: 0.45`
- **Capo:** Capo fret number (integer). Example: `Capo: 2` (default: `0` meaning no capo)
- **Tuning:** Space-separated string tunings low-to-high (or common shorthand). Example: `Tuning: E A D G B E` or `Tuning: D A D G B D` (default: standard `E A D G B E`)
- **Key:** Musical key (string). Example: `Key: G` or `Key: Am`

Example header block and beginning of a .tab file:

```text
Title: AmE
Artist: No-one
Tempo: 90
Timing: 4/4
YouTubeURL: https://www.youtube.com/watch?v=xxxxxxxxxxx
YouTubeOffset: 0.45
Capo: 2
Tuning: E A D G B E
Key: G

    Am                           E
e|--0--------0----------------|--0-----------0-------------|
B|--1-----1-----1-------------|--0--------0-----0----------|
G|--2--2-----------2----------|--1-----1-----------1-------|
D|--2-----------------2-------|--2--2-----------------2----|
A|--0--------------------0----|--2-------------------------|
E|----------------------------|--0-------------------------|
```

Notes:

- Lines that do not match the `Header: value` pattern (after the header block) are interpreted as the tab/notation and rendered by the app.
- Headers are optional; sensible defaults apply where noted.
- For best results include at least `Title` and `Tempo` in the header block when publishing tabs for others.

## 🔒 Using Private Repositories

To access tabs from private GitHub or GitLab repositories, you need to provide an access token:

### 🐙 GitHub Access Tokens (classic and fine-grained)

You can use either a classic Personal Access Token (PAT) or a fine-grained personal access token. Fine-grained tokens are preferred because they allow scoping to specific repositories and limited permissions.

Option A — Fine-grained Personal Access Token (recommended)

1. Go to GitHub Settings → Developer settings → Personal access tokens → [Fine-grained tokens](https://github.com/settings/tokens/fine-grained)
2. Click **Generate new token** → **Generate new fine-grained token**
3. Give it a descriptive name (e.g., "Tabioke Tab Access") and optionally set an expiration
4. Under **Resource owner**, choose the account or organization that owns the repository
5. Select **Repository access** → choose the specific repository (or repositories) you want Tabioke to access
6. Under **Permissions**, set **Repository contents** (or **Contents**) to **Read-only**
7. Click **Generate token**, then copy the token
8. In Tabioke, open the Repository Browser and paste the token in the "Access Token" field

Option B — Classic Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → [Tokens (classic)](https://github.com/settings/tokens)
2. Click **Generate new token** → **Generate new token (classic)**
3. Give it a descriptive name (e.g., "Tabioke Tab Access")
4. Select the `repo` scope (this grants repo read access)
5. Click **Generate token**, then copy the token (starts with `ghp_`)
6. In Tabioke, open the Repository Browser and paste the token in the "Access Token" field

Notes:
- Fine-grained tokens are safer because they limit repository access and can be scoped to read-only contents.
- Choose an expiration for tokens when possible and revoke unused tokens.

### 🦊 GitLab Tokens (Personal / Project / Deploy tokens)

GitLab provides several token types. For reading repository contents from private projects, use a Personal Access Token or a Project Access Token with the appropriate scopes.

Personal Access Token

1. Go to GitLab User Settings → [Access Tokens](https://gitlab.com/-/profile/personal_access_tokens)
2. Create a new token with a descriptive name (e.g., "Tabioke Tab Access")
3. Select scopes: `read_api` and `read_repository` (or at least `read_repository`)
4. Click **Create personal access token**, then copy the token (starts with `glpat-`)
5. In Tabioke, open the Repository Browser and paste the token in the "Access Token" field

Project Access Token / Deploy Token

- If you prefer not to use a user Personal Access Token, you can create a Project Access Token (project-level) or Deploy Token and grant it `read_repository` or equivalent read scopes. Paste that token into Tabioke as above.

### 🔐 Token Security and Best Practices

- Prefer fine-grained tokens (GitHub) or project-scoped tokens (GitLab) with the minimal permissions required (read-only repository contents).
- Set an expiration if supported and rotate tokens periodically.
- Revoke the token immediately if it is accidentally exposed.
- Tokens are stored locally in your browser's `localStorage` by Tabioke so they remain on your machine only; they are only sent to GitHub/GitLab APIs when browsing or fetching files.
- Do not paste tokens into untrusted applications or share them.
