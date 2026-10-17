/** Central character behaviour states and motion types. */

export type CharacterState =
  | 'idle'
  | 'walking'
  | 'sleeping'
  | 'waking'
  | 'dragging'
  | 'happy'
  | 'sad'
  | 'annoyed'

export type WalkDirection = -1 | 1

export type MotionPose = {
  /** Local position offset (breathing / bounce). */
  position: { x: number; y: number; z: number }
  /** Euler rotation in radians. */
  rotation: { x: number; y: number; z: number }
  /** Uniform-ish scale factors (keep close to 1 to avoid distortion). */
  scale: { x: number; y: number; z: number }
}

/** Default facing when idle (slight three-quarter view). */
export const IDLE_YAW = -Math.PI / 5

/**
 * Canonical clip names expected in `CapyB_Animated.glb`.
 * Matching is case-insensitive and also accepts common aliases.
 */
export const ANIMATION_CLIP_NAMES = {
  idle: 'Idle',
  walking: 'Walk',
  sleeping: 'Sleep',
  waking: 'Wake',
  dragging: 'PickedUp',
  happy: 'Happy',
  sad: 'Sad',
  annoyed: 'Annoyed'
} as const satisfies Record<CharacterState, string>
