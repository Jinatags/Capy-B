import { BrowserWindow } from 'electron'
import { join } from 'node:path'

const SETTINGS_WIDTH = 440
const SETTINGS_HEIGHT = 680
const SETTINGS_MIN_WIDTH = 360
const SETTINGS_MIN_HEIGHT = 420

/**
 * Framed settings window for reminder / quiet-hours preferences.
 * Not transparent — a normal utility panel beside the desktop pet.
 */
export function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: SETTINGS_WIDTH,
    height: SETTINGS_HEIGHT,
    minWidth: SETTINGS_MIN_WIDTH,
    minHeight: SETTINGS_MIN_HEIGHT,
    show: false,
    frame: true,
    transparent: false,
    resizable: true,
    minimizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    alwaysOnTop: false,
    title: 'Capy B Settings',
    backgroundColor: '#FFF6E8',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })

  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    const base = process.env['ELECTRON_RENDERER_URL'].replace(/\/$/, '')
    void win.loadURL(`${base}/settings.html`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/settings.html'))
  }

  return win
}
