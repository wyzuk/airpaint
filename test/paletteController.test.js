import { describe, it, expect, beforeEach } from 'vitest';
import { PaletteController, PALETTE_COLORS } from '../src/palette/paletteController.js';

describe('PaletteController', () => {
  let controller;
  let mockContainer;
  let selectedColor;

  beforeEach(() => {
    // Create mock DOM container
    mockContainer = document.createElement('div');
    selectedColor = null;

    controller = new PaletteController(mockContainer, {
      initialIndex: 0,
      onColorChange: (c) => { selectedColor = c; }
    });
  });

  it('initializes with default color', () => {
    expect(controller.getCurrentColor().hex).toBe(PALETTE_COLORS[0].hex);
    expect(controller.selectedIndex).toBe(0);
  });

  it('selects color by index and triggers callback', () => {
    controller.selectIndex(3);
    expect(controller.selectedIndex).toBe(3);
    expect(selectedColor.hex).toBe(PALETTE_COLORS[3].hex);
  });

  it('selects color by hex', () => {
    controller.selectColorHex('#FF3B30'); // Apple Red
    expect(controller.getCurrentColor().name).toBe('Apple Red');
  });

  it('cycles colors forward and wraps around', () => {
    const total = PALETTE_COLORS.length;
    controller.selectIndex(total - 1);
    controller.nextColor();
    expect(controller.selectedIndex).toBe(0);
  });

  it('cycles colors backward and wraps around', () => {
    controller.selectIndex(0);
    controller.prevColor();
    expect(controller.selectedIndex).toBe(PALETTE_COLORS.length - 1);
  });

  it('handles horizontal gesture swipe motion correctly', () => {
    controller.open();
    expect(controller.isOpen).toBe(true);
    controller.selectIndex(2);

    // Initial anchor frame
    controller.handleGestureMotion({ x: 0.5, y: 0.5 }, true, 1000);
    expect(controller.selectedIndex).toBe(2);

    // Swipe right (in mirrored space, moving hand right means lower x in raw camera, higher in mapped space)
    // Moving hand to the right: mappedX increases by > threshold
    controller.handleGestureMotion({ x: 0.40, y: 0.5 }, true, 1250);
    expect(controller.selectedIndex).toBe(3); // Next color!

    // Swipe left: mappedX decreases
    controller.handleGestureMotion({ x: 0.48, y: 0.5 }, true, 1500);
    expect(controller.selectedIndex).toBe(2); // Prev color!
  });

  it('ignores micro-movements below threshold', () => {
    controller.open();
    controller.selectIndex(5);
    controller.handleGestureMotion({ x: 0.5, y: 0.5 }, true, 1000);

    // Tiny jitter (0.005 < 0.038 threshold)
    controller.handleGestureMotion({ x: 0.495, y: 0.5 }, true, 1250);
    expect(controller.selectedIndex).toBe(5);
  });
});
