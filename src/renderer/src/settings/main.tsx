import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { SettingsApp } from './SettingsApp'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <SettingsApp />
    </StrictMode>
  )
}
