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

/** Which reminder features are active and when they fire. */
export type ReminderSettings = {
  enableMorningGreeting: boolean
  enableWaterReminders: boolean
  /** Two daily water slots as "HH:mm". */
  waterTimes: [string, string]
  enableHealthyEatingReminders: boolean
  /** JS weekday numbers (0 = Sunday … 6 = Saturday). Default: Tue + Fri. */
  healthyEatingDays: number[]
  healthyEatingTime: string
}

/** Persisted “already fired today” markers so reminders don’t repeat after restart. */
export type ReminderFireState = {
  morningGreetingDate: string | null
  /** Map of water slot index → local date key. */
  waterFired: Record<string, string>
  healthyEatingDate: string | null
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

  /** Master switch for greetings + habit reminders. */
  enableReminders: boolean
  reminders: ReminderSettings
  reminderFireState: ReminderFireState

  /**
   * Launch at login. Must remain false in development builds —
   * never auto-enable during `npm run dev`.
   */
  launchAtLogin: boolean
  quietHours: QuietHoursSettings
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enableMorningGreeting: true,
  enableWaterReminders: true,
  waterTimes: ['11:00', '16:00'],
  enableHealthyEatingReminders: true,
  // Tuesday + Friday
  healthyEatingDays: [2, 5],
  healthyEatingTime: '12:30'
}

export const DEFAULT_REMINDER_FIRE_STATE: ReminderFireState = {
  morningGreetingDate: null,
  waterFired: {},
  healthyEatingDate: null
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
  reminders: { ...DEFAULT_REMINDER_SETTINGS, waterTimes: [...DEFAULT_REMINDER_SETTINGS.waterTimes] },
  reminderFireState: {
    ...DEFAULT_REMINDER_FIRE_STATE,
    waterFired: {}
  },
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
  reminders: ReminderSettings
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
    quietHours: settings.quietHours,
    reminders: {
      ...settings.reminders,
      waterTimes: [...settings.reminders.waterTimes] as [string, string],
      healthyEatingDays: [...settings.reminders.healthyEatingDays]
    }
  }
}

export { isPetSizeId }
