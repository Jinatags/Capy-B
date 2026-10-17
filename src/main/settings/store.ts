import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import {
  DEFAULT_REMINDER_FIRE_STATE,
  DEFAULT_REMINDER_SETTINGS,
  DEFAULT_SETTINGS,
  type AppSettings,
  type ReminderFireState,
  type ReminderSettings,
  type WindowPosition
} from '../../shared/settings'
import { DEFAULT_PET_SIZE, isPetSizeId } from '../../shared/petSize'
import { parseTimeToMinutes } from '../../shared/reminders'

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseWindowPosition(value: unknown): WindowPosition | null {
  if (!isRecord(value)) return null
  const { x, y, width, height } = value
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number'
  ) {
    return null
  }
  return { x, y, width, height }
}

function asNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function asTime(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  return parseTimeToMinutes(value) === null ? fallback : value
}

function parseReminderSettings(raw: unknown): ReminderSettings {
  if (!isRecord(raw)) {
    return {
      ...DEFAULT_REMINDER_SETTINGS,
      waterTimes: [...DEFAULT_REMINDER_SETTINGS.waterTimes],
      healthyEatingDays: [...DEFAULT_REMINDER_SETTINGS.healthyEatingDays]
    }
  }

  const waterRaw = Array.isArray(raw.waterTimes) ? raw.waterTimes : []
  const water0 = asTime(waterRaw[0], DEFAULT_REMINDER_SETTINGS.waterTimes[0])
  const water1 = asTime(waterRaw[1], DEFAULT_REMINDER_SETTINGS.waterTimes[1])

  const daysRaw = Array.isArray(raw.healthyEatingDays)
    ? raw.healthyEatingDays.filter(
        (d): d is number => typeof d === 'number' && d >= 0 && d <= 6
      )
    : DEFAULT_REMINDER_SETTINGS.healthyEatingDays

  return {
    enableMorningGreeting:
      typeof raw.enableMorningGreeting === 'boolean'
        ? raw.enableMorningGreeting
        : DEFAULT_REMINDER_SETTINGS.enableMorningGreeting,
    enableWaterReminders:
      typeof raw.enableWaterReminders === 'boolean'
        ? raw.enableWaterReminders
        : DEFAULT_REMINDER_SETTINGS.enableWaterReminders,
    waterTimes: [water0, water1],
    enableHealthyEatingReminders:
      typeof raw.enableHealthyEatingReminders === 'boolean'
        ? raw.enableHealthyEatingReminders
        : DEFAULT_REMINDER_SETTINGS.enableHealthyEatingReminders,
    healthyEatingDays:
      daysRaw.length > 0
        ? Array.from(new Set(daysRaw)).sort((a, b) => a - b)
        : [2, 5],
    healthyEatingTime: asTime(
      raw.healthyEatingTime,
      DEFAULT_REMINDER_SETTINGS.healthyEatingTime
    )
  }
}

function parseFireState(raw: unknown): ReminderFireState {
  if (!isRecord(raw)) {
    return { ...DEFAULT_REMINDER_FIRE_STATE, waterFired: {} }
  }
  const waterFired: Record<string, string> = {}
  if (isRecord(raw.waterFired)) {
    for (const [key, value] of Object.entries(raw.waterFired)) {
      if (typeof value === 'string') waterFired[key] = value
    }
  }
  return {
    morningGreetingDate:
      typeof raw.morningGreetingDate === 'string' ? raw.morningGreetingDate : null,
    waterFired,
    healthyEatingDate:
      typeof raw.healthyEatingDate === 'string' ? raw.healthyEatingDate : null
  }
}

