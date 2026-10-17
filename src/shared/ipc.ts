import type { AppSettings, PetRuntimeState } from './settings'

/** Channel names shared between main and renderer (preload bridge). */
export const IpcChannels = {
  SET_IGNORE_MOUSE_EVENTS: 'pet:set-ignore-mouse-events',
  GET_RUNTIME_STATE: 'pet:get-runtime-state',
  RUNTIME_STATE_CHANGED: 'pet:runtime-state-changed',
  GET_SETTINGS: 'settings:get',
  UPDATE_SETTINGS: 'settings:update',
  OPEN_MAIN_APP: 'app:open-main',
  OPEN_SETTINGS: 'app:open-settings',
  REPORT_PERF: 'pet:report-perf',
  NUDGE_WINDOW: 'pet:nudge-window',
  SET_WINDOW_POSITION: 'pet:set-window-position',
  /** Fire-and-forget position updates while dragging (avoids IPC backlog / jitter). */
  MOVE_WINDOW_LIVE: 'pet:move-window-live',
  GET_WINDOW_METRICS: 'pet:get-window-metrics',
  SET_DRAG_ACTIVE: 'pet:set-drag-active',
  FLUSH_WINDOW_POSITION: 'pet:flush-window-position'
} as const

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
}
