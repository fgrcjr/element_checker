class ElementInspector {
  constructor() {
    this.isActive = false;
    this.lastHighlightedElement = null;
    this.lastSelectors = {
      cypress: '',
      playwright: '',
      selenium: ''
    };

    this.tooltip = null;
    this.toggleButton = null;
    this.initDOMElements();
    this.init();
  }

  initDOMElements() {
    this.tooltip = this.createTooltip();
    this.toggleButton = this.createToggleButton();
    this.injectStyles();
  }

  createTooltip() {
    const tooltip = document.createElement('div');
    tooltip.className = 'inspector-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);
    return tooltip;
  }

  createToggleButton() {
    const button = document.createElement('button');
    button.className = 'inspector-toggle';
    button.textContent = '🔍 Inspector: Off';
    document.body.appendChild(button);
    return button;
  }

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .inspector-tooltip {
        position: fixed;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 16px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        z-index: 2147483647;
        max-width: 420px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #1f2937;
      }

      .inspector-toggle {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        padding: 8px 16px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      }

      .inspector-toggle:hover {
        background: #2563eb;
      }

      .tooltip-section {
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e5e7eb;
      }

      .code-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .copy-btn {
        background: none;
        border: none;
        padding: 4px;
        cursor: pointer;
        color: #6b7280;
        transition: color 0.2s ease;
      }

      .copy-btn:hover {
        color: #3b82f6;
      }

      code {
        background-color: #f3f4f6;
        padding: 2px 4px;
        border-radius: 4px;
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        font-size: 13px;
        word-break: break-word;
      }

      .copy-feedback {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-family: system-ui;
        font-size: 14px;
        z-index: 2147483647;
        animation: fadeOut 2s forwards;
      }

      @keyframes fadeOut {
        0% { opacity: 1; }
        90% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  escapeText(text) {
    return text ? text.replace(/['"\\]/g, '\\$&') : '';
  }

  getSelectorPriorityAttributes(element) {
    return [
      element.id && `#${element.id}`,
      ...['data-cy', 'data-test', 'data-testid'].map(attr => 
        element.getAttribute(attr) && `[${attr}="${this.escapeText(element.getAttribute(attr))}"]`
      ),
      element.name && `[name="${this.escapeText(element.name)}"]`
    ].filter(Boolean);
  }

  generateCypressSelector(element) {
    const attrs = this.getSelectorPriorityAttributes(element);
    if (attrs.length) return `cy.get('${attrs[0]}')`;

    const tag = element.tagName.toLowerCase();
    const text = this.escapeText(element.textContent.trim());
    if ((tag === 'button' || tag === 'a') && text) {
      return `cy.contains('${tag}', '${text}')`;
    }

    return this.generateCssSelector(element, 'cy');
  }

  generatePlaywrightSelector(element) {
    if (element.id) return `page.locator('#${element.id}')`;
    
    const role = element.getAttribute('role');
    if (role) {
      const name = this.escapeText(element.textContent.trim());
      return name ? `page.getByRole('${role}', { name: '${name}' })` 
                  : `page.getByRole('${role}')`;
    }

    const attrs = this.getSelectorPriorityAttributes(element);
    if (attrs.length) return `page.locator('${attrs[0]}')`;

    return this.generateCssSelector(element, 'playwright');
  }

  generateSeleniumSelector(element) {
    const attrs = this.getSelectorPriorityAttributes(element);
    if (attrs.length) {
      return `driver.find_element(By.CSS_SELECTOR, "${attrs[0]}")`;
    }

    const xpath = this.generateXPath(element);
    return `driver.find_element(By.XPATH, "${xpath}")`;
  }

  generateCssSelector(element, engine) {
    let path = [];
    let current = element;

    while (current && current !== document.body) {
      const tag = current.tagName.toLowerCase();
      const attrs = [];
      
      if (current.id) {
        attrs.push(`#${current.id}`);
      } else {
        attrs.push(tag);
        
        const classes = Array.from(current.classList)
                          .filter(c => !c.startsWith('ng-'))
                          .map(c => `.${c}`);
        if (classes.length) attrs.push(...classes);

        ['data-cy', 'data-test', 'data-testid'].forEach(attr => {
          const value = current.getAttribute(attr);
          if (value) attrs.push(`[${attr}="${this.escapeText(value)}"]`);
        });
      }

      path.unshift(attrs.join(''));
      current = current.parentElement;
    }

    const selector = path.join(' > ');
    return engine === 'cy' ? `cy.get('${selector}')` 
         : engine === 'playwright' ? `page.locator('${selector}')`
         : `By.CSS_SELECTOR, "${selector}"`;
  }

  generateXPath(element) {
    const parts = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let part = element.tagName.toLowerCase();
      let hasUniqueAttr = false;

      ['id', 'data-cy', 'data-test', 'data-testid'].forEach(attr => {
        const value = element.getAttribute(attr);
        if (value && !hasUniqueAttr) {
          part += `[@${attr}="${this.escapeText(value)}"]`;
          hasUniqueAttr = true;
        }
      });

      if (!hasUniqueAttr) {
        const sameTagSiblings = Array.from(element.parentNode.children)
                                  .filter(el => el.tagName === element.tagName);
        if (sameTagSiblings.length > 1) {
          const index = sameTagSiblings.indexOf(element) + 1;
          part += `[${index}]`;
        }
      }

      parts.unshift(part);
      element = element.parentNode;
    }

    return `/${parts.join('/')}`;
  }

  shouldIgnoreElement(element) {
    const ignoredTags = ['html', 'body', 'script', 'style', 'meta', 'link'];
    const tag = element.tagName.toLowerCase();
    return ignoredTags.includes(tag) ||
           element === this.tooltip ||
           element === this.toggleButton ||
           this.tooltip.contains(element);
  }

  highlightElement(element) {
    if (this.shouldIgnoreElement(element) || !element?.style) return;

    if (this.lastHighlightedElement) {
      this.lastHighlightedElement.style.outline = '';
    }
    
    element.style.outline = '2px solid #ff0';
    this.lastHighlightedElement = element;
  }

  updateTooltip(element, event) {
    if (!element) return;

    this.lastSelectors = {
      cypress: this.generateCypressSelector(element),
      playwright: this.generatePlaywrightSelector(element),
      selenium: this.generateSeleniumSelector(element)
    };

    const safeText = text => this.escapeText(text?.toString() || '').substring(0, 50);
    const innerText = safeText(element.innerText);
    const value = element.value !== undefined ? safeText(element.value) : "none";
    
    this.tooltip.innerHTML = `
      <div class="tooltip-section">
        <strong>Element Info</strong>
        <div>Tag: <code>${element.tagName.toLowerCase()}</code></div>
        ${element.id ? `<div>ID: <code>#${element.id}</code></div>` : ''}
        ${element.className ? `<div>Classes: <code>${element.className.split(/\s+/).join(' .')}</code></div>` : ''}
        ${innerText !== '' ? `<div>Text: <code>${innerText}</code></div>` : ''}
        ${value !== 'none' ? `<div>Value: <code>${value}</code></div>` : ''}
      </div>
      ${this.generateCodeBlock('Cypress', this.lastSelectors.cypress)}
      ${this.generateCodeBlock('Playwright', this.lastSelectors.playwright)}
      ${this.generateCodeBlock('Selenium', this.lastSelectors.selenium)}
    `;

    this.positionTooltip(event);
  }

  generateCodeBlock(title, code) {
    return `
      <div class="tooltip-section">
        <div class="code-header">
          <strong>${title}</strong>
          <button class="copy-btn" 
                  data-code="${this.escapeText(code)}" 
                  data-framework="${title}">📋</button>
        </div>
        <code>${code}</code>
      </div>
    `;
  }

  positionTooltip(event) {
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let left = event.clientX + 15;
    let top = event.clientY + 15;

    if (left + tooltipRect.width > viewport.width) {
      left = viewport.width - tooltipRect.width - 10;
    }

    if (top + tooltipRect.height > viewport.height) {
      top = viewport.height - tooltipRect.height - 10;
    }

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  addKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      if (!this.isActive || !this.lastHighlightedElement) return;
      
      // Use Alt + Shift instead of Ctrl + Shift
      if (!event.altKey || !event.shiftKey) return;
  
      let content = '';
      let framework = '';
      try {
        switch(event.code) {
          case 'Digit1':  // Alt+Shift+1
            content = `// Cypress Selector\n${this.lastSelectors.cypress}`;
            framework = 'Cypress';
            break;
          case 'Digit2':  // Alt+Shift+2
            content = `// Playwright Selector\n${this.lastSelectors.playwright}`;
            framework = 'Playwright';
            break;
          case 'Digit3':  // Alt+Shift+3
            content = `// Selenium Selector\n${this.lastSelectors.selenium}`;
            framework = 'Selenium';
            break;
          default:
            return;
        }
  
        if (content) {
          event.preventDefault();
          navigator.clipboard.writeText(content)
            .then(() => this.showCopyFeedback(framework))
            .catch(err => console.error('Copy failed:', err));
        }
      } catch (error) {
        console.error('Selector generation error:', error);
      }
    });
  }

  showCopyFeedback(framework) {
    const feedback = document.createElement('div');
    feedback.textContent = `✅ Copied ${framework} selector to clipboard!`;
    feedback.className = 'copy-feedback';
    
    document.body.appendChild(feedback);
    setTimeout(() => feedback.remove(), 2000);
  }

  init() {
    // Listen for commands from the background script
    chrome.runtime.onMessage.addListener((request) => {
      if (!this.isActive || !this.lastHighlightedElement) return;
  
      let content = '';
      let framework = '';
      switch(request.command) {
        case 'copy-cypress':
          content = `// Cypress Selector\n${this.lastSelectors.cypress}`;
          framework = 'Cypress';
          break;
        case 'copy-playwright':
          content = `// Playwright Selector\n${this.lastSelectors.playwright}`;
          framework = 'Playwright';
          break;
        case 'copy-selenium':
          content = `// Selenium Selector\n${this.lastSelectors.selenium}`;
          framework = 'Selenium';
          break;
      }
  
      if (content) {
        navigator.clipboard.writeText(content)
          .then(() => this.showCopyFeedback(framework))
          .catch(err => {
            console.error('Clipboard write failed:', err);
            // Fallback for insecure contexts
            const textarea = document.createElement('textarea');
            textarea.value = content;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showCopyFeedback(framework);
          });
      }
    });
  
    // Existing tooltip click handler
    this.tooltip.addEventListener('click', (event) => {
      if (event.target.classList.contains('copy-btn')) {
        const code = event.target.dataset.code;
        const framework = event.target.dataset.framework;
        
        navigator.clipboard.writeText(code)
          .then(() => {
            this.showCopyFeedback(framework);
            event.target.textContent = 'Copied!';
            setTimeout(() => {
              event.target.textContent = '📋';
            }, 1000);
          })
          .catch(console.error);
      }
    });
  
    // Toggle button handler
    this.toggleButton.addEventListener('click', () => {
      this.isActive = !this.isActive;
      this.toggleButton.textContent = `🔍 Inspector: ${this.isActive ? 'On' : 'Off'}`;
      this.tooltip.style.display = 'none';
      
      if (!this.isActive && this.lastHighlightedElement) {
        this.lastHighlightedElement.style.outline = '';
        this.lastHighlightedElement = null;
      }
    });
  
    // Mouse interaction handlers
    document.addEventListener('mouseover', (event) => {
      if (!this.isActive) return;
      const target = event.target;
      
      if (target && !this.shouldIgnoreElement(target)) {
        this.highlightElement(target);
        this.tooltip.style.display = 'block';
        this.updateTooltip(target, event);
      }
    });
  
    document.addEventListener('mouseout', (event) => {
      if (!this.isActive) return;
      const target = event.target;
      
      if (target && !this.shouldIgnoreElement(target)) {
        if (!event.relatedTarget || 
            (!this.tooltip.contains(event.relatedTarget) && 
             !target.contains(event.relatedTarget))) {
          this.tooltip.style.display = 'none';
          if (this.lastHighlightedElement) {
            this.lastHighlightedElement.style.outline = '';
            this.lastHighlightedElement = null;
          }
        }
      }
    });
  
    document.addEventListener('mousemove', (event) => {
      if (this.isActive && this.tooltip.style.display === 'block') {
        this.updateTooltip(event.target, event);
      }
    });
  
    // Initialize remaining features
    this.addKeyboardShortcuts();
  }
}

// Initialize the inspector when DOM is ready
new ElementInspector();