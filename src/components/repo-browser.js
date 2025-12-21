/**
 * Repository Browser Web Component
 * Modal dialog for browsing and loading tabs from GitHub/GitLab repositories
 */
class RepoBrowser extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    this.isOpen = false;
    this.repoUrl = '';
    this.provider = null; // 'github' or 'gitlab'
    this.owner = '';
    this.repo = '';
    this.branch = 'main';
    this.branches = []; // Available branches
    this.currentPath = '';
    this.pathHistory = [];
    this.isLoading = false;
    this.error = null;
    this.contents = [];
    this.accessToken = '';
    this.repoType = 'public'; // 'public' or 'private'
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const savedRepoUrl = localStorage.getItem('tabioke-repo-url');
      if (savedRepoUrl) {
        this.repoUrl = savedRepoUrl;
        const urlInput = this.shadowRoot.getElementById('repo-url-input');
        if (urlInput) urlInput.value = savedRepoUrl;
      }
      
      // Load saved branch - will be used when auto-loading repo
      const savedBranch = localStorage.getItem('tabioke-repo-branch');
      if (savedBranch) {
        this.branch = savedBranch;
      }
      
      const savedToken = localStorage.getItem('tabioke-access-token');
      const savedRepoType = localStorage.getItem('tabioke-repo-type');
      
      if (savedRepoType) {
        this.repoType = savedRepoType;
        const repoTypeSelect = this.shadowRoot.getElementById('repo-type-select');
        const tokenSection = this.shadowRoot.getElementById('token-section');
        
        if (repoTypeSelect) repoTypeSelect.value = savedRepoType;
        
        if (savedRepoType === 'private' && tokenSection) {
          tokenSection.style.display = 'flex';
        }
      }
      
      if (savedToken) {
        this.accessToken = savedToken;
        const tokenInput = this.shadowRoot.getElementById('access-token-input');
        if (tokenInput) tokenInput.value = savedToken;
      }
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
    }
  }

  saveToStorage() {
    try {
      if (this.repoUrl) {
        localStorage.setItem('tabioke-repo-url', this.repoUrl);
      }
      if (this.branch) {
        localStorage.setItem('tabioke-repo-branch', this.branch);
      }
      localStorage.setItem('tabioke-repo-type', this.repoType);
      
      if (this.accessToken) {
        localStorage.setItem('tabioke-access-token', this.accessToken);
      } else {
        localStorage.removeItem('tabioke-access-token');
      }
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
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
          --accent-secondary: #06b6d4;
          --error-color: #ef4444;
          --warning-color: #f59e0b;
          --font-display: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
        }

        .modal-overlay {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 1000;
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
          max-width: 600px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
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
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .url-section {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .url-label {
          font-family: var(--font-display);
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-bottom: 8px;
          display: block;
        }

        .url-input-row {
          display: flex;
          gap: 8px;
        }

        .token-input-row {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .branch-input-row {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          align-items: center;
        }

        .branch-select {
          font-family: var(--font-display);
          font-size: 0.8rem;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 10px 12px;
          color: var(--text-primary);
          cursor: pointer;
          flex: 1;
        }

        .branch-select:focus {
          outline: none;
          border-color: var(--accent-primary);
        }

        .branch-select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .delete-token-btn {
          font-family: var(--font-display);
          font-weight: 500;
          background: transparent;
          color: var(--error-color);
          border: 1px solid var(--error-color);
          border-radius: 6px;
          padding: 10px 16px;
          cursor: pointer;
          font-size: 0.8rem;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .delete-token-btn:hover {
          background: var(--error-color);
          color: var(--text-primary);
        }

        .repo-type-select {
          font-family: var(--font-display);
          font-size: 0.8rem;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 10px 12px;
          color: var(--text-primary);
          cursor: pointer;
          min-width: 100px;
        }

        .repo-type-select:focus {
          outline: none;
          border-color: var(--accent-primary);
        }

        .url-input {
          flex: 1;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 10px 12px;
          color: var(--text-primary);
        }

        .url-input:focus {
          outline: none;
          border-color: var(--accent-primary);
        }

        .url-input::placeholder {
          color: var(--text-muted);
        }

        .load-btn {
          font-family: var(--font-display);
          font-weight: 500;
          background: var(--accent-primary);
          color: var(--bg-primary);
          border: none;
          border-radius: 6px;
          padding: 10px 20px;
          cursor: pointer;
          font-size: 0.8rem;
          transition: all 0.2s;
        }

        .load-btn:hover {
          filter: brightness(1.1);
        }

        .load-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .error-message {
          margin-top: 8px;
          padding: 8px 12px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid var(--error-color);
          border-radius: 4px;
          color: var(--error-color);
          font-size: 0.75rem;
          font-family: var(--font-display);
        }

        .breadcrumbs {
          padding: 12px 20px;
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
          flex-shrink: 0;
        }

        .breadcrumb {
          font-family: var(--font-display);
          font-size: 0.75rem;
          color: var(--accent-primary);
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .breadcrumb:hover {
          background: var(--bg-elevated);
        }

        .breadcrumb.current {
          color: var(--text-primary);
          cursor: default;
        }

        .breadcrumb.current:hover {
          background: transparent;
        }

        .breadcrumb-separator {
          color: var(--text-muted);
          font-size: 0.7rem;
        }

        .file-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }

        .file-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 20px;
          cursor: pointer;
          transition: background 0.15s;
          font-family: var(--font-display);
          font-size: 0.85rem;
          color: var(--text-primary);
          border: none;
          background: none;
          width: 100%;
          text-align: left;
        }

        .file-item:hover {
          background: var(--bg-tertiary);
        }

        .file-icon {
          font-size: 1.1rem;
          width: 24px;
          text-align: center;
          flex-shrink: 0;
        }

        .folder-icon {
          color: var(--warning-color);
        }

        .file-icon-tab {
          color: var(--accent-primary);
        }

        .file-icon-other {
          color: var(--text-muted);
        }

        .file-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: var(--text-secondary);
          font-family: var(--font-display);
          font-size: 0.85rem;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--border-color);
          border-top-color: var(--accent-primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 12px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: var(--text-muted);
          font-family: var(--font-display);
          font-size: 0.85rem;
          text-align: center;
        }

        .empty-icon {
          font-size: 2.5rem;
          margin-bottom: 12px;
          opacity: 0.5;
        }

        .provider-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: var(--bg-tertiary);
          border-radius: 4px;
          font-size: 0.65rem;
          color: var(--text-secondary);
          margin-left: 8px;
        }

        /* Responsive styles */
        @media (max-width: 480px) {
          .url-input-row,
          .token-input-row,
          .branch-input-row {
            flex-wrap: wrap;
          }

          .repo-type-select {
            flex: 0 0 auto;
            min-width: 90px;
          }

          .url-input {
            flex: 1 1 100%;
            min-width: 0;
          }

          .load-btn,
          .delete-token-btn {
            flex: 1 1 auto;
            min-width: 80px;
          }
        }
      </style>

      <div class="modal-overlay" id="modal-overlay">
        <div class="modal" id="modal">
          <div class="modal-header">
            <h2 class="modal-title">
              Browse Repository
              <span class="provider-badge" id="provider-badge" style="display: none;"></span>
            </h2>
            <button class="close-btn" id="close-btn" title="Close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="url-section">
              <label class="url-label">Repository URL</label>
              <div class="url-input-row">
                <select class="repo-type-select" id="repo-type-select">
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
                <input 
                  type="url" 
                  class="url-input" 
                  id="repo-url-input"
                  placeholder="https://github.com/username/repo"
                >
                <button class="load-btn" id="load-repo-btn">Load</button>
              </div>
              <div class="token-input-row" id="token-section" style="display: none;">
                <label class="url-label" style="margin: 0; flex: 0 0 auto; align-self: center;">Access Token</label>
                <input 
                  type="password" 
                  class="url-input" 
                  id="access-token-input"
                  placeholder="github/gitlab personal/project access token"
                  style="flex: 1;"
                >
                <button class="delete-token-btn" id="delete-token-btn" title="Delete token">Delete</button>
              </div>
              <div class="branch-input-row" id="branch-section" style="display: none;">
                <label class="url-label" style="margin: 0; flex: 0 0 auto; align-self: center; min-width: 50px;">Branch</label>
                <select class="branch-select" id="branch-select" disabled>
                  <option value="">Loading branches...</option>
                </select>
              </div>
              <div class="error-message" id="error-message" style="display: none;"></div>
            </div>
            <div class="breadcrumbs" id="breadcrumbs" style="display: none;">
              <button class="breadcrumb" id="root-breadcrumb">📁 root</button>
            </div>
            <div class="file-list" id="file-list">
              <div class="empty-state">
                <div class="empty-icon">📂</div>
                <div>Enter a repository URL and click Load to browse files</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    const overlay = this.shadowRoot.getElementById('modal-overlay');
    const closeBtn = this.shadowRoot.getElementById('close-btn');
    const loadBtn = this.shadowRoot.getElementById('load-repo-btn');
    const urlInput = this.shadowRoot.getElementById('repo-url-input');
    const repoTypeSelect = this.shadowRoot.getElementById('repo-type-select');
    const tokenSection = this.shadowRoot.getElementById('token-section');

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });

    // Close button
    closeBtn.addEventListener('click', () => this.close());

    // Repo type selector
    repoTypeSelect.addEventListener('change', (e) => {
      this.repoType = e.target.value;
      this.saveToStorage();
      
      if (this.repoType === 'private') {
        tokenSection.style.display = 'flex';
        // Load token from storage if switching to private
        const savedToken = localStorage.getItem('tabioke-access-token');
        if (savedToken && !this.accessToken) {
          this.accessToken = savedToken;
          this.shadowRoot.getElementById('access-token-input').value = savedToken;
        }
      } else {
        tokenSection.style.display = 'none';
        // Don't clear token from memory or storage, just hide it
      }
    });

    // Load repository
    loadBtn.addEventListener('click', () => this.loadRepository());
    urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.loadRepository();
    });

    // Access token input
    const tokenInput = this.shadowRoot.getElementById('access-token-input');
    tokenInput.addEventListener('input', (e) => {
      this.accessToken = e.target.value.trim();
      this.saveToStorage();
    });
    tokenInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.loadRepository();
    });

    // Delete token button
    const deleteTokenBtn = this.shadowRoot.getElementById('delete-token-btn');
    deleteTokenBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete the saved access token? This will clear the token from local storage and you will need to enter it again.')) {
        this.accessToken = '';
        tokenInput.value = '';
        localStorage.removeItem('tabioke-access-token');
      }
    });

    // Branch selector
    const branchSelect = this.shadowRoot.getElementById('branch-select');
    branchSelect.addEventListener('change', async (e) => {
      const newBranch = e.target.value;
      if (newBranch && newBranch !== this.branch) {
        this.branch = newBranch;
        this.saveToStorage();
        // Reset to root path when switching branches
        this.currentPath = '';
        this.pathHistory = [];
        await this.fetchContents(this.currentPath);
      }
    });

    // Root breadcrumb
    this.shadowRoot.getElementById('root-breadcrumb').addEventListener('click', () => {
      this.navigateTo('');
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  open() {
    this.isOpen = true;
    const overlay = this.shadowRoot.getElementById('modal-overlay');
    overlay.classList.add('open');
    
    // If we have a saved repo URL and valid repo info, auto-load it
    const savedRepoUrl = localStorage.getItem('tabioke-repo-url');
    if (savedRepoUrl && this.repoUrl && !this.provider) {
      // We have a saved URL but haven't loaded the repo yet
      setTimeout(() => {
        this.loadRepository();
      }, 100);
    } else {
      // Focus the input
      setTimeout(() => {
        const urlInput = this.shadowRoot.getElementById('repo-url-input');
        urlInput.focus();
        urlInput.select();
      }, 100);
    }
  }

  close() {
    this.isOpen = false;
    const overlay = this.shadowRoot.getElementById('modal-overlay');
    overlay.classList.remove('open');
  }

  /**
   * Parse repository URL to extract provider, owner, repo, branch, and path
   * Supports:
   * - https://github.com/owner/repo
   * - https://github.com/owner/repo/tree/branch
   * - https://github.com/owner/repo/tree/branch/path/to/dir
   * - https://gitlab.com/owner/repo (same patterns)
   */
  parseRepoUrl(url) {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      const pathParts = parsed.pathname.split('/').filter(p => p);

      let provider = null;
      if (hostname === 'github.com' || hostname.includes('github')) {
        provider = 'github';
      } else if (hostname === 'gitlab.com' || hostname.includes('gitlab')) {
        provider = 'gitlab';
      } else {
        throw new Error('Unsupported provider. Use GitHub or GitLab URLs.');
      }

      if (pathParts.length < 2) {
        throw new Error('Invalid repository URL. Expected format: https://github.com/owner/repo');
      }

      const owner = pathParts[0];
      const repo = pathParts[1];
      
      let branch = 'main';
      let startPath = '';

      // Check for /tree/branch/path pattern
      if (pathParts.length > 2 && (pathParts[2] === 'tree' || pathParts[2] === '-')) {
        // GitHub uses /tree/, GitLab uses /-/tree/
        const treeIndex = pathParts[2] === '-' ? 4 : 3;
        if (pathParts.length > treeIndex - 1) {
          branch = pathParts[treeIndex - 1];
        }
        if (pathParts.length > treeIndex) {
          startPath = pathParts.slice(treeIndex).join('/');
        }
      }

      return { provider, owner, repo, branch, startPath, hostname };
    } catch (e) {
      if (e.message.includes('Unsupported') || e.message.includes('Invalid')) {
        throw e;
      }
      throw new Error('Invalid URL format');
    }
  }

  async loadRepository() {
    const urlInput = this.shadowRoot.getElementById('repo-url-input');
    const url = urlInput.value.trim();

    if (!url) {
      this.showError('Please enter a repository URL');
      return;
    }

    try {
      this.hideError();
      const parsed = this.parseRepoUrl(url);
      
      this.provider = parsed.provider;
      this.owner = parsed.owner;
      this.repo = parsed.repo;
      
      // Check if we have a saved branch for this repo
      const savedBranch = localStorage.getItem('tabioke-repo-branch');
      const savedRepoUrl = localStorage.getItem('tabioke-repo-url');
      
      // Only use saved branch if we're loading the same repo
      if (savedBranch && savedRepoUrl === url) {
        this.branch = savedBranch;
      } else {
        // Otherwise use the branch from the URL
        this.branch = parsed.branch;
      }
      
      this.hostname = parsed.hostname;
      this.repoUrl = url;
      this.currentPath = parsed.startPath;
      this.pathHistory = [];

      // Update provider badge
      const badge = this.shadowRoot.getElementById('provider-badge');
      badge.textContent = this.provider === 'github' ? '🐙 GitHub' : '🦊 GitLab';
      badge.style.display = 'inline-flex';

      // Save to localStorage
      this.saveToStorage();

      // Fetch branches and populate dropdown
      await this.fetchBranches();

      // Load contents
      await this.fetchContents(this.currentPath);

    } catch (e) {
      this.showError(e.message);
    }
  }

  async fetchBranches() {
    try {
      let apiUrl;
      const headers = {};

      if (this.provider === 'github') {
        apiUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/branches`;
        if (this.repoType === 'private' && this.accessToken) {
          headers['Authorization'] = `Bearer ${this.accessToken}`;
        }
      } else {
        // GitLab
        const projectId = encodeURIComponent(`${this.owner}/${this.repo}`);
        apiUrl = `https://${this.hostname}/api/v4/projects/${projectId}/repository/branches`;
        if (this.repoType === 'private' && this.accessToken) {
          headers['PRIVATE-TOKEN'] = this.accessToken;
        }
      }

      const response = await fetch(apiUrl, { headers });

      if (!response.ok) {
        // If we can't fetch branches, fallback to common branch names
        console.warn('Failed to fetch branches, using defaults');
        this.branches = ['main', 'master', 'develop'];
      } else {
        const data = await response.json();
        this.branches = data.map(branch => branch.name);
      }

      // If the current branch doesn't exist in the list, use the first available
      if (!this.branches.includes(this.branch) && this.branches.length > 0) {
        this.branch = this.branches[0];
      }

      // Populate branch selector
      this.renderBranchSelector();

    } catch (e) {
      console.error('Error fetching branches:', e);
      // Fallback to common branch names
      this.branches = ['main', 'master', 'develop'];
      this.renderBranchSelector();
    }
  }

  renderBranchSelector() {
    const branchSection = this.shadowRoot.getElementById('branch-section');
    const branchSelect = this.shadowRoot.getElementById('branch-select');
    
    if (this.branches.length > 0) {
      branchSection.style.display = 'flex';
      branchSelect.disabled = false;
      branchSelect.innerHTML = '';
      
      this.branches.forEach(branchName => {
        const option = document.createElement('option');
        option.value = branchName;
        option.textContent = branchName;
        if (branchName === this.branch) {
          option.selected = true;
        }
        branchSelect.appendChild(option);
      });
    } else {
      branchSection.style.display = 'none';
    }
  }

  async fetchContents(path) {
    this.isLoading = true;
    this.renderLoading();

    try {
      let apiUrl;
      const headers = {};
      
      if (this.provider === 'github') {
        apiUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${encodeURIComponent(path)}?ref=${this.branch}`;
        if (this.repoType === 'private' && this.accessToken) {
          headers['Authorization'] = `Bearer ${this.accessToken}`;
        }
      } else {
        // GitLab
        const projectId = encodeURIComponent(`${this.owner}/${this.repo}`);
        apiUrl = `https://${this.hostname}/api/v4/projects/${projectId}/repository/tree?path=${encodeURIComponent(path)}&ref=${this.branch}`;
        if (this.repoType === 'private' && this.accessToken) {
          headers['PRIVATE-TOKEN'] = this.accessToken;
        }
      }

      const response = await fetch(apiUrl, { headers });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Repository or path not found. For private repos, add an access token.');
        } else if (response.status === 401) {
          throw new Error('Authentication failed. Check your access token.');
        } else if (response.status === 403) {
          const rateLimitReset = response.headers.get('X-RateLimit-Reset');
          if (rateLimitReset) {
            const resetTime = new Date(parseInt(rateLimitReset) * 1000);
            throw new Error(`API rate limit exceeded. Try again after ${resetTime.toLocaleTimeString()}`);
          }
          throw new Error('API rate limit exceeded. Please try again later.');
        }
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const data = await response.json();

      // Normalize the response (GitHub and GitLab have slightly different formats)
      this.contents = this.normalizeContents(data);
      this.currentPath = path;
      
      this.renderContents();
      this.renderBreadcrumbs();

    } catch (e) {
      this.showError(e.message);
      this.renderEmpty();
    } finally {
      this.isLoading = false;
    }
  }

  normalizeContents(data) {
    // Ensure data is an array (GitHub returns array, GitLab also returns array)
    const items = Array.isArray(data) ? data : [data];

    return items.map(item => {
      // GitHub format
      if (item.type === 'dir' || item.type === 'file') {
        return {
          name: item.name,
          type: item.type === 'dir' ? 'folder' : 'file',
          path: item.path
        };
      }
      // GitLab format
      return {
        name: item.name,
        type: item.type === 'tree' ? 'folder' : 'file',
        path: item.path
      };
    }).sort((a, b) => {
      // Folders first, then files
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  renderLoading() {
    const fileList = this.shadowRoot.getElementById('file-list');
    fileList.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <div>Loading...</div>
      </div>
    `;
  }

  renderEmpty() {
    const fileList = this.shadowRoot.getElementById('file-list');
    fileList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📂</div>
        <div>No files found in this directory</div>
      </div>
    `;
  }

  renderContents() {
    const fileList = this.shadowRoot.getElementById('file-list');
    
    if (this.contents.length === 0) {
      this.renderEmpty();
      return;
    }

    fileList.innerHTML = this.contents.map(item => {
      const isFolder = item.type === 'folder';
      const isTabFile = item.name.endsWith('.tab') || item.name.endsWith('.txt');
      
      let iconClass = 'file-icon-other';
      let icon = '📄';
      
      if (isFolder) {
        iconClass = 'folder-icon';
        icon = '📁';
      } else if (isTabFile) {
        iconClass = 'file-icon-tab';
        icon = '🎸';
      }

      return `
        <button class="file-item" data-path="${item.path}" data-type="${item.type}">
          <span class="file-icon ${iconClass}">${icon}</span>
          <span class="file-name">${item.name}</span>
        </button>
      `;
    }).join('');

    // Add click handlers
    fileList.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', () => {
        const path = item.dataset.path;
        const type = item.dataset.type;
        
        if (type === 'folder') {
          this.navigateTo(path);
        } else {
          this.selectFile(path);
        }
      });
    });
  }

  renderBreadcrumbs() {
    const breadcrumbs = this.shadowRoot.getElementById('breadcrumbs');
    breadcrumbs.style.display = 'flex';

    // Build path segments
    const segments = this.currentPath ? this.currentPath.split('/') : [];
    let html = '<button class="breadcrumb" data-path="">📁 root</button>';

    let cumulativePath = '';
    segments.forEach((segment, index) => {
      cumulativePath += (cumulativePath ? '/' : '') + segment;
      const isLast = index === segments.length - 1;
      
      html += `<span class="breadcrumb-separator">›</span>`;
      html += `<button class="breadcrumb ${isLast ? 'current' : ''}" data-path="${cumulativePath}">${segment}</button>`;
    });

    breadcrumbs.innerHTML = html;

    // Add click handlers
    breadcrumbs.querySelectorAll('.breadcrumb:not(.current)').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navigateTo(btn.dataset.path);
      });
    });
  }

  navigateTo(path) {
    this.fetchContents(path);
  }

  selectFile(path) {
    // Build raw file URL
    let rawUrl;
    
    if (this.provider === 'github') {
      rawUrl = `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/${path}`;
    } else {
      // GitLab
      rawUrl = `https://${this.hostname}/${this.owner}/${this.repo}/-/raw/${this.branch}/${path}`;
    }

    // Dispatch event for tab viewer to handle
    window.dispatchEvent(new CustomEvent('tab-selected-from-repo', {
      detail: {
        url: rawUrl,
        path: path,
        provider: this.provider,
        owner: this.owner,
        repo: this.repo,
        token: this.repoType === 'private' ? this.accessToken : null // Only pass token for private repos
      }
    }));

    // Close modal
    this.close();
  }

  showError(message) {
    const errorEl = this.shadowRoot.getElementById('error-message');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  hideError() {
    const errorEl = this.shadowRoot.getElementById('error-message');
    errorEl.style.display = 'none';
  }
}

customElements.define('repo-browser', RepoBrowser);

export default RepoBrowser;

