// Advanced Swagger UI Enhancements

class SwaggerUIEnhancer {
  constructor() {
    this.init();
  }

  init() {
    this.addCustomHeader();
    this.addCustomFooter();
    this.enhanceStyling();
    this.addSearchFunctionality();
    this.addCopyButtons();
    this.addProgressIndicator();
    this.addThemeToggle();
    this.addResponsiveEnhancements();
    this.addKeyboardShortcuts();
    this.addTooltips();
  }

  addCustomHeader() {
    const headerHtml = `
      <div class="swagger-header">
        <div class="header-container">
          <div class="header-left">
            <div class="logo">
              <span class="logo-icon">🔗</span>
              <span class="logo-text">LocalConnect API</span>
            </div>
            <div class="version-badge">
              <span class="version-text">v1.0.0</span>
            </div>
          </div>
          <div class="header-right">
            <div class="header-nav">
              <a href="#authentication" class="nav-link">🔐 Auth</a>
              <a href="#endpoints" class="nav-link">📡 Endpoints</a>
              <a href="#schemas" class="nav-link">📋 Schemas</a>
              <a href="#support" class="nav-link">💬 Support</a>
            </div>
            <div class="environment-indicator">
              <span class="env-badge production">Production</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Insert header at the beginning of the body
    document.body.insertAdjacentHTML('afterbegin', headerHtml);
  }

  addCustomFooter() {
    const footerHtml = `
      <div class="swagger-footer">
        <div class="footer-container">
          <div class="footer-section">
            <h3>🚀 LocalConnect API</h3>
            <p>Comprehensive local community platform connecting people, businesses, and services</p>
            <div class="footer-stats">
              <div class="stat-item">
                <span class="stat-number">50+</span>
                <span class="stat-label">Endpoints</span>
              </div>
              <div class="stat-item">
                <span class="stat-number">24/7</span>
                <span class="stat-label">Uptime</span>
              </div>
              <div class="stat-item">
                <span class="stat-number">99.9%</span>
                <span class="stat-label">Reliability</span>
              </div>
            </div>
          </div>
          
          <div class="footer-section">
            <h3>🔗 Quick Links</h3>
            <ul class="footer-links">
              <li><a href="#authentication">Authentication</a></li>
              <li><a href="#users">User Management</a></li>
              <li><a href="#posts">Posts & Content</a></li>
              <li><a href="#marketplace">Marketplace</a></li>
              <li><a href="#jobs">Job Board</a></li>
              <li><a href="#chats">Live Chat</a></li>
            </ul>
          </div>
          
          <div class="footer-section">
            <h3>🛠️ Development</h3>
            <ul class="footer-links">
              <li><a href="/health">Health Check</a></li>
              <li><a href="/network-info">Network Info</a></li>
              <li><a href="/api-docs.json">API Spec</a></li>
              <li><a href="https://github.com/localconnect" target="_blank">GitHub</a></li>
              <li><a href="https://docs.localconnect.com" target="_blank">Documentation</a></li>
            </ul>
          </div>
          
          <div class="footer-section">
            <h3>📞 Support</h3>
            <div class="support-info">
              <p><strong>Email:</strong> api-support@localconnect.com</p>
              <p><strong>Response Time:</strong> < 2 hours</p>
              <p><strong>Status:</strong> <span class="status-online">🟢 Online</span></p>
            </div>
            <div class="social-links">
              <a href="#" class="social-link">📧</a>
              <a href="#" class="social-link">💬</a>
              <a href="#" class="social-link">🐦</a>
              <a href="#" class="social-link">📘</a>
            </div>
          </div>
        </div>
        
        <div class="footer-bottom">
          <div class="footer-bottom-content">
            <p>&copy; 2024 LocalConnect. All rights reserved. | Built with ❤️ for communities</p>
            <div class="footer-bottom-links">
              <a href="/terms">Terms</a>
              <a href="/privacy">Privacy</a>
              <a href="/cookies">Cookies</a>
              <a href="/security">Security</a>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Insert footer at the end of the body
    document.body.insertAdjacentHTML('beforeend', footerHtml);
  }

