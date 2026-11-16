import { describe, expect, it } from 'vitest';
import { LauncherLogic } from './launcher';

describe('LauncherLogic', () => {
  it('shoots one ball when the handle is pulled and let go', () => {
    const l = new LauncherLogic();
    l.grab();
    l.setPull(0.6);
    expect(l.release()).toBe(0.6);
    expect(l.pull).toBe(0);
    expect(l.held).toBe(false);
    // Nothing more until the next pull.
    expect(l.release()).toBeNull();
  });

  it('shoots with the pull at the moment of release', () => {
    const l = new LauncherLogic();
    l.grab();
    l.setPull(0.9);
    l.setPull(0.3);
    expect(l.release()).toBe(0.3);
  });

  it('ignores taps and tiny pulls', () => {
    const l = new LauncherLogic();
    l.grab();
    expect(l.release()).toBeNull();
    l.grab();
    l.setPull(0.01);
    expect(l.release()).toBeNull();
  });

  it('clamps the pull and ignores input when not held', () => {
    const l = new LauncherLogic();
    l.setPull(0.9);
    expect(l.pull).toBe(0);
    l.grab();
    l.setPull(7);
    expect(l.pull).toBe(1);
    l.setPull(-3);
    expect(l.pull).toBe(0);
  });

  it('can be cancelled without shooting', () => {
    const l = new LauncherLogic();
    l.grab();
    l.setPull(0.8);
    l.cancel();
    expect(l.release()).toBeNull();
  });
});
