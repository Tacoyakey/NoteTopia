import { cloneSong } from '../SongModel'
import {
  GT_COLUMNS_PER_BEAT,
  gtFieldsForInstrument,
  midiToLine,
} from '../gtPitch'
import type { Note, Song, Track } from '../types'
import { isAudioRackNote } from '../audioRack'
import { AUDIO_RACK_TRACK_NAME } from '../audioRack'
import { splitAccidentalLayers } from './accidentals'
import { finishConvertedSheet, sheetColumnCount } from './packSheet'
import { snapInStaff } from './fitKey'
import { EXPERIMENTAL_CONVERT_ID } from './flags'
import type { ConvertBakeOptions, ConvertModel, ConvertResult } from './types'
import { analyzeSong } from './smart/analyze'
import { mapGmProgram } from './smart/gmMap'
import { occupantSmart } from './smart/occupant'
import {
  DEFAULT_SMART_OPTIONS,
  mergeSmartOptions,
  type SmartOptions,
} from './smart/options'
import { applyArrangement, arrangeForStaff } from './smart/arrange'
import { buildMusicalScore } from './smart/ir'
import { GT_HI, GT_LO } from './smart/pitch'
import { packSmartRacks } from './smart/racks'
import {
  attachOrnaments,
  isOrnament,
  pickupTrimSong,
  shouldStraighten,
  snapToSixteenth,
  straightenSwingNotes,
} from './smart/rhythm'
import {
  overrideFor,
  resolveTrackRoles,
  type DetectedRole,
} from './smart/roles'
import { spellWithPolicy } from './smart/spell'
import {
  collapseOctaveDoubles,
  collapseUnison,
  thinByImportance,
  thinChord,
  thinPadColumn,
  uniqueByLine,
} from './smart/voicing'
import {
  dropHatsUnderKickSnare,
  isGhostHat,
  withDrumFields,
} from './smart/drums'

function resolveSmart(options?: ConvertBakeOptions): SmartOptions {
  const smart = mergeSmartOptions(options?.smart ?? DEFAULT_SMART_OPTIONS)
  return {
    ...smart,
    fitKey: options?.fitKey ?? smart.fitKey,
    preferLow: options?.preferLow ?? smart.preferLow,
    compress: options?.compress ?? smart.compress,
  }
}

function packLimit(smart: SmartOptions, options?: ConvertBakeOptions): number | undefined {
  if (options?.targetColumns != null) return options.targetColumns
  if (smart.targetColumns === 'none') return undefined
  return smart.targetColumns
}

function remapTrack(track: Track, smart: SmartOptions): void {
  const override = overrideFor(track.id, smart.tracks)
  if (override?.instrument) {
    track.instrument = override.instrument
  } else if (track.gmProgram != null) {
    track.instrument = mapGmProgram(track.gmProgram, track.instrument === 'drums', {
      padInstrument: smart.padInstrument,
      bellInstrument: smart.bellInstrument,
      fallbackInstrument: smart.fallbackInstrument,
    })
  } else if (track.instrument === 'synth') {
    track.instrument = smart.padInstrument === 'spooky' ? 'spooky' : smart.fallbackInstrument
  } else if (track.instrument === 'bell') {
    track.instrument = smart.bellInstrument
  }
  const fields = gtFieldsForInstrument(track.instrument, track.gtVariant ?? 'natural')
  track.gtStem = fields.gtStem
  track.gtNumType = fields.gtNumType
  track.gtVariant = fields.gtVariant
}

function flattenAccidentals(song: Song, smart: SmartOptions, keyName: ReturnType<typeof analyzeSong>['key']): void {
  for (const track of song.tracks) {
    for (const note of track.notes) {
      const { written } = spellWithPolicy(note.pitch, smart.accidentalSpelling, keyName)
      note.pitch = written
      note.pitchLine = midiToLine(written)
      note.gtVariant = 'natural'
      const fields = gtFieldsForInstrument(track.instrument, 'natural')
      note.gtNumType = fields.gtNumType
    }
    const fields = gtFieldsForInstrument(track.instrument, 'natural')
    track.gtVariant = 'natural'
    track.gtNumType = fields.gtNumType
    track.gtStem = fields.gtStem
  }
}

