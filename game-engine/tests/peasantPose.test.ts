import { describe, expect, it } from 'vitest';
import { PEASANT_POSE_CONFIG, type Pose, type PoseInput, peasantPose } from '../src/render/peasantPose';

const DEG = Math.PI / 180;
const blank = (): Pose => ({ bob: 0, lean: 0, leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0, tool: 0 });
const pose = (input: Partial<PoseInput>): Pose =>
  peasantPose({ activity: 'idle', distance: 0, time: 0, phase: 0, ...input }, blank());

describe('peasantPose', () => {
  it('swings the legs against each other and each arm against its leg while walking', () => {
    for (let d = 0; d < 1; d += 0.05) {
      const p = pose({ activity: 'walk', distance: d });
      expect(p.leftLeg).toBeCloseTo(-p.rightLeg);
      if (Math.abs(p.leftLeg) > 0.01) expect(Math.sign(p.leftArm)).toBe(-Math.sign(p.leftLeg));
      expect(Math.abs(p.leftLeg)).toBeLessThanOrEqual(30 * DEG + 1e-9);
    }
    const swings = Array.from({ length: 40 }, (_, i) => Math.abs(pose({ activity: 'walk', distance: i / 40 }).leftLeg));
    expect(Math.max(...swings)).toBeCloseTo(30 * DEG, 1);
  });

  it('repeats the walk every two strides', () => {
    const period = 2 * PEASANT_POSE_CONFIG.strideTiles;
    for (const d of [0.1, 0.37, 0.8]) {
      expect(pose({ activity: 'walk', distance: d + period }).leftLeg).toBeCloseTo(pose({ activity: 'walk', distance: d }).leftLeg);
    }
  });

  it('gives peasants with different phases different steps at the same distance', () => {
    const a = pose({ activity: 'walk', distance: 0.2, phase: 0 });
    const b = pose({ activity: 'walk', distance: 0.2, phase: 0.4 });
    expect(a.leftLeg).not.toBeCloseTo(b.leftLeg);
  });

  it('leans a carrier forward with both arms held back', () => {
    for (const d of [0, 0.25, 0.6]) {
      const p = pose({ activity: 'carry', distance: d });
      expect(p.lean).toBeCloseTo(15 * DEG);
      expect(p.leftArm).toBeLessThanOrEqual(-30 * DEG);
      expect(p.rightArm).toBeLessThanOrEqual(-30 * DEG);
    }
  });

  it('raises the tool arm to about 120 degrees and strikes down once per work period', () => {
    const arms = Array.from({ length: 50 }, (_, i) => pose({ activity: 'work', time: i / 50 }).rightArm);
    expect(Math.max(...arms)).toBeCloseTo(120 * DEG, 1);
    expect(Math.min(...arms)).toBeLessThan(10 * DEG);
    for (const t of [0.1, 0.45, 0.9]) {
      expect(pose({ activity: 'work', time: t + PEASANT_POSE_CONFIG.workPeriod }).rightArm).toBeCloseTo(
        pose({ activity: 'work', time: t }).rightArm,
      );
    }
  });

  it('stands idle with the legs still and the arms hanging, swaying slightly', () => {
    for (const t of [0, 1, 2.5, 3.7]) {
      const p = pose({ activity: 'idle', time: t });
      expect(p.leftLeg).toBe(0);
      expect(p.rightLeg).toBe(0);
      expect(Math.abs(p.leftArm)).toBeLessThanOrEqual(2 * DEG + 1e-9);
      expect(Math.abs(p.rightArm)).toBeLessThanOrEqual(2 * DEG + 1e-9);
    }
  });

  it('writes into and returns `out`', () => {
    const out = blank();
    expect(peasantPose({ activity: 'walk', distance: 0.3, time: 0, phase: 0 }, out)).toBe(out);
  });
});
