import type { Note, Song, Track } from './types'
import type { ConvertModelId } from './convert'
import {
  GT_PITCH_LANES,
  formatLegacyCell,
  gtFieldsForInstrument,
  midiToLine,
  numTypeToGmsfNoteType,
} from './gtPitch'
import {
  clampRackVolume,
  isAudioRackNote,
  parseRackNotes,
} from './audioRack'
import { isGtSheetNote, noteMaterialType, noteStartColumn } from './gtSheet'
import { downloadBlob, safeDownloadName } from '../storage/notetopiaFile'
import {
  GMSF_AUDIO_GEAR_ID,
  GMSF_GEAR_SLOTS,
  GMSF_HEIGHT,
  GMSF_MAX_COLUMNS,
  encodeGmsfV1,
  type GmsfCell,
} from './gmsfFormat'

type SheetOccupant = {
  track: Track
  note: Note
  col: number
  line: number
}

export function collectSheetOccupants(song: Song, modelId?: ConvertModelId): {
  byCell: Map<string, SheetOccupant>
  columns: number
} {
  const byCell = new Map<string, SheetOccupant>()
  let maxCol = -1
  for (const track of song.tracks) {
    for (const note of track.notes) {
      const line = note.pitchLine ?? midiToLine(note.pitch)
      const col = noteStartColumn(note)
      if (col < 0) continue
      if (!isGtSheetNote(song, track.id, note, modelId)) continue
      const key = `${col}:${line}`
      if (byCell.has(key)) continue
      byCell.set(key, { track, note, col, line })
      if (col > maxCol) maxCol = col
    }
  }
  return { byCell, columns: maxCol < 0 ? 1 : Math.min(GMSF_MAX_COLUMNS, maxCol + 1) }
}

function occupantToCell(occupant: SheetOccupant): GmsfCell {
  if (isAudioRackNote(occupant.note)) {
    const slots = (occupant.note.audioRack ? parseRackNotes(occupant.note.audioRack.notes) : [])
      .slice(0, GMSF_GEAR_SLOTS)
      .map((slot) => {
        const fields = gtFieldsForInstrument(slot.instrument, slot.variant)
        return {
          noteId: numTypeToGmsfNoteType(fields.gtNumType) ?? 0,
          position: slot.pitchLine - 1,
        }
      })
      .filter((slot) => slot.noteId > 0)
    return {
      id: GMSF_AUDIO_GEAR_ID,
      slots,
      volume: clampRackVolume(occupant.note.audioRack?.volume ?? 100),
    }
  }
  return numTypeToGmsfNoteType(noteMaterialType(occupant.track, occupant.note)) ?? 0
}

/** Growtopia Music Simulator Final binary used by kixnoway.com. */
export function exportSongToGmsf(
  song: Song,
  modelId?: ConvertModelId,
  minColumns?: number,
): Uint8Array {
  const collected = collectSheetOccupants(song, modelId)
  const width = Math.min(
    GMSF_MAX_COLUMNS,
    Math.max(collected.columns, Number.isFinite(minColumns) ? Math.max(1, Math.round(minColumns!)) : 1),
  )
  const grid: GmsfCell[][] = Array.from({ length: GMSF_HEIGHT }, () => Array<GmsfCell>(width).fill(0))
  for (const occupant of collected.byCell.values()) {
    const y = occupant.line - 1
    if (y < 0 || y >= GMSF_HEIGHT || occupant.col >= width) continue
    grid[y][occupant.col] = occupantToCell(occupant)
  }
  return encodeGmsfV1({
    bpm: song.bpm,
    width,
    height: GMSF_HEIGHT,
    grid,
    metadata: song.name,
  })
}

/** Cernodile / GT Text `.gtmusic` used by older sims and kixnoway's file picker. */
export function exportSongToGtmusic(song: Song, modelId?: ConvertModelId): string {
  const { byCell, columns } = collectSheetOccupants(song, modelId)
  const lines: string[] = []
  for (let col = 0; col < columns; col++) {
    const cells: string[] = []
    for (let line = 1; line <= GT_PITCH_LANES; line++) {
      const occupant = byCell.get(`${col}:${line}`)
      if (!occupant || isAudioRackNote(occupant.note)) continue
      const cell = formatLegacyCell(line, noteMaterialType(occupant.track, occupant.note))
      if (cell) cells.push(cell)
    }
    lines.push(cells.join(','))
  }
  return `%cernmusicsim;\nbpm=${Math.round(song.bpm)}\n${lines.join('\n')}`
}

export function downloadGmsf(song: Song, modelId?: ConvertModelId, minColumns?: number): void {
  const data = exportSongToGmsf(song, modelId, minColumns)
  const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  downloadBlob(new Blob([copy], { type: 'application/octet-stream' }), `${safeDownloadName(song.name)}.GMSF`)
}

export function exportSongToLuaTxt(song: Song, modelId?: ConvertModelId): string {
  const { byCell, columns } = collectSheetOccupants(song, modelId)
  const rows: string[] = [
    '-- NoteTopia Growtopia Lua blueprint (not a kixnoway export)',
    `-- name = ${JSON.stringify(song.name)}`,
    `-- bpm = ${Math.round(song.bpm)}`,
    `-- columns = ${columns}`,
    '-- column = 16th-note index from the left; line 1 = B (top) … 14 = c (bottom)',
    'return {',
  ]
  const keys = [...byCell.keys()].sort((a, b) => {
    const [ca, la] = a.split(':').map(Number)
    const [cb, lb] = b.split(':').map(Number)
    return (ca ?? 0) - (cb ?? 0) || (la ?? 0) - (lb ?? 0)
  })
  for (const key of keys) {
    const occupant = byCell.get(key)
    if (!occupant) continue
    if (isAudioRackNote(occupant.note)) {
      const notes = occupant.note.audioRack?.notes ?? ''
      const volume = occupant.note.audioRack?.volume ?? 100
      rows.push(
        `  { column = ${occupant.col}, line = ${occupant.line}, rack = ${JSON.stringify(notes)}, volume = ${volume} },`,
      )
      continue
    }
    const cell = formatLegacyCell(occupant.line, noteMaterialType(occupant.track, occupant.note))
    if (!cell) continue
    rows.push(`  { column = ${occupant.col}, line = ${occupant.line}, cell = ${JSON.stringify(cell)} },`)
  }
  rows.push('}')
  return `${rows.join('\n')}\n`
}

export function downloadLuaTxt(song: Song, modelId?: ConvertModelId): void {
  downloadBlob(
    new Blob([exportSongToLuaTxt(song, modelId)], { type: 'text/plain' }),
    `${safeDownloadName(song.name)}.lua.txt`,
  )
}

export function downloadGtmusic(song: Song, modelId?: ConvertModelId): void {
  const text = exportSongToGtmusic(song, modelId)
  downloadBlob(
    new Blob([text], { type: 'text/plain' }),
    `${safeDownloadName(song.name)}.gtmusic`,
  )
}
