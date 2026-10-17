import { IDLE_YAW, type MotionPose } from '@shared/character'
import { proceduralMotionScale } from '../animation/reducedMotion'
import type { CharacterStateMachine, MachineSnapshot } from './stateMachine'

const BASE_POSE: MotionPose = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: IDLE_YAW, z: 0 },
  scale: { x: 1, y: 1, z: 1 }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

export type MotionPoseOptions = {
  /**
   * When true, skeletal clips own the character pose — only apply tiny root offsets
   * so we do not fight the mixer (no squash / large leans).
   */
  skeletalActive?: boolean
}

/**
 * Builds a subtle procedural pose from the state machine snapshot.
 * Used as the full animation path until a rigged GLB ships, and as a soft
 * root accent even when clips are playing.
 */
export function computeMotionPose(
  snapshot: MachineSnapshot,
  machine: CharacterStateMachine,
  clockSec: number,
  options: MotionPoseOptions = {}
): MotionPose {
  const pose: MotionPose = {
    position: { ...BASE_POSE.position },
    rotation: { ...BASE_POSE.rotation },
    scale: { ...BASE_POSE.scale }
  }

  const amp = proceduralMotionScale()
  const skeletal = options.skeletalActive === true

  // When clips drive the mesh, keep root motion minimal — facing + micro breath only.
  if (skeletal) {
    applySkeletalRootAccent(pose, snapshot, machine, clockSec, amp)
    return pose
  }

  const breath = Math.sin(clockSec * 1.85)
  const softBreath = Math.sin(clockSec * 1.05)

  switch (snapshot.state) {
    case 'idle': {
      // Gentle breathing + very light natural sway (no hop / spin).
      pose.position.y = breath * 0.012 * amp
      pose.scale.y = 1 + breath * 0.01 * amp
      pose.scale.x = 1 - breath * 0.005 * amp
      pose.scale.z = 1 - breath * 0.005 * amp
      pose.rotation.z = softBreath * 0.022 * amp
      pose.rotation.y = IDLE_YAW + machine.idleLookYaw * amp
      break
    }
    case 'walking': {
      // Small cute step cycle — fused mesh can only hop as a whole.
      const step = Math.sin(clockSec * 8.2)
      const hop = Math.abs(step)
      pose.position.y = hop * 0.032 * amp
      pose.rotation.z = step * 0.04 * amp
      // Slight forward lean into travel.
      pose.rotation.x = 0.04 * amp
      const faceYaw = snapshot.walkDirection === 1 ? -Math.PI / 2.15 : Math.PI / 2.15
      pose.rotation.y = faceYaw
      pose.scale.y = 1 + hop * 0.014 * amp
      pose.scale.x = 1 - hop * 0.007 * amp
      pose.scale.z = 1 - hop * 0.007 * amp
      break
    }
    case 'sleeping': {
      const fallIn = smoothstep(Math.min(1, snapshot.stateTime / 1.25))
      pose.rotation.z = lerp(0, 0.48, fallIn)
      pose.rotation.x = lerp(0, 0.1, fallIn)
      pose.rotation.y = lerp(IDLE_YAW, IDLE_YAW * 0.45, fallIn)
      pose.position.y = lerp(0, -0.07, fallIn) + softBreath * 0.006 * amp
      pose.scale.y = 1 + softBreath * 0.008 * amp
      pose.scale.x = 1 + softBreath * 0.003 * amp
      break
    }
    case 'waking': {
      // Stretch up mid-wake, then settle into idle breath.
      const wake = smoothstep(snapshot.stateProgress)
      const stretch = Math.sin(wake * Math.PI) * 0.045 * amp
      pose.rotation.z = lerp(0.48, 0, wake)
      pose.rotation.x = lerp(0.1, -0.06 * (1 - wake), wake)
      pose.rotation.y = lerp(IDLE_YAW * 0.45, IDLE_YAW, wake)
      pose.position.y = lerp(-0.07, breath * 0.012 * amp, wake) + stretch
      pose.scale.y = 1 + stretch * 0.8 + breath * 0.01 * amp * wake
      pose.scale.x = 1 - stretch * 0.25
      pose.scale.z = 1 - stretch * 0.25
      break
    }
    case 'dragging': {
      // Gentle lifted / dangling feel — no spinning.
      const dangle = Math.sin(clockSec * 2.4) * 0.035 * amp
      pose.rotation.y = IDLE_YAW
      pose.rotation.z = dangle
      pose.rotation.x = -0.06 * amp
      pose.position.y = 0.04 * amp + breath * 0.008 * amp
      break
    }
    case 'happy': {
      const bounce = Math.abs(Math.sin(clockSec * 7.5)) * smoothstep(
        1 - Math.min(1, snapshot.stateProgress)
      )
      const settle = smoothstep(Math.min(1, snapshot.stateTime / 0.2))
      pose.position.y = bounce * 0.07 * amp * settle
      pose.scale.y = 1 + bounce * 0.03 * amp
      pose.scale.x = 1 - bounce * 0.015 * amp
      pose.scale.z = 1 - bounce * 0.015 * amp
      pose.rotation.y = IDLE_YAW + Math.sin(clockSec * 5) * 0.05 * amp
      pose.rotation.z = Math.sin(clockSec * 7.5) * 0.04 * amp
      break
    }
    case 'sad': {
      const dip = smoothstep(Math.min(1, snapshot.stateTime / 0.45))
      pose.position.y = lerp(0, -0.045, dip) + softBreath * 0.004 * amp
      pose.rotation.x = lerp(0, 0.14, dip)
      pose.rotation.z = softBreath * 0.015 * amp
      pose.rotation.y = IDLE_YAW
      pose.scale.y = 1 - 0.025 * dip
      pose.scale.x = 1 + 0.012 * dip
      pose.scale.z = 1 + 0.012 * dip
      break
    }
    case 'annoyed': {
      const shake = Math.sin(clockSec * 14) * (1 - snapshot.stateProgress)
      pose.rotation.z = shake * 0.08 * amp
      pose.position.x = shake * 0.012 * amp
      pose.rotation.y = IDLE_YAW
      pose.scale.y = 1 - 0.015 * amp
      break
    }
    default:
      break
  }

  return pose
}

function applySkeletalRootAccent(
  pose: MotionPose,
  snapshot: MachineSnapshot,
  machine: CharacterStateMachine,
  clockSec: number,
  amp: number
): void {
  const breath = Math.sin(clockSec * 1.6) * 0.004 * amp

  switch (snapshot.state) {
    case 'idle':
      pose.position.y = breath
      pose.rotation.y = IDLE_YAW + machine.idleLookYaw * 0.5 * amp
      break
    case 'walking': {
      const faceYaw = snapshot.walkDirection === 1 ? -Math.PI / 2.15 : Math.PI / 2.15
      pose.rotation.y = faceYaw
      break
    }
    case 'dragging':
      pose.rotation.y = IDLE_YAW
      pose.position.y = 0.02 * amp
      break
    case 'sleeping':
    case 'waking':
    case 'happy':
    case 'sad':
    case 'annoyed':
      pose.rotation.y = IDLE_YAW
      pose.position.y = breath
      break
    default:
      pose.rotation.y = IDLE_YAW
      break
  }
}
