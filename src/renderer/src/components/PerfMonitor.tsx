import { useEffect, useRef, useState, type JSX } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

export type PerfHud = {
  fps: number
  triangles: number
  drawCalls: number
}

const PERF_EVENT = 'capy:perf'

/**
 * Samples FPS / renderer.info. Only mounted when explicit debug mode is on.
 * Reports to the main process infrequently to avoid log spam.
 */
export function PerfMonitor(): null {
  const { gl, scene } = useThree()
  const trianglesRef = useRef(0)
  const framesRef = useRef(0)
  const lastSampleRef = useRef(performance.now())
  const lastReportRef = useRef(0)

  useEffect(() => {
    let triangles = 0
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) || !obj.geometry) return
      const geo = obj.geometry
      const index = geo.index
      if (index) {
        triangles += index.count / 3
      } else if (geo.attributes.position) {
        triangles += geo.attributes.position.count / 3
      }
    })
    trianglesRef.current = Math.round(triangles)
  }, [scene])

  useFrame(() => {
    framesRef.current += 1
    const now = performance.now()
    const elapsed = now - lastSampleRef.current

    if (elapsed < 1000) return

    const fps = (framesRef.current * 1000) / elapsed
    framesRef.current = 0
    lastSampleRef.current = now

    const info = gl.info.render
    const snapshot = {
      fps,
      triangles: trianglesRef.current,
      drawCalls: info.calls,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures
    }

    window.dispatchEvent(new CustomEvent(PERF_EVENT, { detail: snapshot }))

    // Sparse main-process logging (debug only, ~30s).
    if (now - lastReportRef.current > 30000) {
      lastReportRef.current = now
      window.pet?.reportPerf(snapshot)
    }
  })

  return null
}

/** DOM HUD — only rendered when App mounts it under explicit debug mode. */
export function PerfHudOverlay(): JSX.Element | null {
  const [hud, setHud] = useState<PerfHud | null>(null)

  useEffect(() => {
    const onPerf = (event: Event): void => {
      const detail = (event as CustomEvent<PerfHud>).detail
      setHud({
        fps: Math.round(detail.fps),
        triangles: detail.triangles,
        drawCalls: detail.drawCalls
      })
    }
    window.addEventListener(PERF_EVENT, onPerf)
    return () => window.removeEventListener(PERF_EVENT, onPerf)
  }, [])

  if (!hud) return null

  return (
    <div className="pointer-events-none absolute bottom-1 left-1 z-30 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] leading-tight text-cream/90">
      {hud.fps} fps · {hud.triangles.toLocaleString()} tris · {hud.drawCalls} draws
    </div>
  )
}
