/**
 * AIRPAINT - Camera Controller
 * Manages webcam streams, resolution switching, device enumeration, and error handling
 */

export class CameraController {
  constructor(videoElement, options = {}) {
    this.video = videoElement;
    this.stream = null;
    this.currentDeviceId = options.deviceId || null;
    this.resolution = options.resolution || '720p'; // '720p', '1080p', '480p'
    this.isMirrored = options.isMirrored !== undefined ? options.isMirrored : true;
    this.onStatusChange = options.onStatusChange || null;
    this.devices = [];
    this.isConnected = false;
  }

  getResolutionConstraints() {
    switch (this.resolution) {
      case '1080p':
        return { width: { ideal: 1920 }, height: { ideal: 1080 } };
      case '480p':
        return { width: { ideal: 640 }, height: { ideal: 480 } };
      case '720p':
      default:
        return { width: { ideal: 1280 }, height: { ideal: 720 } };
    }
  }

  async enumerateCameras() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      this.devices = allDevices
        .filter(device => device.kind === 'videoinput')
        .map((device, idx) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${idx + 1}`
        }));
      return this.devices;
    } catch (err) {
      console.warn('Failed to enumerate cameras:', err);
      return [];
    }
  }

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errorMsg = 'Your browser does not support webcam video capture.';
      this._notifyStatus(false, errorMsg);
      throw new Error(errorMsg);
    }

    this.stop();

    const resolution = this.getResolutionConstraints();
    const videoConstraints = {
      ...resolution,
      facingMode: 'user'
    };

    if (this.currentDeviceId) {
      videoConstraints.deviceId = { exact: this.currentDeviceId };
      delete videoConstraints.facingMode;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });

      this.video.srcObject = this.stream;
      this.video.setAttribute('playsinline', 'true');
      this.video.muted = true;

      await new Promise((resolve, reject) => {
        this.video.onloadedmetadata = () => {
          this.video.play()
            .then(resolve)
            .catch(reject);
        };
        this.video.onerror = (e) => reject(new Error('Video element error: ' + e));
      });

      this.isConnected = true;
      await this.enumerateCameras();

      // Track active device ID
      const videoTrack = this.stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        if (settings.deviceId) {
          this.currentDeviceId = settings.deviceId;
        }
      }

      this._notifyStatus(true, null);
      return {
        width: this.video.videoWidth,
        height: this.video.videoHeight
      };
    } catch (err) {
      this.isConnected = false;
      let friendlyError = 'Failed to access camera.';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        friendlyError = 'Camera permission denied. Please allow camera access in your browser settings to use AIRPAINT.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        friendlyError = 'No webcam found. Please connect a camera and refresh.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        friendlyError = 'Camera is currently in use by another application.';
      } else if (err.name === 'OverconstrainedError') {
        // Fallback to basic constraints if resolution was too demanding
        if (this.resolution !== '480p') {
          console.warn('Resolution overconstrained, falling back to basic 480p');
          this.resolution = '480p';
          return this.start();
        }
        friendlyError = 'The requested camera resolution is not supported by your device.';
      }

      this._notifyStatus(false, friendlyError);
      throw new Error(friendlyError);
    }
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    this.isConnected = false;
    this._notifyStatus(false, null);
  }

  async switchCamera(deviceId) {
    this.currentDeviceId = deviceId;
    return await this.start();
  }

  async switchResolution(resolution) {
    this.resolution = resolution;
    if (this.isConnected) {
      return await this.start();
    }
  }

  setMirrored(mirrored) {
    this.isMirrored = mirrored;
    if (this.video) {
      this.video.style.transform = mirrored ? 'scaleX(-1)' : 'none';
    }
  }

  _notifyStatus(connected, error) {
    if (typeof this.onStatusChange === 'function') {
      this.onStatusChange({
        connected,
        currentDeviceId: this.currentDeviceId,
        devices: this.devices,
        error
      });
    }
  }
}
