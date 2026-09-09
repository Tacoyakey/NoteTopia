import { v4 as uuidv4 } from 'uuid'
import type { Song, Track, Note, InstrumentId } from './types'

import { midiToLine, snapMidiToLine, gtFieldsForInstrument, GT_BLANK, GT_REPEAT_BEGIN, GT_REPEAT_END, GT_AUDIO_RACK } from './gtPitch'

export function createNote(
  pitch: number,
  startBeat: number,
  durationBeats = 1,
  velocity = 100,
): Note {
  const snapped = snapMidiToLine(pitch)
  return {
    id: uuidv4(),
    pitch: snapped,
    pitchLine: midiToLine(snapped),
    startBeat,
    durationBeats,
    velocity,
  }
}

/** Keep the original MIDI pitch so convert methods can fold octaves themselves. */
export function createImportedNote(
  pitch: number,
  startBeat: number,
  durationBeats = 1,
  velocity = 100,
): Note {
  return {
    id: uuidv4(),
    pitch,
    pitchLine: midiToLine(pitch),
    startBeat,
    durationBeats: Math.max(durationBeats, 1 / 64),
    velocity,
  }
}

/** Place a note using the selected track's Growtopia instrument variant. */
export function createNoteFromTrack(
  track: Track,
  pitch: number,
  startBeat: number,
  durationBeats = 0.25,
  velocity = 100,
): Note {
  const note = createNote(pitch, startBeat, durationBeats, velocity)
  note.gtNumType = track.gtNumType
  note.gtVariant = track.gtVariant ?? 'natural'
  return note
}

export function createTrack(
  name: string,
  instrument: InstrumentId = 'piano',
): Track {
  return {
    id: uuidv4(),
    name,
    instrument,
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    notes: [],
    ...gtFieldsForInstrument(instrument),
  }
}

/** Keep sheet sprites in sync when a track’s instrument / variant changes. */
export function applyTrackUpdates(track: Track, updates: Partial<Track>): Track {
  const next = { ...track, ...updates }
  const spriteChanged =
    (updates.instrument != null && updates.instrument !== track.instrument) ||
    (updates.gtNumType != null && updates.gtNumType !== track.gtNumType) ||
    (updates.gtVariant != null && updates.gtVariant !== track.gtVariant)
  if (!spriteChanged) return next
  next.notes = track.notes.map((note) => {
    if (
      note.audioRack != null ||
      note.gtNumType === GT_AUDIO_RACK ||
      note.gtNumType === GT_REPEAT_BEGIN ||
      note.gtNumType === GT_REPEAT_END ||
      note.gtNumType === GT_BLANK
    ) {
      return note
    }
    return {
      ...note,
      ...(next.gtNumType != null ? { gtNumType: next.gtNumType } : {}),
      ...(next.gtVariant != null ? { gtVariant: next.gtVariant } : {}),
    }
  })
  return next
}

export function createEmptySong(name = 'Untitled'): Song {
  return {
    version: 1,
    name,
    bpm: 120,
    timeSignature: { numerator: 4, denominator: 4 },
    tracks: [
      createTrack('Melody', 'piano'),
      createTrack('Bass', 'bass'),
      createTrack('Chords', 'synth'),
      createTrack('Drums', 'drums'),
    ],
  }
}

export function cloneSong(song: Song): Song {
  return JSON.parse(JSON.stringify(song)) as Song
}

export function addNoteToTrack(song: Song, trackId: string, note: Note): Song {
  return {
    ...song,
    tracks: song.tracks.map((t) =>
      t.id === trackId ? { ...t, notes: [...t.notes, note] } : t,
    ),
  }
}

export function removeNotesFromTrack(
  song: Song,
  trackId: string,
  noteIds: string[],
): Song {
  const idSet = new Set(noteIds)
  return {
    ...song,
    tracks: song.tracks.map((t) =>
      t.id === trackId
        ? { ...t, notes: t.notes.filter((n) => !idSet.has(n.id)) }
        : t,
    ),
  }
}

export function updateNoteInTrack(
  song: Song,
  trackId: string,
  noteId: string,
  updates: Partial<Note>,
): Song {
  return {
    ...song,
    tracks: song.tracks.map((t) =>
      t.id === trackId
        ? {
            ...t,
            notes: t.notes.map((n) =>
              n.id === noteId ? { ...n, ...updates } : n,
            ),
          }
        : t,
    ),
  }
}

export function updateTrack(
  song: Song,
  trackId: string,
  updates: Partial<Track>,
): Song {
  return {
    ...song,
    tracks: song.tracks.map((t) =>
      t.id === trackId ? { ...t, ...updates } : t,
    ),
  }
}

export function addTrack(song: Song, track?: Track, afterTrackId?: string): Song {
  const newTrack = track ?? createTrack(`Track ${song.tracks.length + 1}`)
  if (!afterTrackId) return { ...song, tracks: [...song.tracks, newTrack] }
  const idx = song.tracks.findIndex((item) => item.id === afterTrackId)
  if (idx < 0) return { ...song, tracks: [...song.tracks, newTrack] }
  const tracks = [...song.tracks]
  tracks.splice(idx + 1, 0, newTrack)
  return { ...song, tracks }
}

export function moveTrack(song: Song, trackId: string, toIndex: number): Song {
  const from = song.tracks.findIndex((track) => track.id === trackId)
  if (from < 0) return song
  const to = Math.max(0, Math.min(song.tracks.length - 1, Math.round(toIndex)))
  if (from === to) return song
  const tracks = [...song.tracks]
  const [track] = tracks.splice(from, 1)
  tracks.splice(to, 0, track)
  return { ...song, tracks }
}

export function removeTrack(song: Song, trackId: string): Song {
  return { ...song, tracks: song.tracks.filter((t) => t.id !== trackId) }
}

export function getActiveTracks(song: Song): Track[] {
  const hasSolo = song.tracks.some((t) => t.solo)
  if (hasSolo) {
    return song.tracks.filter((t) => t.solo && !t.muted)
  }
  return song.tracks.filter((t) => !t.muted)
}

export function findNote(
  song: Song,
  noteId: string,
): { track: Track; note: Note } | null {
  for (const track of song.tracks) {
    const note = track.notes.find((n) => n.id === noteId)
    if (note) return { track, note }
  }
  return null
}

export function getAllNotes(song: Song): { track: Track; note: Note }[] {
  const result: { track: Track; note: Note }[] = []
  for (const track of song.tracks) {
    for (const note of track.notes) {
      result.push({ track, note })
    }
  }
  return result
}
