import { describe, expect, it } from 'vitest';
import { coreVersion } from './index.js';

describe('coreVersion', () => {
  it('exports a version string', () => {
    expect(coreVersion).toBe('0.0.0');
  });
});
