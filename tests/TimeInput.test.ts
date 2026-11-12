import { describe, expect, it } from 'vitest';
import { SimulationRunner } from '../src/game/SimulationRunner';
import { TimeInput } from '../src/game/TimeInput';

function keydown(code: string, repeat = false): Event {
  return Object.assign(new Event('keydown', { cancelable: true }), { code, repeat });
}

function setup(): { target: EventTarget; runner: SimulationRunner; input: TimeInput } {
  const target = new EventTarget();
  const runner = new SimulationRunner(10);
  return { target, runner, input: new TimeInput(target, runner) };
}

describe('TimeInput', () => {
  it('Space toggles pause and prevents the default action', () => {
    const { target, runner } = setup();
    const event = keydown('Space');
    target.dispatchEvent(event);
    expect(runner.paused).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    target.dispatchEvent(keydown('Space'));
    expect(runner.paused).toBe(false);
  });

  it('ignores key repeats', () => {
    const { target, runner } = setup();
    target.dispatchEvent(keydown('Space', true));
    target.dispatchEvent(keydown('Equal', true));
    expect(runner.paused).toBe(false);
    expect(runner.speed).toBe(1);
  });

  it('Equal goes faster and Minus slower', () => {
    const { target, runner } = setup();
    target.dispatchEvent(keydown('Equal'));
    expect(runner.speed).toBe(2);
    target.dispatchEvent(keydown('Minus'));
    expect(runner.speed).toBe(1);
  });

  it('accepts the numpad plus and minus keys', () => {
    const { target, runner } = setup();
    const plus = keydown('NumpadAdd');
    target.dispatchEvent(plus);
    expect(runner.speed).toBe(2);
    expect(plus.defaultPrevented).toBe(true);
    target.dispatchEvent(keydown('NumpadSubtract'));
    expect(runner.speed).toBe(1);
  });

  it('does not prevent other keys', () => {
    const { target } = setup();
    const event = keydown('KeyW');
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('stops reacting after dispose', () => {
    const { target, runner, input } = setup();
    input.dispose();
    const event = keydown('Space');
    target.dispatchEvent(event);
    target.dispatchEvent(keydown('Equal'));
    expect(runner.paused).toBe(false);
    expect(runner.speed).toBe(1);
    expect(event.defaultPrevented).toBe(false);
  });
});