function mergeSettings(raw: unknown): AppSettings {
  if (!isRecord(raw)) {
    return structuredClone(DEFAULT_SETTINGS)
  }

  const quiet = isRecord(raw.quietHours) ? raw.quietHours : {}

  return {
    petVisible: typeof raw.petVisible === 'boolean' ? raw.petVisible : DEFAULT_SETTINGS.petVisible,
    petPaused: typeof raw.petPaused === 'boolean' ? raw.petPaused : DEFAULT_SETTINGS.petPaused,
    windowPosition: parseWindowPosition(raw.windowPosition),
    petSize: isPetSizeId(raw.petSize) ? raw.petSize : DEFAULT_PET_SIZE,
    enableWalking:
      typeof raw.enableWalking === 'boolean' ? raw.enableWalking : DEFAULT_SETTINGS.enableWalking,
    walkSpeed: asNumber(raw.walkSpeed, DEFAULT_SETTINGS.walkSpeed, 20, 160),
    walkIntervalMinSec: asNumber(
      raw.walkIntervalMinSec,
      DEFAULT_SETTINGS.walkIntervalMinSec,
      5,
      120
    ),
    walkIntervalMaxSec: asNumber(
      raw.walkIntervalMaxSec,
      DEFAULT_SETTINGS.walkIntervalMaxSec,
      8,
      180
    ),
    enableReminders:
      typeof raw.enableReminders === 'boolean'
        ? raw.enableReminders
        : DEFAULT_SETTINGS.enableReminders,
    reminders: parseReminderSettings(raw.reminders),
    reminderFireState: parseFireState(raw.reminderFireState),
    launchAtLogin:
      typeof raw.launchAtLogin === 'boolean' ? raw.launchAtLogin : DEFAULT_SETTINGS.launchAtLogin,
    quietHours: {
      enabled:
        typeof quiet.enabled === 'boolean'
          ? quiet.enabled
          : DEFAULT_SETTINGS.quietHours.enabled,
      start: asTime(
        typeof quiet.start === 'string' ? quiet.start : DEFAULT_SETTINGS.quietHours.start,
        DEFAULT_SETTINGS.quietHours.start
      ),
      end: asTime(
        typeof quiet.end === 'string' ? quiet.end : DEFAULT_SETTINGS.quietHours.end,
        DEFAULT_SETTINGS.quietHours.end
      )
    }
  }
}

export class SettingsStore {
  private settings: AppSettings

  constructor() {
    this.settings = this.load()
    this.normalizeWalkIntervals()
    this.persist()
  }

  get(): AppSettings {
    return structuredClone(this.settings)
  }

  update(patch: Partial<AppSettings>): AppSettings {
    const next: AppSettings = {
      ...this.settings,
      ...patch,
      quietHours: {
        ...this.settings.quietHours,
        ...(patch.quietHours ?? {})
      },
      reminders: {
        ...this.settings.reminders,
        ...(patch.reminders ?? {}),
        waterTimes: [
          ...(patch.reminders?.waterTimes ?? this.settings.reminders.waterTimes)
        ] as [string, string],
        healthyEatingDays: [
          ...(patch.reminders?.healthyEatingDays ?? this.settings.reminders.healthyEatingDays)
        ]
      },
      reminderFireState: {
        ...this.settings.reminderFireState,
        ...(patch.reminderFireState ?? {}),
        waterFired: {
          ...this.settings.reminderFireState.waterFired,
          ...(patch.reminderFireState?.waterFired ?? {})
        }
      },
      windowPosition:
        patch.windowPosition === undefined
          ? this.settings.windowPosition
          : patch.windowPosition
            ? { ...patch.windowPosition }
            : null
    }

    // Re-parse reminder nested patch through validators.
    next.reminders = parseReminderSettings(next.reminders)
    next.reminderFireState = parseFireState(next.reminderFireState)

    if (!app.isPackaged) {
      next.launchAtLogin = false
    }

    if (!isPetSizeId(next.petSize)) {
      next.petSize = DEFAULT_PET_SIZE
    }

    this.settings = next
    this.normalizeWalkIntervals()
    this.persist()
    return this.get()
  }

  private normalizeWalkIntervals(): void {
    if (this.settings.walkIntervalMaxSec < this.settings.walkIntervalMinSec) {
      this.settings.walkIntervalMaxSec = this.settings.walkIntervalMinSec
    }
  }

  private load(): AppSettings {
    const path = settingsPath()
    try {
      if (!existsSync(path)) {
        return structuredClone(DEFAULT_SETTINGS)
      }
      const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
      return mergeSettings(raw)
    } catch (error) {
      console.warn('[settings] failed to load, using defaults', error)
      return structuredClone(DEFAULT_SETTINGS)
    }
  }

  private persist(): void {
    const path = settingsPath()
    try {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, JSON.stringify(this.settings, null, 2), 'utf8')
    } catch (error) {
      console.error('[settings] failed to persist', error)
    }
  }
}
