/**
 * AIRPAINT - Gesture Recognition Engine
 * 21-point Hand Landmark Geometric Classification with Temporal Stabilization
 */

export const GESTURE_TYPES = Object.freeze({
  PEN: 'pen',           // 1 finger: Index extended -> Draw
  ERASER: 'eraser',     // 2 fingers: Index + Middle extended -> Erase
  PALETTE: 'palette',   // 3 fingers: Index + Middle + Ring extended -> Color palette
  NEUTRAL: 'neutral',   // 5 fingers: Open palm -> Pause / Safe state
  IDLE: 'idle',         // Closed fist -> Idle mode
  UNKNOWN: 'unknown'    // Transitional / ambiguous
});

export const GESTURE_INFO = Object.freeze({
  [GESTURE_TYPES.PEN]: {
    label: 'Drawing',
    sublabel: 'Pen Active',
    badge: '1 Finger',
    color: '#007AFF',
    icon: 'pen-tool'
  },
  [GESTURE_TYPES.ERASER]: {
    label: 'Erasing',
    sublabel: 'Eraser Active',
    badge: '2 Fingers',
    color: '#FF9500',
    icon: 'eraser'
  },
  [GESTURE_TYPES.PALETTE]: {
    label: 'Color Palette',
    sublabel: 'Swipe to Choose Color',
    badge: '3 Fingers',
    color: '#AF52DE',
    icon: 'palette'
  },
  [GESTURE_TYPES.NEUTRAL]: {
    label: 'Open Palm',
    sublabel: 'Drawing Paused',
    badge: '5 Fingers',
    color: '#34C759',
    icon: 'hand'
  },
  [GESTURE_TYPES.IDLE]: {
    label: 'Closed Fist',
    sublabel: 'Idle Mode',
    badge: 'Fist',
    color: '#8E8E93',
    icon: 'grip'
  },
  [GESTURE_TYPES.UNKNOWN]: {
    label: 'Adjusting Hand',
    sublabel: 'Aligning gesture...',
    badge: '...',
    color: '#636366',
    icon: 'sparkles'
  }
});

// Euclidean distance in 2D or 3D
export function distance(p1, p2, use3D = false) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  if (use3D && p1.z !== undefined && p2.z !== undefined) {
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return Math.sqrt(dx * dx + dy * dy);
}

// Vector angle in radians
export function angleBetweenVectors(v1, v2) {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cos);
}

export class GestureClassifier {
  constructor(options = {}) {
    this.stabilizationMs = options.stabilizationMs || 120; // 120ms debounce
    this.currentGesture = GESTURE_TYPES.IDLE;
    this.pendingGesture = GESTURE_TYPES.IDLE;
    this.pendingStartTime = 0;
    this.confidence = 0;
    this.history = [];
    this.maxHistory = 10;

    // Smoothed fingertip position for drawing cursor
    this.smoothedIndexTip = null;
    this.smoothedEraserCenter = null;
    this.smoothingAlpha = options.smoothingAlpha || 0.45; // Base EMA alpha
  }

  setSensitivity(level) {
    // level: 1 (fast/reactive) to 5 (extra stable/gentle)
    const map = {
      1: 80,
      2: 100,
      3: 130,
      4: 170,
      5: 220
    };
    this.stabilizationMs = map[level] || 130;
  }

  setSmoothing(level) {
    // level: 1 (responsive, light smoothing) to 5 (ultra smooth, high stabilization)
    const map = {
      1: 0.7,
      2: 0.55,
      3: 0.45,
      4: 0.35,
      5: 0.25
    };
    this.smoothingAlpha = map[level] || 0.45;
  }

