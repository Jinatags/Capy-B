import { useCallback, useEffect, useState, type JSX, type ReactNode } from 'react'
import { type AppSettings, type ReminderSettings } from '@shared/settings'

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' }
]

function Section({
  title,
  children
}: {
  title: string
  children: ReactNode
}): JSX.Element {
  return (
    <section className="space-y-3 rounded-2xl border border-cocoa/10 bg-white/55 p-4 shadow-sm">
      <h2 className="text-sm font-bold tracking-wide text-cocoa/80 uppercase">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Toggle({
  label,
  checked,
  onChange,
  hint
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
  hint?: string
}): JSX.Element {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span>
        <span className="block text-sm font-semibold text-cocoa">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-cocoa/60">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-cocoa"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

/**
 * Reminder + quiet-hours settings panel (opened from the tray).
 * Header stays fixed; form body scrolls in `.settings-scroll`.
 */
export function SettingsApp(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const isDev = import.meta.env.DEV

  useEffect(() => {
    let disposed = false
    void window.pet?.getSettings().then((next) => {
      if (!disposed) setSettings(next)
    })
    const unsub = window.pet?.onSettingsChanged((next) => {
      setSettings(next)
    })
    return () => {
      disposed = true
      unsub?.()
    }
  }, [])

  const patch = useCallback(async (partial: Partial<AppSettings>) => {
    const next = await window.pet?.updateSettings(partial)
    if (next) {
      setSettings(next)
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1200)
    }
  }, [])

  const patchReminders = useCallback(
    async (partial: Partial<ReminderSettings>) => {
      if (!settings) return
      await patch({
        reminders: {
          ...settings.reminders,
          ...partial,
          waterTimes: partial.waterTimes ?? settings.reminders.waterTimes,
          healthyEatingDays: partial.healthyEatingDays ?? settings.reminders.healthyEatingDays
        }
      })
    },
    [patch, settings]
  )

  if (!settings) {
    return (
      <div className="settings-shell items-center justify-center">
        <p className="text-cocoa">Loading…</p>
      </div>
    )
  }

  const { reminders, quietHours } = settings
  const selectedDays = reminders.healthyEatingDays.length

  return (
    <div className="settings-shell">
      <header className="shrink-0 px-5 pb-3 pt-5">
        <h1 className="text-2xl font-bold tracking-tight text-cocoa">Capy B Settings</h1>
        <p className="mt-1 text-sm text-cocoa/65">
          Soft reminders, quiet hours, and a little personality.
        </p>
        {savedFlash ? (
          <p className="mt-2 text-xs font-semibold text-cocoa/70">Saved ♡</p>
        ) : null}
      </header>

      <div className="settings-scroll px-5 pb-8">
        <div className="space-y-4">
          <Section title="Reminders">
            <Toggle
              label="Enable reminders"
              hint="Master switch for greetings and habit nudges."
              checked={settings.enableReminders}
              onChange={(enableReminders) => void patch({ enableReminders })}
            />
            <Toggle
              label="Morning greeting"
              hint="“good morning princess” once each morning (5:00–12:00)."
              checked={reminders.enableMorningGreeting}
              onChange={(enableMorningGreeting) => void patchReminders({ enableMorningGreeting })}
            />
            <Toggle
              label="Water reminders"
              hint="Twice a day — 'it is time to pay tax' with okay / i don't wanna."
              checked={reminders.enableWaterReminders}
              onChange={(enableWaterReminders) => void patchReminders({ enableWaterReminders })}
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-cocoa/70">
                Water time 1
                <input
                  type="time"
                  className="mt-1 w-full rounded-lg border border-cocoa/15 bg-white px-2 py-1.5 text-sm"
                  value={reminders.waterTimes[0]}
                  onChange={(e) =>
                    void patchReminders({
                      waterTimes: [e.target.value, reminders.waterTimes[1]]
                    })
                  }
                />
              </label>
              <label className="text-xs font-semibold text-cocoa/70">
                Water time 2
                <input
                  type="time"
                  className="mt-1 w-full rounded-lg border border-cocoa/15 bg-white px-2 py-1.5 text-sm"
                  value={reminders.waterTimes[1]}
                  onChange={(e) =>
                    void patchReminders({
                      waterTimes: [reminders.waterTimes[0], e.target.value]
                    })
                  }
                />
              </label>
            </div>

            <Toggle
              label="Healthy eating"
              hint="Pick any days — twice weekly is the default (Tue + Fri)."
              checked={reminders.enableHealthyEatingReminders}
              onChange={(enableHealthyEatingReminders) =>
                void patchReminders({ enableHealthyEatingReminders })
              }
            />
            <div>
              <p className="mb-1.5 text-xs font-semibold text-cocoa/70">
                Days ({selectedDays} selected
                {selectedDays === 2 ? ' · twice weekly' : ''})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => {
                  const active = reminders.healthyEatingDays.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      type="button"
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        active
                          ? 'bg-cocoa text-cream'
                          : 'border border-cocoa/15 bg-white text-cocoa/70'
                      }`}
                      onClick={() => {
                        const next = active
                          ? reminders.healthyEatingDays.filter((d) => d !== day.value)
                          : [...reminders.healthyEatingDays, day.value].sort((a, b) => a - b)
                        // Keep at least one day so the schedule stays valid.
                        void patchReminders({
                          healthyEatingDays: next.length ? next : [day.value]
                        })
                      }}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <label className="block text-xs font-semibold text-cocoa/70">
              Healthy eating time
              <input
                type="time"
                className="mt-1 w-full rounded-lg border border-cocoa/15 bg-white px-2 py-1.5 text-sm"
                value={reminders.healthyEatingTime}
                onChange={(e) => void patchReminders({ healthyEatingTime: e.target.value })}
              />
            </label>
          </Section>

          <Section title="Quiet hours">
            <Toggle
              label="Enable quiet hours"
              hint="No reminders during this window (overnight wrap OK)."
              checked={quietHours.enabled}
              onChange={(enabled) => void patch({ quietHours: { ...quietHours, enabled } })}
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-cocoa/70">
                Start
                <input
                  type="time"
                  className="mt-1 w-full rounded-lg border border-cocoa/15 bg-white px-2 py-1.5 text-sm"
                  value={quietHours.start}
                  onChange={(e) =>
                    void patch({ quietHours: { ...quietHours, start: e.target.value } })
                  }
                />
              </label>
              <label className="text-xs font-semibold text-cocoa/70">
                End
                <input
                  type="time"
                  className="mt-1 w-full rounded-lg border border-cocoa/15 bg-white px-2 py-1.5 text-sm"
                  value={quietHours.end}
                  onChange={(e) =>
                    void patch({ quietHours: { ...quietHours, end: e.target.value } })
                  }
                />
              </label>
            </div>
          </Section>

          <Section title="Companion">
            <Toggle
              label="Enable walking"
              checked={settings.enableWalking}
              onChange={(enableWalking) => void patch({ enableWalking })}
            />
            <Toggle
              label="Launch at login"
              hint={
                isDev
                  ? 'Disabled while developing (npm run dev).'
                  : 'Start Capy B when you log in to macOS.'
              }
              checked={settings.launchAtLogin}
              onChange={(launchAtLogin) => {
                if (isDev) return
                void patch({ launchAtLogin })
              }}
            />
          </Section>
        </div>
      </div>
    </div>
  )
}
