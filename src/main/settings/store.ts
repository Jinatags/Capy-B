import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type WindowPosition
} from '../../shared/settings'
import { DEFAULT_PET_SIZE, isPetSizeId } from '../../shared/petSize'

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

function mergeSettings(raw: unknown): AppSettings {
  if (!isRecord(raw)) {
    return { ...DEFAULT_SETTINGS, quietHours: { ...DEFAULT_SETTINGS.quietHours } }
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
    launchAtLogin:
      typeof raw.launchAtLogin === 'boolean' ? raw.launchAtLogin : DEFAULT_SETTINGS.launchAtLogin,
    quietHours: {
      enabled:
        typeof quiet.enabled === 'boolean'
          ? quiet.enabled
          : DEFAULT_SETTINGS.quietHours.enabled,
      start: typeof quiet.start === 'string' ? quiet.start : DEFAULT_SETTINGS.quietHours.start,
      end: typeof quiet.end === 'string' ? quiet.end : DEFAULT_SETTINGS.quietHours.end
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
    return {
      ...this.settings,
      quietHours: { ...this.settings.quietHours },
      windowPosition: this.settings.windowPosition
        ? { ...this.settings.windowPosition }
        : null
    }
  }

  update(patch: Partial<AppSettings>): AppSettings {
    const next: AppSettings = {
      ...this.settings,
      ...patch,
      quietHours: {
        ...this.settings.quietHours,
        ...(patch.quietHours ?? {})
      },
      windowPosition:
        patch.windowPosition === undefined
          ? this.settings.windowPosition
          : patch.windowPosition
            ? { ...patch.windowPosition }
            : null
    }

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
        return {
          ...DEFAULT_SETTINGS,
          quietHours: { ...DEFAULT_SETTINGS.quietHours }
        }
      }
      const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
      return mergeSettings(raw)
    } catch (error) {
      console.warn('[settings] failed to load, using defaults', error)
      return {
        ...DEFAULT_SETTINGS,
        quietHours: { ...DEFAULT_SETTINGS.quietHours }
      }
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
