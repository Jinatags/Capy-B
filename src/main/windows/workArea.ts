import { screen } from 'electron'
import { PET_WINDOW_HEIGHT, PET_WINDOW_WIDTH } from './petWindow'

export type WorkArea = { x: number; y: number; width: number; height: number }

export function workAreaForPoint(x: number, y: number): WorkArea {
  const display =
    screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) }) ??
    screen.getPrimaryDisplay()
  return { ...display.workArea }
}

export function clampPositionToWorkArea(
  x: number,
  y: number,
  width = PET_WINDOW_WIDTH,
  height = PET_WINDOW_HEIGHT
): {
  x: number
  y: number
  hitLeft: boolean
  hitRight: boolean
  hitTop: boolean
  hitBottom: boolean
  workArea: WorkArea
} {
  const workArea = workAreaForPoint(x + width / 2, y + height / 2)
  const minX = workArea.x
  const maxX = workArea.x + workArea.width - width
  const minY = workArea.y
  const maxY = workArea.y + workArea.height - height

  const clampedX = Math.round(Math.min(Math.max(x, minX), maxX))
  const clampedY = Math.round(Math.min(Math.max(y, minY), maxY))

  return {
    x: clampedX,
    y: clampedY,
    hitLeft: clampedX <= minX,
    hitRight: clampedX >= maxX,
    hitTop: clampedY <= minY,
    hitBottom: clampedY >= maxY,
    workArea
  }
}
