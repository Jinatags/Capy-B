import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, type PetRuntimeState, toPetRuntimeState } from '@shared/settings'

const FALLBACK_STATE: PetRuntimeState = toPetRuntimeState(DEFAULT_SETTINGS)

/**
 * Subscribes to main-process pet runtime state (pause / walking / motion config).
 */
export function usePetRuntime(): PetRuntimeState {
  const [state, setState] = useState<PetRuntimeState>(FALLBACK_STATE)

  useEffect(() => {
    let disposed = false

    void window.pet?.getRuntimeState().then((next) => {
      if (!disposed) setState(next)
    })

    const unsubscribe = window.pet?.onRuntimeStateChanged((next) => {
      setState(next)
    })

    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [])

  return state
}
