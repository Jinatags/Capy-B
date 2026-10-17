/** Runtime model URLs and resolution for animated vs static Capy B. */

export const ANIMATED_MODEL_URL = '/models/CapyB_Animated.glb'
export const FALLBACK_MODEL_URL = '/models/CapyB_Single.glb'

export type CapyModelKind = 'animated' | 'static'

export type ResolvedCapyModel = {
  url: string
  kind: CapyModelKind
}

/**
 * Probe whether a public model URL exists without downloading the body.
 * Falls back to a ranged GET when HEAD is unsupported.
 */
export async function modelUrlExists(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    if (head.ok) return true
    // Some static servers reject HEAD — try a tiny ranged GET.
    if (head.status === 405 || head.status === 501) {
      const ranged = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        cache: 'no-store'
      })
      return ranged.ok || ranged.status === 206
    }
    return false
  } catch {
    return false
  }
}

/**
 * Prefer the animated GLB when present; otherwise use the static single-mesh extract.
 * Does not download the GLB body — only checks availability.
 */
export async function resolveCapyModelUrl(): Promise<ResolvedCapyModel> {
  const animatedAvailable = await modelUrlExists(ANIMATED_MODEL_URL)
  if (animatedAvailable) {
    return { url: ANIMATED_MODEL_URL, kind: 'animated' }
  }
  return { url: FALLBACK_MODEL_URL, kind: 'static' }
}
