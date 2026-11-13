/**
 * AIRPAINT - Hand Tracker
 * Integrates MediaPipe HandLandmarker with robust error recovery & performance scaling
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const LOCAL_MODEL_PATH = '/models/hand_landmarker.task';
const CDN_MODEL_PATH = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const CDN_WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';

export class HandTracker {
  constructor(options = {}) {
    this.handLandmarker = null;
    this.isInitializing = false;
    this.isReady = false;
    this.lastVideoTime = -1;
    this.lastInferenceTimestamp = 0;
    this.onHandDetected = options.onHandDetected || null;
    this.onStatusChange = options.onStatusChange || null;

    // Performance settings
    this.minInferenceIntervalMs = 0; // 0 = process every frame; in eco mode ~33ms (30 FPS)
    this.useGpu = true;
  }

  setPerformanceMode(isLowPerformance) {
    // In low performance / eco mode, throttle inference to ~30 FPS to save CPU/battery on laptops
    this.minInferenceIntervalMs = isLowPerformance ? 33 : 0;
  }

  async initialize() {
    if (this.isReady) return true;
    if (this.isInitializing) return;
    this.isInitializing = true;

    this._notifyStatus('loading', 'Initializing MediaPipe AI Vision...');

    try {
      // 1. Initialize FilesetResolver with CDN/local fallback
      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks('/wasm');
      } catch (err) {
        console.warn('Local wasm failed, falling back to CDN wasm:', err);
        vision = await FilesetResolver.forVisionTasks(CDN_WASM_PATH);
      }

      // 2. Initialize HandLandmarker with GPU first, fallback to CPU
      try {
        this.handLandmarker = await this._createLandmarker(vision, LOCAL_MODEL_PATH, 'GPU');
      } catch (gpuErr) {
        console.warn('GPU hand landmarker initialization failed, retrying with CPU or CDN model:', gpuErr);
        try {
          this.handLandmarker = await this._createLandmarker(vision, LOCAL_MODEL_PATH, 'CPU');
        } catch (localCpuErr) {
          console.warn('Local model failed, fetching from CDN model path:', localCpuErr);
          this.handLandmarker = await this._createLandmarker(vision, CDN_MODEL_PATH, 'CPU');
        }
      }

      this.isReady = true;
      this.isInitializing = false;
      this._notifyStatus('ready', 'Hand Tracking Model Ready');
      return true;
    } catch (err) {
      this.isReady = false;
      this.isInitializing = false;
      const errorMsg = 'Failed to load hand tracking model: ' + (err.message || err);
      console.error(errorMsg, err);
      this._notifyStatus('error', errorMsg);
      throw new Error(errorMsg);
    }
  }

  async _createLandmarker(vision, modelPath, delegate = 'GPU') {
    return await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath,
        delegate: delegate
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6
    });
  }

  /**
   * Process a live video frame
   */
  processVideoFrame(videoElement, timestamp = performance.now()) {
    if (!this.isReady || !this.handLandmarker || !videoElement) {
      return null;
    }

    // Video must have valid dimensions and playback state
    if (videoElement.readyState < 2 || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      return null;
    }

    // Inference throttling for low-power mode
    if (this.minInferenceIntervalMs > 0 && (timestamp - this.lastInferenceTimestamp) < this.minInferenceIntervalMs) {
      return null;
    }

    // MediaPipe requires strictly increasing timestamps
    const currentVideoTime = videoElement.currentTime;
    if (currentVideoTime === this.lastVideoTime) {
      return null;
    }
    this.lastVideoTime = currentVideoTime;
    this.lastInferenceTimestamp = timestamp;

    try {
      const results = this.handLandmarker.detectForVideo(videoElement, timestamp);

      if (results && results.landmarks && results.landmarks.length > 0) {
        const handLandmarks = results.landmarks[0]; // Primary hand
        const handedness = results.handednesses && results.handednesses[0] ? results.handednesses[0][0] : null;

        if (typeof this.onHandDetected === 'function') {
          this.onHandDetected({
            landmarks: handLandmarks,
            handedness: handedness ? handedness.categoryName : 'Right',
            score: handedness ? handedness.score : 0.9,
            timestamp
          });
        }

        return {
          detected: true,
          landmarks: handLandmarks,
          handedness,
          timestamp
        };
      } else {
        if (typeof this.onHandDetected === 'function') {
          this.onHandDetected({
            landmarks: null,
            handedness: null,
            score: 0,
            timestamp
          });
        }

        return {
          detected: false,
          landmarks: null,
          timestamp
        };
      }
    } catch (err) {
      console.warn('Error during frame hand detection:', err);
      return null;
    }
  }

  _notifyStatus(status, message) {
    if (typeof this.onStatusChange === 'function') {
      this.onStatusChange({ status, message });
    }
  }

  destroy() {
    if (this.handLandmarker) {
      try {
        this.handLandmarker.close();
      } catch (e) {}
      this.handLandmarker = null;
    }
    this.isReady = false;
  }
}