  enhanceStyling() {
    // Add custom CSS
    const customCSS = `
      /* Advanced Swagger UI Custom Styling */
      .swagger-ui * { box-sizing: border-box; }
      
      /* Custom Header */
      .swagger-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 20px 0;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        position: relative;
        overflow: hidden;
      }
      
      .swagger-header::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="75" cy="75" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="50" cy="10" r="0.5" fill="rgba(255,255,255,0.1)"/><circle cx="10" cy="60" r="0.5" fill="rgba(255,255,255,0.1)"/><circle cx="90" cy="40" r="0.5" fill="rgba(255,255,255,0.1)"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
        opacity: 0.3;
      }
      
      .header-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: relative;
        z-index: 2;
      }
      
      .header-left {
        display: flex;
        align-items: center;
        gap: 20px;
      }
      
      .logo {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .logo-icon {
        font-size: 32px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
      }
      
      .logo-text {
        color: white;
        font-size: 28px;
        font-weight: 700;
        text-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      
      .version-badge {
        background: rgba(255,255,255,0.2);
        border-radius: 20px;
        padding: 6px 12px;
        backdrop-filter: blur(10px);
      }
      
      .version-text {
        color: white;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .header-right {
        display: flex;
        align-items: center;
        gap: 30px;
      }
      
      .header-nav {
        display: flex;
        gap: 20px;
      }
      
      .nav-link {
        color: white;
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        padding: 8px 16px;
        border-radius: 20px;
        transition: all 0.3s ease;
        background: rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
      }
      
      .nav-link:hover {
        background: rgba(255,255,255,0.2);
        transform: translateY(-1px);
      }
      
      .environment-indicator {
        display: flex;
        align-items: center;
      }
      
      .env-badge {
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .env-badge.production {
        background: #10b981;
        color: white;
        box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
      }
      
      /* Custom Footer */
      .swagger-footer {
        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
        color: white;
        margin-top: 50px;
        position: relative;
        overflow: hidden;
      }
      
      .swagger-footer::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="rgba(255,255,255,0.05)"/><circle cx="75" cy="75" r="1" fill="rgba(255,255,255,0.05)"/><circle cx="50" cy="10" r="0.5" fill="rgba(255,255,255,0.05)"/><circle cx="10" cy="60" r="0.5" fill="rgba(255,255,255,0.05)"/><circle cx="90" cy="40" r="0.5" fill="rgba(255,255,255,0.05)"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
        opacity: 0.3;
      }
      
      .footer-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 40px 20px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 40px;
        position: relative;
        z-index: 2;
      }
      
      .footer-section h3 {
        color: #3498db;
        margin-bottom: 20px;
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .footer-section p {
        margin: 12px 0;
        opacity: 0.9;
        font-size: 14px;
        line-height: 1.6;
      }
      
      .footer-stats {
        display: flex;
        gap: 20px;
        margin-top: 20px;
      }
      
      .stat-item {
        text-align: center;
        background: rgba(255,255,255,0.1);
        padding: 15px;
        border-radius: 12px;
        backdrop-filter: blur(10px);
        min-width: 80px;
      }
      
      .stat-number {
        display: block;
        font-size: 24px;
        font-weight: 700;
        color: #3498db;
        margin-bottom: 5px;
      }
      
      .stat-label {
        font-size: 12px;
        opacity: 0.8;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .footer-links {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      
      .footer-links li {
        margin: 10px 0;
      }
      
      .footer-links a {
        color: white;
        text-decoration: none;
        font-size: 14px;
        opacity: 0.8;
        transition: all 0.3s ease;
        display: inline-block;
        padding: 5px 0;
      }
      
      .footer-links a:hover {
        opacity: 1;
        color: #3498db;
        transform: translateX(5px);
      }
      
      .support-info p {
        margin: 8px 0;
        font-size: 14px;
      }
      
      .status-online {
        color: #10b981;
        font-weight: 600;
      }
      
      .social-links {
        display: flex;
        gap: 15px;
        margin-top: 20px;
      }
      
      .social-link {
        display: inline-block;
        width: 40px;
        height: 40px;
        background: rgba(255,255,255,0.1);
        border-radius: 50%;
        text-align: center;
        line-height: 40px;
        font-size: 18px;
        text-decoration: none;
        transition: all 0.3s ease;
        backdrop-filter: blur(10px);
      }
      
      .social-link:hover {
        background: rgba(255,255,255,0.2);
        transform: translateY(-2px);
      }
      
      .footer-bottom {
        border-top: 1px solid rgba(255,255,255,0.1);
        padding: 20px 0;
        background: rgba(0,0,0,0.2);
      }
      
      .footer-bottom-content {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 20px;
      }
      
      .footer-bottom p {
        margin: 0;
        font-size: 14px;
        opacity: 0.8;
      }
      
      .footer-bottom-links {
        display: flex;
        gap: 20px;
      }
      
      .footer-bottom-links a {
        color: white;
        text-decoration: none;
        font-size: 14px;
        opacity: 0.8;
        transition: opacity 0.3s ease;
      }
      
      .footer-bottom-links a:hover {
        opacity: 1;
      }
      
      /* Enhanced Operation Blocks */
      .swagger-ui .opblock {
        border-radius: 12px;
        margin: 20px 0;
        box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        overflow: hidden;
        transition: all 0.3s ease;
      }
      
      .swagger-ui .opblock:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      }
      
      .swagger-ui .opblock-summary {
        padding: 20px;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-bottom: 1px solid #dee2e6;
      }
      
      .swagger-ui .opblock-summary-method {
        border-radius: 8px;
        font-weight: 600;
        padding: 8px 16px;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .swagger-ui .btn.execute {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        border-radius: 8px;
        padding: 12px 24px;
        font-weight: 600;
        color: white;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
      }
      
      .swagger-ui .btn.execute:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
      }
      
      /* Responsive Design */
      @media (max-width: 768px) {
        .header-container {
          flex-direction: column;
          gap: 20px;
        }
        
        .header-right {
          flex-direction: column;
          gap: 15px;
        }
        
        .header-nav {
          flex-wrap: wrap;
          justify-content: center;
        }
        
        .logo-text {
          font-size: 24px;
        }
        
        .footer-container {
          grid-template-columns: 1fr;
          gap: 30px;
        }
        
        .footer-stats {
          justify-content: center;
        }
        
        .footer-bottom-content {
          flex-direction: column;
          text-align: center;
        }
        
        .footer-bottom-links {
          justify-content: center;
        }
      }
      
      /* Loading Animation */
      .swagger-ui .loading {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      /* Custom Scrollbar */
      .swagger-ui ::-webkit-scrollbar {
        width: 8px;
      }
      
      .swagger-ui ::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
      }
      
      .swagger-ui ::-webkit-scrollbar-thumb {
        background: #667eea;
        border-radius: 4px;
      }
      
      .swagger-ui ::-webkit-scrollbar-thumb:hover {
        background: #5a6fd8;
      }
    `;
    
    const style = document.createElement('style');
    style.textContent = customCSS;
    document.head.appendChild(style);
  }

