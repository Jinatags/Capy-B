import { useCallback, useEffect, useState, type JSX } from 'react'
import { PetScene } from './components/PetScene'
import { SpeechBubble } from './components/SpeechBubble'
import { PerfHudOverlay } from './components/PerfMonitor'
import { useClickThrough } from './hooks/useClickThrough'
import { usePetRuntime } from './hooks/usePetRuntime'
import { isCapyDebug } from './debug'
import {
  createDialogueId,
  nextClickLine,
  reactionLine,
  type DialogueChoice,
  type DialogueEvent,
  type MoodReaction
} from '@shared/dialogue'

import type { MoodRequest } from './mood'

function moodFromReaction(reaction: MoodReaction): MoodRequest['mood'] {
  if (reaction === 'happy') return 'happy'
  if (reaction === 'annoyed') return 'annoyed'
  return 'sad'
}

export default function App(): JSX.Element {
  const [dialogue, setDialogue] = useState<DialogueEvent | null>(null)
  const [moodRequest, setMoodRequest] = useState<MoodRequest | null>(null)
  const runtime = usePetRuntime()
  const { onPointerMove, onPointerLeave } = useClickThrough()
  const debug = isCapyDebug()

  useEffect(() => {
    if (runtime.paused) {
      window.__capyHovering = false
      window.pet?.setIgnoreMouseEvents(true)
    }
  }, [runtime.paused])

  useEffect(() => {
    const unsubscribe = window.pet?.onDialogue((event) => {
      if (runtime.paused) {
        window.pet?.dismissDialogue(event.id)
        return
      }
      setDialogue(event)
      if (event.choices?.length) {
        window.pet?.setIgnoreMouseEvents(false)
      }
    })
    return () => unsubscribe?.()
  }, [runtime.paused])

  const clearDialogue = useCallback((id: string, notifyMain: boolean) => {
    setDialogue((current) => (current?.id === id ? null : current))
    if (notifyMain) {
      window.pet?.dismissDialogue(id)
    }
  }, [])

  const handlePetClick = useCallback(() => {
    if (runtime.paused) return
    // Don't interrupt an interactive reminder.
    if (dialogue?.choices?.length) return

    const event: DialogueEvent = {
      id: createDialogueId('click'),
      kind: 'click',
      text: nextClickLine(),
      holdMs: 2200
    }
    setDialogue(event)
    setMoodRequest({ mood: 'happy', token: Date.now() })
  }, [runtime.paused, dialogue])

  const handleBubbleGone = useCallback(() => {
    if (!dialogue) return
    const id = dialogue.id
    // Local-only bubbles (click / final reaction) do not hold the scheduler.
    const notifyMain = dialogue.kind !== 'click' && dialogue.kind !== 'reaction'
    clearDialogue(id, notifyMain)
  }, [dialogue, clearDialogue])

  const handleChoice = useCallback(
    (choice: DialogueChoice) => {
      if (!dialogue) return

      setMoodRequest({ mood: moodFromReaction(choice.reaction), token: Date.now() })
      window.pet?.setIgnoreMouseEvents(false)

      // Water / food nag: show reply text with the same buttons so the user must answer again.
      if (choice.persistPrompt && dialogue.choices?.length) {
        setDialogue({
          id: createDialogueId(dialogue.kind),
          kind: dialogue.kind,
          text: choice.reply ?? dialogue.text,
          choices: dialogue.choices,
          holdMs: dialogue.holdMs
        })
        // Keep main-process dialogueBusy set — do not respondDialogue yet.
        return
      }

      // Accepting choice — release the scheduler and show a short reaction line.
      window.pet?.respondDialogue({
        dialogueId: dialogue.id,
        choiceId: choice.id,
        reaction: choice.reaction
      })
      setDialogue({
        id: createDialogueId('reaction'),
        kind: 'reaction',
        text: choice.reply ?? reactionLine(choice.reaction),
        holdMs: 2200
      })
    },
    [dialogue]
  )

  const dialogueInteractive = Boolean(dialogue?.choices?.length)

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-transparent"
      onPointerMove={runtime.paused ? undefined : onPointerMove}
      onPointerLeave={() => {
        // Keep the window interactive while reminder buttons are on screen.
        if (dialogueInteractive) {
          window.pet?.setIgnoreMouseEvents(false)
          return
        }
        onPointerLeave()
      }}
    >
      <PetScene
        onPetClick={handlePetClick}
        runtime={runtime}
        moodRequest={moodRequest}
      />
      {dialogue && !runtime.paused ? (
        <SpeechBubble
          key={dialogue.id}
          text={dialogue.text}
          onGone={handleBubbleGone}
          petSize={runtime.petSize}
          holdMs={dialogue.holdMs}
          choices={dialogue.choices}
          onChoice={handleChoice}
        />
      ) : null}
      {debug ? <PerfHudOverlay /> : null}
    </div>
  )
}
