/**
 * Commit Modal Web Component
 * Standalone modal for committing changes to GitHub/GitLab repositories
 */
class CommitModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    this.isOpen = false;
    this.filePath = null;
    this.fileName = null;
    this.content = null;
    this.provider = null;
    this.owner = null;
    this.repo = null;
    this.branch = null;
    this.hostname = 'gitlab.com';
    this.accessToken = null;
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
          --accent-primary: #22d3ee;
          --error-color: #ef4444;
          --success-color: #10b981;
          --font-display: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
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
          max-width: 500px;
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
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
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
        }

        .file-info {
          font-family: var(--font-display);
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: 16px;
          padding: 12px;
          background: var(--bg-tertiary);
          border-radius: 6px;
          border-left: 3px solid var(--accent-primary);
        }

        .file-name {
          color: var(--text-primary);
          font-weight: 500;
          font-family: monospace;
        }

        .repo-info {
          color: var(--text-muted);
          font-size: 0.75rem;
          margin-top: 4px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .label {
          font-family: var(--font-display);
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-bottom: 8px;
          display: block;
          font-weight: 500;
        }

        .commit-input {
          width: 100%;
          font-family: var(--font-display);
          font-size: 0.9rem;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 12px;
          color: var(--text-primary);
          resize: vertical;
          min-height: 80px;
        }

        .commit-input:focus {
          outline: none;
          border-color: var(--accent-primary);
        }

        .commit-input::placeholder {
          color: var(--text-muted);
        }

        .button-group {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        .btn {
          font-family: var(--font-display);
          font-weight: 500;
          font-size: 0.9rem;
          padding: 12px 24px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          flex: 1;
        }

        .btn-primary {
          background: var(--success-color);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          filter: brightness(1.1);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: transparent;
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }

        .btn-secondary:hover {
          background: var(--bg-elevated);
          color: var(--text-primary);
        }

        .status-message {
          margin-top: 16px;
          padding: 12px;
          border-radius: 6px;
          font-size: 0.85rem;
          font-family: var(--font-display);
          display: none;
        }

        .status-message.visible {
          display: block;
        }

        .status-message.success {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid var(--success-color);
          color: var(--success-color);
        }

        .status-message.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid var(--error-color);
          color: var(--error-color);
        }

        .shortcut-hint {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-align: right;
          margin-top: 8px;
        }

        .kbd {
          display: inline-block;
          padding: 2px 6px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 3px;
          font-family: monospace;
          font-size: 0.7rem;
        }
      </style>

      <div class="modal-overlay" id="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">💾 Commit Changes</h2>
            <button class="close-btn" id="close-btn" title="Close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="file-info">
              <div>Committing: <span class="file-name" id="file-name"></span></div>
              <div class="repo-info" id="repo-info"></div>
            </div>
            
            <div class="form-group">
              <label class="label" for="commit-message">Commit Message</label>
              <textarea
                class="commit-input"
                id="commit-message"
                placeholder="Describe your changes...&#10;&#10;Example: Updated intro section with correct timing"
              ></textarea>
            </div>

            <div class="shortcut-hint">
              Press <span class="kbd">Ctrl+Enter</span> to commit
            </div>

            <div class="button-group">
              <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
              <button class="btn btn-primary" id="commit-btn">💾 Commit</button>
            </div>

            <div class="status-message" id="status-message"></div>
          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    const overlay = this.shadowRoot.getElementById('modal-overlay');
    const closeBtn = this.shadowRoot.getElementById('close-btn');
    const cancelBtn = this.shadowRoot.getElementById('cancel-btn');
    const commitBtn = this.shadowRoot.getElementById('commit-btn');
    const commitMessage = this.shadowRoot.getElementById('commit-message');

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });

    // Close button
    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());

    // Commit button
    commitBtn.addEventListener('click', () => this.commit());

    // Ctrl+Enter to commit
    commitMessage.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        this.commit();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Listen for commit requests
    window.addEventListener('show-commit-modal', (e) => {
      if (e.detail) {
        this.open(e.detail);
      }
    });
  }

  open(data) {
    this.filePath = data.filePath;
    this.fileName = data.fileName;
    this.content = data.content;
    this.provider = data.provider;
    this.owner = data.owner;
    this.repo = data.repo;
    this.branch = data.branch;
    this.accessToken = data.accessToken;
    
    if (this.provider === 'gitlab') {
      this.hostname = data.hostname || 'gitlab.com';
    }

    this.isOpen = true;
    const overlay = this.shadowRoot.getElementById('modal-overlay');
    overlay.classList.add('open');

    // Update UI
    this.shadowRoot.getElementById('file-name').textContent = this.fileName;
    this.shadowRoot.getElementById('repo-info').textContent = 
      `${this.owner}/${this.repo} (${this.branch})`;
    
    const commitMessageInput = this.shadowRoot.getElementById('commit-message');
    commitMessageInput.value = `Update ${this.fileName}`;

    // Hide status
    const statusEl = this.shadowRoot.getElementById('status-message');
    statusEl.classList.remove('visible');

    // Focus and select commit message
    setTimeout(() => {
      commitMessageInput.focus();
      commitMessageInput.select();
    }, 100);
  }

  close() {
    this.isOpen = false;
    const overlay = this.shadowRoot.getElementById('modal-overlay');
    overlay.classList.remove('open');
  }

  async commit() {
    const commitMessageInput = this.shadowRoot.getElementById('commit-message');
    const commitMessage = commitMessageInput.value.trim();
    
    if (!commitMessage) {
      this.showStatus('Please enter a commit message', 'error');
      return;
    }

    const commitBtn = this.shadowRoot.getElementById('commit-btn');
    commitBtn.disabled = true;
    commitBtn.textContent = '⏳ Committing...';

    try {
      if (this.provider === 'github') {
        await this.commitToGitHub(commitMessage);
      } else if (this.provider === 'gitlab') {
        await this.commitToGitLab(commitMessage);
      } else {
        throw new Error('Unknown provider');
      }

      this.showStatus('✓ Changes committed successfully!', 'success');
      
      // Close after 1.5 seconds
      setTimeout(() => {
        this.close();
      }, 1500);

    } catch (e) {
      console.error('Commit failed:', e);
      this.showStatus(`Commit failed: ${e.message}`, 'error');
    } finally {
      commitBtn.disabled = false;
      commitBtn.textContent = '💾 Commit';
    }
  }

  async commitToGitHub(commitMessage) {
    if (!this.accessToken) {
      throw new Error('Access token required. Please set up a GitHub token in the repository browser.');
    }

    // URL-encode the file path (handles spaces and special characters)
    const encodedPath = this.filePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
    
    // Get the current file SHA (required for updates)
    const apiUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${encodedPath}`;
    
    console.log('Fetching file metadata from:', apiUrl);
    
    let fileSha = null;
    try {
      // Fetch file metadata to get the SHA
      // Add cache-busting timestamp to avoid browser returning cached raw content
      // when we need JSON metadata (browser may cache based on URL, ignoring Vary: Accept)
      // Note: Cache-Control header is not allowed by GitHub CORS policy, so we rely on the timestamp
      const cacheBuster = `_t=${Date.now()}`;
      const fileResponse = await fetch(apiUrl + `?ref=${encodeURIComponent(this.branch)}&${cacheBuster}`, { 
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      
      console.log('GitHub API response status:', fileResponse.status);
      console.log('Content-Type:', fileResponse.headers.get('content-type'));
      
      if (fileResponse.ok) {
        const contentType = fileResponse.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await fileResponse.text();
          console.error('Non-JSON response received. Content-Type:', contentType);
          console.error('Response preview:', text.substring(0, 200));
          throw new Error(`GitHub returned non-JSON response (${contentType}). The file may be too large or the API request format is incorrect.`);
        }
        
        const fileData = await fileResponse.json();
        
        // GitHub API returns a file object with sha field
        if (fileData.sha) {
          fileSha = fileData.sha;
          console.log('Got SHA from file metadata:', fileSha);
        } else {
          console.warn('Unexpected response structure:', fileData);
          throw new Error('Could not extract SHA from GitHub response');
        }
      } else if (fileResponse.status === 404) {
        throw new Error('File not found in repository. Please reload the file from the repository browser.');
      } else {
        const errorText = await fileResponse.text();
        console.error(`GitHub API error (${fileResponse.status}):`, errorText);
        throw new Error(`Failed to fetch file metadata: ${fileResponse.status}`);
      }
    } catch (fetchError) {
      if (fetchError.message && (fetchError.message.includes('File not found') || fetchError.message.includes('Failed to fetch'))) {
        throw fetchError;
      }
      console.error('Error fetching file metadata:', fetchError);
      throw new Error(`Unable to get file SHA: ${fetchError.message}`);
    }

    if (!fileSha) {
      throw new Error('Unable to retrieve file SHA from GitHub. Please reload the file from the repository browser.');
    }

    console.log('Committing with SHA:', fileSha.substring(0, 10) + '...');

    // Commit the file using GitHub Contents API
    const content = btoa(unescape(encodeURIComponent(this.content))); // Base64 encode UTF-8
    
    const commitData = {
      message: commitMessage,
      content: content,
      branch: this.branch,
      sha: fileSha
    };

    const commitResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify(commitData)
    });

    console.log('Commit response status:', commitResponse.status);

    if (!commitResponse.ok) {
      let errorMessage = `Failed to commit (${commitResponse.status})`;
      try {
        const contentType = commitResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await commitResponse.json();
          errorMessage = errorData.message || errorMessage;
        } else {
          const errorText = await commitResponse.text();
          if (errorText) {
            errorMessage = errorText.substring(0, 200);
          }
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
      }
      throw new Error(errorMessage);
    }

    return await commitResponse.json();
  }

  async commitToGitLab(commitMessage) {
    if (!this.accessToken) {
      throw new Error('Access token required. Please set up a GitLab token in the repository browser.');
    }

    const headers = {
      'PRIVATE-TOKEN': this.accessToken,
      'Content-Type': 'application/json'
    };

    const projectId = encodeURIComponent(`${this.owner}/${this.repo}`);
    const filePathEncoded = encodeURIComponent(this.filePath);
    
    // Check if file exists
    const fileUrl = `https://${this.hostname}/api/v4/projects/${projectId}/repository/files/${filePathEncoded}?ref=${this.branch}`;
    const fileResponse = await fetch(fileUrl, { headers });
    
    const fileExists = fileResponse.ok;
    
    // Commit using GitLab Repository Files API
    const commitUrl = `https://${this.hostname}/api/v4/projects/${projectId}/repository/files/${filePathEncoded}`;
    
    const commitData = {
      branch: this.branch,
      content: this.content,
      commit_message: commitMessage
    };

    const method = fileExists ? 'PUT' : 'POST';

    const commitResponse = await fetch(commitUrl, {
      method: method,
      headers: headers,
      body: JSON.stringify(commitData)
    });

    if (!commitResponse.ok) {
      let errorMessage = `Failed to commit (${commitResponse.status})`;
      try {
        const contentType = commitResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await commitResponse.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } else {
          const errorText = await commitResponse.text();
          if (errorText) {
            errorMessage = errorText.substring(0, 200);
          }
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
      }
      throw new Error(errorMessage);
    }

    return await commitResponse.json();
  }

  showStatus(message, type) {
    const statusEl = this.shadowRoot.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type} visible`;
  }
}

customElements.define('commit-modal', CommitModal);

export default CommitModal;
