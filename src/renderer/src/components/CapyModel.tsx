import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX
} from 'react'
import { Center, useGLTF } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { PetRuntimeState } from '@shared/settings'
import { layoutForPetSize } from '@shared/petSize'
import { AnimationController } from '../animation/AnimationController'
import { isUsableAnimatedGltf } from '../animation/clipMap'
import {
  ANIMATED_MODEL_URL,
  FALLBACK_MODEL_URL,
  resolveCapyModelUrl,
  type ResolvedCapyModel
} from '../animation/modelUrls'
import { CharacterStateMachine } from '../behaviour/stateMachine'
import { computeMotionPose } from '../behaviour/motion'
import { isCapyDebug } from '../debug'

const DRAG_THRESHOLD_PX = 7

type CapyModelProps = {
  onPetClick: () => void
  interactive?: boolean
  runtime: PetRuntimeState
}

function sceneHasSkeleton(root: THREE.Object3D): boolean {
  let found = false
  root.traverse((obj) => {
    if (found) return
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh || (obj as THREE.Bone).isBone) {
      found = true
    }
  })
  return found
}

function prepareMaterials(scene: THREE.Object3D): void {
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
}

/**
 * Resolves animated vs static model URL, then mounts the character.
 * Avoids loading both GLBs unless the animated candidate is invalid.
 */
export function CapyModel(props: CapyModelProps): JSX.Element | null {
  const [resolved, setResolved] = useState<ResolvedCapyModel | null>(null)
  const [forcedFallback, setForcedFallback] = useState(false)

  useEffect(() => {
    let cancelled = false
    void resolveCapyModelUrl().then((next) => {
      if (cancelled) return
      // Preload only the chosen URL so we do not fetch both GLBs.
      useGLTF.preload(next.url)
      setResolved(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!resolved) return null

  const model: ResolvedCapyModel = forcedFallback
    ? { url: FALLBACK_MODEL_URL, kind: 'static' }
    : resolved

  return (
    <CapyModelLoaded
      key={model.url}
      {...props}
      model={model}
      onAnimatedInvalid={() => {
        if (import.meta.env.DEV || isCapyDebug()) {
          console.warn(
            `[CapyB] ${ANIMATED_MODEL_URL} is present but has no skeleton/clips — falling back to ${FALLBACK_MODEL_URL}`
          )
        }
        useGLTF.preload(FALLBACK_MODEL_URL)
        setForcedFallback(true)
      }}
    />
  )
}

type LoadedProps = CapyModelProps & {
  model: ResolvedCapyModel
  onAnimatedInvalid: () => void
}

/**
 * Loads one Capy B GLB and drives skeletal clips (when present) + procedural root motion.
 */
function CapyModelLoaded({
  onPetClick,
  interactive = true,
  runtime,
  model,
  onAnimatedInvalid
}: LoadedProps): JSX.Element {
  const gltf = useGLTF(model.url)
  const { scene, animations } = gltf
  const { gl, invalidate } = useThree()
  const layout = layoutForPetSize(runtime.petSize)

  const rootRef = useRef<THREE.Group>(null)
  const machineRef = useRef<CharacterStateMachine | null>(null)
  if (!machineRef.current) {
    machineRef.current = new CharacterStateMachine()
  }

  const animRef = useRef<AnimationController | null>(null)
  if (!animRef.current) {
    animRef.current = new AnimationController()
  }

  const pendingDx = useRef(0)
  const nudgeInFlight = useRef(false)
  const wasWalking = useRef(false)
  const lastAnimState = useRef<string | null>(null)
  const invalidChecked = useRef(false)
  const pointerDownRef = useRef<{
    x: number
    y: number
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

  const hasSkeleton = useMemo(() => sceneHasSkeleton(scene), [scene])

  useLayoutEffect(() => {
    prepareMaterials(scene)
    invalidate()
  }, [scene, invalidate])

  // Validate animated candidate once; fall back without keeping a broken asset.
  useEffect(() => {
    if (invalidChecked.current) return
    invalidChecked.current = true
    if (model.kind !== 'animated') return

    const usable = isUsableAnimatedGltf({
      animations,
      hasSkeleton
    })
    if (!usable) {
      onAnimatedInvalid()
    }
  }, [model.kind, animations, hasSkeleton, onAnimatedInvalid])

  // Bind mixer to the GLTF scene (skeleton owner), not the outer pose group.
  useEffect(() => {
    const controller = animRef.current
    if (!controller) return

    controller.bind(scene, animations)
    if (controller.hasClips) {
      controller.play('idle')
      lastAnimState.current = 'idle'
    }

    return () => {
      controller.dispose()
      lastAnimState.current = null
    }
  }, [scene, animations])

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

  useEffect(() => {
    animRef.current?.setPaused(runtime.paused || !runtime.visible)
  }, [runtime.paused, runtime.visible])

  useFrame((state, delta) => {
    const machine = machineRef.current
    const root = rootRef.current
    const anim = animRef.current
    if (!machine || !root) return

    const dt = Math.min(0.05, Math.max(0, delta))
    const paused = runtime.paused || !runtime.visible
    const snapshot = machine.update(dt, paused)
    const skeletalActive = Boolean(anim?.hasClips)

    if (anim) {
      if (!paused && skeletalActive && lastAnimState.current !== snapshot.state) {
        anim.play(snapshot.state)
        lastAnimState.current = snapshot.state
      }
      anim.update(paused ? 0 : dt)
    }

    const pose = computeMotionPose(snapshot, machine, state.clock.elapsedTime, {
      skeletalActive
    })

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
      machineRef.current?.beginHappy(1.6)
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
