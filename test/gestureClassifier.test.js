import { describe, it, expect, beforeEach } from 'vitest';
import { GestureClassifier, GESTURE_TYPES } from '../src/vision/gestureClassifier.js';

// Helper to generate simulated 21 landmarks for testing
function createMockLandmarks({
  thumbExtended = false,
  indexExtended = false,
  middleExtended = false,
  ringExtended = false,
  pinkyExtended = false
} = {}) {
  const landmarks = [];
  // 0: Wrist
  landmarks.push({ x: 0.5, y: 0.8, z: 0 });

  // 1-4 Thumb
  landmarks.push({ x: 0.45, y: 0.75, z: 0 }); // 1: CMC
  landmarks.push({ x: 0.42, y: 0.70, z: 0 }); // 2: MCP
  landmarks.push({ x: 0.40, y: 0.65, z: 0 }); // 3: IP
  if (thumbExtended) {
    landmarks.push({ x: 0.25, y: 0.55, z: 0 }); // 4: Tip (extended outward)
  } else {
    landmarks.push({ x: 0.45, y: 0.65, z: 0 }); // 4: Tip (tucked inward)
  }

  // Helper for non-thumb fingers (mcp y ~ 0.55)
  const addFinger = (baseX, isExtended) => {
    landmarks.push({ x: baseX, y: 0.55, z: 0 }); // MCP
    landmarks.push({ x: baseX, y: 0.45, z: 0 }); // PIP
    landmarks.push({ x: baseX, y: 0.38, z: 0 }); // DIP
    if (isExtended) {
      landmarks.push({ x: baseX, y: 0.25, z: 0 }); // TIP (extended high up, far from wrist)
    } else {
      landmarks.push({ x: baseX, y: 0.58, z: 0 }); // TIP (curled down towards MCP)
    }
  };

  // 5-8: Index
  addFinger(0.40, indexExtended);
  // 9-12: Middle
  addFinger(0.48, middleExtended);
  // 13-16: Ring
  addFinger(0.56, ringExtended);
  // 17-20: Pinky
  addFinger(0.64, pinkyExtended);

  return landmarks;
}

describe('GestureClassifier', () => {
  let classifier;

  beforeEach(() => {
    classifier = new GestureClassifier({ stabilizationMs: 100 });
  });

  it('classifies Pen mode (1 finger: Index extended only)', () => {
    const landmarks = createMockLandmarks({
      indexExtended: true,
      middleExtended: false,
      ringExtended: false,
      pinkyExtended: false,
      thumbExtended: false
    });

    const raw = classifier.classifyRawLandmarks(landmarks);
    expect(raw.gesture).toBe(GESTURE_TYPES.PEN);
    expect(raw.fingerStates.index).toBe(true);
    expect(raw.fingerStates.middle).toBe(false);
  });

  it('classifies Eraser mode (2 fingers: Index + Middle extended)', () => {
    const landmarks = createMockLandmarks({
      indexExtended: true,
      middleExtended: true,
      ringExtended: false,
      pinkyExtended: false,
      thumbExtended: false
    });

    const raw = classifier.classifyRawLandmarks(landmarks);
    expect(raw.gesture).toBe(GESTURE_TYPES.ERASER);
  });

  it('classifies Palette mode (3 fingers: Index + Middle + Ring extended)', () => {
    const landmarks = createMockLandmarks({
      indexExtended: true,
      middleExtended: true,
      ringExtended: true,
      pinkyExtended: false,
      thumbExtended: false
    });

    const raw = classifier.classifyRawLandmarks(landmarks);
    expect(raw.gesture).toBe(GESTURE_TYPES.PALETTE);
  });

  it('classifies Neutral / Open Palm mode (5 fingers extended)', () => {
    const landmarks = createMockLandmarks({
      indexExtended: true,
      middleExtended: true,
      ringExtended: true,
      pinkyExtended: true,
      thumbExtended: true
    });

    const raw = classifier.classifyRawLandmarks(landmarks);
    expect(raw.gesture).toBe(GESTURE_TYPES.NEUTRAL);
  });

  it('classifies Idle mode (Closed Fist: all fingers curled)', () => {
    const landmarks = createMockLandmarks({
      indexExtended: false,
      middleExtended: false,
      ringExtended: false,
      pinkyExtended: false,
      thumbExtended: false
    });

    const raw = classifier.classifyRawLandmarks(landmarks);
    expect(raw.gesture).toBe(GESTURE_TYPES.IDLE);
  });

  it('applies temporal debouncing and hysteresis properly', () => {
    const penLandmarks = createMockLandmarks({ indexExtended: true });

    // Frame 1 at t=0: pending becomes pen, but current remains idle
    const res1 = classifier.update(penLandmarks, 1000);
    expect(res1.rawGesture).toBe(GESTURE_TYPES.PEN);
    expect(res1.gesture).toBe(GESTURE_TYPES.IDLE); // Not stabilized yet

    // Frame 2 at t=50ms (< 100ms threshold): still idle
    const res2 = classifier.update(penLandmarks, 1050);
    expect(res2.gesture).toBe(GESTURE_TYPES.IDLE);

    // Frame 3 at t=120ms (> 100ms threshold): should switch to PEN!
    const res3 = classifier.update(penLandmarks, 1120);
    expect(res3.gesture).toBe(GESTURE_TYPES.PEN);
  });

  it('smooths coordinates adaptively without NaN', () => {
    const landmarks = createMockLandmarks({ indexExtended: true });
    const res = classifier.update(landmarks, 1000);
    expect(res.point).toBeDefined();
    expect(res.point.x).toBeCloseTo(0.40, 1);
    expect(res.point.y).toBeCloseTo(0.25, 1);
  });
});
