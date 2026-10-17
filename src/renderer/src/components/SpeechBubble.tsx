import { useEffect, useState, type JSX } from 'react'
import { layoutForPetSize, type PetSizeId } from '@shared/petSize'

type SpeechBubbleProps = {
  text: string
  onGone: () => void
  petSize: PetSizeId
  holdMs?: number
}

/**
 * Cute greeting bubble seated in the reserved band above the character.
 * pointer-events: none so it never blocks the desktop / pet hit-testing.
 */
export function SpeechBubble({
  text,
  onGone,
  petSize,
  holdMs = 2200
}: SpeechBubbleProps): JSX.Element {
  const [leaving, setLeaving] = useState(false)
  const layout = layoutForPetSize(petSize)
  const fontPx = Math.max(11, Math.round(layout.characterHeightPx * 0.11))
  const padY = Math.max(4, Math.round(fontPx * 0.35))
  const padX = Math.max(8, Math.round(fontPx * 0.7))
  // Sit in the bubble reserve band, just above the character.
  const topPx = Math.max(4, layout.marginPx)

  useEffect(() => {
    setLeaving(false)
    const leaveTimer = window.setTimeout(() => setLeaving(true), holdMs)
    return () => window.clearTimeout(leaveTimer)
  }, [text, holdMs])

  useEffect(() => {
    if (!leaving) return
    const goneTimer = window.setTimeout(onGone, 280)
    return () => window.clearTimeout(goneTimer)
  }, [leaving, onGone])

  return (
    <div
      className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-2xl border border-cocoa/10 bg-cream/95 text-cocoa shadow-[0_2px_8px_rgba(92,58,46,0.12)] ${
        leaving ? 'animate-bubble-out' : 'animate-bubble-in'
      }`}
      style={{
        top: topPx,
        fontSize: fontPx,
        padding: `${padY}px ${padX}px`,
        fontWeight: 600,
        letterSpacing: '0.01em'
      }}
      role="status"
      aria-live="polite"
    >
      {text}
      <span
        aria-hidden
        className="absolute left-1/2 top-full -mt-px h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[7px] border-x-transparent border-t-cream/95"
      />
    </div>
  )
}
