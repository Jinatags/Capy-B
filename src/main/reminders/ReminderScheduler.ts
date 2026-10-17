import type { SettingsStore } from '../settings/store'
import {
  createDialogueId,
  HEALTHY_EATING_CHOICES,
  HEALTHY_EATING_TEXT,
  MORNING_GREETING,
  WATER_CHOICES,
  WATER_REMINDER_TEXT,
  type DialogueEvent
} from '../../shared/dialogue'
import {
  findDueReminder,
  isInQuietHours,
  markReminderFired
} from '../../shared/reminders'

const TICK_MS = 20_000
const STARTUP_DELAY_MS = 2_500

export type ReminderSchedulerHost = {
  getStore: () => SettingsStore
  /** Whether the pet is paused (blocks reminders). */
  isPaused: () => boolean
  /** Ensure the pet is visible before showing a prompt. */
  ensurePetVisible: () => void
  /** Deliver a dialogue event to the pet renderer. */
  presentDialogue: (event: DialogueEvent) => void
  /** True while a dialogue is awaiting a response / on screen. */
  isDialogueBusy: () => boolean
}

/**
 * Lightweight local scheduler for morning greetings, water, and healthy-eating prompts.
 * Persists fire markers in settings so relaunches don’t spam the same slot.
 */
export class ReminderScheduler {
  private timer: NodeJS.Timeout | null = null
  private startupTimer: NodeJS.Timeout | null = null
  private readonly host: ReminderSchedulerHost

  constructor(host: ReminderSchedulerHost) {
    this.host = host
  }

  start(): void {
    this.stop()
    this.startupTimer = setTimeout(() => {
      this.tick()
      this.timer = setInterval(() => this.tick(), TICK_MS)
    }, STARTUP_DELAY_MS)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.startupTimer) {
      clearTimeout(this.startupTimer)
      this.startupTimer = null
    }
  }

  /** Call after settings changes that affect scheduling. */
  wake(): void {
    this.tick()
  }

  private tick(): void {
    const settings = this.host.getStore().get()
    if (!settings.enableReminders) return
    if (this.host.isPaused()) return
    if (this.host.isDialogueBusy()) return
    if (isInQuietHours(settings.quietHours)) return

    const due = findDueReminder(settings.reminders, settings.reminderFireState)
    if (!due) return

    const event = this.buildEvent(due)
    this.host.getStore().update({
      reminderFireState: markReminderFired(settings.reminderFireState, due)
    })
    this.host.ensurePetVisible()
    this.host.presentDialogue(event)
  }

  private buildEvent(due: ReturnType<typeof findDueReminder>): DialogueEvent {
    if (!due) {
      return {
        id: createDialogueId('morning'),
        kind: 'morning',
        text: MORNING_GREETING,
        holdMs: 3200
      }
    }

    if (due.kind === 'morning') {
      return {
        id: createDialogueId('morning'),
        kind: 'morning',
        text: MORNING_GREETING,
        holdMs: 3400
      }
    }

    if (due.kind === 'water') {
      return {
        id: createDialogueId('water'),
        kind: 'water',
        text: WATER_REMINDER_TEXT,
        choices: WATER_CHOICES,
        holdMs: 12_000
      }
    }

    return {
      id: createDialogueId('healthyEating'),
      kind: 'healthyEating',
      text: HEALTHY_EATING_TEXT,
      choices: HEALTHY_EATING_CHOICES,
      holdMs: 12_000
    }
  }
}
