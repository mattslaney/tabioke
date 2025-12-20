# Tabioke 🎸

Tabioke is a lightweight web app for practicing guitar using synchronized tablature and YouTube videos ▶️. It combines a tab viewer, a metronome 🥁, and a video player, and can load tabs directly from GitHub 🐙 or GitLab 🦊 repositories (public or private).

## Features

- **Tab Viewer** 🎸: Load and display guitar tablature with syntax highlighting
- **YouTube Player** ▶️: Synchronized video playback with custom controls and A-B looping
- **Metronome** 🥁: Precise timing with various time signatures and tempo sync
- **Repository Browser** 📁: Browse and load tabs from GitHub 🐙 or GitLab 🦊 repositories (public or private)

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


