// Mouse-drag camera control: dragging with the middle button turns and tilts the camera.
import type { Pointer, PointerDrag } from '../input/Pointer';
import { dragRotation } from '../render/cameraMath';
import type { CameraRig } from '../render/CameraRig';

const MIDDLE_BUTTON = 1;

export class CameraDragInput {
  /** Listens for drags on `pointer` and turns/tilts `rig` for middle-button drags. Create once at setup. */
  public constructor(
    pointer: Pointer,
    private readonly rig: CameraRig,
  ) {
    pointer.onDrag(this.onDrag);
  }

  /** Middle-button drags rotate (sideways) and tilt (up/down); drags with other buttons do nothing for now. */
  private readonly onDrag = (drag: PointerDrag): void => {
    if (drag.button !== MIDDLE_BUTTON) return;
    const { yawDelta, pitchDelta } = dragRotation(drag.dx, drag.dy);
    this.rig.rotateBy(yawDelta);
    this.rig.tiltBy(pitchDelta);
  };
}
