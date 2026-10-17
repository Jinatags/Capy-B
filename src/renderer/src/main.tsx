import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

/**
 * Three's GLTFLoader prefers ImageBitmapLoader when createImageBitmap exists.
 * That path can yield materials with missing maps for this GLB's large embedded
 * JPEGs. Removing the API forces TextureLoader so baseColor/normal/MR maps load.
 */
try {
  delete (window as unknown as { createImageBitmap?: unknown }).createImageBitmap
} catch {
  // best-effort workaround
}

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element #root not found')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
