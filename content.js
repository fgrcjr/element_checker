class ElementInspector {
    constructor() {
      this.isActive = false;
      this.tooltip = this.createTooltip();
      this.toggleButton = this.createToggleButton();
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
      button.textContent = 'Turn Inspector On';
      document.body.appendChild(button);
      return button;
    }
  
    generateCypressSelector(element) {
      // Priority order for Cypress selectors
      if (element.id) {
        return `cy.get('#${element.id}')`;
      }
  
      if (element.getAttribute('data-cy')) {
        return `cy.get('[data-cy="${element.getAttribute('data-cy')}"]')`;
      }
  
      if (element.getAttribute('data-test')) {
        return `cy.get('[data-test="${element.getAttribute('data-test')}"]')`;
      }
  
      if (element.name) {
        return `cy.get('[name="${element.name}"]')`;
      }
  
      // For buttons and links with text
      if (element.tagName.toLowerCase() === 'button' || element.tagName.toLowerCase() === 'a') {
        const text = element.textContent.trim();
        if (text) {
          return `cy.contains('${element.tagName.toLowerCase()}', '${text}')`;
        }
      }
  
      // Class-based selector (only if the element has a single class)
      const classList = element.className.split(/\s+/).filter(c => c);
      if (classList.length === 1) {
        return `cy.get('.${classList[0]}')`;
      }
  
      // Generate a unique selector using closest parent with ID or fall back to nth-child
      return this.generateUniqueSelector(element);
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
  
    updateTooltip(element, event) {
      const cypressSelector = this.generateCypressSelector(element);
      const playwrightSelector = this.generatePlaywrightSelector(element);
      
      this.tooltip.innerHTML = `
        <div style="margin-bottom: 8px;">
          <strong>Element Info:</strong><br>
          Tag: ${element.tagName.toLowerCase()}<br>
          ID: ${element.id || 'none'}<br>
          Classes: ${element.className || 'none'}
        </div>
        <div style="margin-bottom: 8px;">
          <strong>Cypress:</strong><br>
          <code>${cypressSelector}</code>
        </div>
        <div>
          <strong>Playwright:</strong><br>
          <code>${playwrightSelector}</code>
        </div>
      `;
  
      const tooltipRect = this.tooltip.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };
  
      // Position tooltip to avoid viewport edges
      let left = event.pageX + 10;
      let top = event.pageY + 10;
  
      if (left + tooltipRect.width > viewport.width) {
        left = viewport.width - tooltipRect.width - 10;
      }
  
      if (top + tooltipRect.height > viewport.height) {
        top = viewport.height - tooltipRect.height - 10;
      }
  
      this.tooltip.style.left = `${left}px`;
      this.tooltip.style.top = `${top}px`;
    }
  
    init() {
      this.toggleButton.addEventListener('click', () => {
        this.isActive = !this.isActive;
        this.toggleButton.textContent = this.isActive ? 'Turn Inspector Off' : 'Turn Inspector On';
        this.tooltip.style.display = 'none';
        
        if (!this.isActive) {
          document.querySelectorAll('.inspector-highlight').forEach(el => {
            el.classList.remove('inspector-highlight');
          });
        }
      });
  
      document.addEventListener('mouseover', (event) => {
        if (!this.isActive) return;
        
        const target = event.target;
        if (target && target !== this.tooltip && target !== this.toggleButton) {
          target.classList.add('inspector-highlight');
          this.tooltip.style.display = 'block';
          this.updateTooltip(target, event);
        }
      });
  
      document.addEventListener('mouseout', (event) => {
        if (!this.isActive) return;
        
        const target = event.target;
        if (target && target !== this.tooltip) {
          target.classList.remove('inspector-highlight');
          if (!event.relatedTarget || (!event.relatedTarget.contains(target) && !target.contains(event.relatedTarget))) {
            this.tooltip.style.display = 'none';
          }
        }
      });
  
      document.addEventListener('mousemove', (event) => {
        if (this.isActive && this.tooltip.style.display === 'block') {
          this.updateTooltip(event.target, event);
        }
      });
    }
  }
  
  // Initialize the inspector
  new ElementInspector();