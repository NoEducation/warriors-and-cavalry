// Tracks which keys (by KeyboardEvent.code) are currently held on an event target.

export interface KeyState {
  isDown(code: string): boolean;
  dispose(): void;
}

export function createKeyState(target: EventTarget): KeyState {
  const down = new Set<string>();

  const onKeyDown = (e: Event): void => {
    down.add((e as KeyboardEvent).code);
  };
  const onKeyUp = (e: Event): void => {
    down.delete((e as KeyboardEvent).code);
  };
  const onBlur = (): void => {
    down.clear();
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
    isDown: (code) => down.has(code),
    dispose(): void {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
      down.clear();
    },
  };
}
