import { useEffect, useLayoutEffect, useMemo, useRef, type JSX } from 'react'
import { Center, useGLTF } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { PetRuntimeState } from '@shared/settings'
import { layoutForPetSize } from '@shared/petSize'
import { CharacterStateMachine } from '../behaviour/stateMachine'
import { computeMotionPose } from '../behaviour/motion'

/**
 * Single-character extract from the Meshy turnaround bake.
 * Original fused asset kept at `public/models/CapyB.glb` (+ `.original.glb` backup).
 */
const MODEL_URL = '/models/CapyB_Single.glb'
const DRAG_THRESHOLD_PX = 7

type CapyModelProps = {
  onPetClick: () => void
  interactive?: boolean
  runtime: PetRuntimeState
}

/**
 * Loads the static Capy B GLB and drives Phase 2A procedural behaviour.
 * Model is normalised to world-height ≈ 1 so camera zoom maps 1:1 to CSS px height.
 */
export function CapyModel({
  onPetClick,
  interactive = true,
  runtime
}: CapyModelProps): JSX.Element {
  const { scene } = useGLTF(MODEL_URL)
  const { gl, invalidate } = useThree()
  const layout = layoutForPetSize(runtime.petSize)

  const rootRef = useRef<THREE.Group>(null)
  const machineRef = useRef<CharacterStateMachine | null>(null)
  if (!machineRef.current) {
    machineRef.current = new CharacterStateMachine()
  }

  const pendingDx = useRef(0)
  const nudgeInFlight = useRef(false)
  const wasWalking = useRef(false)
  const pointerDownRef = useRef<{
    x: number
    y: number
    /** Offset from window top-left to the grab point (CSS px). */
    grabX: number
    grabY: number
    dragging: boolean
  } | null>(null)

  /** Uniform scale so mesh height (Y) equals 1 world unit. */
  const heightScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const height = size.y || 1
    return 1 / height
  }, [scene])

  useLayoutEffect(() => {
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return

      child.castShadow = false
      child.receiveShadow = false

      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const mat of materials) {
        if (!(mat instanceof THREE.MeshStandardMaterial)) continue

        mat.metalness = 0.05
        mat.roughness = 0.85
        mat.side = THREE.DoubleSide
        mat.envMapIntensity = 0.25

        if (mat.map) {
          mat.map.colorSpace = THREE.SRGBColorSpace
          mat.map.needsUpdate = true
        }

        mat.needsUpdate = true
      }
    })
    invalidate()
  }, [scene, invalidate])

  useEffect(() => {
    machineRef.current?.setConfig({
      enableWalking: runtime.enableWalking,
      walkSpeed: runtime.walkSpeed,
      walkIntervalMinSec: runtime.walkIntervalMinSec,
      walkIntervalMaxSec: runtime.walkIntervalMaxSec
    })
  }, [
    runtime.enableWalking,
    runtime.walkSpeed,
    runtime.walkIntervalMinSec,
    runtime.walkIntervalMaxSec
  ])

  useEffect(() => {
    invalidate()
  }, [runtime.petSize, invalidate])

  useFrame((state, delta) => {
    const machine = machineRef.current
    const root = rootRef.current
    if (!machine || !root) return

    const dt = Math.min(0.05, Math.max(0, delta))
    const paused = runtime.paused || !runtime.visible
    const snapshot = machine.update(dt, paused)
    const pose = computeMotionPose(snapshot, machine, state.clock.elapsedTime)

    root.position.set(
      pose.position.x,
      layout.characterWorldY + pose.position.y,
      pose.position.z
    )
    root.rotation.set(pose.rotation.x, pose.rotation.y, pose.rotation.z)
    root.scale.set(
      heightScale * pose.scale.x,
      heightScale * pose.scale.y,
      heightScale * pose.scale.z
    )

    // Horizontal roam only — preserves whatever Y the user left him at.
    if (!paused && snapshot.state === 'walking' && interactive) {
      wasWalking.current = true
      pendingDx.current += snapshot.walkDirection * runtime.walkSpeed * dt

      if (!nudgeInFlight.current && Math.abs(pendingDx.current) >= 1) {
        const step = Math.trunc(pendingDx.current)
        const dir = snapshot.walkDirection
        pendingDx.current -= step
        nudgeInFlight.current = true
        void window.pet
          ?.nudgeWindow(step, 0)
          .then((result) => {
            if (!result) return
            if ((dir === 1 && result.hitRight) || (dir === -1 && result.hitLeft)) {
              machine.notifyWalkBlocked()
            }
          })
          .finally(() => {
            nudgeInFlight.current = false
          })
      }
    } else if (wasWalking.current && snapshot.state !== 'walking') {
      wasWalking.current = false
      pendingDx.current = 0
      window.pet?.flushWindowPosition()
    }
  })

  const handlePointerOver = (event: ThreeEvent<PointerEvent>): void => {
    if (!interactive || runtime.paused) return
    event.stopPropagation()
    window.__capyHovering = true
    gl.domElement.style.cursor = 'grab'
    window.pet?.setIgnoreMouseEvents(false)
  }

  const handlePointerOut = (event: ThreeEvent<PointerEvent>): void => {
    if (pointerDownRef.current?.dragging) return
    event.stopPropagation()
    window.__capyHovering = false
    gl.domElement.style.cursor = 'default'
    window.pet?.setIgnoreMouseEvents(true)
  }

  const handlePointerDown = (event: ThreeEvent<PointerEvent>): void => {
    if (!interactive || runtime.paused) return
    event.stopPropagation()
    pointerDownRef.current = {
      x: event.clientX,
      y: event.clientY,
      grabX: event.clientX,
      grabY: event.clientY,
      dragging: false
    }
    window.pet?.setIgnoreMouseEvents(false)
    gl.domElement.setPointerCapture?.(event.nativeEvent.pointerId)
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>): void => {
    const down = pointerDownRef.current
    if (!down || !interactive || runtime.paused) return

    const dist = Math.hypot(event.clientX - down.x, event.clientY - down.y)
    if (!down.dragging && dist >= DRAG_THRESHOLD_PX) {
      down.dragging = true
      machineRef.current?.beginDrag()
      window.pet?.setDragActive(true)
      gl.domElement.style.cursor = 'grabbing'
    }

    if (down.dragging) {
      event.stopPropagation()
      // Anchor: window top-left so the grab point stays under the cursor.
      const x = Math.round(event.nativeEvent.screenX - down.grabX)
      const y = Math.round(event.nativeEvent.screenY - down.grabY)
      window.pet?.moveWindowLive(x, y)
    }
  }

  const endPointer = (event: ThreeEvent<PointerEvent>, wasClickCandidate: boolean): void => {
    const down = pointerDownRef.current
    pointerDownRef.current = null

    try {
      gl.domElement.releasePointerCapture?.(event.nativeEvent.pointerId)
    } catch {
      // ignore
    }

    if (down?.dragging) {
      machineRef.current?.endDrag()
      window.pet?.setDragActive(false)
      window.pet?.flushWindowPosition()
      gl.domElement.style.cursor = 'grab'
      return
    }

    if (wasClickCandidate && down && interactive && !runtime.paused) {
      machineRef.current?.beginInteraction(2.4)
      onPetClick()
    }
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>): void => {
    endPointer(event, true)
  }

  const handlePointerCancel = (event: ThreeEvent<PointerEvent>): void => {
    endPointer(event, false)
  }

  return (
    <group
      ref={rootRef}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      scale={heightScale}
      position={[0, layout.characterWorldY, 0]}
    >
      <Center>
        <primitive object={scene} dispose={null} />
      </Center>
    </group>
  )
}

useGLTF.preload(MODEL_URL)