function convertPitchedTrack(
  track: Track,
  role: DetectedRole,
  smart: SmartOptions,
  importance?: Map<string, number>,
): { notes: Note[]; snapped: number; droppedOrnaments: number; thinnedChords: number } {
  let droppedOrnaments = 0
  let usable = track.notes
  if (smart.graceNotes === 'drop') {
    const next = usable.filter((note) => !isOrnament(note))
    droppedOrnaments = usable.length - next.length
    usable = next
  } else if (smart.graceNotes === 'attach') {
    droppedOrnaments = usable.filter(isOrnament).length
    usable = attachOrnaments(usable)
  }

  const ordered = [...usable].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch)
  let snapped = 0
  const mapped = ordered.map((note) => {
    const startBeat = snapToSixteenth(note.startBeat)
    if (Math.abs(startBeat - note.startBeat) > 1e-6) snapped++
    const pitch = snapInStaff(note.pitch)
    const variant = note.gtVariant ?? track.gtVariant ?? 'natural'
    const fields = gtFieldsForInstrument(track.instrument, variant)
    return {
      ...note,
      startBeat,
      durationBeats: 0.25,
      pitch,
      pitchLine: midiToLine(pitch),
      gtVariant: variant,
      gtNumType: note.gtNumType ?? fields.gtNumType,
    }
  })

  const byColumn = new Map<number, Note[]>()
  for (const note of mapped) {
    const col = Math.round(note.startBeat * GT_COLUMNS_PER_BEAT)
    const list = byColumn.get(col) ?? []
    list.push(note)
    byColumn.set(col, list)
  }

  let thinnedChords = 0
  const thinned: Note[] = []
  for (const group of byColumn.values()) {
    let next = group
    if (smart.unisonCollapse) next = collapseUnison(next).notes
    if (smart.octaveDoubleCollapse) next = collapseOctaveDoubles(next).notes
    if (role === 'pad') next = thinPadColumn(next, smart.padThin)
    const before = next.length
    next = importance?.size
      ? thinByImportance(next, smart.chordCap, importance)
      : thinChord(next, smart.chordCap)
    if (next.length < before) thinnedChords += before - next.length
    thinned.push(...uniqueByLine(next))
  }
  return { notes: thinned, snapped, droppedOrnaments, thinnedChords }
}

function convertDrumTrack(
  track: Track,
  smart: SmartOptions,
): { notes: Note[]; snapped: number; droppedOrnaments: number } {
  let usable = track.notes
  let droppedOrnaments = 0
  if (smart.dropGhostHats) {
    const next = usable.filter((note) => !isGhostHat(note.pitch, note.velocity, smart.ghostHatVelocity))
    droppedOrnaments += usable.length - next.length
    usable = next
  }
  if (smart.kickSnarePriority) usable = dropHatsUnderKickSnare(usable)
  let snapped = 0
  const mapped = usable.map((note) => {
    const startBeat = snapToSixteenth(note.startBeat)
    if (Math.abs(startBeat - note.startBeat) > 1e-6) snapped++
    return withDrumFields({ ...note, startBeat }, smart.compactKit)
  })
  const byColumn = new Map<number, Note[]>()
  for (const note of mapped) {
    const col = Math.round(note.startBeat * GT_COLUMNS_PER_BEAT)
    const list = byColumn.get(col) ?? []
    list.push(note)
    byColumn.set(col, list)
  }
  const notes: Note[] = []
  for (const group of byColumn.values()) notes.push(...uniqueByLine(group))
  return { notes, snapped, droppedOrnaments }
}

function mergeSameInstrumentTracks(song: Song): void {
  const groups = new Map<string, Track>()
  const kept: Track[] = []
  for (const track of song.tracks) {
    if (track.name === AUDIO_RACK_TRACK_NAME || track.notes.some(isAudioRackNote)) {
      kept.push(track)
      continue
    }
    const key = `${track.instrument}:${track.gtVariant ?? 'natural'}`
    const host = groups.get(key)
    if (!host) {
      groups.set(key, track)
      kept.push(track)
      continue
    }
    host.notes.push(...track.notes)
  }
  song.tracks = kept
}

function scaleVelocities(song: Song, smart: SmartOptions): void {
  const notes = song.tracks.flatMap((track) => track.notes.filter((note) => !isAudioRackNote(note)))
  if (notes.length === 0) return
  if (smart.flattenVelocities) {
    for (const note of notes) note.velocity = 100
    return
  }
  if (!smart.normalize) return
  const max = Math.max(...notes.map((note) => note.velocity), 1)
  if (max <= 0) return
  for (const note of notes) {
    note.velocity = Math.max(1, Math.min(127, Math.round((note.velocity / max) * 100)))
  }
}

