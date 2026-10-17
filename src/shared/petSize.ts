/** Character size presets (CSS pixels, feet → top of hair). */

export type PetSizeId = 'tiny' | 'small' | 'medium' | 'large'

export type PetSizePreset = {
  id: PetSizeId
  label: string
  /** Target on-screen character height in CSS pixels. */
  characterHeightPx: number
}

export const PET_SIZE_ORDER: PetSizeId[] = ['tiny', 'small', 'medium', 'large']

export const PET_SIZES: Record<PetSizeId, PetSizePreset> = {
  tiny: { id: 'tiny', label: 'Tiny', characterHeightPx: 100 },
  small: { id: 'small', label: 'Small', characterHeightPx: 160 },
  medium: { id: 'medium', label: 'Medium', characterHeightPx: 220 },
  large: { id: 'large', label: 'Large', characterHeightPx: 300 }
}

export const DEFAULT_PET_SIZE: PetSizeId = 'small'

export type PetWindowLayout = {
  width: number
  height: number
  characterHeightPx: number
  /** CSS px reserved above the character for the speech bubble. */
  bubbleReservePx: number
  marginPx: number
  /** Orthographic zoom so world-height 1 ≈ characterHeightPx on screen. */
  cameraZoom: number
  /** World-space Y offset to sit the pet in the lower band (room for bubble). */
  characterWorldY: number
}

/**
 * Tight window around the pet + bubble band — avoids a large invisible hit area.
 */
export function layoutForPetSize(sizeId: PetSizeId): PetWindowLayout {
  const { characterHeightPx } = PET_SIZES[sizeId]
  const marginPx = Math.max(8, Math.round(characterHeightPx * 0.1))
  const bubbleReservePx = Math.max(40, Math.round(characterHeightPx * 0.4))
  // Chubby body is ~as wide as tall; leave a little side room for walk bob / bubble text.
  const width = Math.round(characterHeightPx * 1.65) + marginPx * 2
  const height = characterHeightPx + bubbleReservePx + marginPx * 2

  // drei OrthographicCamera: visibleWorldHeight ≈ cssHeight / zoom.
  // With model normalised to height 1, zoom = characterHeightPx.
  const cameraZoom = characterHeightPx

  // Place character centre so its top sits just under the bubble band.
  const centreFromTop = marginPx + bubbleReservePx + characterHeightPx / 2
  const centreFromMid = height / 2 - centreFromTop
  const characterWorldY = centreFromMid / cameraZoom

  return {
    width,
    height,
    characterHeightPx,
    bubbleReservePx,
    marginPx,
    cameraZoom,
    characterWorldY
  }
}

export function isPetSizeId(value: unknown): value is PetSizeId {
  return typeof value === 'string' && value in PET_SIZES
}
