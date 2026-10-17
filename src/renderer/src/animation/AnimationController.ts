import * as THREE from 'three'
import type { CharacterState } from '@shared/character'
import { mapClipsToStates } from './clipMap'

const DEFAULT_FADE_SEC = 0.35
const ONE_SHOT_STATES = new Set<CharacterState>(['waking', 'happy', 'sad'])

export type AnimationControllerOptions = {
  /** Crossfade duration in seconds. */
  fadeSec?: number
}

/**
 * Drives GLB AnimationClips via Three.js AnimationMixer.
 * When no clips are present, {@link hasClips} is false and callers should use procedural poses.
 *
 * Designed for imperative use inside `useFrame` — does not subscribe React state.
 */
export class AnimationController {
  private mixer: THREE.AnimationMixer | null = null
  private actions = new Map<string, THREE.AnimationAction>()
  private stateToClip: Partial<Record<CharacterState, string>> = {}
  private activeState: CharacterState | null = null
  private fadeSec: number
  private finishedListener: ((event: { action: THREE.AnimationAction }) => void) | null =
    null
  private onOneShotComplete: ((state: CharacterState) => void) | null = null

  constructor(options: AnimationControllerOptions = {}) {
    this.fadeSec = options.fadeSec ?? DEFAULT_FADE_SEC
  }

  get hasClips(): boolean {
    return this.actions.size > 0
  }

  get currentState(): CharacterState | null {
    return this.activeState
  }

  /** Optional callback when a one-shot clip finishes (Wake / Happy / Sad). */
  setOneShotCompleteListener(cb: ((state: CharacterState) => void) | null): void {
    this.onOneShotComplete = cb
  }

  /**
   * Bind mixer to a scene root and discover clips.
   * Safe to call again after switching models — previous mixer is disposed first.
   */
  bind(root: THREE.Object3D, clips: THREE.AnimationClip[]): void {
    this.dispose()

    if (!clips.length) {
      return
    }

    this.mixer = new THREE.AnimationMixer(root)
    const names = clips.map((c) => c.name)
    const { byState } = mapClipsToStates(names)
    this.stateToClip = byState

    for (const clip of clips) {
      this.actions.set(clip.name, this.mixer.clipAction(clip))
    }

    this.finishedListener = (event) => {
      const clipName = event.action.getClip().name
      const state = (
        Object.entries(this.stateToClip) as Array<[CharacterState, string]>
      ).find(([, name]) => name === clipName)?.[0]
      if (state && ONE_SHOT_STATES.has(state)) {
        this.onOneShotComplete?.(state)
      }
    }
    this.mixer.addEventListener('finished', this.finishedListener)
  }

  /**
   * Crossfade to the clip mapped for `state`.
   * No-op when that clip is missing (procedural fallback remains active).
   */
  play(state: CharacterState, options?: { fadeSec?: number; force?: boolean }): void {
    if (!this.mixer || !this.hasClips) return
    if (!options?.force && this.activeState === state) return

    const clipName = this.stateToClip[state]
    if (!clipName) return

    const next = this.actions.get(clipName)
    if (!next) return

    const fade = options?.fadeSec ?? this.fadeSec
    const prevState = this.activeState
    const prevClip = prevState ? this.stateToClip[prevState] : undefined
    const prev = prevClip ? this.actions.get(prevClip) : undefined

    const loop = ONE_SHOT_STATES.has(state) ? THREE.LoopOnce : THREE.LoopRepeat

    next.reset()
    next.setLoop(loop, Infinity)
    next.clampWhenFinished = ONE_SHOT_STATES.has(state)
    next.enabled = true
    next.setEffectiveTimeScale(1)
    next.setEffectiveWeight(1)

    if (prev && prev !== next) {
      next.crossFadeFrom(prev, fade, false)
    } else {
      next.fadeIn(fade)
    }
    next.play()

    this.activeState = state
  }

  /** Advance the mixer. Call from `useFrame` with clamped delta. */
  update(dt: number): void {
    this.mixer?.update(dt)
  }

  /** Pause/resume effective time scale (honours app pause). */
  setPaused(paused: boolean): void {
    if (!this.mixer) return
    this.mixer.timeScale = paused ? 0 : 1
  }

  dispose(): void {
    if (this.mixer && this.finishedListener) {
      this.mixer.removeEventListener('finished', this.finishedListener)
    }
    this.actions.forEach((action) => {
      action.stop()
    })
    this.mixer?.stopAllAction()
    this.mixer = null
    this.actions.clear()
    this.stateToClip = {}
    this.activeState = null
    this.finishedListener = null
  }
}
