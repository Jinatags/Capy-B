/** Runtime model URLs and resolution for animated vs static Capy B. */

export const ANIMATED_MODEL_URL = '/models/CapyB_Animated.glb'
export const FALLBACK_MODEL_URL = '/models/CapyB_Single.glb'

export type CapyModelKind = 'animated' | 'static'

export type ResolvedCapyModel = {
  url: string
  kind: CapyModelKind
}

const GLB_MAGIC = [0x67, 0x6c, 0x54, 0x46] // "glTF"

function looksLikeHtmlContentType(contentType: string | null): boolean {
  if (!contentType) return false
  return contentType.toLowerCase().includes('text/html')
}

function looksLikeBinaryModelContentType(contentType: string | null): boolean {
  if (!contentType) return false
  const ct = contentType.toLowerCase()
  // Be strict — do not treat arbitrary types containing "binary" as GLB.
  return (
    ct.includes('model/gltf-binary') ||
    ct.includes('model/gltf+json') ||
    ct.includes('model/gltf') ||
    ct.includes('application/octet-stream') ||
    ct === 'application/gltf-buffer'
  )
}

async function bufferStartsWithGlbMagic(response: Response): Promise<boolean> {
  try {
    const buf = new Uint8Array(await response.arrayBuffer())
    if (buf.length < 4) return false
    return GLB_MAGIC.every((byte, i) => buf[i] === byte)
  } catch {
    return false
  }
}

/**
 * Probe whether a public model URL is a real GLB.
 *
 * Important: Vite's SPA fallback serves `index.html` with HTTP 200 for missing
 * public files. A naive `response.ok` check therefore falsely reports that
 * `CapyB_Animated.glb` exists, and useGLTF then hangs/fails on HTML.
 */
export async function modelUrlExists(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' })

    if (head.ok) {
      const contentType = head.headers.get('content-type')
      if (looksLikeHtmlContentType(contentType)) {
        return false
      }
      if (looksLikeBinaryModelContentType(contentType)) {
        return true
      }
    } else if (head.status !== 405 && head.status !== 501) {
      return false
    }

    // Confirm with a tiny ranged GET + glTF magic bytes (covers missing Content-Type
    // and servers that reject HEAD).
    const ranged = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-3' },
      cache: 'no-store'
    })
    if (!(ranged.ok || ranged.status === 206)) {
      return false
    }
    if (looksLikeHtmlContentType(ranged.headers.get('content-type'))) {
      return false
    }
    return bufferStartsWithGlbMagic(ranged)
  } catch {
    return false
  }
}

/**
 * Prefer the animated GLB when it is a real binary asset; otherwise use the
 * static single-mesh extract.
 */
export async function resolveCapyModelUrl(): Promise<ResolvedCapyModel> {
  const animatedAvailable = await modelUrlExists(ANIMATED_MODEL_URL)
  if (animatedAvailable) {
    return { url: ANIMATED_MODEL_URL, kind: 'animated' }
  }
  return { url: FALLBACK_MODEL_URL, kind: 'static' }
}
