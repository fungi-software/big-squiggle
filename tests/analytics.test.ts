import { describe, expect, it } from 'vitest';

import { environmentFor } from '../src/analytics';

describe('analytics', () => {
  it('names the deploy from the build mode and the hosting channel', () => {
    expect(environmentFor('development', 'localhost')).toBe('local');
    expect(environmentFor('staging', 'big-squiggle.web.app')).toBe('local');
    expect(environmentFor('production', 'localhost')).toBe('local');
    expect(environmentFor('production', 'big-squiggle.firebaseapp.com')).toBe('production');
    expect(environmentFor('production', 'big-squiggle--pr12-abc123.web.app')).toBe('preview');
    expect(environmentFor('production', 'big-squiggle.web.app')).toBe('production');
  });
});