  /**
   * Evaluates raw finger extension states from 21 MediaPipe landmarks
   * Landmarks:
   * 0: Wrist
   * 1-4: Thumb (CMC, MCP, IP, Tip)
   * 5-8: Index (MCP, PIP, DIP, Tip)
   * 9-12: Middle (MCP, PIP, DIP, Tip)
   * 13-16: Ring (MCP, PIP, DIP, Tip)
   * 17-20: Pinky (MCP, PIP, DIP, Tip)
   */
  classifyRawLandmarks(landmarks) {
    if (!landmarks || landmarks.length < 21) {
      return { gesture: GESTURE_TYPES.UNKNOWN, confidence: 0, fingerStates: null };
    }

    const wrist = landmarks[0];
    const middleMcp = landmarks[9];
    const palmLength = Math.max(distance(wrist, middleMcp), 0.001);

    // Helper to evaluate non-thumb fingers (Index: 5..8, Middle: 9..12, Ring: 13..16, Pinky: 17..20)
    const checkFinger = (mcpIdx, pipIdx, dipIdx, tipIdx) => {
      const mcp = landmarks[mcpIdx];
      const pip = landmarks[pipIdx];
      const dip = landmarks[dipIdx];
      const tip = landmarks[tipIdx];

      const wristToTip = distance(wrist, tip);
      const wristToPip = distance(wrist, pip);
      const mcpToTip = distance(mcp, tip);
      const mcpToPip = distance(mcp, pip);

      // Vector straightness check
      const v1 = { x: pip.x - mcp.x, y: pip.y - mcp.y };
      const v2 = { x: tip.x - dip.x, y: tip.y - dip.y };
      const bendAngle = angleBetweenVectors(v1, v2);

      // Extended: tip is farther from wrist than PIP is, MCP->Tip is longer than MCP->PIP, and not curled backwards
      const isExtended = (wristToTip > wristToPip * 1.05) &&
                         (mcpToTip > mcpToPip * 1.35) &&
                         (bendAngle < Math.PI * 0.45);

      // Curled: tip is close to palm/mcp
      const isCurled = (wristToTip < wristToPip * 1.0) || (mcpToTip < mcpToPip * 1.15);

      return { isExtended, isCurled, wristToTip, mcpToTip };
    };

    const indexState = checkFinger(5, 6, 7, 8);
    const middleState = checkFinger(9, 10, 11, 12);
    const ringState = checkFinger(13, 14, 15, 16);
    const pinkyState = checkFinger(17, 18, 19, 20);

    // Thumb check (Landmarks 1..4)
    const thumbTip = landmarks[4];
    const thumbMcp = landmarks[2];
    const thumbPip = landmarks[3];
    const pinkyMcp = landmarks[17];
    const indexMcp = landmarks[5];

    const thumbToPinkyDist = distance(thumbTip, pinkyMcp);
    const thumbToIndexMcp = distance(thumbTip, indexMcp);
    const thumbMcpToTip = distance(thumbMcp, thumbTip);

    // When thumb is tucked into palm, it's close to pinky MCP or index MCP
    // When extended outwards, thumb is stretched away from palm center
    const thumbExtended = (thumbToIndexMcp > palmLength * 0.55) && (thumbToPinkyDist > palmLength * 0.7);
    const thumbCurled = !thumbExtended;

    const fingerStates = {
      thumb: thumbExtended,
      index: indexState.isExtended,
      middle: middleState.isExtended,
      ring: ringState.isExtended,
      pinky: pinkyState.isExtended
    };

    const extendedCount = [
      indexState.isExtended,
      middleState.isExtended,
      ringState.isExtended,
      pinkyState.isExtended
    ].filter(Boolean).length;

    let gesture = GESTURE_TYPES.UNKNOWN;
    let confidence = 0.7;

    // 1. One finger: Index extended, Middle, Ring, Pinky curled
    if (indexState.isExtended && !middleState.isExtended && !ringState.isExtended && !pinkyState.isExtended) {
      gesture = GESTURE_TYPES.PEN;
      confidence = 0.95;
    }
    // 2. Two fingers: Index and Middle extended, Ring and Pinky curled
    else if (indexState.isExtended && middleState.isExtended && !ringState.isExtended && !pinkyState.isExtended) {
      // Check if index and middle are reasonably parallel
      const tipDist = distance(landmarks[8], landmarks[12]);
      if (tipDist < palmLength * 1.2) {
        gesture = GESTURE_TYPES.ERASER;
        confidence = 0.92;
      } else {
        gesture = GESTURE_TYPES.ERASER;
        confidence = 0.85;
      }
    }
    // 3. Three fingers: Index, Middle, Ring extended, Pinky curled
    else if (indexState.isExtended && middleState.isExtended && ringState.isExtended && !pinkyState.isExtended) {
      gesture = GESTURE_TYPES.PALETTE;
      confidence = 0.92;
    }
    // 4. Five fingers: Open Palm
    else if (thumbExtended && indexState.isExtended && middleState.isExtended && ringState.isExtended && pinkyState.isExtended) {
      gesture = GESTURE_TYPES.NEUTRAL;
      confidence = 0.96;
    }
    // Also accept 4 fingers extended without thumb as open palm if fingers are splayed
    else if (extendedCount === 4 && indexState.isExtended && middleState.isExtended && ringState.isExtended && pinkyState.isExtended) {
      gesture = GESTURE_TYPES.NEUTRAL;
      confidence = 0.88;
    }
    // 5. Closed fist: All fingers curled
    else if (extendedCount === 0) {
      gesture = GESTURE_TYPES.IDLE;
      confidence = 0.95;
    }
    else {
      gesture = GESTURE_TYPES.UNKNOWN;
      confidence = 0.5;
    }

    return { gesture, confidence, fingerStates, palmLength };
  }

