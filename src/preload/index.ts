import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IpcChannels,
  type DebugBehaviourCommand,
  type NudgeResult,
  type PerfSnapshot,
  type PetApi,
  type WindowMetrics
} from '../shared/ipc'
import type { AppSettings, PetRuntimeState } from '../shared/settings'
import type { DialogueEvent, DialogueResponse } from '../shared/dialogue'

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

  onSettingsChanged: (handler) => {
    const listener = (_event: IpcRendererEvent, settings: AppSettings): void => {
      handler(settings)
    }
    ipcRenderer.on(IpcChannels.SETTINGS_CHANGED, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.SETTINGS_CHANGED, listener)
    }
  },

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
  },

  onDialogue: (handler) => {
    const listener = (_event: IpcRendererEvent, dialogue: DialogueEvent): void => {
      handler(dialogue)
    }
    ipcRenderer.on(IpcChannels.DIALOGUE_SHOW, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.DIALOGUE_SHOW, listener)
    }
  },

  respondDialogue: (response: DialogueResponse) => {
    ipcRenderer.send(IpcChannels.DIALOGUE_RESPOND, response)
  },

  dismissDialogue: (dialogueId: string) => {
    ipcRenderer.send(IpcChannels.DIALOGUE_DISMISS, dialogueId)
  },

  onDebugBehaviour: (handler) => {
    const listener = (_event: IpcRendererEvent, command: DebugBehaviourCommand): void => {
      handler(command)
    }
    ipcRenderer.on(IpcChannels.DEBUG_BEHAVIOUR, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.DEBUG_BEHAVIOUR, listener)
    }
  }
}

contextBridge.exposeInMainWorld('pet', petApi)
