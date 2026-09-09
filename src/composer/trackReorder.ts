export type TrackReorder = {
  id: string
  from: number
  to: number
  dy: number
}

/** How far a non-dragged lane slides while a neighbor is being dragged. */
export function reorderShiftY(index: number, from: number, to: number, laneHeight: number): number {
  if (from < to && index > from && index <= to) return -laneHeight
  if (from > to && index >= to && index < from) return laneHeight
  return 0
}

export function laneDrawY(index: number, laneHeight: number, reorder: TrackReorder | null): number {
  if (!reorder) return index * laneHeight
  if (index === reorder.from) return index * laneHeight + reorder.dy
  return index * laneHeight + reorderShiftY(index, reorder.from, reorder.to, laneHeight)
}
