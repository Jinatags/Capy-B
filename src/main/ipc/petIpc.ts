import { app, ipcMain } from 'electron'
import { IpcChannels, type PerfSnapshot } from '../../shared/ipc'
import type { AppSettings } from '../../shared/settings'
import type { DialogueResponse } from '../../shared/dialogue'
import type { PetController } from '../app/petController'
import { clampPositionToWorkArea } from '../windows/workArea'
import { defaultPetWindowSize } from '../windows/petWindow'

/**
 * Registers pet + settings IPC. Surface stays narrow and typed via preload.
 */
export function registerPetIpc(controller: PetController): void {
  ipcMain.on(IpcChannels.SET_IGNORE_MOUSE_EVENTS, (_event, ignore: unknown) => {
    if (typeof ignore !== 'boolean') return
    if (controller.getRuntimeState().paused) return

    const win = controller.getPetWindow()
    if (!win || win.isDestroyed()) return

    if (controller.isDragActive() && ignore) return

    if (ignore) {
      win.setIgnoreMouseEvents(true, { forward: true })
    } else {
      win.setIgnoreMouseEvents(false)
    }
  })

  ipcMain.handle(IpcChannels.GET_RUNTIME_STATE, () => controller.getRuntimeState())

  ipcMain.handle(IpcChannels.GET_SETTINGS, () => controller.getSettings())

  ipcMain.handle(IpcChannels.UPDATE_SETTINGS, (_event, patch: unknown) => {
    if (typeof patch !== 'object' || patch === null) {
      return controller.getSettings()
    }
    return controller.updateSettings(patch as Partial<AppSettings>)
  })

  ipcMain.on(IpcChannels.OPEN_MAIN_APP, () => {
    controller.openMainAppPlaceholder()
  })

  ipcMain.on(IpcChannels.OPEN_SETTINGS, () => {
    controller.openSettings()
  })

  ipcMain.on(IpcChannels.REPORT_PERF, (_event, snapshot: unknown) => {
    if (typeof snapshot !== 'object' || snapshot === null) return
    const perf = snapshot as PerfSnapshot
    if (typeof perf.fps !== 'number' || typeof perf.triangles !== 'number') return

    if (!app.isPackaged) {
      console.log(
        `[perf] fps=${perf.fps.toFixed(1)} tris=${perf.triangles} draws=${perf.drawCalls} geo=${perf.geometries} tex=${perf.textures}`
      )
    }
  })

  ipcMain.handle(IpcChannels.NUDGE_WINDOW, (_event, dx: unknown, dy: unknown) => {
    if (typeof dx !== 'number' || typeof dy !== 'number') {
      return null
    }
    return controller.nudgeWindow(dx, dy)
  })

  ipcMain.handle(IpcChannels.SET_WINDOW_POSITION, (_event, x: unknown, y: unknown) => {
    if (typeof x !== 'number' || typeof y !== 'number') {
      return null
    }
    return controller.setWindowPosition(x, y)
  })

  ipcMain.on(IpcChannels.MOVE_WINDOW_LIVE, (_event, x: unknown, y: unknown) => {
    if (typeof x !== 'number' || typeof y !== 'number') return
    controller.setWindowPosition(x, y)
  })

  ipcMain.handle(IpcChannels.GET_WINDOW_METRICS, () => {
    const win = controller.getPetWindow()
    if (!win || win.isDestroyed()) return null
    const [x, y] = win.getPosition()
    const [width, height] = win.getSize()
    const fallback = defaultPetWindowSize(controller.getSettings().petSize)
    const clamped = clampPositionToWorkArea(
      x,
      y,
      width || fallback.width,
      height || fallback.height
    )
    return {
      x,
      y,
      width: width || fallback.width,
      height: height || fallback.height,
      workArea: clamped.workArea
    }
  })

  ipcMain.on(IpcChannels.SET_DRAG_ACTIVE, (_event, active: unknown) => {
    if (typeof active !== 'boolean') return
    controller.setDragActive(active)
  })

  ipcMain.on(IpcChannels.FLUSH_WINDOW_POSITION, () => {
    controller.flushWindowPosition()
  })

  ipcMain.on(IpcChannels.DIALOGUE_RESPOND, (_event, payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) return
    const response = payload as DialogueResponse
    if (
      typeof response.dialogueId !== 'string' ||
      typeof response.choiceId !== 'string' ||
      (response.reaction !== 'happy' &&
        response.reaction !== 'annoyed' &&
        response.reaction !== 'disappointed')
    ) {
      return
    }
    controller.clearDialogueBusy()
  })

  ipcMain.on(IpcChannels.DIALOGUE_DISMISS, (_event, dialogueId: unknown) => {
    if (typeof dialogueId !== 'string') return
    void dialogueId
    controller.clearDialogueBusy()
  })
}