  /**
   * Process incoming frame landmarks with temporal debouncing & adaptive EMA smoothing
   */
  update(landmarks, timestamp = performance.now()) {
    if (!landmarks || landmarks.length < 21) {
      this.currentGesture = GESTURE_TYPES.IDLE;
      this.pendingGesture = GESTURE_TYPES.IDLE;
      this.confidence = 0;
      this.smoothedIndexTip = null;
      this.smoothedEraserCenter = null;
      return {
        gesture: GESTURE_TYPES.IDLE,
        confidence: 0,
        stable: true,
        point: null,
        eraserPoint: null,
        rawFingerStates: null
      };
    }

    const { gesture: rawGesture, confidence, fingerStates } = this.classifyRawLandmarks(landmarks);

    // Temporal stabilization logic
    if (rawGesture === this.pendingGesture) {
      const elapsed = timestamp - this.pendingStartTime;
      if (elapsed >= this.stabilizationMs && this.currentGesture !== this.pendingGesture) {
        this.currentGesture = this.pendingGesture;
      }
    } else {
      this.pendingGesture = rawGesture;
      this.pendingStartTime = timestamp;
    }

    this.confidence = confidence;

    // Calculate smoothed fingertip coordinates (Landmark 8: Index Tip)
    const rawIndexTip = landmarks[8];
    if (rawIndexTip) {
      if (!this.smoothedIndexTip) {
        this.smoothedIndexTip = { x: rawIndexTip.x, y: rawIndexTip.y, z: rawIndexTip.z || 0 };
      } else {
        // Dynamic adaptive smoothing: faster movements get higher alpha to reduce latency
        const moveDist = distance(rawIndexTip, this.smoothedIndexTip);
        const dynamicAlpha = Math.min(0.9, Math.max(this.smoothingAlpha, moveDist * 6.0));

        this.smoothedIndexTip.x += dynamicAlpha * (rawIndexTip.x - this.smoothedIndexTip.x);
        this.smoothedIndexTip.y += dynamicAlpha * (rawIndexTip.y - this.smoothedIndexTip.y);
        this.smoothedIndexTip.z = (rawIndexTip.z !== undefined) ? rawIndexTip.z : 0;
      }
    }

    // Calculate eraser center (midpoint between index tip (8) and middle tip (12))
    const rawMiddleTip = landmarks[12];
    if (rawIndexTip && rawMiddleTip) {
      const midX = (rawIndexTip.x + rawMiddleTip.x) * 0.5;
      const midY = (rawIndexTip.y + rawMiddleTip.y) * 0.5;

      if (!this.smoothedEraserCenter) {
        this.smoothedEraserCenter = { x: midX, y: midY };
      } else {
        const moveDist = Math.hypot(midX - this.smoothedEraserCenter.x, midY - this.smoothedEraserCenter.y);
        const dynamicAlpha = Math.min(0.9, Math.max(this.smoothingAlpha, moveDist * 6.0));
        this.smoothedEraserCenter.x += dynamicAlpha * (midX - this.smoothedEraserCenter.x);
        this.smoothedEraserCenter.y += dynamicAlpha * (midY - this.smoothedEraserCenter.y);
      }
    }

    return {
      gesture: this.currentGesture,
      rawGesture,
      confidence: this.confidence,
      stable: this.currentGesture === this.pendingGesture,
      point: this.smoothedIndexTip ? { ...this.smoothedIndexTip } : null,
      eraserPoint: this.smoothedEraserCenter ? { ...this.smoothedEraserCenter } : null,
      rawFingerStates: fingerStates
    };
  }

  reset() {
    this.currentGesture = GESTURE_TYPES.IDLE;
    this.pendingGesture = GESTURE_TYPES.IDLE;
    this.pendingStartTime = 0;
    this.confidence = 0;
    this.smoothedIndexTip = null;
    this.smoothedEraserCenter = null;
  }
}
