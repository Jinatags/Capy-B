import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import type { WindowPosition } from '../../shared/settings'
import { DEFAULT_PET_SIZE, layoutForPetSize, type PetSizeId } from '../../shared/petSize'

const PET_MARGIN = 16

export type CreatePetWindowOptions = {
  position?: WindowPosition | null
  petSize?: PetSizeId
  showOnReady?: boolean
}

export function defaultPetWindowSize(petSize: PetSizeId = DEFAULT_PET_SIZE): {
  width: number
  height: number
} {
  const layout = layoutForPetSize(petSize)
  return { width: layout.width, height: layout.height }
}

function defaultBottomRightPosition(width: number, height: number): { x: number; y: number } {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: Math.round(workArea.x + workArea.width - width - PET_MARGIN),
    y: Math.round(workArea.y + workArea.height - height - PET_MARGIN)
  }
}

function clampToWorkArea(position: WindowPosition): { x: number; y: number } {
  const displays = screen.getAllDisplays()
  const width = Math.max(1, position.width)
  const height = Math.max(1, position.height)

  // Prefer the display that contains the window centre; otherwise primary.
  const centreX = position.x + width / 2
  const centreY = position.y + height / 2
  const containing = displays.find((d) => {
    const { x, y, width: dw, height: dh } = d.workArea
    return centreX >= x && centreX < x + dw && centreY >= y && centreY < y + dh
  })
  const near = screen.getDisplayNearestPoint({
    x: Math.round(centreX),
    y: Math.round(centreY)
  })
  const display = containing ?? near ?? screen.getPrimaryDisplay()

  const { x: wx, y: wy, width: ww, height: wh } = display.workArea
  // If the window cannot fit, pin to the work-area origin rather than NaN/off-screen.
  const maxX = Math.max(wx, wx + ww - width)
  const maxY = Math.max(wy, wy + wh - height)
  const x = Math.min(Math.max(position.x, wx), maxX)
  const y = Math.min(Math.max(position.y, wy), maxY)
  return { x: Math.round(x), y: Math.round(y) }
}

/** True when a saved rect has no meaningful overlap with any display work area. */
export function isWindowPositionOffscreen(
  position: WindowPosition,
  margin = 32
): boolean {
  const width = Math.max(1, position.width)
  const height = Math.max(1, position.height)
  return !screen.getAllDisplays().some((d) => {
    const { x, y, width: dw, height: dh } = d.workArea
    const overlapW =
      Math.min(position.x + width, x + dw) - Math.max(position.x, x)
    const overlapH =
      Math.min(position.y + height, y + dh) - Math.max(position.y, y)
    return overlapW > margin && overlapH > margin
  })
}

/**
 * Creates the transparent, frameless desktop-pet window sized for the pet preset.
 */
export function createPetWindow(options: CreatePetWindowOptions = {}): BrowserWindow {
  const petSize = options.petSize ?? DEFAULT_PET_SIZE
  const { width, height } = defaultPetWindowSize(petSize)

  const saved = options.position
  const { x, y } = saved
    ? clampToWorkArea({
        x: saved.x,
        y: saved.y,
        width,
        height
      })
    : defaultBottomRightPosition(width, height)

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: true,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    acceptFirstMouse: true,
    backgroundColor: '#00000000',
    titleBarStyle: 'customButtonsOnHover',
    trafficLightPosition: { x: -100, y: -100 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })

  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false })
  win.setIgnoreMouseEvents(true, { forward: true })

  if (options.showOnReady !== false) {
    win.once('ready-to-show', () => {
      win.showInactive()
    })
  }

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

/** @deprecated Use defaultPetWindowSize — kept for call-site clarity during migration. */
export const PET_WINDOW_WIDTH = layoutForPetSize(DEFAULT_PET_SIZE).width
export const PET_WINDOW_HEIGHT = layoutForPetSize(DEFAULT_PET_SIZE).height
