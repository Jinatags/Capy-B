import { IDLE_YAW, type MotionPose } from '@shared/character'
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

/**
 * Builds a subtle procedural pose from the state machine snapshot.
 * Avoids exaggerated squash/stretch — keep scale near 1.
 */
export function computeMotionPose(
  snapshot: MachineSnapshot,
  machine: CharacterStateMachine,
  clockSec: number
): MotionPose {
  const pose: MotionPose = {
    position: { ...BASE_POSE.position },
    rotation: { ...BASE_POSE.rotation },
    scale: { ...BASE_POSE.scale }
  }

  const breath = Math.sin(clockSec * 2.1)
  const softBreath = Math.sin(clockSec * 1.15)

  switch (snapshot.state) {
    case 'idle':
    case 'interacting': {
      // Gentle breathing + tiny bob (no heavy squash).
      pose.position.y = breath * 0.018
      pose.scale.y = 1 + breath * 0.012
      pose.scale.x = 1 - breath * 0.006
      pose.scale.z = 1 - breath * 0.006
      pose.rotation.z = softBreath * 0.03
      pose.rotation.y = IDLE_YAW + machine.idleLookYaw
      if (snapshot.state === 'interacting') {
        pose.rotation.y += Math.sin(clockSec * 6) * 0.04
      }
      break
    }
    case 'walking': {
      const hop = Math.abs(Math.sin(clockSec * 9.5))
      pose.position.y = hop * 0.055
      pose.rotation.z = Math.sin(clockSec * 9.5) * 0.05
      // Face travel direction (screen +X = right).
      const faceYaw = snapshot.walkDirection === 1 ? -Math.PI / 2.15 : Math.PI / 2.15
      pose.rotation.y = faceYaw
      pose.scale.y = 1 + hop * 0.02
      pose.scale.x = 1 - hop * 0.01
      pose.scale.z = 1 - hop * 0.01
      break
    }
    case 'sleeping': {
      const fallIn = smoothstep(Math.min(1, snapshot.stateTime / 1.1))
      pose.rotation.z = lerp(0, 0.55, fallIn)
      pose.rotation.x = lerp(0, 0.12, fallIn)
      pose.rotation.y = lerp(IDLE_YAW, IDLE_YAW * 0.4, fallIn)
      pose.position.y = lerp(0, -0.08, fallIn) + softBreath * 0.008
      pose.scale.y = 1 + softBreath * 0.01
      break
    }
    case 'waking': {
      const wake = smoothstep(snapshot.stateProgress)
      pose.rotation.z = lerp(0.55, 0, wake)
      pose.rotation.x = lerp(0.12, 0, wake)
      pose.rotation.y = lerp(IDLE_YAW * 0.4, IDLE_YAW, wake)
      pose.position.y = lerp(-0.08, breath * 0.018, wake)
      pose.scale.y = 1 + breath * 0.012 * wake
      break
    }
    case 'dragging': {
      // Keep proportions — no squash/stretch while the user repositions.
      pose.rotation.y = IDLE_YAW
      pose.position.y = breath * 0.01
      break
    }
    default:
      break
  }

  return pose
}
