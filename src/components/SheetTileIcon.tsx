import { useEffect, useRef } from 'react'
import type { Note, Track } from '../music/types'
import { getTile, probeTiles, resolveNoteTileKey, resolveTrackTileKey, subscribeTiles } from '../world/tiles'

export type TilePreviewTrack = Pick<Track, 'instrument'> &
  Partial<Pick<Track, 'gtNumType' | 'gtVariant' | 'gtStem'>>

export function SheetTileIcon({
  track,
  note,
  size = 20,
  title,
}: {
  track: TilePreviewTrack
  note?: Note
  size?: number
  title?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const instrument = track.instrument
  const gtNumType = track.gtNumType
  const gtVariant = track.gtVariant
  const noteNumType = note?.gtNumType
  const noteVariant = note?.gtVariant

  useEffect(() => {
    const preview = { instrument, gtNumType, gtVariant } as Track
    void probeTiles()
    const draw = () => {
      const canvas = ref.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const key = note ? resolveNoteTileKey(preview, note, false) : resolveTrackTileKey(preview)
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, size, size)
      ctx.drawImage(getTile(key), 0, 0, size, size)
    }
    draw()
    return subscribeTiles(draw)
  }, [instrument, gtNumType, gtVariant, note, noteNumType, noteVariant, size])

  return (
    <canvas
      ref={ref}
      className="sheet-tile-icon"
      width={size}
      height={size}
      title={title}
      aria-hidden
    />
  )
}
