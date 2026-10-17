import type { QuietHoursSettings, ReminderSettings, ReminderFireState } from './settings'

/** Local calendar date `YYYY-MM-DD`. */
export function localDateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Minutes since local midnight. */
export function minutesSinceMidnight(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes()
}

/** Parse `"HH:mm"` → minutes since midnight, or null if invalid. */
export function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }
  return hours * 60 + minutes
}

export function formatMinutesAsTime(total: number): string {
  const clamped = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Quiet hours spanning midnight (e.g. 22:00–08:00) are supported.
 * Disabled quiet hours never block.
 */
export function isInQuietHours(quiet: QuietHoursSettings, date = new Date()): boolean {
  if (!quiet.enabled) return false
  const start = parseTimeToMinutes(quiet.start)
  const end = parseTimeToMinutes(quiet.end)
  if (start === null || end === null) return false

  const now = minutesSinceMidnight(date)
  if (start === end) return true
  if (start < end) {
    return now >= start && now < end
  }
  // Wraps past midnight.
  return now >= start || now < end
}

export function isMorningWindow(date = new Date()): boolean {
  const minutes = minutesSinceMidnight(date)
  // 05:00 – 11:59
  return minutes >= 5 * 60 && minutes < 12 * 60
}

export type DueReminder =
  | { kind: 'morning' }
  | { kind: 'water'; slotIndex: number }
  | { kind: 'healthyEating' }

/**
 * Pick at most one due reminder for this tick (priority: morning → water → food).
 */
export function findDueReminder(
  reminders: ReminderSettings,
  fireState: ReminderFireState,
  date = new Date()
): DueReminder | null {
  const today = localDateKey(date)
  const nowMinutes = minutesSinceMidnight(date)

  if (reminders.enableMorningGreeting && isMorningWindow(date)) {
    if (fireState.morningGreetingDate !== today) {
      return { kind: 'morning' }
    }
  }

  if (reminders.enableWaterReminders) {
    for (let i = 0; i < reminders.waterTimes.length; i += 1) {
      const slot = parseTimeToMinutes(reminders.waterTimes[i] ?? '')
      if (slot === null) continue
      if (nowMinutes < slot) continue
      if (fireState.waterFired[String(i)] === today) continue
      return { kind: 'water', slotIndex: i }
    }
  }

  if (reminders.enableHealthyEatingReminders) {
    const weekday = date.getDay() // 0 Sun … 6 Sat
    if (reminders.healthyEatingDays.includes(weekday)) {
      const at = parseTimeToMinutes(reminders.healthyEatingTime)
      if (at !== null && nowMinutes >= at && fireState.healthyEatingDate !== today) {
        return { kind: 'healthyEating' }
      }
    }
  }

  return null
}

export function markReminderFired(
  fireState: ReminderFireState,
  due: DueReminder,
  date = new Date()
): ReminderFireState {
  const today = localDateKey(date)
  if (due.kind === 'morning') {
    return { ...fireState, morningGreetingDate: today }
  }
  if (due.kind === 'water') {
    return {
      ...fireState,
      waterFired: { ...fireState.waterFired, [String(due.slotIndex)]: today }
    }
  }
  return { ...fireState, healthyEatingDate: today }
}
