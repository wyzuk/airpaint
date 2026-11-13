/**
 * AIRPAINT - Master Application Coordinator
 * Real-Time AI Hand Gesture Drawing Studio
 */

import {
  createIcons,
  Sparkles,
  ArrowRight,
  Wand2,
  HelpCircle,
  Settings,
  Maximize,
  Minimize,
  PenTool,
  Eraser,
  Undo,
  Redo,
  Trash2,
  Scan,
  Paintbrush,
  Download,
  ChevronUp,
  FileImage,
  Camera,
  Square,
  Moon,
  X
} from 'lucide';

import { CameraController } from './camera/cameraController.js';
import { HandTracker } from './vision/handTracker.js';
import { GestureClassifier, GESTURE_TYPES, GESTURE_INFO } from './vision/gestureClassifier.js';
import { DrawingEngine } from './drawing/drawingEngine.js';
import { PaletteController, PALETTE_COLORS } from './palette/paletteController.js';
import { exportArtwork } from './utils/export.js';

class AirPaintApp {
  constructor() {
    this.videoElement = document.getElementById('camera-video');
    this.drawingCanvas = document.getElementById('drawing-canvas');
    this.overlayCanvas = document.getElementById('overlay-canvas');
    this.stageElement = document.getElementById('studio-stage');

    this.isStudioActive = false;
    this.showSkeleton = false;
    this.isMirrored = true;
    this.currentTool = 'pen';
    this.lastRecognizedGesture = GESTURE_TYPES.IDLE;

    // Performance monitoring
    this.fpsCounterEl = document.getElementById('fps-counter');
    this.frameCount = 0;
    this.lastFpsUpdateTime = performance.now();
    this.currentFps = 60;

    this.initLucideIcons();
    this.initComponents();
    this.setupEventListeners();
  }

  initLucideIcons() {
    createIcons({
      icons: {
        Sparkles,
        ArrowRight,
        Wand2,
        HelpCircle,
        Settings,
        Maximize,
        Minimize,
        PenTool,
        Eraser,
        Undo,
        Redo,
        Trash2,
        Scan,
        Paintbrush,
        Download,
        ChevronUp,
        FileImage,
        Camera,
        Square,
        Moon,
        X
      }
    });
  }

  initComponents() {
    // 1. Gesture Classifier
    this.gestureClassifier = new GestureClassifier({
      stabilizationMs: 120,
      smoothingAlpha: 0.45
    });

    // 2. Camera Controller
    this.cameraController = new CameraController(this.videoElement, {
      resolution: '720p',
      isMirrored: this.isMirrored,
      onStatusChange: (status) => this.onCameraStatusChange(status)
    });

    // 3. Hand Tracker
    this.handTracker = new HandTracker({
      onStatusChange: (status) => this.onTrackerStatusChange(status)
    });

    // 4. Drawing Engine
    this.drawingEngine = new DrawingEngine(this.drawingCanvas, this.overlayCanvas, {
      color: '#007AFF',
      brushSize: 8,
      eraserSize: 36,
      isMirrored: this.isMirrored,
      onHistoryChange: (state) => this.onHistoryChange(state)
    });

    // 5. Palette Controller
    const paletteContainer = document.getElementById('floating-palette-container');
    this.paletteController = new PaletteController(paletteContainer, {
      initialIndex: 9, // Royal Blue
      onColorChange: (colorObj) => this.onColorSelected(colorObj)
    });

    // 6. Quick Swatches in bottom bar
    this.renderQuickSwatches();

    // 7. Initial canvas resize
    this.handleResize();
  }

