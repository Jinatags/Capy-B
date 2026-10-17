import { Menu, Tray, nativeImage, app } from 'electron'
import { join } from 'node:path'
import type { AppSettings } from '../../shared/settings'
import { PET_SIZE_ORDER, PET_SIZES, type PetSizeId } from '../../shared/petSize'

export type TrayActions = {
  getSettings: () => AppSettings
  onShowHide: () => void
  onPauseResume: () => void
  onToggleWalking: () => void
  onToggleReminders: () => void
  onSetPetSize: (size: PetSizeId) => void
  onOpenMainApp: () => void
  onOpenSettings: () => void
  onQuit: () => void
  /** Present only when the host registers them (development builds). */
  onTestSleep?: () => void
  onTestWake?: () => void
}

type RefreshableTray = Tray & {
  __actions?: TrayActions
}

function resolveTrayIcon(): Electron.NativeImage {
  const candidates = [
    join(process.resourcesPath ?? '', 'tray', 'trayTemplate.png'),
    join(app.getAppPath(), 'resources', 'tray', 'trayTemplate.png'),
    join(__dirname, '../../../resources/tray/trayTemplate.png'),
    join(process.cwd(), 'resources', 'tray', 'trayTemplate.png')
  ]

  for (const path of candidates) {
    const image = nativeImage.createFromPath(path)
    if (!image.isEmpty()) {
      image.setTemplateImage(true)
      return image
    }
  }

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAhElEQVQ4T2NkYGD4z0ABYBzVMGoAhQYGBgYGRkZGRhD4//8/AxMDFQDT////GZgYGRlBav7//8/AyMjIwMfHx8DExARWAzKQEewCBgcHBwY2NjYGFhYWsBxcDzMzMwMzMzMDIyMjWA0Dw////xgYGRkZGBgYGBhYgWxGqhtAywAGBgYGJgYGBrAryDYAAPoOEwG3b1o2AAAAAElFTkSuQmCC',
    'base64'
  )
  const fallback = nativeImage.createFromBuffer(png)
  fallback.setTemplateImage(true)
  return fallback
}

function buildMenu(actions: TrayActions): Menu {
  const settings = actions.getSettings()
  const isDev = !app.isPackaged
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: settings.petVisible ? 'Hide Capy B' : 'Show Capy B',
      click: () => actions.onShowHide()
    },
    {
      label: settings.petPaused ? 'Resume Capy B' : 'Pause Capy B',
      click: () => actions.onPauseResume()
    },
    {
      label: settings.enableWalking ? 'Disable Walking' : 'Enable Walking',
      click: () => actions.onToggleWalking()
    },
    {
      label: settings.enableReminders ? 'Disable Reminders' : 'Enable Reminders',
      click: () => actions.onToggleReminders()
    },
    {
      label: 'Character Size',
      submenu: PET_SIZE_ORDER.map((id) => ({
        label: `${PET_SIZES[id].label} (${PET_SIZES[id].characterHeightPx}px)`,
        type: 'radio' as const,
        checked: settings.petSize === id,
        click: () => actions.onSetPetSize(id)
      }))
    },
    { type: 'separator' },
    {
      label: 'Open Main App…',
      click: () => actions.onOpenMainApp()
    },
    {
      label: 'Settings…',
      click: () => actions.onOpenSettings()
    }
  ]

  if (isDev && actions.onTestSleep && actions.onTestWake) {
    template.push(
      { type: 'separator' },
      {
        label: 'Developer',
        submenu: [
          {
            label: 'Test Sleep',
            click: () => actions.onTestSleep?.()
          },
          {
            label: 'Test Wake',
            click: () => actions.onTestWake?.()
          }
        ]
      }
    )
  }

  template.push(
    { type: 'separator' },
    {
      label: 'Quit Capy B',
      click: () => actions.onQuit()
    }
  )

  return Menu.buildFromTemplate(template)
}

export function createAppTray(actions: TrayActions): Tray {
  const tray = new Tray(resolveTrayIcon()) as RefreshableTray
  tray.__actions = actions
  tray.setToolTip('Capy B')
  tray.setIgnoreDoubleClickEvents(true)
  tray.setContextMenu(buildMenu(actions))

  tray.on('click', () => {
    tray.popUpContextMenu(buildMenu(actions))
  })

  return tray
}

export function refreshTrayMenu(tray: Tray | null, _settings?: AppSettings): void {
  if (!tray) return
  const actions = (tray as RefreshableTray).__actions
  if (!actions) return
  tray.setContextMenu(buildMenu(actions))
}
