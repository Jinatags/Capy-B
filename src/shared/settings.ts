import {
  DEFAULT_PET_SIZE,
  type PetSizeId,
  isPetSizeId
} from './petSize'

/** Persistent application settings (userData JSON). */

export type QuietHoursSettings = {
  enabled: boolean
  /** Local time "HH:mm" (24h). */
  start: string
  /** Local time "HH:mm" (24h). */
  end: string
}

export type WindowPosition = {
  x: number
  y: number
  width: number
  height: number
}

export type AppSettings = {
  /** Whether the pet window is shown on the desktop. */
  petVisible: boolean
  /** When true, automatic movement and pet interactions are disabled. */
  petPaused: boolean
  /** Last known pet window bounds (null → default bottom-right). */
  windowPosition: WindowPosition | null

  /** On-screen character size preset. */
  petSize: PetSizeId

  /** Allow occasional left/right roaming. */
  enableWalking: boolean
  /** Horizontal roam speed in CSS pixels per second. */
  walkSpeed: number
  /** Minimum seconds between walk attempts. */
  walkIntervalMinSec: number
  /** Maximum seconds between walk attempts. */
  walkIntervalMaxSec: number

  enableReminders: boolean
  /**
   * Launch at login. Must remain false in development builds —
   * never auto-enable during `npm run dev`.
   */
  launchAtLogin: boolean
  quietHours: QuietHoursSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  petVisible: true,
  petPaused: false,
  windowPosition: null,
  petSize: DEFAULT_PET_SIZE,
  enableWalking: true,
  walkSpeed: 55,
  walkIntervalMinSec: 14,
  walkIntervalMaxSec: 36,
  enableReminders: true,
  launchAtLogin: false,
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00'
  }
}

/** Subset pushed to the pet renderer for live behaviour. */
export type PetRuntimeState = {
  visible: boolean
  paused: boolean
  petSize: PetSizeId
  enableWalking: boolean
  walkSpeed: number
  walkIntervalMinSec: number
  walkIntervalMaxSec: number
  enableReminders: boolean
  quietHours: QuietHoursSettings
}

export function toPetRuntimeState(settings: AppSettings): PetRuntimeState {
  return {
    visible: settings.petVisible,
    paused: settings.petPaused,
    petSize: isPetSizeId(settings.petSize) ? settings.petSize : DEFAULT_PET_SIZE,
    enableWalking: settings.enableWalking,
    walkSpeed: settings.walkSpeed,
    walkIntervalMinSec: settings.walkIntervalMinSec,
    walkIntervalMaxSec: settings.walkIntervalMaxSec,
    enableReminders: settings.enableReminders,
    quietHours: settings.quietHours
  }
}

export { isPetSizeId }
