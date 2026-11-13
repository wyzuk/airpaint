/**
 * AIRPAINT - Canvas Drawing Engine
 * High-performance 2D Canvas drawing with Bézier interpolation and stroke history
 */

import { StrokeHistory } from './strokeHistory.js';

export class DrawingEngine {
  constructor(drawingCanvas, overlayCanvas, options = {}) {
    this.drawingCanvas = drawingCanvas;
    this.overlayCanvas = overlayCanvas;
    this.drawCtx = drawingCanvas.getContext('2d');
    this.overlayCtx = overlayCanvas.getContext('2d');

    this.currentColor = options.color || '#007AFF';
    this.brushSize = options.brushSize || 8;
    this.eraserSize = options.eraserSize || 36;
    this.isMirrored = options.isMirrored !== undefined ? options.isMirrored : true;

    this.history = new StrokeHistory({
      maxHistory: 100,
      onChange: options.onHistoryChange
    });

    this.currentStroke = null;
    this.activeTool = 'pen'; // 'pen' | 'eraser'
    this.width = drawingCanvas.width;
    this.height = drawingCanvas.height;

    // Minimum distance in pixels before adding a new stroke point (prevents point flooding)
    this.minDistanceThreshold = 3.0;
  }

  resize(width, height) {
    if (width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;

    // Save existing drawing content
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.drawingCanvas.width;
    tempCanvas.height = this.drawingCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCanvas.width > 0 && tempCanvas.height > 0) {
      tempCtx.drawImage(this.drawingCanvas, 0, 0);
    }

    this.drawingCanvas.width = width;
    this.drawingCanvas.height = height;
    this.overlayCanvas.width = width;
    this.overlayCanvas.height = height;

    // Replay stroke history to maintain exact scale
    this.redrawAll();
  }

  setMirrored(mirrored) {
    this.isMirrored = mirrored;
  }

  setColor(color) {
    this.currentColor = color;
  }

  getColor() {
    return this.currentColor;
  }

  setBrushSize(size) {
    this.brushSize = Math.max(1, Math.min(60, size));
  }

  getBrushSize() {
    return this.brushSize;
  }

  setEraserSize(size) {
    this.eraserSize = Math.max(5, Math.min(120, size));
  }

  getEraserSize() {
    return this.eraserSize;
  }

  setTool(tool) {
    if (tool !== this.activeTool) {
      this.endStroke();
      this.activeTool = tool;
    }
  }

  /**
   * Converts normalized [0, 1] landmark coordinates into canvas pixel coordinates
   */
  mapCoordinates(normalizedPoint) {
    if (!normalizedPoint) return null;
    const x = this.isMirrored ? (1 - normalizedPoint.x) * this.width : normalizedPoint.x * this.width;
    const y = normalizedPoint.y * this.height;
    return { x, y, timestamp: performance.now() };
  }

