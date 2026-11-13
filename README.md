# AIRPAINT — Real-Time AI Hand Gesture Drawing Studio

![AIRPAINT Banner](https://img.shields.io/badge/AIRPAINT-Vision%20Studio-007AFF?style=for-the-badge&logo=apple)
![License](https://img.shields.io/badge/License-MIT-34C759?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Production%20Ready-FF9500?style=for-the-badge)
![Build](https://img.shields.io/badge/Build-Passing-007AFF?style=for-the-badge)

> *"Your hands. Your imagination. No boundaries."*

**AIRPAINT** is a futuristic, browser-based digital art studio that turns your live webcam feed into an interactive canvas. By leveraging real-time 21-point hand tracking through Google MediaPipe Tasks Vision and HTML5 Canvas 2D Bézier curve rendering, AIRPAINT allows you to sketch, paint, erase, and select colors in mid-air using natural hand gestures.

The user interface draws inspiration from **macOS Sequoia** and **Apple Vision Pro**, featuring ultra-refined glassmorphism, translucent floating palettes, responsive micro-interactions, and instant visual feedback.

---

## 🖐️ Gesture Control System

AIRPAINT detects hand geometry, joint angles, and fingertip distances in real time with temporal stabilization and adaptive Exponential Moving Average (EMA) smoothing to eliminate accidental mode switches.

| Gesture | Mode | Description |
| :--- | :--- | :--- |
| ☝️ **1 Finger (Index Extended)** | **Pen / Draw Mode** | Tracks your index fingertip. Smoothly draws continuous strokes on the transparent canvas using quadratic Bézier interpolation. |
| ✌️ **2 Fingers (Index + Middle)** | **Eraser Mode** | Activates the circular eraser ring. Uses `destination-out` compositing to erase existing strokes beneath your fingers. |
| 🤟 **3 Fingers (Index + Middle + Ring)** | **Color Palette Mode** | Freezes drawing and displays a floating color palette. **Swipe your hand left or right horizontally** in mid-air to cycle through colors. |
| ✋ **5 Fingers (Open Palm)** | **Neutral / Pause Mode** | Pauses all drawing and erasing. Safe rest state allowing you to gesture or speak without marking the canvas. |
| ✊ **Closed Fist** | **Idle Mode** | Closes hand into a fist to keep the canvas untouched and ready. |

---

## ✨ Key Features

- **Layered Architecture**:
  - *Layer 1*: Live webcam feed with horizontal mirroring.
  - *Layer 2*: Transparent drawing canvas preserving raw digital artwork.
  - *Layer 3*: Dynamic overlay canvas for fingertip cursors, eraser rings, and optional hand skeletons.
  - *Layer 4*: Frosted glass UI controls and status HUDs.
- **Mid-Air 3-Finger Swiping Palette**:
  - Horizontal swipe gesture tracking with hysteresis and cooldown.
  - 14 curated studio colors (Pure White, Obsidian Black, Apple Red, Flame Orange, Radiant Yellow, Lime Green, Deep Emerald, Vibrant Cyan, Sky Blue, Royal Blue, Lavender Purple, Neon Pink, Magenta, Earth Brown).
  - Hybrid click selection support.
- **Stroke-Based History Engine**:
  - Non-destructive full Undo/Redo stack (`Ctrl+Z`, `Ctrl+Shift+Z`).
  - Clear canvas with safety confirmation dialog.
- **High-Resolution Export Options**:
  - **Transparent PNG**: Artwork-only transparent export.
  - **With Camera Background**: Composited live video frame and drawing.
  - **Studio White Background**: Clean white studio JPEG export.
  - **Obsidian Black Background**: Deep dark gallery JPEG export.
  - Confetti burst celebration on successful download.
- **Optional 21-Point Landmark Skeleton**:
  - Real-time visualization of hand joints and fingertip tracking vectors.
- **Performance & Battery Saver**:
  - Adaptive EMA smoothing for zero-lag responsiveness.
  - Eco Mode option for laptops (30 FPS AI inference with 60 FPS canvas rendering).

---

## 🛠️ Technology Stack

- **Computer Vision**: [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) (Hand Landmarker 21-point tracking)
- **Frontend / Bundler**: [Vite 5](https://vitejs.dev/) + Modern Vanilla ES Modules
- **Drawing Engine**: HTML5 Canvas 2D + `requestAnimationFrame` + Quadratic Bézier Curves
- **Icons**: [Lucide Icons](https://lucide.dev/)
- **Effects**: Canvas Confetti
- **Testing**: [Vitest](https://vitest.dev/) + Happy-DOM

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or 20+
- A modern desktop or laptop browser (Chrome, Edge, Safari, Firefox) with WebRTC and WebGL support
- A webcam / front-facing camera

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/wyzuk/airpaint.git
   cd airpaint
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

4. Run automated test suites:
   ```bash
   npm test
   ```

5. Build for production:
   ```bash
   npm run build
   ```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Z` / `⌘ + Z` | Undo last stroke |
| `Ctrl + Shift + Z` / `⌘ + Shift + Z` / `Ctrl + Y` | Redo undone stroke |
| `Ctrl + S` / `⌘ + S` | Quick Save / Export Artwork |
| `Escape` | Close modals and menus |

---

## 📂 Project Structure

```
airpaint/
├── public/
│   └── models/
│       └── hand_landmarker.task     # Local MediaPipe model weights
├── src/
│   ├── camera/
│   │   └── cameraController.js      # WebRTC stream, device enumeration, resolution
│   ├── vision/
│   │   ├── handTracker.js           # MediaPipe HandLandmarker wrapper
│   │   └── gestureClassifier.js     # 21-point landmark geometric classification & EMA
│   ├── drawing/
│   │   ├── drawingEngine.js         # Canvas 2D Bézier drawing & overlay rendering
│   │   └── strokeHistory.js         # Undo/Redo stroke state management
│   ├── palette/
│   │   └── paletteController.js     # 3-finger horizontal gesture swipe palette
│   ├── utils/
│   │   └── export.js                # Multi-format PNG/JPEG export & canvas compositing
│   ├── styles/
│   │   ├── global.css               # macOS / Vision Pro design tokens & glass primitives
│   │   ├── studio.css               # Layered studio stage, topbar, bottombar, left tools
│   │   └── components.css           # Modals, floating palette, welcome screen
│   └── app.js                       # Master application loop and UI coordinator
├── test/
│   ├── gestureClassifier.test.js    # Gesture geometry & temporal debounce tests
│   ├── drawingEngine.test.js        # Stroke history & undo/redo tests
│   ├── paletteController.test.js    # Color selection & swipe motion tests
│   └── export.test.js               # Export filename generation tests
├── index.html                       # HTML5 Studio entrypoint
├── vite.config.js                   # Vite configuration & Happy-DOM test setup
├── package.json
└── README.md
```

---

## 🛡️ Privacy & Performance

- **100% Local Execution**: All webcam processing, hand landmark estimation, and drawing logic occur entirely on your local machine using client-side WebAssembly / WebGL. No video, images, or landmark data are transmitted to any external server.
- **Aspect-Ratio & Mirroring**: Real-time mirroring ensures hand movement in the air aligns with what you see on the screen.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
