export const DAW_GUTTER = 220
export const LANE_HEIGHT = 84
export const LANE_HEIGHT_MIN = 44
export const LANE_HEIGHT_MAX = 120
export const PIANO_KEY_WIDTH = 52

export function clampLaneHeight(value: number): number {
  return Math.round(Math.max(LANE_HEIGHT_MIN, Math.min(LANE_HEIGHT_MAX, value)))
}

export function laneNotePad(laneHeight: number): number {
  return Math.max(4, Math.round(laneHeight * 0.12))
}
