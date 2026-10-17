import { app, BrowserWindow, dialog, screen } from 'electron'
import type { Tray } from 'electron'
import { SettingsStore } from '../settings/store'
import {
  createPetWindow,
  defaultPetWindowSize,
  isWindowPositionOffscreen
} from '../windows/petWindow'
import { createSettingsWindow } from '../windows/settingsWindow'
import { clampPositionToWorkArea } from '../windows/workArea'
import { createAppTray, refreshTrayMenu } from '../tray/createTray'
import { ReminderScheduler } from '../reminders/ReminderScheduler'
import { toPetRuntimeState, type AppSettings, type PetRuntimeState } from '../../shared/settings'
import { layoutForPetSize, type PetSizeId } from '../../shared/petSize'
import { IpcChannels, type DebugBehaviourCommand, type NudgeResult } from '../../shared/ipc'
import type { DialogueEvent } from '../../shared/dialogue'

/**
 * Owns desktop-pet lifecycle: window, tray, persisted settings, pause/visibility/size,
 * and Phase 3 reminder / dialogue delivery.
 */
export class PetController {
  private readonly store = new SettingsStore()
  private petWindow: BrowserWindow | null = null
  private settingsWindow: BrowserWindow | null = null
  private tray: Tray | null = null
  private isQuitting = false
  private positionSaveTimer: NodeJS.Timeout | null = null
  private dragActive = false
  private suppressMovePersist = false
  private dialogueBusy = false
  private readonly scheduler = new ReminderScheduler({
    getStore: () => this.store,
    isPaused: () => this.store.get().petPaused,
    ensurePetVisible: () => this.showPet(),
    presentDialogue: (event) => this.presentDialogue(event),
    isDialogueBusy: () => this.dialogueBusy
  })

  start(): void {
    app.on('before-quit', () => {
      this.isQuitting = true
      this.persistWindowPosition()
      this.scheduler.stop()
    })

    const trayActions = {
      getSettings: () => this.store.get(),
      onShowHide: () => this.toggleVisibility(),
      onPauseResume: () => this.togglePaused(),
      onToggleWalking: () => this.toggleWalking(),
      onToggleReminders: () => this.toggleReminders(),
      onSetPetSize: (size: PetSizeId) => this.setPetSize(size),
      onOpenMainApp: () => this.openMainAppPlaceholder(),
      onOpenSettings: () => this.openSettings(),
      onQuit: () => this.quit(),
      ...(app.isPackaged
        ? {}
        : {
            onTestSleep: () => this.sendDebugBehaviour('sleep'),
            onTestWake: () => this.sendDebugBehaviour('wake')
          })
    }
    this.tray = createAppTray(trayActions)

    this.createOrShowPetWindow()
    this.applyVisibility(this.store.get().petVisible)
    this.broadcastRuntimeState()
    this.scheduler.start()
  }

  getPetWindow(): BrowserWindow | null {
    return this.petWindow
  }

  isDragActive(): boolean {
    return this.dragActive
  }

  setDragActive(active: boolean): void {
    this.dragActive = active
    if (!active) {
      this.persistWindowPosition()
    }
  }

  flushWindowPosition(): void {
    this.persistWindowPosition()
  }

  getSettings(): AppSettings {
    return this.store.get()
  }

  getRuntimeState(): PetRuntimeState {
    return toPetRuntimeState(this.store.get())
  }

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    const prev = this.store.get()
    const next = this.store.update(patch)

    if (prev.petVisible !== next.petVisible) {
      this.applyVisibility(next.petVisible)
    }

    if (prev.petSize !== next.petSize) {
      this.applyPetSize(next.petSize, { persistCenter: true })
    }

    const runtimeChanged =
      prev.petPaused !== next.petPaused ||
      prev.petSize !== next.petSize ||
      prev.enableWalking !== next.enableWalking ||
      prev.walkSpeed !== next.walkSpeed ||
      prev.walkIntervalMinSec !== next.walkIntervalMinSec ||
      prev.walkIntervalMaxSec !== next.walkIntervalMaxSec ||
      prev.enableReminders !== next.enableReminders ||
      JSON.stringify(prev.quietHours) !== JSON.stringify(next.quietHours) ||
      JSON.stringify(prev.reminders) !== JSON.stringify(next.reminders)

