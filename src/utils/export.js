/**
 * AIRPAINT - Export & Artwork Saver
 * High-resolution canvas compositing and file downloader
 */

import confetti from 'canvas-confetti';

export function generateFilename(format = 'png', suffix = '') {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');

  const base = `AIRPAINT_Artwork_${year}-${month}-${day}_${hours}${mins}${secs}`;
  return suffix ? `${base}_${suffix}.${format}` : `${base}.${format}`;
}

export function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function triggerExportCelebration() {
  confetti({
    particleCount: 60,
    spread: 60,
    origin: { y: 0.8 },
    colors: ['#007AFF', '#FF9500', '#34C759', '#AF52DE', '#FF2D55']
  });
}

/**
 * Export artwork with options:
 * @param {HTMLCanvasElement} drawingCanvas
 * @param {HTMLVideoElement|null} videoElement
 * @param {'transparent-png'|'camera-png'|'white-jpeg'|'black-jpeg'} mode
 * @param {boolean} isMirrored
 */
export async function exportArtwork(drawingCanvas, videoElement, mode = 'transparent-png', isMirrored = true) {
  if (!drawingCanvas || drawingCanvas.width === 0 || drawingCanvas.height === 0) {
    throw new Error('Drawing canvas is empty or uninitialized');
  }

  const width = drawingCanvas.width;
  const height = drawingCanvas.height;

  // 1. Transparent PNG (just the drawing strokes)
  if (mode === 'transparent-png') {
    const dataUrl = drawingCanvas.toDataURL('image/png');
    const filename = generateFilename('png', 'transparent');
    downloadDataUrl(dataUrl, filename);
    triggerExportCelebration();
    return filename;
  }

  // For composited exports, create an offscreen canvas
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const ctx = exportCanvas.getContext('2d');

  if (mode === 'white-jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(drawingCanvas, 0, 0);
    const dataUrl = exportCanvas.toDataURL('image/jpeg', 0.95);
    const filename = generateFilename('jpg', 'white-bg');
    downloadDataUrl(dataUrl, filename);
    triggerExportCelebration();
    return filename;
  }

  if (mode === 'black-jpeg') {
    ctx.fillStyle = '#121214';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(drawingCanvas, 0, 0);
    const dataUrl = exportCanvas.toDataURL('image/jpeg', 0.95);
    const filename = generateFilename('jpg', 'dark-bg');
    downloadDataUrl(dataUrl, filename);
    triggerExportCelebration();
    return filename;
  }

  if (mode === 'camera-png') {
    if (videoElement && videoElement.readyState >= 2) {
      ctx.save();
      if (isMirrored) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(videoElement, 0, 0, width, height);
      ctx.restore();
    } else {
      // Fallback if camera frame not ready
      ctx.fillStyle = '#1D1D1F';
      ctx.fillRect(0, 0, width, height);
    }

    // Draw artwork on top
    ctx.drawImage(drawingCanvas, 0, 0);

    const dataUrl = exportCanvas.toDataURL('image/png');
    const filename = generateFilename('png', 'with-camera');
    downloadDataUrl(dataUrl, filename);
    triggerExportCelebration();
    return filename;
  }

  throw new Error(`Unknown export mode: ${mode}`);
}
