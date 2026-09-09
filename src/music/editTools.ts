import { v4 as uuidv4 } from 'uuid'
import type { Note, Song, Track } from './types'
import { midiToLine, snapMidiToLine } from './gtPitch'
import { noteMaterialType } from './gtSheet'
import { isAudioRackNote } from './audioRack'
import { createNoteFromTrack } from './SongModel'

export function notesMatchingIds(song: Song, ids: ReadonlySet<string>): { track: Track; note: Note }[] {
  const hits: { track: Track; note: Note }[] = []
  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (ids.has(note.id)) hits.push({ track, note })
    }
  }
  return hits
}

export function selectSamePitchIds(song: Song, seedIds: ReadonlySet<string>, trackOnly: boolean): string[] {
  const seeds = notesMatchingIds(song, seedIds)
  if (seeds.length === 0) return []
  const pitches = new Set(seeds.map(({ note }) => note.pitch))
  const trackIds = trackOnly ? new Set(seeds.map(({ track }) => track.id)) : null
  const ids: string[] = []
  for (const track of song.tracks) {
    if (trackIds && !trackIds.has(track.id)) continue
    for (const note of track.notes) {
      if (pitches.has(note.pitch)) ids.push(note.id)
    }
  }
  return ids
}

export function sliceNoteAtBeat(note: Note, beat: number): { left: Note; right: Note } | null {
  const split = beat
  if (split <= note.startBeat + 1e-6) return null
  if (split >= note.startBeat + note.durationBeats - 1e-6) return null
  const leftDur = split - note.startBeat
  const right: Note = {
    ...note,
    id: uuidv4(),
    startBeat: split,
    durationBeats: note.durationBeats - leftDur,
  }
  const left: Note = { ...note, durationBeats: leftDur }
  return { left, right }
}

export function sliceSongAtBeat(
  song: Song,
  beat: number,
  noteIds: ReadonlySet<string> | null,
): Song {
  const tracks = song.tracks.map((track) => {
    const notes: Note[] = []
    for (const note of track.notes) {
      if (noteIds && !noteIds.has(note.id)) {
        notes.push(note)
        continue
      }
      if (isAudioRackNote(note)) {
        notes.push(note)
        continue
      }
      const sliced = sliceNoteAtBeat(note, beat)
      if (!sliced) {
        notes.push(note)
        continue
      }
      notes.push(sliced.left, sliced.right)
    }
    return { ...track, notes }
  })
  return { ...song, tracks }
}

export function replaceSelectedWithTrack(
  song: Song,
  ids: ReadonlySet<string>,
  instrumentTrack: Track,
): { trackId: string; noteId: string; updates: Partial<Note> }[] {
  const patches: { trackId: string; noteId: string; updates: Partial<Note> }[] = []
  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (!ids.has(note.id) || isAudioRackNote(note)) continue
      patches.push({
        trackId: track.id,
        noteId: note.id,
        updates: {
          gtNumType: instrumentTrack.gtNumType ?? note.gtNumType,
          gtVariant: instrumentTrack.gtVariant ?? note.gtVariant,
        },
      })
    }
  }
  return patches
}

export function paintNoteBeats(fromBeat: number, toBeat: number, snap: number): number[] {
  const grid = 4 / snap
  const a = Math.min(fromBeat, toBeat)
  const b = Math.max(fromBeat, toBeat)
  const start = Math.round(a / grid) * grid
  const beats: number[] = []
  for (let beat = start; beat <= b + 1e-9; beat += grid) {
    beats.push(Math.max(0, beat))
  }
  return beats
}

export function makePaintedNotes(track: Track, beats: number[], pitch: number, snap: number): Note[] {
  const duration = 4 / snap
  const snapped = snapMidiToLine(pitch)
  return beats.map((startBeat) => {
    const note = createNoteFromTrack(track, snapped, startBeat, duration)
    note.pitchLine = midiToLine(snapped)
    return note
  })
}

export { noteMaterialType }
