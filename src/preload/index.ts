import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IpcChannels,
  type NudgeResult,
  type PerfSnapshot,
  type PetApi,
  type WindowMetrics
} from '../shared/ipc'
import type { AppSettings, PetRuntimeState } from '../shared/settings'

const petApi: PetApi = {
  setIgnoreMouseEvents: (ignore: boolean) => {
    ipcRenderer.send(IpcChannels.SET_IGNORE_MOUSE_EVENTS, ignore)
  },

  getRuntimeState: () =>
    ipcRenderer.invoke(IpcChannels.GET_RUNTIME_STATE) as Promise<PetRuntimeState>,

  onRuntimeStateChanged: (handler) => {
    const listener = (_event: IpcRendererEvent, state: PetRuntimeState): void => {
      handler(state)
    }
    ipcRenderer.on(IpcChannels.RUNTIME_STATE_CHANGED, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.RUNTIME_STATE_CHANGED, listener)
    }
  },

  getSettings: () => ipcRenderer.invoke(IpcChannels.GET_SETTINGS) as Promise<AppSettings>,

  updateSettings: (patch) =>
    ipcRenderer.invoke(IpcChannels.UPDATE_SETTINGS, patch) as Promise<AppSettings>,

  openMainApp: () => {
    ipcRenderer.send(IpcChannels.OPEN_MAIN_APP)
  },

  openSettings: () => {
    ipcRenderer.send(IpcChannels.OPEN_SETTINGS)
  },

  reportPerf: (snapshot: PerfSnapshot) => {
    ipcRenderer.send(IpcChannels.REPORT_PERF, snapshot)
  },

  nudgeWindow: (dx, dy) =>
    ipcRenderer.invoke(IpcChannels.NUDGE_WINDOW, dx, dy) as Promise<NudgeResult | null>,

  setWindowPosition: (x, y) =>
    ipcRenderer.invoke(IpcChannels.SET_WINDOW_POSITION, x, y) as Promise<NudgeResult | null>,

  moveWindowLive: (x, y) => {
    ipcRenderer.send(IpcChannels.MOVE_WINDOW_LIVE, x, y)
  },

  getWindowMetrics: () =>
    ipcRenderer.invoke(IpcChannels.GET_WINDOW_METRICS) as Promise<WindowMetrics | null>,

  setDragActive: (active: boolean) => {
    ipcRenderer.send(IpcChannels.SET_DRAG_ACTIVE, active)
  },

  flushWindowPosition: () => {
    ipcRenderer.send(IpcChannels.FLUSH_WINDOW_POSITION)
  }
}

contextBridge.exposeInMainWorld('pet', petApi)
