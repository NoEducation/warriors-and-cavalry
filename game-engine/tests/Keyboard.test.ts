import { describe, expect, it } from 'vitest';
import { Keyboard } from '../src/input/Keyboard';

function key(type: 'keydown' | 'keyup', code: string): Event {
  return Object.assign(new Event(type), { code });
}

describe('Keyboard', () => {
  it('tracks keydown and keyup by event.code', () => {
    const target = new EventTarget();
    const keys = new Keyboard(target);
    expect(keys.isDown('KeyW')).toBe(false);
    target.dispatchEvent(key('keydown', 'KeyW'));
    expect(keys.isDown('KeyW')).toBe(true);
    target.dispatchEvent(key('keyup', 'KeyW'));
    expect(keys.isDown('KeyW')).toBe(false);
  });

  it('releases all keys on blur', () => {
    const target = new EventTarget();
    const keys = new Keyboard(target);
    target.dispatchEvent(key('keydown', 'KeyW'));
    target.dispatchEvent(key('keydown', 'ArrowLeft'));
    target.dispatchEvent(new Event('blur'));
    expect(keys.isDown('KeyW')).toBe(false);
    expect(keys.isDown('ArrowLeft')).toBe(false);
  });

  it('ignores events after dispose', () => {
    const target = new EventTarget();
    const keys = new Keyboard(target);
    keys.dispose();
    target.dispatchEvent(key('keydown', 'KeyW'));
    expect(keys.isDown('KeyW')).toBe(false);
  });
});
