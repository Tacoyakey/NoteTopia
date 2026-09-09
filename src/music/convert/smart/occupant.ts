import { GT_COLUMNS_PER_BEAT, midiToLine } from '../../gtPitch'
import { findAudioRackAt, isAudioRackNote } from '../../audioRack'
import { isRepeatNote, noteLine } from '../../sheetRepeats'
import type { Note, Song, Track } from '../../types'
import type { TileOccupant } from '../types'
import type { DetectedRole } from './roles'
import { inferRoleFromInstrument, roleWeight } from './roles'

function score(
  track: Track,
  trackIndex: number,
  note: Note,
  roles?: Map<string, DetectedRole>,
): number {
  const role = roles?.get(track.id) ?? inferRoleFromInstrument(track)
  const line = note.pitchLine ?? midiToLine(note.pitch)
  const midi = note.pitch
  const inLowHalf = midi <= 59
  const register =
    (role === 'bass' && inLowHalf) || (role === 'lead' && !inLowHalf) ? 8 : 0
  return roleWeight(role, trackIndex) + note.velocity / 6 + register + (15 - line) * 0.05
}

export function occupantSmart(
  song: Song,
  beat: number,
  pitchLine: number,
  roles?: Map<string, DetectedRole>,
): TileOccupant | null {
  const rack = findAudioRackAt(song, beat, pitchLine)
  if (rack) return rack
  const column = Math.round(beat * GT_COLUMNS_PER_BEAT)
  let best: TileOccupant | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  let repeat: TileOccupant | null = null
  song.tracks.forEach((track, trackIndex) => {
    if (track.muted) return
    for (const note of track.notes) {
      if (isAudioRackNote(note)) continue
      const line = noteLine(note)
      if (line !== pitchLine) continue
      if (Math.round(note.startBeat * GT_COLUMNS_PER_BEAT) !== column) continue
      if (isRepeatNote(note)) {
        repeat = { trackId: track.id, noteId: note.id }
        continue
      }
      const next = score(track, trackIndex, note, roles)
      if (next >= bestScore) {
        bestScore = next
        best = { trackId: track.id, noteId: note.id }
      }
    }
  })
  return repeat ?? best
}
