import { describe, expect, it } from 'vitest'
import { createEmptySong, createNote, createTrack } from '../music/SongModel'
import {
  collectSelectedWorldNotes,
  notesIntersectingScreenRect,
  relocateWorldNotes,
} from './worldSelection'
import { beatToWorldX, densityFromSlider, getNoteWorldY, GT_BLOCK_SIZE } from './worldLayout'

describe('relocateWorldNotes', () => {
  it('moves a group by columns and pitch lines', () => {
    const song = createEmptySong('Move')
    const track = createTrack('Lead', 'piano')
    const a = createNote(60, 0, 0.25)
    a.pitchLine = 8
    const b = createNote(62, 0.25, 0.25)
    b.pitchLine = 8
    track.notes = [a, b]
    song.tracks = [track]
    const origs = collectSelectedWorldNotes(song, new Set([a.id, b.id]))
    const patches = relocateWorldNotes(song, origs, 2, -1)
    expect(patches).toHaveLength(2)
    expect(patches?.[0].startBeat).toBe(0.5)
    expect(patches?.[0].pitchLine).toBe(7)
    expect(patches?.[1].startBeat).toBe(0.75)
  })

  it('rejects moves that hit another tile or leave the staff', () => {
    const song = createEmptySong('Block')
    const track = createTrack('Lead', 'piano')
    const a = createNote(60, 0, 0.25)
    a.pitchLine = 8
    const wall = createNote(64, 0.5, 0.25)
    wall.pitchLine = 8
    track.notes = [a, wall]
    song.tracks = [track]
    const origs = collectSelectedWorldNotes(song, new Set([a.id]))
    expect(relocateWorldNotes(song, origs, 2, 0)).toBeNull()
    a.pitchLine = 1
    origs[0].pitchLine = 1
    expect(relocateWorldNotes(song, origs, 0, -1)).toBeNull()
  })
})

describe('notesIntersectingScreenRect', () => {
  it('returns notes whose tiles overlap the marquee', () => {
    const song = createEmptySong('Box')
    const track = createTrack('Lead', 'piano')
    const note = createNote(60, 0, 0.25)
    note.pitchLine = 8
    track.notes = [note]
    song.tracks = [track]
    const densitySlider = 100
    const density = densityFromSlider(densitySlider)
    const zoom = 1
    const viewH = 600
    const cameraX = 0
    const wx = beatToWorldX(0, density, false, song)
    const wy = getNoteWorldY(note, viewH, true, zoom)
    const ids = notesIntersectingScreenRect(
      song,
      {
        x: (wx - cameraX) * zoom + 2,
        y: wy * zoom + 2,
        w: GT_BLOCK_SIZE * density * zoom - 4,
        h: GT_BLOCK_SIZE * zoom - 4,
      },
      cameraX,
      zoom,
      viewH,
      densitySlider,
    )
    expect(ids).toEqual([note.id])
    const miss = notesIntersectingScreenRect(
      song,
      { x: 0, y: 0, w: 4, h: 4 },
      cameraX,
      zoom,
      viewH,
      densitySlider,
    )
    expect(miss).toEqual([])
  })
})
