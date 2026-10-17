import { app } from 'electron'
import { PetController } from './app/petController'
import { registerPetIpc } from './ipc/petIpc'

const controller = new PetController()

// Single-instance lock so tray + pet stay unique.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    controller.showPet()
  })

  app.whenReady().then(() => {
    // Menu-bar companion: stay out of the Dock on macOS.
    if (process.platform === 'darwin' && app.dock) {
      app.dock.hide()
    }

    registerPetIpc(controller)
    controller.start()
  })

  app.on('activate', () => {
    // Clicking the (hidden) dock icon or reopen — show the pet.
    controller.showPet()
  })

  // Do not quit when the pet window is hidden. Only Quit from the tray exits.
  app.on('window-all-closed', () => {
    // Intentionally empty on all platforms for a tray-resident pet.
  })
}
