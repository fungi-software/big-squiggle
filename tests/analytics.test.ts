import { describe, expect, it } from 'vitest';

import { environmentFor, flag, screenShown, track } from '../src/analytics';

describe('analytics', () => {
  it('names the deploy from the build mode and the hosting channel', () => {
    expect(environmentFor('development', 'localhost')).toBe('local');
    expect(environmentFor('production', 'big-squiggle--pr12-abc123.web.app')).toBe('preview');
    expect(environmentFor('production', 'big-squiggle.web.app')).toBe('production');
  });

  it('is a no-op with no key configured', () => {
    expect(() => track('play_began', { round_id: 1 })).not.toThrow();
    expect(() => screenShown('lobby')).not.toThrow();
    expect(flag('anything')).toBeUndefined();
  });
});
