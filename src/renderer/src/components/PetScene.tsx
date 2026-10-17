import { Suspense, useEffect, useMemo, type JSX } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import type { PetRuntimeState } from '@shared/settings'
import { layoutForPetSize } from '@shared/petSize'
import { isCapyDebug } from '../debug'
import { CapyModel } from './CapyModel'
import { PerfMonitor } from './PerfMonitor'
import type { MoodRequest } from '../mood'

const TARGET_FPS = 30
const FRAME_MS = 1000 / TARGET_FPS

type PetSceneProps = {
  onPetClick: () => void
  runtime: PetRuntimeState
  moodRequest?: MoodRequest | null
}

function FramePacer({ active }: { active: boolean }): null {
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    if (!active) return

    invalidate()
    const id = window.setInterval(() => {
      invalidate()
    }, FRAME_MS)

    return () => {
      window.clearInterval(id)
    }
  }, [active, invalidate])

  return null
}

function SizedCamera({ zoom }: { zoom: number }): JSX.Element {
  return <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={zoom} near={0.1} far={100} />
}

/**
 * Transparent WebGL scene hosting Capy B.
 * Camera zoom tracks the selected pet size (world height 1 ≈ characterHeightPx).
 */
export function PetScene({
  onPetClick,
  runtime,
  moodRequest = null
}: PetSceneProps): JSX.Element {
  const active = !runtime.paused && runtime.visible
  const debug = isCapyDebug()
  const layout = useMemo(() => layoutForPetSize(runtime.petSize), [runtime.petSize])

  return (
    <Canvas
      orthographic
      dpr={[1, 2]}
      frameloop="demand"
      gl={{
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'low-power'
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0)
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      }}
      style={{ background: 'transparent', width: '100%', height: '100%' }}
      onPointerMissed={() => {
        window.__capyHovering = false
        window.pet?.setIgnoreMouseEvents(true)
      }}
    >
      <SizedCamera zoom={layout.cameraZoom} />

      <ambientLight intensity={0.65} color="#fff6e8" />
      <directionalLight position={[3, 5, 4]} intensity={0.85} color="#fffaf0" />
      <directionalLight position={[-3, 2, -2]} intensity={0.3} color="#e8f0ff" />
      <hemisphereLight args={['#fff8f0', '#c9b8a8', 0.4]} />

      {/* Keep pacing while the window is shown so Suspense model loads still paint. */}
      <FramePacer active={!runtime.paused && runtime.visible} />

      <Suspense fallback={null}>
        <CapyModel
          onPetClick={onPetClick}
          interactive={active}
          runtime={runtime}
          moodRequest={moodRequest}
        />
      </Suspense>

      {debug ? <PerfMonitor /> : null}
    </Canvas>
  )
}
