/// <reference types="vite/client" />

import type { PetApi } from '@shared/ipc'

declare global {
  interface Window {
    pet: PetApi
    __capyHovering?: boolean
  }
}

export {}