function bakeSmart(song: Song, options?: ConvertBakeOptions): ConvertResult {
  const smart = resolveSmart(options)
  const bpmIn = song.bpm
  const next = cloneSong(song)
  const skip = new Set(smart.tracks.filter((row) => row.include === false).map((row) => row.trackId))
  next.tracks = next.tracks.filter((track) => !skip.has(track.id))
  if (smart.skipDrums) {
    next.tracks = next.tracks.filter((track) => track.instrument !== 'drums')
  }
  if (smart.dropQuiet) {
    for (const track of next.tracks) {
      track.notes = track.notes.filter((note) => note.velocity > smart.quietThreshold)
    }
  }
  next.tracks = next.tracks.filter((track) => track.notes.length > 0)
  if (next.tracks.length === 0) {
    const empty = cloneSong(song)
    return {
      song: empty,
      stats: { notesIn: 0, notesOut: 0, overlapsResolved: 0, snappedToGrid: 0, bpmIn, bpmOut: empty.bpm },
    }
  }

  if (smart.trimSilence) {
    let minBeat = Infinity
    for (const track of next.tracks) {
      for (const note of track.notes) minBeat = Math.min(minBeat, note.startBeat)
    }
    if (Number.isFinite(minBeat) && minBeat > 0.0001) {
      for (const track of next.tracks) {
        for (const note of track.notes) note.startBeat -= minBeat
      }
    }
  }
  if (smart.pickupTrim) pickupTrimSong(next)

  for (const track of next.tracks) {
    remapTrack(track, smart)
    const override = overrideFor(track.id, smart.tracks)
    if (override && override.octave !== 0) {
      for (const note of track.notes) note.pitch += override.octave
    }
  }

  let roles = resolveTrackRoles(next, smart.tracks)
  if (smart.melodyIsolation) {
    next.tracks = next.tracks.filter((track) => {
      const role = roles.get(track.id)
      return role === 'lead' || role === 'bass' || role === 'drums'
    })
    roles = resolveTrackRoles(next, smart.tracks)
  }

  if (shouldStraighten(next, smart.swing)) {
    for (const track of next.tracks) track.notes = straightenSwingNotes(track.notes)
  }

  let droppedOrnaments = 0
  for (const track of next.tracks) {
    if (track.instrument === 'drums') continue
    if (smart.graceNotes === 'drop') {
      const kept = track.notes.filter((note) => !isOrnament(note))
      droppedOrnaments += track.notes.length - kept.length
      track.notes = kept
    } else if (smart.graceNotes === 'attach') {
      droppedOrnaments += track.notes.filter(isOrnament).length
      track.notes = attachOrnaments(track.notes)
    }
  }
  next.tracks = next.tracks.filter((track) => track.notes.length > 0)
  roles = resolveTrackRoles(next, smart.tracks)

  const analysis = analyzeSong(next)
  const notesIn = next.tracks.reduce((n, track) => n + track.notes.length, 0)

  const score = buildMusicalScore(next, roles, analysis)
  const arranged = arrangeForStaff(score, {
    fitKey: smart.fitKey,
    preferLow: smart.preferLow,
    keyLock: smart.keyLock,
    chordCap: smart.chordCap,
    padThin: smart.padThin,
  })
  applyArrangement(next, arranged)

  if (smart.splitAccidentals) {
    const spelled = splitAccidentalLayers(next, (midi) =>
      spellWithPolicy(midi, smart.accidentalSpelling, analysis.key),
    )
    next.tracks = spelled.tracks
    roles = resolveTrackRoles(next, smart.tracks)
  } else {
    flattenAccidentals(next, smart, analysis.key)
  }

  let snappedToGrid = 0
  let thinnedChords = 0
  next.tracks.forEach((track) => {
    const role = roles.get(track.id) ?? 'harmony'
    if (role === 'drums' || track.instrument === 'drums') {
      const converted = convertDrumTrack(track, smart)
      snappedToGrid += converted.snapped
      droppedOrnaments += converted.droppedOrnaments
      track.notes = converted.notes
      return
    }
    const converted = convertPitchedTrack(track, role, smart, arranged.importance)
    snappedToGrid += converted.snapped
    droppedOrnaments += converted.droppedOrnaments
    thinnedChords += converted.thinnedChords
    track.notes = converted.notes
  })

  let racksCreated = 0
  let rackOverflow = 0
  if (smart.packRacks && !smart.neverRacks) {
    const packed = packSmartRacks(next, roles, {
      maxVoices: smart.maxRackVoices,
      mixVolume: smart.mixRackVolume,
      duck: smart.duckBusyRacks,
      sameInstrumentChords: smart.sameInstrumentChords,
    })
    racksCreated = packed.packed
    rackOverflow = packed.overflow
  }

  let overlapsResolved = 0
  const keptByTrack = next.tracks.map((track) => {
    if (track.muted) return track.notes
    const kept: Note[] = []
    for (const note of track.notes) {
      if (isAudioRackNote(note)) {
        kept.push(note)
        continue
      }
      const line = note.pitchLine ?? midiToLine(note.pitch)
      const occ = occupantSmart(next, note.startBeat, line, roles)
      if (occ?.trackId === track.id && occ.noteId === note.id) kept.push(note)
      else overlapsResolved++
    }
    return kept
  })
  next.tracks.forEach((track, i) => {
    track.notes = keptByTrack[i]
  })

  if (smart.mergeSameInstruments) mergeSameInstrumentTracks(next)
  scaleVelocities(next, smart)

  const warnings: string[] = []
  if (rackOverflow > 0) warnings.push('rack-overflow')
  const leftoverOut = next.tracks.reduce((n, track) => {
    if (track.instrument === 'drums') return n
    return (
      n +
      track.notes.filter(
        (note) => !isAudioRackNote(note) && (note.pitch < GT_LO || note.pitch > GT_HI),
      ).length
    )
  }, 0)
  if (leftoverOut > 0) warnings.push('out-of-range')

  const collapsed = options?.skipFinish
    ? next
    : finishConvertedSheet(next, {
        ...options,
        compress: smart.compress,
        targetColumns: packLimit(smart, options),
        minBpm: options?.minBpm ?? smart.minBpm,
      })
  if (collapsed.bpm < bpmIn) warnings.push('bpm-halved')

  return {
    song: collapsed,
    stats: {
      notesIn,
      notesOut: collapsed.tracks.reduce((n, track) => n + track.notes.length, 0),
      overlapsResolved,
      snappedToGrid,
      racksCreated,
      keyShift: arranged.globalShift,
      warnings: warnings.length ? warnings : undefined,
      columns: sheetColumnCount(collapsed),
      bpmIn,
      bpmOut: collapsed.bpm,
      droppedOrnaments,
      thinnedChords,
      detectedKey: analysis.key.name,
      notesPreserved: arranged.stats.notesPreserved,
      notesOctaveShifted: arranged.stats.notesOctaveShifted,
      notesTransposed: arranged.stats.notesTransposed,
      notesRemoved: arranged.stats.notesRemoved,
      notesSimplified: arranged.stats.notesSimplified,
      chordsSimplified: arranged.stats.chordsSimplified,
      melodicNotesPreserved: arranged.stats.melodicNotesPreserved,
      melodicContourChanges: arranged.stats.melodicContourChanges,
      averageMelodicIntervalChange: arranged.stats.averageMelodicIntervalChange,
      maximumMelodicJump: arranged.stats.maximumMelodicJump,
      voiceLeadingMovement: arranged.stats.voiceLeadingMovement,
      repeatedMotifsPreserved: arranged.stats.repeatedMotifsPreserved,
      rhythmPreserved: arranged.stats.rhythmPreserved,
      polyphonyReductions: arranged.stats.polyphonyReductions,
      arrangementScore: arranged.stats.arrangementScore,
      decisions: arranged.decisions.length ? arranged.decisions : undefined,
    },
  }
}

/** 2.0 (internal) — Adapt: analysis-driven MIDI → Growtopia sheet. */
export const convertV3: ConvertModel = {
  id: EXPERIMENTAL_CONVERT_ID,
  tag: '2.0',
  label: 'Adapt',
  description: 'Arranges the whole MIDI into two octaves. Mixed overlaps become Audio Racks.',
  recommended: true,
  occupant: (song, beat, pitchLine) => occupantSmart(song, beat, pitchLine),
  bake: bakeSmart,
}
