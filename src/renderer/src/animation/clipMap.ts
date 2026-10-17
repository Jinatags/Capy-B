import type { CharacterState } from '@shared/character'
import { ANIMATION_CLIP_NAMES } from '@shared/character'
import { isCapyDebug } from '../debug'

/** Alias lists per behaviour state (matched case-insensitively). */
const CLIP_ALIASES: Record<CharacterState, readonly string[]> = {
  idle: [ANIMATION_CLIP_NAMES.idle, 'idle', 'Idle_Loop', 'Breathing'],
  walking: [ANIMATION_CLIP_NAMES.walking, 'walk', 'Walking', 'Walk_Loop'],
  sleeping: [ANIMATION_CLIP_NAMES.sleeping, 'sleep', 'Sleeping', 'Sleep_Loop', 'Nap'],
  waking: [ANIMATION_CLIP_NAMES.waking, 'wake', 'WakeUp', 'Yawn', 'Stretch'],
  dragging: [ANIMATION_CLIP_NAMES.dragging, 'pickedup', 'pickUp', 'PickUp', 'Held', 'Lift'],
  happy: [ANIMATION_CLIP_NAMES.happy, 'Happy', 'Joy', 'Bounce'],
  sad: [ANIMATION_CLIP_NAMES.sad, 'Sad', 'Pout', 'Down'],
  annoyed: [ANIMATION_CLIP_NAMES.annoyed, 'Annoyed', 'Hmph', 'Grumpy']
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

/**
 * Build a state → AnimationClip index name map from loaded clip names.
 * Logs missing expected clips in development / debug mode.
 */
export function mapClipsToStates(clipNames: readonly string[]): {
  byState: Partial<Record<CharacterState, string>>
  missing: CharacterState[]
} {
  const normalizedIndex = new Map<string, string>()
  for (const name of clipNames) {
    normalizedIndex.set(normalize(name), name)
  }

  const byState: Partial<Record<CharacterState, string>> = {}
  const missing: CharacterState[] = []

  for (const state of Object.keys(CLIP_ALIASES) as CharacterState[]) {
    let matched: string | undefined
    for (const alias of CLIP_ALIASES[state]) {
      const hit = normalizedIndex.get(normalize(alias))
      if (hit) {
        matched = hit
        break
      }
    }
    if (matched) {
      byState[state] = matched
    } else {
      missing.push(state)
    }
  }

  if (missing.length > 0 && (import.meta.env.DEV || isCapyDebug())) {
    console.info(
      `[CapyB] Missing animation clips for states: ${missing.join(', ')}. ` +
        `Available: ${clipNames.length ? clipNames.join(', ') : '(none)'}`
    )
  }

  return { byState, missing }
}

/** Whether a loaded GLTF looks like a usable animated character. */
export function isUsableAnimatedGltf(input: {
  animations: ReadonlyArray<{ name: string }>
  hasSkeleton: boolean
}): boolean {
  return input.animations.length > 0 || input.hasSkeleton
}