  renderQuickSwatches() {
    const swatchesContainer = document.getElementById('quick-swatches');
    if (!swatchesContainer) return;

    // 7 representative colors for quick direct clicking
    const quickColors = [
      PALETTE_COLORS[0], // White
      PALETTE_COLORS[1], // Black
      PALETTE_COLORS[2], // Red
      PALETTE_COLORS[4], // Yellow
      PALETTE_COLORS[5], // Green
      PALETTE_COLORS[9], // Royal Blue
      PALETTE_COLORS[11] // Pink
    ];

    swatchesContainer.innerHTML = quickColors.map((c, i) => `
      <button
        class="swatch-circle ${c.hex === '#007AFF' ? 'selected' : ''}"
        data-hex="${c.hex}"
        title="${c.name}"
        style="background-color: ${c.hex};"
        aria-label="${c.name}"
      ></button>
    `).join('');

    swatchesContainer.querySelectorAll('.swatch-circle').forEach(btn => {
      btn.addEventListener('click', () => {
        const hex = btn.getAttribute('data-hex');
        this.paletteController.selectColorHex(hex);
      });
    });
  }

  setupEventListeners() {
    // Window Resize
    window.addEventListener('resize', () => this.handleResize());

    // Welcome Screen CTA
    const btnStart = document.getElementById('btn-start-drawing');
    if (btnStart) {
      btnStart.addEventListener('click', () => this.startStudioSession());
    }

    // Left Toolbar Tools
    const btnPen = document.getElementById('tool-pen');
    const btnEraser = document.getElementById('tool-eraser');
    const btnUndo = document.getElementById('tool-undo');
    const btnRedo = document.getElementById('tool-redo');
    const btnClear = document.getElementById('tool-clear');
    const btnSkeleton = document.getElementById('tool-skeleton');

    btnPen?.addEventListener('click', () => this.selectTool('pen'));
    btnEraser?.addEventListener('click', () => this.selectTool('eraser'));
    btnUndo?.addEventListener('click', () => this.drawingEngine.undo());
    btnRedo?.addEventListener('click', () => this.drawingEngine.redo());
    btnClear?.addEventListener('click', () => this.openClearModal());
    btnSkeleton?.addEventListener('click', () => this.toggleSkeleton());

    // Clear confirmation modal buttons
    const btnCancelClear = document.getElementById('btn-cancel-clear');
    const btnConfirmClear = document.getElementById('btn-confirm-clear');
    btnCancelClear?.addEventListener('click', () => this.closeClearModal());
    btnConfirmClear?.addEventListener('click', () => {
      this.drawingEngine.clear();
      this.closeClearModal();
    });

    // Sliders
    const brushSlider = document.getElementById('brush-size-slider');
    const brushValue = document.getElementById('brush-size-value');
    brushSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.drawingEngine.setBrushSize(val);
      if (brushValue) brushValue.textContent = `${val}px`;
    });

    const eraserSlider = document.getElementById('eraser-size-slider');
    const eraserValue = document.getElementById('eraser-size-value');
    eraserSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.drawingEngine.setEraserSize(val);
      if (eraserValue) eraserValue.textContent = `${val}px`;
    });

    // Top Bar Modals
    const btnGuide = document.getElementById('btn-guide-modal');
    const btnCloseGuide = document.getElementById('btn-close-guide');
    const modalGuide = document.getElementById('modal-guide');
    btnGuide?.addEventListener('click', () => modalGuide?.classList.add('active'));
    btnCloseGuide?.addEventListener('click', () => modalGuide?.classList.remove('active'));

    const btnSettings = document.getElementById('btn-settings-modal');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const modalSettings = document.getElementById('modal-settings');
    btnSettings?.addEventListener('click', () => modalSettings?.classList.add('active'));
    btnCloseSettings?.addEventListener('click', () => modalSettings?.classList.remove('active'));

    // Fullscreen Toggle
    const btnFullscreen = document.getElementById('btn-toggle-fullscreen');
    btnFullscreen?.addEventListener('click', () => this.toggleFullscreen());

    // Export Dropdown
    const btnExportToggle = document.getElementById('btn-export-toggle');
    const exportMenu = document.getElementById('export-menu');
    btnExportToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      exportMenu?.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!exportMenu?.contains(e.target) && e.target !== btnExportToggle) {
        exportMenu?.classList.remove('show');
      }
    });

    // Export Options
    const exportItems = document.querySelectorAll('.export-menu-item');
    exportItems.forEach(item => {
      item.addEventListener('click', async () => {
        const mode = item.getAttribute('data-mode');
        exportMenu?.classList.remove('show');
        try {
          await exportArtwork(this.drawingCanvas, this.videoElement, mode, this.isMirrored);
        } catch (err) {
          alert('Failed to export artwork: ' + err.message);
        }
      });
    });

    // Settings Controls
    const settingCamera = document.getElementById('setting-camera-device');
    settingCamera?.addEventListener('change', async (e) => {
      if (e.target.value) {
        await this.cameraController.switchCamera(e.target.value);
      }
    });

    const settingRes = document.getElementById('setting-resolution');
    settingRes?.addEventListener('change', async (e) => {
      await this.cameraController.switchResolution(e.target.value);
      this.handleResize();
    });

    const settingMirror = document.getElementById('setting-mirror');
    settingMirror?.addEventListener('change', (e) => {
      this.isMirrored = e.target.checked;
      this.cameraController.setMirrored(this.isMirrored);
      this.drawingEngine.setMirrored(this.isMirrored);
    });

    const settingSkeleton = document.getElementById('setting-skeleton');
    settingSkeleton?.addEventListener('change', (e) => {
      this.showSkeleton = e.target.checked;
      document.getElementById('tool-skeleton')?.classList.toggle('active', this.showSkeleton);
    });

    const settingSensitivity = document.getElementById('setting-sensitivity');
    settingSensitivity?.addEventListener('input', (e) => {
      this.gestureClassifier.setSensitivity(parseInt(e.target.value, 10));
    });

    const settingSmoothing = document.getElementById('setting-smoothing');
    settingSmoothing?.addEventListener('input', (e) => {
      this.gestureClassifier.setSmoothing(parseInt(e.target.value, 10));
    });

    const settingEco = document.getElementById('setting-eco');
    settingEco?.addEventListener('change', (e) => {
      this.handTracker.setPerformanceMode(e.target.checked);
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

    // Hybrid Mouse Drawing Fallback
    this.setupMouseDrawingFallback();
  }

  setupMouseDrawingFallback() {
    let isMouseDown = false;

    const getCanvasPos = (e) => {
      const rect = this.drawingCanvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (this.drawingCanvas.width / rect.width),
        y: (e.clientY - rect.top) * (this.drawingCanvas.height / rect.height)
      };
    };

    this.drawingCanvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isMouseDown = true;
      const pt = getCanvasPos(e);
      this.drawingEngine.startStroke(pt, this.currentTool);
    });

    window.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      const pt = getCanvasPos(e);
      this.drawingEngine.continueStroke(pt);
    });

    window.addEventListener('mouseup', () => {
      if (isMouseDown) {
        isMouseDown = false;
        this.drawingEngine.endStroke();
      }
    });
  }

  handleKeyboardShortcuts(e) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (modifier && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        this.drawingEngine.redo();
      } else {
        this.drawingEngine.undo();
      }
    } else if (modifier && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.drawingEngine.redo();
    } else if (modifier && e.key.toLowerCase() === 's') {
      e.preventDefault();
      exportArtwork(this.drawingCanvas, this.videoElement, 'transparent-png', this.isMirrored);
    } else if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      document.getElementById('export-menu')?.classList.remove('show');
      this.paletteController.close();
    }
  }

  async startStudioSession() {
    const btnStart = document.getElementById('btn-start-drawing');
    const originalText = btnStart.innerHTML;
    btnStart.disabled = true;
    btnStart.innerHTML = `<span>Starting Camera & AI Vision...</span>`;

    try {
      // 1. Initialize Camera
      await this.cameraController.start();

      // 2. Initialize MediaPipe HandLandmarker
      await this.handTracker.initialize();

      // 3. Populate Camera List in Settings
      const select = document.getElementById('setting-camera-device');
      if (select && this.cameraController.devices.length > 0) {
        select.innerHTML = this.cameraController.devices.map(d => `
          <option value="${d.deviceId}" ${d.deviceId === this.cameraController.currentDeviceId ? 'selected' : ''}>
            ${d.label}
          </option>
        `).join('');
      }

      // 4. Smooth Transition
      this.handleResize();
      const welcomeScreen = document.getElementById('welcome-screen');
      welcomeScreen.classList.add('hidden');
      this.isStudioActive = true;

      // 5. Start main loop
      requestAnimationFrame((t) => this.mainLoop(t));
    } catch (err) {
      console.error('Studio startup error:', err);
      alert(err.message || 'Could not start AIRPAINT studio. Please check camera permissions.');
      btnStart.disabled = false;
      btnStart.innerHTML = originalText;
    }
  }

  mainLoop(timestamp) {
    if (!this.isStudioActive) return;

    // FPS calculation
    this.frameCount++;
    if (timestamp - this.lastFpsUpdateTime >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (timestamp - this.lastFpsUpdateTime));
      if (this.fpsCounterEl) {
        this.fpsCounterEl.textContent = `${this.currentFps} FPS`;
      }
      this.frameCount = 0;
      this.lastFpsUpdateTime = timestamp;
    }

    // Process Hand Tracking frame
    const detection = this.handTracker.processVideoFrame(this.videoElement, timestamp);

    if (detection && detection.detected && detection.landmarks) {
      // Classify gesture
      const gestureResult = this.gestureClassifier.update(detection.landmarks, timestamp);
      this.processGesture(gestureResult, detection.landmarks, timestamp);
    } else {
      // No hand detected
      this.gestureClassifier.reset();
      this.updateGestureUI(GESTURE_TYPES.UNKNOWN, 'No Hand Detected', '#8E8E93', 'No Hand');
      this.drawingEngine.endStroke();
      this.paletteController.close();
      this.drawingEngine.renderOverlay({ cursorPoint: null, showSkeleton: false });
    }

    requestAnimationFrame((t) => this.mainLoop(t));
  }

  processGesture(gestureResult, landmarks, timestamp) {
    const { gesture, point, eraserPoint, confidence } = gestureResult;
    const info = GESTURE_INFO[gesture] || GESTURE_INFO[GESTURE_TYPES.UNKNOWN];

    this.updateGestureUI(gesture, info.label, info.color, info.badge);

    // Coordinate mapping to canvas pixels
    let mappedPoint = null;
    if (gesture === GESTURE_TYPES.ERASER) {
      mappedPoint = this.drawingEngine.mapCoordinates(eraserPoint || point);
    } else {
      mappedPoint = this.drawingEngine.mapCoordinates(point);
    }

    // Gesture State Machine Dispatch
    switch (gesture) {
      case GESTURE_TYPES.PEN: {
        this.paletteController.close();
        if (this.lastRecognizedGesture !== GESTURE_TYPES.PEN) {
          this.drawingEngine.startStroke(mappedPoint, 'pen');
        } else {
          this.drawingEngine.continueStroke(mappedPoint);
        }

        this.drawingEngine.renderOverlay({
          cursorPoint: mappedPoint,
          gesture,
          isEraser: false,
          showSkeleton: this.showSkeleton,
          landmarks
        });
        break;
      }

      case GESTURE_TYPES.ERASER: {
        this.paletteController.close();
        if (this.lastRecognizedGesture !== GESTURE_TYPES.ERASER) {
          this.drawingEngine.startStroke(mappedPoint, 'eraser');
        } else {
          this.drawingEngine.continueStroke(mappedPoint);
        }

        this.drawingEngine.renderOverlay({
          cursorPoint: mappedPoint,
          gesture,
          isEraser: true,
          showSkeleton: this.showSkeleton,
          landmarks
        });
        break;
      }

      case GESTURE_TYPES.PALETTE: {
        this.drawingEngine.endStroke();
        this.paletteController.open();

        // Feed horizontal index fingertip motion to navigate swatches
        if (point) {
          this.paletteController.handleGestureMotion(point, this.isMirrored, timestamp);
        }

        this.drawingEngine.renderOverlay({
          cursorPoint: mappedPoint,
          gesture,
          isEraser: false,
          showSkeleton: this.showSkeleton,
          landmarks
        });
        break;
      }

      case GESTURE_TYPES.NEUTRAL: {
        // 5-finger open palm: safe pause
        this.drawingEngine.endStroke();
        this.paletteController.close();
        this.drawingEngine.renderOverlay({
          cursorPoint: null,
          gesture,
          isEraser: false,
          showSkeleton: this.showSkeleton,
          landmarks
        });
        break;
      }

      case GESTURE_TYPES.IDLE:
      case GESTURE_TYPES.UNKNOWN:
      default: {
        this.drawingEngine.endStroke();
        this.drawingEngine.renderOverlay({
          cursorPoint: null,
          gesture,
          isEraser: false,
          showSkeleton: this.showSkeleton,
          landmarks
        });
        break;
      }
    }

    this.lastRecognizedGesture = gesture;
  }

  updateGestureUI(gesture, labelText, color, badgeText) {
    const indicatorDot = document.getElementById('gesture-indicator-dot');
    const labelEl = document.getElementById('gesture-label-text');
    const badgeEl = document.getElementById('gesture-badge-text');

    if (indicatorDot) {
      indicatorDot.style.backgroundColor = color;
      indicatorDot.style.boxShadow = `0 0 10px ${color}`;
    }
    if (labelEl) labelEl.textContent = labelText;
    if (badgeEl) badgeEl.textContent = badgeText;
  }

  onColorSelected(colorObj) {
    this.drawingEngine.setColor(colorObj.hex);

    // Update bottombar active preview circle
    const preview = document.getElementById('active-color-preview');
    if (preview) {
      preview.style.backgroundColor = colorObj.hex;
      preview.setAttribute('title', colorObj.name);
    }

    // Update quick swatches selection
    const swatches = document.querySelectorAll('.swatch-circle');
    swatches.forEach(s => {
      if (s.getAttribute('data-hex').toLowerCase() === colorObj.hex.toLowerCase()) {
        s.classList.add('selected');
      } else {
        s.classList.remove('selected');
      }
    });
  }

  selectTool(tool) {
    this.currentTool = tool;
    this.drawingEngine.setTool(tool);

    document.getElementById('tool-pen')?.classList.toggle('active', tool === 'pen');
    document.getElementById('tool-eraser')?.classList.toggle('active', tool === 'eraser');
  }

  toggleSkeleton() {
    this.showSkeleton = !this.showSkeleton;
    document.getElementById('tool-skeleton')?.classList.toggle('active', this.showSkeleton);
    const settingCheckbox = document.getElementById('setting-skeleton');
    if (settingCheckbox) settingCheckbox.checked = this.showSkeleton;
  }

  onHistoryChange({ canUndo, canRedo }) {
    const btnUndo = document.getElementById('tool-undo');
    const btnRedo = document.getElementById('tool-redo');

    if (btnUndo) btnUndo.disabled = !canUndo;
    if (btnRedo) btnRedo.disabled = !canRedo;
  }

  onCameraStatusChange({ connected, error }) {
    const statusText = document.getElementById('camera-status-text');
    if (statusText) {
      statusText.textContent = connected ? 'Camera Active' : (error || 'Camera Offline');
    }
  }

  onTrackerStatusChange({ status, message }) {
    console.log(`[HandTracker] ${status}: ${message}`);
  }

  openClearModal() {
    document.getElementById('modal-clear-confirm')?.classList.add('active');
  }

  closeClearModal() {
    document.getElementById('modal-clear-confirm')?.classList.remove('active');
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.warn(err));
    } else {
      document.exitFullscreen().catch(err => console.warn(err));
    }
  }

  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (this.drawingEngine) {
      this.drawingEngine.resize(width, height);
    }
  }
}

// Instantiate application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.airPaintApp = new AirPaintApp();
});
