import { useEffect, useState, type JSX } from 'react'
import { layoutForPetSize, type PetSizeId } from '@shared/petSize'
import type { DialogueChoice } from '@shared/dialogue'

type SpeechBubbleProps = {
  text: string
  onGone: () => void
  petSize: PetSizeId
  holdMs?: number
  choices?: DialogueChoice[]
  onChoice?: (choice: DialogueChoice) => void
}

/**
 * Cute speech bubble above the character.
 * With choices, becomes interactive (pointer-events on) for reminder replies
 * and does not auto-dismiss — the user must pick a button.
 */
export function SpeechBubble({
  text,
  onGone,
  petSize,
  holdMs = 2200,
  choices,
  onChoice
}: SpeechBubbleProps): JSX.Element {
  const [leaving, setLeaving] = useState(false)
  const layout = layoutForPetSize(petSize)
  const fontPx = Math.max(11, Math.round(layout.characterHeightPx * 0.1))
  const padY = Math.max(4, Math.round(fontPx * 0.35))
  const padX = Math.max(8, Math.round(fontPx * 0.65))
  const topPx = Math.max(4, layout.marginPx)
  const interactive = Boolean(choices && choices.length > 0)

  useEffect(() => {
    setLeaving(false)
    // Choice prompts stay until the user answers (or the parent replaces them).
    if (interactive) return

    const leaveTimer = window.setTimeout(() => setLeaving(true), holdMs)
    return () => window.clearTimeout(leaveTimer)
  }, [text, holdMs, interactive, choices])

  useEffect(() => {
    if (!leaving) return
    const goneTimer = window.setTimeout(onGone, 280)
    return () => window.clearTimeout(goneTimer)
  }, [leaving, onGone])

  useEffect(() => {
    if (!interactive) return
    window.pet?.setIgnoreMouseEvents(false)
  }, [interactive, text])

  const handleChoice = (choice: DialogueChoice): void => {
    if (leaving) return
    onChoice?.(choice)
    // Persist-prompt choices are replaced by the parent with a new bubble key.
    // Final choices dismiss this bubble into a short reaction line.
    if (!choice.persistPrompt) {
      setLeaving(true)
    }
  }

  return (
    <div
      data-pet-interactive={interactive ? 'true' : undefined}
      className={`absolute left-1/2 z-20 flex max-w-[92%] -translate-x-1/2 flex-col items-center gap-1.5 rounded-2xl border border-cocoa/10 bg-cream/95 text-cocoa shadow-[0_2px_8px_rgba(92,58,46,0.12)] ${
        interactive ? 'pointer-events-auto' : 'pointer-events-none'
      } ${leaving ? 'animate-bubble-out' : 'animate-bubble-in'}`}
      style={{
        top: topPx,
        fontSize: fontPx,
        padding: `${padY}px ${padX}px`,
        fontWeight: 600,
        letterSpacing: '0.01em'
      }}
      role={interactive ? 'dialog' : 'status'}
      aria-live="polite"
      onPointerEnter={() => {
        if (interactive) {
          window.pet?.setIgnoreMouseEvents(false)
        }
      }}
    >
      <span className="whitespace-normal text-center leading-snug">{text}</span>

      {interactive && choices ? (
        <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1">
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              data-pet-interactive="true"
              className="rounded-full border border-cocoa/15 bg-white/80 px-2 py-0.5 text-[0.92em] font-semibold text-cocoa transition hover:bg-blush/40 active:scale-95"
              onClick={(event) => {
                event.stopPropagation()
                handleChoice(choice)
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>
      ) : null}

      <span
        aria-hidden
        className="absolute left-1/2 top-full -mt-px h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[7px] border-x-transparent border-t-cream/95"
      />
    </div>
  )
}
