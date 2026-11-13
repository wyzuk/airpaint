import { describe, it, expect } from 'vitest';
import { generateFilename } from '../src/utils/export.js';

describe('Export Utils', () => {
  it('generates filename with correct prefix, format, and suffix', () => {
    const fn1 = generateFilename('png', 'transparent');
    expect(fn1).toMatch(/^AIRPAINT_Artwork_\d{4}-\d{2}-\d{2}_\d{6}_transparent\.png$/);

    const fn2 = generateFilename('jpg', 'white-bg');
    expect(fn2).toMatch(/^AIRPAINT_Artwork_\d{4}-\d{2}-\d{2}_\d{6}_white-bg\.jpg$/);
  });
});
