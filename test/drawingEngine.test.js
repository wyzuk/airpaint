import { describe, it, expect, beforeEach } from 'vitest';
import { StrokeHistory } from '../src/drawing/strokeHistory.js';

describe('StrokeHistory', () => {
  let history;

  beforeEach(() => {
    history = new StrokeHistory();
  });

  it('manages stroke addition and undo/redo stacks correctly', () => {
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);

    const s1 = { id: 's1', type: 'pen', color: '#FF0000', size: 5, points: [{ x: 10, y: 10 }] };
    const s2 = { id: 's2', type: 'pen', color: '#00FF00', size: 8, points: [{ x: 20, y: 20 }] };

    history.addStroke(s1);
    expect(history.canUndo()).toBe(true);
    expect(history.getStrokeCount()).toBe(1);

    history.addStroke(s2);
    expect(history.getStrokeCount()).toBe(2);

    // Undo s2
    const undone = history.undo();
    expect(undone.id).toBe('s2');
    expect(history.getStrokeCount()).toBe(1);
    expect(history.canRedo()).toBe(true);

    // Redo s2
    const redone = history.redo();
    expect(redone.id).toBe('s2');
    expect(history.getStrokeCount()).toBe(2);
    expect(history.canRedo()).toBe(false);
  });

  it('clears redo stack upon new stroke addition', () => {
    const s1 = { id: 's1', type: 'pen', color: '#FF0000', size: 5, points: [{ x: 10, y: 10 }] };
    const s2 = { id: 's2', type: 'pen', color: '#00FF00', size: 8, points: [{ x: 20, y: 20 }] };
    const s3 = { id: 's3', type: 'pen', color: '#0000FF', size: 10, points: [{ x: 30, y: 30 }] };

    history.addStroke(s1);
    history.addStroke(s2);
    history.undo(); // s2 is in redo stack

    expect(history.canRedo()).toBe(true);

    history.addStroke(s3); // Adding s3 clears redo stack
    expect(history.canRedo()).toBe(false);
    expect(history.getStrokeCount()).toBe(2);
  });

  it('handles clear canvas operation', () => {
    const s1 = { id: 's1', type: 'pen', color: '#FF0000', size: 5, points: [{ x: 10, y: 10 }] };
    history.addStroke(s1);
    expect(history.getStrokeCount()).toBe(1);

    history.clear();
    expect(history.getStrokeCount()).toBe(0);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true); // Redo restores cleared strokes
  });
});
