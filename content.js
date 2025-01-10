class ElementInspector {
  constructor() {
    this.isActive = false;
    this.tooltip = this.createTooltip();
    this.toggleButton = this.createToggleButton();
    this.lastHighlightedElement = null;
    this.init();
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
    button.textContent = 'Inspector: Off';
    document.body.appendChild(button);
    return button;
  }

  generateCypressSelector(element) {
    // Priority 1: Use the ID
    if (element.id) {
      return `cy.get('#${element.id}')`;
    }
  
    // Priority 2: Use data attributes
    const dataAttributes = ['data-cy', 'data-test', 'data-testid'];
    for (const attr of dataAttributes) {
      if (element.getAttribute(attr)) {
        return `cy.get('[${attr}="${element.getAttribute(attr)}"]')`;
      }
    }
  
    // Priority 3: Use the name attribute (for form elements)
    if (element.name) {
      return `cy.get('[name="${element.name}"]')`;
    }
  
    // Priority 4: Use the tag and visible text (for buttons and links)
    const tag = element.tagName.toLowerCase();
    const text = element.textContent.trim();
    if ((tag === 'button' || tag === 'a') && text) {
      return `cy.contains('${tag}', '${text}')`;
    }
  
    // Priority 5: Use a single class if available
    const classList = element.className.split(/\s+/).filter(c => c);
    if (classList.length === 1) {
      return `cy.get('.${classList[0]}')`;
    }
  
    // Priority 6: Generate a unique selector using parent context
    return this.generateContextualSelector(element);
  }
  
  generateContextualSelector(element) {
    let selector = '';
    let current = element;
  
    while (current && current !== document.body) {
      const tag = current.tagName.toLowerCase();
  
      // Use ID if available in the hierarchy
      if (current.id) {
        selector = `#${current.id}${selector ? ' > ' + selector : ''}`;
        break;
      }
  
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(current) + 1;
        selector = `${tag}:nth-child(${index})${selector ? ' > ' + selector : ''}`;
      }
  
      current = parent;
    }
  
    return `cy.get('${selector}')`;
  }

  generateUniqueSelector(element) {
    let selector = '';
    let current = element;
    
    while (current && current !== document.body) {
      const tag = current.tagName.toLowerCase();
      if (current.id) {
        selector = `#${current.id}${selector ? ' > ' + selector : ''}`;
        break;
      }
      
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(current) + 1;
        selector = `${tag}:nth-child(${index})${selector ? ' > ' + selector : ''}`;
      }
      
      current = parent;
    }
    
    return `cy.get('${selector}')`;
  }

  generatePlaywrightSelector(element) {
    const id = element.id ? `#${element.id}` : '';
    const role = element.getAttribute('role');
    
    if (id) {
      return `page.locator('${id}')`;
    }
    
    if (role) {
      return `page.getByRole('${role}')`;
    }
    
    if (element.tagName.toLowerCase() === 'button' || element.tagName.toLowerCase() === 'a') {
      const text = element.textContent.trim();
      if (text) {
        return `page.getByText('${text}')`;
      }
    }
    
    return `page.locator('${this.generateUniqueSelector(element).replace('cy.get(\'', '').replace('\')', '')}')`;
  }

  generateSeleniumSelector(element) {
    // Priority order for Selenium selectors
    if (element.id) {
      return `driver.find_element(By.ID, "${element.id}")`;
    }
  
    if (element.name) {
      return `driver.find_element(By.NAME, "${element.name}")`;
    }
  
    const classList = element.className.split(/\s+/).filter(c => c);
    if (classList.length > 0) {
      return `driver.find_element(By.CLASS_NAME, "${classList[0]}")`;
    }
  
    const tagName = element.tagName.toLowerCase();
    if (tagName) {
      return `driver.find_element(By.TAG_NAME, "${tagName}")`;
    }
  
    const linkText = element.textContent.trim();
    if (tagName === 'a' && linkText) {
      return `driver.find_element(By.LINK_TEXT, "${linkText}")`;
    }
  
    if (tagName === 'a' && linkText) {
      return `driver.find_element(By.PARTIAL_LINK_TEXT, "${linkText.substring(0, 10)}")`;
    }
  
    // Fallback to XPath if no better options are found
    const xpath = this.generateXPath(element);
    return `driver.find_element(By.XPATH, "${xpath}")`;
  }
  
  generateXPath(element) {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
    const parts = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = element.previousSibling;
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === element.tagName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      const tagName = element.tagName.toLowerCase();
      const part = index > 0 ? `${tagName}[${index + 1}]` : tagName;
      parts.unshift(part);
      element = element.parentNode;
    }
    return `/${parts.join("/")}`;
  }

  shouldIgnoreElement(element) {
    // List of elements to ignore
    const ignoredTags = ['html', 'body', 'script', 'style', 'meta', 'link'];
    const tag = element.tagName.toLowerCase();
    
    return (
      ignoredTags.includes(tag) ||
      element === this.tooltip ||
      element === this.toggleButton ||
      this.tooltip.contains(element) ||
      this.toggleButton.contains(element)
    );
  }

  highlightElement(element) {
    if (this.shouldIgnoreElement(element)) {
      return;
    }

    if (this.lastHighlightedElement) {
      this.lastHighlightedElement.style.outline = '';
    }
    
    element.style.outline = '2px solid #ff0';
    this.lastHighlightedElement = element;
  }

  updateTooltip(element, event) {
    if (this.shouldIgnoreElement(element)) {
      return;
    }
  
    const cypressSelector = this.generateCypressSelector(element);
    const playwrightSelector = this.generatePlaywrightSelector(element);
    const seleniumSelector = this.generateSeleniumSelector(element);
  
    // Capture additional attributes
    const innerText = element.innerText || "none";
    const innerHTML = element.innerHTML || "none";
    const value = element.value !== undefined ? element.value : "none";
  
    this.tooltip.innerHTML = `
      <div style="margin-bottom: 8px;">
        <strong>Element Info:</strong><br>
        Tag: ${element.tagName.toLowerCase()}<br>
        ID: ${element.id || 'none'}<br>
        Classes: ${element.className || 'none'}<br>
        Inner Text: ${innerText}<br>
        Value: ${value}
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Cypress:</strong><br>
        <code>${cypressSelector}</code>
      </div>
      <div>
        <strong>Playwright:</strong><br>
        <code>${playwrightSelector}</code>
      </div>
      <div>
        <strong>Selenium:</strong><br>
        <code>${seleniumSelector}</code>
      </div>
    `;
  
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };
  
    // Adjust the tooltip position considering the scrolling offset
    let left = event.clientX + 10 + window.scrollX;
    let top = event.clientY + 10 + window.scrollY;
  
    if (left + tooltipRect.width > viewport.width + window.scrollX) {
      left = viewport.width + window.scrollX - tooltipRect.width - 10;
    }
  
    if (top + tooltipRect.height > viewport.height + window.scrollY) {
      top = viewport.height + window.scrollY - tooltipRect.height - 10;
    }
  
    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  init() {
    this.toggleButton.addEventListener('click', () => {
      this.isActive = !this.isActive;
      this.toggleButton.textContent = `Inspector: ${this.isActive ? 'On' : 'Off'}`;
      this.tooltip.style.display = 'none';
      
      if (!this.isActive && this.lastHighlightedElement) {
        this.lastHighlightedElement.style.outline = '';
        this.lastHighlightedElement = null;
      }
    });

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
      const relatedTarget = event.relatedTarget;
      
      if (target && !this.shouldIgnoreElement(target)) {
        if (!relatedTarget || 
            (!this.tooltip.contains(relatedTarget) && 
             !target.contains(relatedTarget) && 
             !relatedTarget.contains(target))) {
          this.tooltip.style.display = 'none';
          if (this.lastHighlightedElement) {
            this.lastHighlightedElement.style.outline = '';
            this.lastHighlightedElement = null;
          }
        }
      }
    });

    document.addEventListener('mousemove', (event) => {
      if (this.isActive && 
          this.tooltip.style.display === 'block' && 
          !this.shouldIgnoreElement(event.target)) {
        this.updateTooltip(event.target, event);
      }
    });
  }
}

// Initialize the inspector
new ElementInspector();