  addSearchFunctionality() {
    // Add search bar to header
    const searchHtml = `
      <div class="search-container">
        <input type="text" id="api-search" placeholder="🔍 Search endpoints..." class="search-input">
        <div id="search-results" class="search-results"></div>
      </div>
    `;
    
    const headerRight = document.querySelector('.header-right');
    if (headerRight) {
      headerRight.insertAdjacentHTML('beforeend', searchHtml);
    }
    
    // Add search functionality
    const searchInput = document.getElementById('api-search');
    if (searchInput) {
      searchInput.addEventListener('input', this.handleSearch.bind(this));
    }
  }

  handleSearch(event) {
    const query = event.target.value.toLowerCase();
    const results = document.getElementById('search-results');
    
    if (query.length < 2) {
      results.innerHTML = '';
      results.style.display = 'none';
      return;
    }
    
    const endpoints = document.querySelectorAll('.opblock-summary-description');
    const matches = [];
    
    endpoints.forEach((endpoint, index) => {
      if (endpoint.textContent.toLowerCase().includes(query)) {
        matches.push({
          text: endpoint.textContent,
          element: endpoint.closest('.opblock')
        });
      }
    });
    
    this.displaySearchResults(matches, results);
  }

  displaySearchResults(matches, resultsContainer) {
    if (matches.length === 0) {
      resultsContainer.innerHTML = '<div class="no-results">No endpoints found</div>';
    } else {
      const resultsHtml = matches.map(match => 
        `<div class="search-result" onclick="document.querySelector('.opblock').scrollIntoView({behavior: 'smooth'})">
          ${match.text}
        </div>`
      ).join('');
      resultsContainer.innerHTML = resultsHtml;
    }
    
    resultsContainer.style.display = 'block';
  }