  /**
   * Start a new stroke at given canvas coordinates
   */
  startStroke(point, tool = this.activeTool) {
    if (!point) return;
    this.endStroke();

    const isEraser = tool === 'eraser';
    this.currentStroke = {
      id: 'stroke_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type: isEraser ? 'eraser' : 'pen',
      color: this.currentColor,
      size: isEraser ? this.eraserSize : this.brushSize,
      points: [point],
      timestamp: Date.now()
    };

    const ctx = this.drawCtx;
    ctx.save();
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(point.x, point.y, this.eraserSize * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.fillStyle = this.currentColor;
      ctx.beginPath();
      ctx.arc(point.x, point.y, this.brushSize * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Append a point to current stroke and draw a smooth Bézier segment
   */
  continueStroke(point) {
    if (!this.currentStroke || !point) {
      this.startStroke(point);
      return;
    }

    const pts = this.currentStroke.points;
    const lastPt = pts[pts.length - 1];

    // Distance threshold check
    const dist = Math.hypot(point.x - lastPt.x, point.y - lastPt.y);
    if (dist < this.minDistanceThreshold) return;

    pts.push(point);

    const ctx = this.drawCtx;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const isEraser = this.currentStroke.type === 'eraser';
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = this.currentStroke.size;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = this.currentStroke.color;
      ctx.lineWidth = this.currentStroke.size;
    }

    if (pts.length === 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
    } else {
      const p0 = pts[pts.length - 3];
      const p1 = pts[pts.length - 2];
      const p2 = pts[pts.length - 1];

      const mid1 = { x: (p0.x + p1.x) * 0.5, y: (p0.y + p1.y) * 0.5 };
      const mid2 = { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 };

      ctx.beginPath();
      ctx.moveTo(mid1.x, mid1.y);
      ctx.quadraticCurveTo(p1.x, p1.y, mid2.x, mid2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Cleanly finish the current stroke and commit it to stroke history
   */
  endStroke() {
    if (!this.currentStroke) return;
    if (this.currentStroke.points.length > 0) {
      this.history.addStroke(this.currentStroke);
    }
    this.currentStroke = null;
  }

  undo() {
    this.endStroke();
    const undone = this.history.undo();
    if (undone) {
      this.redrawAll();
    }
    return undone;
  }

  redo() {
    this.endStroke();
    const redone = this.history.redo();
    if (redone) {
      this.redrawAll();
    }
    return redone;
  }

  clear() {
    this.endStroke();
    this.history.clear();
    this.redrawAll();
  }

  /**
   * Re-renders all strokes from scratch on the drawing canvas
   */
  redrawAll() {
    const ctx = this.drawCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    const strokes = this.history.getStrokes();
    for (const stroke of strokes) {
      this.renderSingleStroke(ctx, stroke);
    }
  }

  renderSingleStroke(ctx, stroke) {
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const isEraser = stroke.type === 'eraser';
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = '#000000';
      ctx.lineWidth = stroke.size;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.size;
    }

    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, stroke.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (pts.length === 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) * 0.5;
      const midY = (pts[i].y + pts[i + 1].y) * 0.5;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }

    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Clears overlay canvas and renders visual cursor / guides
   */
  renderOverlay({ cursorPoint, gesture, isEraser, showSkeleton, landmarks, canvasBounds }) {
    const ctx = this.overlayCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Optional skeleton rendering
    if (showSkeleton && landmarks && landmarks.length >= 21) {
      this.renderSkeleton(ctx, landmarks);
    }

    if (!cursorPoint) return;

    ctx.save();
    if (isEraser) {
      // Elegant Apple-style frosted eraser ring
      const radius = this.eraserSize * 0.5;
      ctx.beginPath();
      ctx.arc(cursorPoint.x, cursorPoint.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 149, 0, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cursorPoint.x, cursorPoint.y, radius - 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.0;
      ctx.stroke();

      // Eraser center dot
      ctx.beginPath();
      ctx.arc(cursorPoint.x, cursorPoint.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#FF9500';
      ctx.fill();
    } else {
      // Pen cursor: pulsing glass circle matching current brush size and color
      const radius = Math.max(this.brushSize * 0.5, 4);

      // Outer glow ring
      ctx.beginPath();
      ctx.arc(cursorPoint.x, cursorPoint.y, radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Active brush core
      ctx.beginPath();
      ctx.arc(cursorPoint.x, cursorPoint.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = this.currentColor;
      ctx.fill();

      // Center precision point
      ctx.beginPath();
      ctx.arc(cursorPoint.x, cursorPoint.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * MediaPipe Hand Landmark Connections Visualizer
   */
  renderSkeleton(ctx, landmarks) {
    const connections = [
      // Thumb
      [0, 1], [1, 2], [2, 3], [3, 4],
      // Index
      [0, 5], [5, 6], [6, 7], [7, 8],
      // Middle
      [0, 9], [9, 10], [10, 11], [11, 12],
      // Ring
      [0, 13], [13, 14], [14, 15], [15, 16],
      // Pinky
      [0, 17], [17, 18], [18, 19], [19, 20],
      // Palm base
      [5, 9], [9, 13], [13, 17]
    ];

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2.0;

    for (const [i, j] of connections) {
      const p1 = this.mapCoordinates(landmarks[i]);
      const p2 = this.mapCoordinates(landmarks[j]);
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    // Draw joints
    for (let i = 0; i < landmarks.length; i++) {
      const p = this.mapCoordinates(landmarks[i]);
      if (!p) continue;
      const isTip = [4, 8, 12, 16, 20].includes(i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, isTip ? 4.5 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? '#007AFF' : 'rgba(255, 255, 255, 0.8)';
      ctx.fill();
    }
    ctx.restore();
  }
}
