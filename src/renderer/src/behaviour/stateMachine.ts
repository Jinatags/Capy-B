import type { CharacterState, WalkDirection } from '@shared/character'
import type { PetRuntimeState } from '@shared/settings'

export type MachineConfig = Pick<
  PetRuntimeState,
  'enableWalking' | 'walkSpeed' | 'walkIntervalMinSec' | 'walkIntervalMaxSec'
>

export type MachineSnapshot = {
  state: CharacterState
  walkDirection: WalkDirection
  /** 0..1 progress within the current state (for blend poses). */
  stateProgress: number
  /** Elapsed seconds in the current state. */
  stateTime: number
}

function randRange(min: number, max: number): number {
  return min + Math.random() * Math.max(0, max - min)
}

/**
 * Lightweight finite-state machine driving idle / walk / sleep / mood cycles.
 * Works with either skeletal clips or procedural root poses.
 */
export class CharacterStateMachine {
  private state: CharacterState = 'idle'
  private stateTime = 0
  private stateDuration = 0
  private walkDirection: WalkDirection = 1
  private nextWalkIn = 8
  private nextSleepIn = 40
  private lookTimer = 0
  private lookYaw = 0
  private config: MachineConfig = {
    enableWalking: true,
    walkSpeed: 55,
    walkIntervalMinSec: 14,
    walkIntervalMaxSec: 36
  }

  /** Brief look-around yaw offset for idle (whole-body when unrigged). */
  get idleLookYaw(): number {
    return this.lookYaw
  }

  getSnapshot(): MachineSnapshot {
    const progress =
      this.stateDuration > 0 ? Math.min(1, this.stateTime / this.stateDuration) : 0
    return {
      state: this.state,
      walkDirection: this.walkDirection,
      stateProgress: progress,
      stateTime: this.stateTime
    }
  }

  setConfig(config: MachineConfig): void {
    this.config = { ...config }
    this.nextWalkIn = Math.min(
      this.nextWalkIn,
      randRange(config.walkIntervalMinSec, config.walkIntervalMaxSec)
    )
  }

  /** User started a drag — highest priority until released. */
  beginDrag(): void {
    this.enter('dragging', Number.POSITIVE_INFINITY)
  }

  endDrag(): void {
    if (this.state === 'dragging') {
      this.enter('idle', Number.POSITIVE_INFINITY)
      this.scheduleNextWalk()
      this.scheduleNextSleep()
    }
  }

  /**
   * Positive interaction (click / future praise).
   * Plays a short happy bounce, then returns to idle.
   */
  beginHappy(durationSec = 1.6): void {
    if (this.state === 'dragging') return
    this.enter('happy', durationSec)
  }

  /**
   * Soft sad reaction for future habit-tracker hooks.
   * Does not open any habit UI on its own.
   */
  beginSad(durationSec = 2.0): void {
    if (this.state === 'dragging') return
    this.enter('sad', durationSec)
  }

  /** @deprecated Prefer {@link beginHappy} — kept as a thin alias for call sites. */
  beginInteraction(durationSec = 1.6): void {
    this.beginHappy(durationSec)
  }

  /** Edge of screen while walking — reverse or settle. */
  notifyWalkBlocked(): void {
    if (this.state !== 'walking') return
    this.walkDirection = (this.walkDirection === 1 ? -1 : 1) as WalkDirection
    this.stateDuration = Math.min(this.stateDuration, this.stateTime + 1.2)
  }

  update(dt: number, paused: boolean): MachineSnapshot {
    if (paused) {
      return this.getSnapshot()
    }

    this.stateTime += dt

    if (this.state === 'dragging') {
      return this.getSnapshot()
    }

    if (this.state === 'happy' || this.state === 'sad') {
      if (this.stateTime >= this.stateDuration) {
        this.enter('idle', Number.POSITIVE_INFINITY)
        this.scheduleNextWalk()
      }
      return this.getSnapshot()
    }

    if (this.state === 'walking') {
      if (!this.config.enableWalking || this.stateTime >= this.stateDuration) {
        this.enter('idle', Number.POSITIVE_INFINITY)
        this.scheduleNextWalk()
      }
      return this.getSnapshot()
    }

    if (this.state === 'sleeping') {
      if (this.stateTime >= this.stateDuration) {
        this.enter('waking', 1.8)
      }
      return this.getSnapshot()
    }

    if (this.state === 'waking') {
      if (this.stateTime >= this.stateDuration) {
        this.enter('idle', Number.POSITIVE_INFINITY)
        this.scheduleNextWalk()
        this.scheduleNextSleep()
      }
      return this.getSnapshot()
    }

    // idle
    this.updateIdleLook(dt)
    this.nextWalkIn -= dt
    this.nextSleepIn -= dt

    if (this.nextSleepIn <= 0) {
      this.enter('sleeping', randRange(7, 14))
      return this.getSnapshot()
    }

    if (this.config.enableWalking && this.nextWalkIn <= 0) {
      this.walkDirection = Math.random() < 0.5 ? -1 : 1
      this.enter('walking', randRange(2.2, 5.5))
      return this.getSnapshot()
    }

    return this.getSnapshot()
  }

  private updateIdleLook(dt: number): void {
    this.lookTimer -= dt
    if (this.lookTimer <= 0) {
      this.lookTimer = randRange(3.5, 8)
      // Tiny yaw peek — whole mesh only when no head bone.
      this.lookYaw = (Math.random() - 0.5) * 0.14
    } else {
      this.lookYaw *= 1 - Math.min(1, dt * 0.35)
    }
  }

  private enter(state: CharacterState, duration: number): void {
    this.state = state
    this.stateTime = 0
    this.stateDuration = duration
    if (state === 'idle') {
      this.lookYaw = 0
    }
  }

  private scheduleNextWalk(): void {
    this.nextWalkIn = randRange(
      this.config.walkIntervalMinSec,
      this.config.walkIntervalMaxSec
    )
  }

  private scheduleNextSleep(): void {
    this.nextSleepIn = randRange(48, 95)
  }
}