    if (runtimeChanged) {
      this.broadcastRuntimeState()
    }

    this.broadcastSettings()

    if (app.isPackaged && prev.launchAtLogin !== next.launchAtLogin) {
      app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, openAsHidden: true })
    }

    refreshTrayMenu(this.tray, next)
    this.scheduler.wake()
    return next
  }

  toggleVisibility(): void {
    const visible = !this.store.get().petVisible
    this.store.update({ petVisible: visible })
    this.applyVisibility(visible)
    refreshTrayMenu(this.tray, this.store.get())
    this.broadcastRuntimeState()
    this.broadcastSettings()
  }

  togglePaused(): void {
    const paused = !this.store.get().petPaused
    this.store.update({ petPaused: paused })
    refreshTrayMenu(this.tray, this.store.get())
    this.broadcastRuntimeState()
    this.broadcastSettings()
    this.scheduler.wake()
  }

  toggleWalking(): void {
    const enableWalking = !this.store.get().enableWalking
    this.store.update({ enableWalking })
    refreshTrayMenu(this.tray, this.store.get())
    this.broadcastRuntimeState()
    this.broadcastSettings()
  }

  toggleReminders(): void {
    const enableReminders = !this.store.get().enableReminders
    this.store.update({ enableReminders })
    refreshTrayMenu(this.tray, this.store.get())
    this.broadcastRuntimeState()
    this.broadcastSettings()
    this.scheduler.wake()
  }

  setPetSize(petSize: PetSizeId): void {
    if (this.store.get().petSize === petSize) return
    this.store.update({ petSize })
    this.applyPetSize(petSize, { persistCenter: true })
    refreshTrayMenu(this.tray, this.store.get())
    this.broadcastRuntimeState()
    this.broadcastSettings()
  }

  showPet(): void {
    if (!this.store.get().petVisible) {
      this.store.update({ petVisible: true })
    }
    this.applyVisibility(true)
    this.ensurePetOnScreen({ reason: 'showPet' })
    refreshTrayMenu(this.tray, this.store.get())
    this.broadcastRuntimeState()
    this.broadcastSettings()
  }

  /** Horizontal walk only — preserves current Y. */
  nudgeWindow(dx: number, dy: number): NudgeResult | null {
    if (this.dragActive) return null
    const win = this.petWindow
    if (!win || win.isDestroyed()) return null

    const [x, y] = win.getPosition()
    return this.applyClampedPosition(x + dx, y + dy, { persist: false })
  }

  setWindowPosition(x: number, y: number): NudgeResult | null {
    return this.applyClampedPosition(x, y, { persist: this.dragActive })
  }

  openMainAppPlaceholder(): void {
    dialog.showMessageBox({
      type: 'info',
      title: 'Capy B',
      message: 'Main App',
      detail: 'The habit tracker and home screen will open here in a later phase.'
    })
  }

  openSettings(): void {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.focus()
      return
    }

    this.settingsWindow = createSettingsWindow()
    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null
    })
  }

  presentDialogue(event: DialogueEvent): void {
    this.dialogueBusy = true
    this.createOrShowPetWindow()
    const win = this.petWindow
    if (!win || win.isDestroyed()) {
      this.dialogueBusy = false
      return
    }
    win.webContents.send(IpcChannels.DIALOGUE_SHOW, event)
  }

  /**
   * Dev-only: ask the pet renderer to enter sleep/wake via the existing FSM.
   * Does not touch settings or the natural sleep schedule timers in the store.
   */
  sendDebugBehaviour(command: DebugBehaviourCommand): void {
    if (app.isPackaged) return
    this.showPet()
    const win = this.petWindow
    if (!win || win.isDestroyed()) return
    win.webContents.send(IpcChannels.DEBUG_BEHAVIOUR, command)
  }

  clearDialogueBusy(): void {
    this.dialogueBusy = false
    this.scheduler.wake()
  }

  quit(): void {
    this.isQuitting = true
    this.scheduler.stop()
    this.persistWindowPosition()
    this.tray?.destroy()
    this.tray = null
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.close()
    }
    app.quit()
  }

  private applyPetSize(petSize: PetSizeId, options: { persistCenter: boolean }): void {
    const win = this.petWindow
    if (!win || win.isDestroyed()) return

    const { width, height } = layoutForPetSize(petSize)
    const [x, y] = win.getPosition()
    const [prevW, prevH] = win.getSize()

    let nextX = x
    let nextY = y
    if (options.persistCenter) {
      nextX = Math.round(x + prevW / 2 - width / 2)
      nextY = Math.round(y + prevH / 2 - height / 2)
    }

    const clamped = clampPositionToWorkArea(nextX, nextY, width, height)
    this.suppressMovePersist = true
    win.setBounds({ x: clamped.x, y: clamped.y, width, height }, false)
    setTimeout(() => {
      this.suppressMovePersist = false
      this.persistWindowPosition()
    }, 50)
  }

  private applyClampedPosition(
    x: number,
    y: number,
    options: { persist: boolean }
  ): NudgeResult {
    const win = this.petWindow
    if (!win || win.isDestroyed()) {
      return {
        x: Math.round(x),
        y: Math.round(y),
        hitLeft: false,
        hitRight: false,
        hitTop: false,
        hitBottom: false
      }
    }

    const [width, height] = win.getSize()
    const clamped = clampPositionToWorkArea(x, y, width, height)

    this.suppressMovePersist = !options.persist
    win.setPosition(clamped.x, clamped.y, false)

    if (options.persist) {
      this.schedulePersistPosition()
    } else {
      setTimeout(() => {
        this.suppressMovePersist = false
      }, 50)
    }

    return {
      x: clamped.x,
      y: clamped.y,
      hitLeft: clamped.hitLeft,
      hitRight: clamped.hitRight,
      hitTop: clamped.hitTop,
      hitBottom: clamped.hitBottom
    }
  }

  private createOrShowPetWindow(): void {
    if (this.petWindow && !this.petWindow.isDestroyed()) return

    const settings = this.store.get()
    let position = settings.windowPosition
    if (position && isWindowPositionOffscreen(position)) {
      console.warn(
        '[CapyB] Saved pet position is off-screen; restoring bottom-right default.',
        position
      )
      position = null
      this.store.update({ windowPosition: null })
    }

    this.petWindow = createPetWindow({
      position,
      petSize: settings.petSize,
      showOnReady: false
    })

    this.applyPetSize(settings.petSize, { persistCenter: false })

    this.petWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.error('[CapyB] Pet renderer failed to load', { code, desc, url })
    })
    this.petWindow.webContents.on('render-process-gone', (_e, details) => {
      console.error('[CapyB] Pet renderer process gone', details)
    })

    this.petWindow.once('ready-to-show', () => {
      if (this.store.get().petVisible) {
        this.ensurePetOnScreen({ reason: 'ready-to-show' })
        this.petWindow?.showInactive()
        this.logPetWindowDiagnostics('ready-to-show')
      }
    })

    // If ready-to-show already happened (or stalls), still force a visible restore.
    setTimeout(() => {
      if (this.isQuitting) return
      if (!this.store.get().petVisible) return
      const win = this.petWindow
      if (!win || win.isDestroyed()) return
      if (!win.isVisible()) {
        console.warn('[CapyB] Pet window not visible after startup — forcing show')
        this.ensurePetOnScreen({ reason: 'startup-fallback' })
        win.showInactive()
      }
      this.logPetWindowDiagnostics('startup-fallback')
    }, 1500)

    this.petWindow.on('close', (event) => {
      if (this.isQuitting) return
      event.preventDefault()
      this.persistWindowPosition()
      this.store.update({ petVisible: false })
      this.petWindow?.hide()
      refreshTrayMenu(this.tray, this.store.get())
      this.broadcastRuntimeState()
      this.broadcastSettings()
    })

    this.petWindow.on('closed', () => {
      this.petWindow = null
    })

    this.petWindow.on('moved', () => {
      if (this.suppressMovePersist) return
      this.schedulePersistPosition()
    })
    this.petWindow.on('resized', () => this.schedulePersistPosition())
  }

  /**
   * Keep the pet inside a real work area with a nonzero size.
   * Does not wipe unrelated settings — only corrects window bounds when needed.
   */
  private ensurePetOnScreen(options: { reason: string }): void {
    const win = this.petWindow
    if (!win || win.isDestroyed()) return

    const petSize = this.store.get().petSize
    const expected = defaultPetWindowSize(petSize)
    const [x, y] = win.getPosition()
    let [width, height] = win.getSize()

    if (!width || !height || width < 64 || height < 64) {
      console.warn('[CapyB] Pet window had invalid size; restoring layout size', {
        width,
        height,
        reason: options.reason
      })
      width = expected.width
      height = expected.height
    }

    const current = { x, y, width, height }
    if (isWindowPositionOffscreen(current)) {
      console.warn('[CapyB] Pet window off-screen; moving on-screen', {
        current,
        reason: options.reason
      })
      const { workArea } = screen.getPrimaryDisplay()
      const nextX = Math.round(workArea.x + workArea.width - width - 16)
      const nextY = Math.round(workArea.y + workArea.height - height - 16)
      this.suppressMovePersist = true
      win.setBounds({ x: nextX, y: nextY, width, height }, false)
      setTimeout(() => {
        this.suppressMovePersist = false
        this.persistWindowPosition()
      }, 50)
      return
    }

    const clamped = clampPositionToWorkArea(x, y, width, height)
    if (clamped.x !== x || clamped.y !== y || width !== expected.width || height !== expected.height) {
      this.suppressMovePersist = true
      win.setBounds(
        { x: clamped.x, y: clamped.y, width: expected.width, height: expected.height },
        false
      )
      setTimeout(() => {
        this.suppressMovePersist = false
        this.persistWindowPosition()
      }, 50)
    }
  }

  private logPetWindowDiagnostics(tag: string): void {
    const win = this.petWindow
    if (!win || win.isDestroyed()) {
      console.warn(`[CapyB] diagnostics(${tag}): no pet window`)
      return
    }
    const [x, y] = win.getPosition()
    const [width, height] = win.getSize()
    console.log(`[CapyB] diagnostics(${tag})`, {
      visible: win.isVisible(),
      destroyed: win.isDestroyed(),
      x,
      y,
      width,
      height,
      petVisible: this.store.get().petVisible,
      petPaused: this.store.get().petPaused,
      url: win.webContents.getURL()
    })
  }

  private schedulePersistPosition(): void {
    if (this.positionSaveTimer) clearTimeout(this.positionSaveTimer)
    this.positionSaveTimer = setTimeout(() => this.persistWindowPosition(), 200)
  }

  private applyVisibility(visible: boolean): void {
    this.createOrShowPetWindow()
    const win = this.petWindow
    if (!win || win.isDestroyed()) return

    if (visible) {
      this.ensurePetOnScreen({ reason: 'applyVisibility' })
      if (!win.isVisible()) {
        win.showInactive()
      }
    } else {
      this.persistWindowPosition()
      win.hide()
    }
  }

  private persistWindowPosition(): void {
    const win = this.petWindow
    if (!win || win.isDestroyed()) return

    const [x, y] = win.getPosition()
    const [width, height] = win.getSize()
    const fallback = defaultPetWindowSize(this.store.get().petSize)
    this.store.update({
      windowPosition: {
        x,
        y,
        width: width || fallback.width,
        height: height || fallback.height
      }
    })
  }

  private broadcastRuntimeState(): void {
    const state = this.getRuntimeState()
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IpcChannels.RUNTIME_STATE_CHANGED, state)
      }
    }
  }

  private broadcastSettings(): void {
    const settings = this.getSettings()
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IpcChannels.SETTINGS_CHANGED, settings)
      }
    }
  }
}
