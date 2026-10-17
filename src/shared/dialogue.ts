/** Interactive dialogue payloads shared between main and renderer. */

export type MoodReaction = 'happy' | 'annoyed' | 'disappointed'

export type DialogueKind = 'morning' | 'water' | 'healthyEating' | 'click' | 'reaction'

export type DialogueChoice = {
  id: string
  label: string
  reaction: MoodReaction
  /** Exact reply line after choosing (overrides random reaction lines). */
  reply?: string
  /**
   * After showing {@link reply}, re-open the same prompt + choices
   * (used by water “i don't wanna” nag).
   */
  persistPrompt?: boolean
}

export type DialogueEvent = {
  /** Unique id for this prompt instance. */
  id: string
  kind: DialogueKind
  text: string
  choices?: DialogueChoice[]
  /** How long to hold a non-choice bubble before auto-dismiss (ms). */
  holdMs?: number
}

export type DialogueResponse = {
  dialogueId: string
  choiceId: string
  reaction: MoodReaction
}

/** Soft click-lines — rotated when the user taps Capy B. */
export const CLICK_LINES = [
  'hello princess ♡',
  'hi hi~',
  "i'm right here ♡",
  'you found me',
  'hehe… hi',
  'need a tiny hug?'
] as const

export const MORNING_GREETING = 'good morning princess'

export const WATER_REMINDER_TEXT = 'it is time to pay tax'

export const WATER_NAG_TEXT = 'you have to pay tax'

export const WATER_OK_REPLY = 'good girl'

export const HEALTHY_EATING_TEXT = 'eat something kind today ♡'

/** Phase 3 water reminder — two buttons with the specified reply loop. */
export const WATER_CHOICES: DialogueChoice[] = [
  {
    id: 'water-okay',
    label: 'okay',
    reaction: 'happy',
    reply: WATER_OK_REPLY
  },
  {
    id: 'water-no',
    label: "i don't wanna",
    reaction: 'annoyed',
    reply: WATER_NAG_TEXT,
    persistPrompt: true
  }
]

export const HEALTHY_EATING_CHOICES: DialogueChoice[] = [
  { id: 'food-yes', label: 'okay', reaction: 'happy', reply: 'good girl' },
  {
    id: 'food-no',
    label: "i don't wanna",
    reaction: 'annoyed',
    reply: 'please eat something nice ♡',
    persistPrompt: true
  }
]

export const REACTION_LINES: Record<MoodReaction, readonly string[]> = {
  happy: ['yay ♡', 'good job princess', 'i knew you could', 'proud of you~'],
  annoyed: ['hmph…', "i'm waiting", "don't forget me", 'okay… fine'],
  disappointed: ['oh… okay', "i'll remind you later", 'take care of yourself', '…alright']
}

let clickIndex = 0

export function nextClickLine(): string {
  const line = CLICK_LINES[clickIndex % CLICK_LINES.length]
  clickIndex += 1
  return line
}

export function reactionLine(reaction: MoodReaction): string {
  const lines = REACTION_LINES[reaction]
  return lines[Math.floor(Math.random() * lines.length)] ?? '…'
}

export function createDialogueId(kind: DialogueKind): string {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
