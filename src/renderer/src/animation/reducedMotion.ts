/**
 * Amplitude multiplier for procedural motion when the OS requests reduced motion.
 * Skeletal clips (when present) still play but with the same scale applied to root pose.
 */
export function proceduralMotionScale(): number {
  try {
    if (typeof window === 'undefined') return 1
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.25 : 1
  } catch {
    return 1
  }
}
