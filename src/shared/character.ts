/** Central character behaviour states for Phase 2A procedural motion. */

export type CharacterState =
  | 'idle'
  | 'walking'
  | 'sleeping'
  | 'waking'
  | 'dragging'
  | 'interacting'

export type WalkDirection = -1 | 1

export type MotionPose = {
  /** Local position offset (breathing / bounce). */
  position: { x: number; y: number; z: number }
  /** Euler rotation in radians. */
  rotation: { x: number; y: number; z: number }
  /** Uniform-ish scale factors (keep close to 1 to avoid distortion). */
  scale: { x: number; y: number; z: number }
}

export const IDLE_YAW = -Math.PI / 5
