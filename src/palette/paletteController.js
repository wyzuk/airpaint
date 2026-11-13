/**
 * AIRPAINT - Floating Color Palette Controller
 * Supports 3-finger gesture horizontal swipe color switching and direct click selection
 */

export const PALETTE_COLORS = [
  { name: 'Pure White', hex: '#FFFFFF', isLight: true },
  { name: 'Obsidian Black', hex: '#1C1C1E', isLight: false },
  { name: 'Apple Red', hex: '#FF3B30', isLight: false },
  { name: 'Flame Orange', hex: '#FF9500', isLight: false },
  { name: 'Radiant Yellow', hex: '#FFCC00', isLight: true },
  { name: 'Lime Green', hex: '#34C759', isLight: false },
  { name: 'Deep Emerald', hex: '#00875A', isLight: false },
  { name: 'Vibrant Cyan', hex: '#32ADE6', isLight: false },
  { name: 'Sky Blue', hex: '#5AC8FA', isLight: false },
  { name: 'Royal Blue', hex: '#007AFF', isLight: false },
  { name: 'Lavender Purple', hex: '#AF52DE', isLight: false },
  { name: 'Neon Pink', hex: '#FF2D55', isLight: false },
  { name: 'Magenta', hex: '#E040FB', isLight: false },
  { name: 'Earth Brown', hex: '#A2845E', isLight: false }
];

export class PaletteController {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.colors = PALETTE_COLORS;
    this.selectedIndex = options.initialIndex !== undefined ? options.initialIndex : 9; // Default Royal Blue (#007AFF)
    this.isOpen = false;
    this.onColorChange = options.onColorChange || null;

    // Gesture swipe tracking
    this.anchorX = null;
    this.lastSwipeTime = 0;
    this.swipeCooldownMs = 180; // 180ms debounce between swipes
    this.swipeThreshold = 0.038; // Normalized X travel distance ~4% of screen width

    this.render();
  }

  getCurrentColor() {
    return this.colors[this.selectedIndex];
  }

  getColorHex() {
    return this.colors[this.selectedIndex].hex;
  }

  open() {
    if (!this.isOpen) {
      this.isOpen = true;
      this.anchorX = null;
      if (this.container) {
        this.container.classList.add('active');
        this.container.setAttribute('aria-hidden', 'false');
      }
      this.updateSelectionVisuals(true);
    }
  }

  close() {
    if (this.isOpen) {
      this.isOpen = false;
      this.anchorX = null;
      if (this.container) {
        this.container.classList.remove('active');
        this.container.setAttribute('aria-hidden', 'true');
      }
    }
  }

  selectIndex(index, triggerEvent = true) {
    if (index < 0 || index >= this.colors.length) return;
    this.selectedIndex = index;
    this.updateSelectionVisuals(true);

    if (triggerEvent && typeof this.onColorChange === 'function') {
      this.onColorChange(this.colors[this.selectedIndex]);
    }
  }

  selectColorHex(hex) {
    const idx = this.colors.findIndex(c => c.hex.toLowerCase() === hex.toLowerCase());
    if (idx !== -1) {
      this.selectIndex(idx, true);
    }
  }

  nextColor() {
    const newIdx = (this.selectedIndex + 1) % this.colors.length;
    this.selectIndex(newIdx, true);
  }

  prevColor() {
    const newIdx = (this.selectedIndex - 1 + this.colors.length) % this.colors.length;
    this.selectIndex(newIdx, true);
  }

  /**
   * Evaluates horizontal index fingertip motion while in 3-finger palette mode
   */
  handleGestureMotion(normalizedPoint, isMirrored = true, timestamp = performance.now()) {
    if (!this.isOpen || !normalizedPoint) return;

    // Account for mirroring so moving hand physically to the right moves selection right
    const mappedX = isMirrored ? (1 - normalizedPoint.x) : normalizedPoint.x;

    if (this.anchorX === null) {
      this.anchorX = mappedX;
      return;
    }

    if (timestamp - this.lastSwipeTime < this.swipeCooldownMs) {
      return;
    }

    const deltaX = mappedX - this.anchorX;

    if (deltaX > this.swipeThreshold) {
      // Swiped right -> Next color
      this.nextColor();
      this.anchorX = mappedX;
      this.lastSwipeTime = timestamp;
      this.animateSwipeDirection('right');
    } else if (deltaX < -this.swipeThreshold) {
      // Swiped left -> Previous color
      this.prevColor();
      this.anchorX = mappedX;
      this.lastSwipeTime = timestamp;
      this.animateSwipeDirection('left');
    }
  }

  animateSwipeDirection(direction) {
    if (!this.container) return;
    this.container.classList.remove('swipe-left', 'swipe-right');
    // Trigger reflow
    void this.container.offsetWidth;
    this.container.classList.add(`swipe-${direction}`);
  }

  updateSelectionVisuals(scrollIntoView = false) {
    if (!this.container) return;

    const items = this.container.querySelectorAll('.palette-color-item');
    items.forEach((item, idx) => {
      if (idx === this.selectedIndex) {
        item.classList.add('selected');
        item.setAttribute('aria-selected', 'true');
        if (scrollIntoView && typeof item.scrollIntoView === 'function') {
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      } else {
        item.classList.remove('selected');
        item.setAttribute('aria-selected', 'false');
      }
    });

    const labelEl = this.container.querySelector('.palette-current-label');
    if (labelEl) {
      labelEl.textContent = this.colors[this.selectedIndex].name;
    }
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="palette-glass-card">
        <div class="palette-header">
          <div class="palette-hint-badge">
            <span class="palette-gesture-icon">✌️+☝️</span>
            <span>Swipe Hand to Select</span>
          </div>
          <div class="palette-current-label">${this.colors[this.selectedIndex].name}</div>
        </div>
        <div class="palette-colors-row" role="listbox" aria-label="Color Palette">
          ${this.colors.map((c, i) => `
            <button
              type="button"
              class="palette-color-item ${i === this.selectedIndex ? 'selected' : ''}"
              data-index="${i}"
              role="option"
              aria-selected="${i === this.selectedIndex}"
              title="${c.name}"
              style="--item-color: ${c.hex};"
            >
              <span class="palette-color-dot" style="background-color: ${c.hex};"></span>
              <span class="palette-color-ring"></span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    // Click handler for mouse/touch interaction
    const buttons = this.container.querySelectorAll('.palette-color-item');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        this.selectIndex(idx, true);
      });
    });
  }
}
