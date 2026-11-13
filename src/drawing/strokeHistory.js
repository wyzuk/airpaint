/**
 * AIRPAINT - Stroke History & Undo/Redo Engine
 * Stroke-based state management for non-destructive digital art
 */

export class StrokeHistory {
  constructor(options = {}) {
    this.maxHistory = options.maxHistory || 100;
    this.strokes = [];
    this.redoStack = [];
    this.onChange = options.onChange || null;
  }

  addStroke(stroke) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return;
    this.strokes.push(stroke);
    if (this.strokes.length > this.maxHistory) {
      this.strokes.shift();
    }
    // Any new drawing action clears the redo stack
    this.redoStack = [];
    this._notify();
  }

  undo() {
    if (!this.canUndo()) return null;
    const undone = this.strokes.pop();
    this.redoStack.push(undone);
    this._notify();
    return undone;
  }

  redo() {
    if (!this.canRedo()) return null;
    const redone = this.redoStack.pop();
    this.strokes.push(redone);
    this._notify();
    return redone;
  }

  canUndo() {
    return this.strokes.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    if (this.strokes.length === 0) return;
    // Save current strokes to redo stack so clear is undoable!
    this.redoStack.push([...this.strokes]);
    this.strokes = [];
    this._notify();
  }

  getStrokes() {
    return this.strokes;
  }

  getStrokeCount() {
    return this.strokes.length;
  }

  _notify() {
    if (typeof this.onChange === 'function') {
      this.onChange({
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        strokeCount: this.strokes.length
      });
    }
  }
}
