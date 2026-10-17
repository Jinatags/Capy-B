import { app, BrowserWindow, dialog } from 'electron'
import type { Tray } from 'electron'
import { SettingsStore } from '../settings/store'
import { createPetWindow, defaultPetWindowSize } from '../windows/petWindow'
import { clampPositionToWorkArea } from '../windows/workArea'
import { createAppTray, refreshTrayMenu } from '../tray/createTray'
import { toPetRuntimeState, type AppSettings, type PetRuntimeState } from '../../shared/settings'
import { layoutForPetSize, type PetSizeId } from '../../shared/petSize'
import { IpcChannels, type NudgeResult } from '../../shared/ipc'

/**
 * Owns desktop-pet lifecycle: window, tray, persisted settings, pause/visibility/size.
 */
export class PetController {
  private readonly store = new SettingsStore()
  private petWindow: BrowserWindow | null = null
  private tray: Tray | null = null
  private isQuitting = false
  private positionSaveTimer: NodeJS.Timeout | null = null
  private dragActive = false
  private suppressMovePersist = false

  start(): void {
    app.on('before-quit', () => {
      this.isQuitting = true
      this.persistWindowPosition()
    })

    this.tray = createAppTray({
      getSettings: () => this.store.get(),
      onShowHide: () => this.toggleVisibility(),
      onPauseResume: () => this.togglePaused(),
      onToggleWalking: () => this.toggleWalking(),
      onSetPetSize: (size) => this.setPetSize(size),
      onOpenMainApp: () => this.openMainAppPlaceholder(),
      onOpenSettings: () => this.openSettingsPlaceholder(),
      onQuit: () => this.quit()
    })

    this.createOrShowPetWindow()
    this.applyVisibility(this.store.get().petVisible)
    this.broadcastRuntimeState()
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
      prev.quietHours.enabled !== next.quietHours.enabled ||
      prev.quietHours.start !== next.quietHours.start ||
      prev.quietHours.end !== next.quietHours.end

    if (runtimeChanged) {
      this.broadcastRuntimeState()
    }

    if (app.isPackaged && prev.launchAtLogin !== next.launchAtLogin) {
      app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, openAsHidden: true })
    }

    refreshTrayMenu(this.tray, next)
    return next
  }

  toggleVisibility(): void {
    const visible = !this.store.get().petVisible
    this.store.update({ petVisible: visible })
    this.applyVisibility(visible)
    refreshTrayMenu(this.tray, this.store.get())
    this.broadcastRuntimeState()
  }

  togglePaused(): void {
    const paused = !this.store.get().petPaused
    this.store.update({ petPaused: paused })
    refreshTrayMenu(this.tray, this.store.get())
    this.broadcastRuntimeState()
  }

  toggleWalking(): void {
    const enableWalking = !this.store.get().enableWalking
    this.store.update({ enableWalking })
    refreshTrayMenu(this.tray, this.store.get())
    this.broadcastRuntimeState()
  }

  setPetSize(petSize: PetSizeId): void {
    if (this.store.get().petSize === petSize) return
    this.store.update({ petSize })
    this.applyPetSize(petSize, { persistCenter: true })
    refreshTrayMenu(this.tray, this.store.get())
    this.broadcastRuntimeState()
  }

  showPet(): void {
    if (!this.store.get().petVisible) {
      this.store.update({ petVisible: true })
    }
    this.applyVisibility(true)
    refreshTrayMenu(this.tray, this.store.get())
    this.broadcastRuntimeState()
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

  openSettingsPlaceholder(): void {
    dialog.showMessageBox({
      type: 'info',
      title: 'Capy B Settings',
      message: 'Settings',
      detail:
        'Use the tray for size, walking and pause.\nComing soon:\n• Reminders\n• Launch at login\n• Quiet hours'
    })
  }

  quit(): void {
    this.isQuitting = true
    this.persistWindowPosition()
    this.tray?.destroy()
    this.tray = null
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
    win.setBounds(
      { x: clamped.x, y: clamped.y, width, height },
      false
    )
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
    this.petWindow = createPetWindow({
      position: settings.windowPosition,
      petSize: settings.petSize,
      showOnReady: false
    })

    // Ensure bounds match current size preset (saved width may be stale).
    this.applyPetSize(settings.petSize, { persistCenter: false })

    this.petWindow.once('ready-to-show', () => {
      if (this.store.get().petVisible) {
        this.petWindow?.showInactive()
      }
    })

    this.petWindow.on('close', (event) => {
      if (this.isQuitting) return
      event.preventDefault()
      this.persistWindowPosition()
      this.store.update({ petVisible: false })
      this.petWindow?.hide()
      refreshTrayMenu(this.tray, this.store.get())
      this.broadcastRuntimeState()
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

  private schedulePersistPosition(): void {
    if (this.positionSaveTimer) clearTimeout(this.positionSaveTimer)
    this.positionSaveTimer = setTimeout(() => this.persistWindowPosition(), 200)
  }

  private applyVisibility(visible: boolean): void {
    this.createOrShowPetWindow()
    const win = this.petWindow
    if (!win || win.isDestroyed()) return

    if (visible) {
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
}
