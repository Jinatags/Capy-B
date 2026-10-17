import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/** Minimal mirror of shared reminder helpers for zero-dep Node tests. */

function parseTimeToMinutes(value) {
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

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes()
}

function localDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isInQuietHours(quiet, date = new Date()) {
  if (!quiet.enabled) return false
  const start = parseTimeToMinutes(quiet.start)
  const end = parseTimeToMinutes(quiet.end)
  if (start === null || end === null) return false
  const now = minutesSinceMidnight(date)
  if (start === end) return true
  if (start < end) return now >= start && now < end
  return now >= start || now < end
}

function isMorningWindow(date = new Date()) {
  const minutes = minutesSinceMidnight(date)
  return minutes >= 5 * 60 && minutes < 12 * 60
}

function findDueReminder(reminders, fireState, date = new Date()) {
  const today = localDateKey(date)
  const nowMinutes = minutesSinceMidnight(date)

  if (reminders.enableMorningGreeting && isMorningWindow(date)) {
    if (fireState.morningGreetingDate !== today) return { kind: 'morning' }
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
    const weekday = date.getDay()
    if (reminders.healthyEatingDays.includes(weekday)) {
      const at = parseTimeToMinutes(reminders.healthyEatingTime)
      if (at !== null && nowMinutes >= at && fireState.healthyEatingDate !== today) {
        return { kind: 'healthyEating' }
      }
    }
  }

  return null
}

const DEFAULT_REMINDER_SETTINGS = {
  enableMorningGreeting: true,
  enableWaterReminders: true,
  waterTimes: ['11:00', '16:00'],
  enableHealthyEatingReminders: true,
  healthyEatingDays: [2, 5],
  healthyEatingTime: '12:30'
}

describe('reminders (logic)', () => {
  it('parses HH:mm', () => {
    assert.equal(parseTimeToMinutes('11:00'), 11 * 60)
    assert.equal(parseTimeToMinutes('24:00'), null)
  })

  it('detects quiet hours wrapping midnight', () => {
    const quiet = { enabled: true, start: '22:00', end: '08:00' }
    assert.equal(isInQuietHours(quiet, new Date(2026, 0, 1, 23, 0)), true)
    assert.equal(isInQuietHours(quiet, new Date(2026, 0, 2, 7, 0)), true)
    assert.equal(isInQuietHours(quiet, new Date(2026, 0, 2, 12, 0)), false)
  })

  it('fires morning greeting in the morning window', () => {
    const morning = new Date(2026, 0, 5, 9, 0)
    const due = findDueReminder(
      DEFAULT_REMINDER_SETTINGS,
      { morningGreetingDate: null, waterFired: {}, healthyEatingDate: null },
      morning
    )
    assert.deepEqual(due, { kind: 'morning' })
  })

  it('fires second water slot after 16:00 when first already fired', () => {
    const afternoon = new Date(2026, 0, 5, 16, 30)
    const due = findDueReminder(
      DEFAULT_REMINDER_SETTINGS,
      {
        morningGreetingDate: '2026-01-05',
        waterFired: { 0: '2026-01-05' },
        healthyEatingDate: null
      },
      afternoon
    )
    assert.deepEqual(due, { kind: 'water', slotIndex: 1 })
  })
})