  addCopyButtons() {
    // Add copy buttons to code blocks
    const codeBlocks = document.querySelectorAll('pre');
    codeBlocks.forEach(block => {
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-button';
      copyButton.innerHTML = '📋 Copy';
      copyButton.onclick = () => this.copyToClipboard(block.textContent);
      block.appendChild(copyButton);
    });
  }

  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      // Show success message
      this.showNotification('Copied to clipboard!', 'success');
    });
  }

  addProgressIndicator() {
    // Add progress bar for page loading
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.innerHTML = '<div class="progress-fill"></div>';
    document.body.appendChild(progressBar);
    
    // Simulate progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => {
          progressBar.style.opacity = '0';
        }, 500);
      }
      progressBar.querySelector('.progress-fill').style.width = progress + '%';
    }, 100);
  }

  addThemeToggle() {
    // Add theme toggle button
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.innerHTML = '🌙';
    themeToggle.onclick = () => this.toggleTheme();
    
    const headerRight = document.querySelector('.header-right');
    if (headerRight) {
      headerRight.appendChild(themeToggle);
    }
  }

  toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const toggle = document.querySelector('.theme-toggle');
    toggle.innerHTML = document.body.classList.contains('dark-theme') ? '☀️' : '🌙';
  }

  addResponsiveEnhancements() {
    // Add responsive menu for mobile
    const menuToggle = document.createElement('button');
    menuToggle.className = 'menu-toggle';
    menuToggle.innerHTML = '☰';
    menuToggle.onclick = () => this.toggleMobileMenu();
    
    const headerContainer = document.querySelector('.header-container');
    if (headerContainer) {
      headerContainer.appendChild(menuToggle);
    }
  }

  toggleMobileMenu() {
    const nav = document.querySelector('.header-nav');
    nav.classList.toggle('mobile-open');
  }

  addKeyboardShortcuts() {
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
          case 'k':
            e.preventDefault();
            document.getElementById('api-search').focus();
            break;
          case '/':
            e.preventDefault();
            this.toggleTheme();
            break;
        }
      }
    });
  }

  addTooltips() {
    // Add tooltips to various elements
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    tooltipElements.forEach(element => {
      element.addEventListener('mouseenter', (e) => this.showTooltip(e));
      element.addEventListener('mouseleave', () => this.hideTooltip());
    });
  }

  showTooltip(event) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = event.target.getAttribute('data-tooltip');
    document.body.appendChild(tooltip);
    
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = rect.left + 'px';
    tooltip.style.top = (rect.bottom + 5) + 'px';
  }

  hideTooltip() {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Initialize the enhancer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SwaggerUIEnhancer();
});

// Export for use in other modules
window.SwaggerUIEnhancer = SwaggerUIEnhancer;
