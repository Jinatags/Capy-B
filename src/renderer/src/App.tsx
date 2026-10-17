import { useCallback, useEffect, useState, type JSX } from 'react'
import { PetScene } from './components/PetScene'
import { SpeechBubble } from './components/SpeechBubble'
import { PerfHudOverlay } from './components/PerfMonitor'
import { useClickThrough } from './hooks/useClickThrough'
import { usePetRuntime } from './hooks/usePetRuntime'
import { isCapyDebug } from './debug'

export default function App(): JSX.Element {
  const [message, setMessage] = useState<string | null>(null)
  const runtime = usePetRuntime()
  const { onPointerMove, onPointerLeave } = useClickThrough()
  const debug = isCapyDebug()

  useEffect(() => {
    if (runtime.paused) {
      window.__capyHovering = false
      window.pet?.setIgnoreMouseEvents(true)
    }
  }, [runtime.paused])

  const handlePetClick = useCallback(() => {
    if (runtime.paused) return
    setMessage('hello princess ♡')
  }, [runtime.paused])

  const handleMessageGone = useCallback(() => {
    setMessage(null)
  }, [])

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-transparent"
      onPointerMove={runtime.paused ? undefined : onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <PetScene onPetClick={handlePetClick} runtime={runtime} />
      {message && !runtime.paused ? (
        <SpeechBubble
          text={message}
          onGone={handleMessageGone}
          petSize={runtime.petSize}
        />
      ) : null}
      {debug ? <PerfHudOverlay /> : null}
    </div>
  )
}
