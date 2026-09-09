import { v4 as uuidv4 } from 'uuid'
import type { Song, Track, Note, InstrumentId } from './types'
import { createEmptySong } from './SongModel'
import { getSongDurationBeats } from './timing'
import { assertFileSize, MAX_IMPORT_BYTES } from '../storage/projectSchema'
import {
  gmsfNoteTypeToNumType,
  parseLegacyCell,
  lineToMidi,
  lineToLabel,
  columnToBeat,
  getGtDefForNumType,
  numTypeToVariant,
  GT_BLANK,
  GT_REPEAT_BEGIN,
  GT_REPEAT_END,
} from './gtPitch'
import {
  AUDIO_RACK_TRACK_NAME,
  accidentalChar,
  clampRackVolume,
  createAudioRackNote,
  createAudioRackTrack,
  encodeRackNotes,
  instrumentRackCode,
  type RackSlot,
} from './audioRack'
import {
  GMSF_AUDIO_GEAR_ID,
  GMSF_HEIGHT,
  clampGmsfBpm,
  decodeGmsfV1,
  looksLikeGmsf,
} from './gmsfFormat'

export interface GtImportSummary {
  trackCount: number
  noteCount: number
  bpm: number
  durationBeats: number
  columns: number
}

function makeNote(
  pitchLine: number,
  column: number,
  numType: number,
  durationColumns = 1,
): Note {
  const variant = numTypeToVariant(numType)
  return {
    id: uuidv4(),
    pitch: lineToMidi(pitchLine),
    pitchLine,
    gtVariant: variant,
    gtNumType: numType,
    startBeat: columnToBeat(column),
    durationBeats: columnToBeat(durationColumns),
    velocity: 100,
  }
}

function trackKey(numType: number): string {
  const def = getGtDefForNumType(numType)
  return def ? `${def.stem}-${numTypeToVariant(numType)}` : `unknown-${numType}`
}

function numTypeToInstrument(numType: number): InstrumentId {
  const def = getGtDefForNumType(numType)
  return (def?.appInstrument ?? 'piano') as InstrumentId
}

function ensureRepeatTrack(trackMap: Map<string, Track>): Track {
  const existing = trackMap.get('repeat')
  if (existing) return existing
  const track: Track = {
    id: uuidv4(),
    name: 'Repeat',
    instrument: 'piano',
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    notes: [],
  }
  trackMap.set('repeat', track)
  return track
}

type GtGridCell =
  | { kind: 'note'; numType: number }
  | { kind: 'rack'; volume: number; notes: string }

function slotFromGmsf(numType: number, pitchLine: number): RackSlot | null {
  const def = getGtDefForNumType(numType)
  if (!def) return null
  const instrument = numTypeToInstrument(numType)
  if (!instrumentRackCode(instrument)) return null
  return { instrument, pitchLine, variant: numTypeToVariant(numType) }
}

function rackNotesFromSlots(slots: RackSlot[]): string {
  return encodeRackNotes(
    slots.map((slot) => `${instrumentRackCode(slot.instrument)!}${lineToLabel(slot.pitchLine)}${accidentalChar(slot.variant)}`),
  )
}

function buildSongFromGrid(
  grid: (GtGridCell | number | null)[][],
  bpm: number,
  name: string,
): { song: Song; summary: GtImportSummary } {
  // grid[column][pitchLine 1-14] = cell or numType or null
  const trackMap = new Map<string, Track>()
  let noteCount = 0
  const song = createEmptySong(name)
  song.bpm = Number.isFinite(bpm) ? clampGmsfBpm(bpm) : 120

  for (let col = 0; col < grid.length; col++) {
    const column = grid[col]
    if (!column) continue
    for (let line = 1; line <= 14; line++) {
      const raw = column[line]
      if (raw == null) continue
      if (typeof raw !== 'number' && raw.kind === 'rack') {
        let rack = song.tracks.find((track) => track.name === AUDIO_RACK_TRACK_NAME)
        if (!rack) {
          rack = createAudioRackTrack()
          song.tracks.push(rack)
        }
        rack.notes.push(
          createAudioRackNote(columnToBeat(col), line, { volume: raw.volume, notes: raw.notes }),
        )
        noteCount++
        continue
      }
      const numType = typeof raw === 'number' ? raw : raw.numType
      if (numType === GT_BLANK) continue
      if (numType === GT_REPEAT_BEGIN || numType === GT_REPEAT_END) {
        ensureRepeatTrack(trackMap).notes.push(makeNote(line, col, numType))
        noteCount++
        continue
      }
      const key = trackKey(numType)
      if (!trackMap.has(key)) {
        const def = getGtDefForNumType(numType)!
        trackMap.set(key, {
          id: uuidv4(),
          name: def.label,
          instrument: numTypeToInstrument(numType),
          gtStem: def.fileStem ?? def.stem,
          gtNumType: numType,
          gtVariant: numTypeToVariant(numType),
          volume: 0.8,
          pan: 0,
          muted: false,
          solo: false,
          notes: [],
        })
      }
      trackMap.get(key)!.notes.push(makeNote(line, col, numType))
      noteCount++
    }
  }

  const rackTrack = song.tracks.find((track) => track.name === AUDIO_RACK_TRACK_NAME && track.notes.length > 0)
  if (trackMap.size > 0) {
    song.tracks = [...trackMap.values()]
    if (rackTrack) song.tracks.push(rackTrack)
  } else if (rackTrack) {
    song.tracks = [rackTrack]
  }

  return {
    song,
    summary: {
      trackCount: song.tracks.length,
      noteCount,
      bpm: song.bpm,
      durationBeats: getSongDurationBeats(song),
      columns: grid.length,
    },
  }
}

