import type { DialogueEvent, DialogueResponse } from './dialogue'
import type { AppSettings, PetRuntimeState } from './settings'

/** Channel names shared between main and renderer (preload bridge). */
export const IpcChannels = {
  SET_IGNORE_MOUSE_EVENTS: 'pet:set-ignore-mouse-events',
  GET_RUNTIME_STATE: 'pet:get-runtime-state',
  RUNTIME_STATE_CHANGED: 'pet:runtime-state-changed',
  GET_SETTINGS: 'settings:get',
  UPDATE_SETTINGS: 'settings:update',
  SETTINGS_CHANGED: 'settings:changed',
  OPEN_MAIN_APP: 'app:open-main',
  OPEN_SETTINGS: 'app:open-settings',
  REPORT_PERF: 'pet:report-perf',
  NUDGE_WINDOW: 'pet:nudge-window',
  SET_WINDOW_POSITION: 'pet:set-window-position',
  /** Fire-and-forget position updates while dragging (avoids IPC backlog / jitter). */
  MOVE_WINDOW_LIVE: 'pet:move-window-live',
  GET_WINDOW_METRICS: 'pet:get-window-metrics',
  SET_DRAG_ACTIVE: 'pet:set-drag-active',
  FLUSH_WINDOW_POSITION: 'pet:flush-window-position',
  /** Main → pet: show a speech / choice prompt. */
  DIALOGUE_SHOW: 'pet:dialogue-show',
  /** Pet → main: user picked a choice (or dismissed). */
  DIALOGUE_RESPOND: 'pet:dialogue-respond',
  /** Pet → main: non-choice bubble finished / dismissed. */
  DIALOGUE_DISMISS: 'pet:dialogue-dismiss',
  /** Main → pet (dev only): force sleep / wake for animation testing. */
  DEBUG_BEHAVIOUR: 'pet:debug-behaviour'
} as const

export type DebugBehaviourCommand = 'sleep' | 'wake'

export type PerfSnapshot = {
  fps: number
  triangles: number
  drawCalls: number
  geometries: number
  textures: number
}

export type WindowMetrics = {
  x: number
  y: number
  width: number
  height: number
  workArea: { x: number; y: number; width: number; height: number }
}

export type NudgeResult = {
  x: number
  y: number
  hitLeft: boolean
  hitRight: boolean
  hitTop: boolean
  hitBottom: boolean
}

export type PetApi = {
  setIgnoreMouseEvents: (ignore: boolean) => void
  getRuntimeState: () => Promise<PetRuntimeState>
  onRuntimeStateChanged: (handler: (state: PetRuntimeState) => void) => () => void
  getSettings: () => Promise<AppSettings>
  updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
  onSettingsChanged: (handler: (settings: AppSettings) => void) => () => void
  openMainApp: () => void
  openSettings: () => void
  reportPerf: (snapshot: PerfSnapshot) => void
  nudgeWindow: (dx: number, dy: number) => Promise<NudgeResult | null>
  setWindowPosition: (x: number, y: number) => Promise<NudgeResult | null>
  /** Synchronous-feeling drag updates (main handles immediately). */
  moveWindowLive: (x: number, y: number) => void
  getWindowMetrics: () => Promise<WindowMetrics | null>
  setDragActive: (active: boolean) => void
  flushWindowPosition: () => void
  onDialogue: (handler: (event: DialogueEvent) => void) => () => void
  respondDialogue: (response: DialogueResponse) => void
  dismissDialogue: (dialogueId: string) => void
  /** Development-only sleep/wake test hooks from the tray. */
  onDebugBehaviour: (handler: (command: DebugBehaviourCommand) => void) => () => void
}
