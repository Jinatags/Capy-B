import { useCallback, useRef, type PointerEvent } from 'react'

/**
 * Forwards mouse events through transparent window regions so the desktop
 * stays usable, while enabling hit-testing when the pointer is over opaque UI / the pet.
 *
 * Strategy: sample the topmost element under the cursor. If it is the canvas
 * (WebGL), we cannot cheaply read pixel alpha here — instead PetScene reports
 * mesh hover via a shared flag on window (set by raycast). For DOM overlays
 * (speech bubble), we always capture.
 */
export function useClickThrough(): {
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  onPointerLeave: () => void
} {
  const ignoringRef = useRef(true)

  const setIgnore = useCallback((ignore: boolean) => {
    if (ignoringRef.current === ignore) return
    ignoringRef.current = ignore
    window.pet?.setIgnoreMouseEvents(ignore)
  }, [])

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null
      const overUi = Boolean(target?.closest('[data-pet-interactive="true"]'))
      const overModel = Boolean(window.__capyHovering)

      // Capture mouse when over the model or interactive UI; otherwise pass through.
      setIgnore(!(overModel || overUi))
    },
    [setIgnore]
  )

  const onPointerLeave = useCallback(() => {
    window.__capyHovering = false
    setIgnore(true)
  }, [setIgnore])

  return { onPointerMove, onPointerLeave }
}

declare global {
  interface Window {
    __capyHovering?: boolean
  }
}