export function importGtmusicText(text: string, filename?: string): {
  song: Song
  summary: GtImportSummary
} {
  if (!text.startsWith('%cernmusicsim;')) {
    throw new Error('Invalid .gtmusic file')
  }

  const lines = text.slice('%cernmusicsim;'.length).split(/\r?\n/)
  while (lines.length && !lines[0].trim()) lines.shift()
  const bpmLine = lines.shift()
  const bpmRaw = Number.parseInt(String(bpmLine ?? '').split('=')[1], 10)
  const bpm = Number.isFinite(bpmRaw) ? bpmRaw : 120

  const grid: (number | null)[][] = []

  for (const row of lines) {
    if (!row.trim()) continue
    const cells = row.split(',')
    const column: (number | null)[] = new Array(15).fill(null)
    for (const cell of cells) {
      if (!cell || cell.trim() === '') continue
      const parsed = parseLegacyCell(cell.trim())
      if (parsed) column[parsed.line] = parsed.numType
    }
    grid.push(column)
  }

  const name = filename?.replace(/\.(gtmusic|GMSF)$/i, '') ?? 'Imported GT Song'
  return buildSongFromGrid(grid, bpm, name)
}

export function importGmsfBuffer(buffer: ArrayBuffer, filename?: string): {
  song: Song
  summary: GtImportSummary
} {
  const parsed = decodeGmsfV1(buffer)
  const height = Math.min(GMSF_HEIGHT, parsed.height)
  const grid: (GtGridCell | number | null)[][] = []
  for (let col = 0; col < parsed.width; col++) {
    grid.push(new Array(15).fill(null))
  }

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < parsed.width; col++) {
      const cell = parsed.grid[row]?.[col]
      if (cell == null || cell === 0) continue
      const line = row + 1
      if (typeof cell !== 'number' && cell.id === GMSF_AUDIO_GEAR_ID) {
        const slots: RackSlot[] = []
        for (const slot of cell.slots) {
          const numType = gmsfNoteTypeToNumType(slot.noteId)
          if (numType == null) continue
          const mapped = slotFromGmsf(numType, slot.position + 1)
          if (mapped) slots.push(mapped)
        }
        grid[col][line] = {
          kind: 'rack',
          volume: clampRackVolume(cell.volume || 100),
          notes: rackNotesFromSlots(slots),
        }
        continue
      }
      const gmsfId = typeof cell === 'number' ? cell : 0
      const numType = gmsfNoteTypeToNumType(gmsfId)
      if (numType != null) grid[col][line] = numType
    }
  }

  const fromMeta = parsed.metadata.split(/\r?\n/)[0]?.trim()
  const name =
    fromMeta ||
    filename?.replace(/\.(gtmusic|GMSF|gmsf|gmf)$/i, '') ||
    'Imported GT Song'
  return buildSongFromGrid(grid, parsed.bpm, name)
}

export async function importGtMusicFile(file: File): Promise<{
  song: Song
  summary: GtImportSummary
}> {
  assertFileSize(file, MAX_IMPORT_BYTES)
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const lower = file.name.toLowerCase()
  if (looksLikeGmsf(bytes) || lower.endsWith('.gmsf') || lower.endsWith('.gmf')) {
    return importGmsfBuffer(buffer, file.name)
  }
  const text = new TextDecoder().decode(bytes)
  return importGtmusicText(text, file.name)
}
