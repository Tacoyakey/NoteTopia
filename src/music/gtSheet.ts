import { midiToLine, GT_AUDIO_RACK } from './gtPitch'
import { getConvertModel, type ConvertModelId } from './convert'
import { findAudioRackAt, isAudioRackNote } from './audioRack'
import type { Note, Song } from './types'

export function noteStartColumn(note: Note): number {
  return Math.round(note.startBeat * 4)
}

/** The single instrument that owns this 16th + pitch tile, per the selected convert model. */
export function getGtCellOccupant(
  song: Song,
  beat: number,
  pitchLine: number,
  modelId?: ConvertModelId,
): { trackId: string; noteId: string } | null {
  return (
    findAudioRackAt(song, beat, pitchLine) ?? getConvertModel(modelId).occupant(song, beat, pitchLine)
  )
}

export function isGtSheetNote(
  song: Song,
  trackId: string,
  note: Note,
  modelId?: ConvertModelId,
): boolean {
  const line = note.pitchLine ?? midiToLine(note.pitch)
  const occ = getGtCellOccupant(song, note.startBeat, line, modelId)
  return occ?.trackId === trackId && occ.noteId === note.id
}

/** Notes that share a 16th + pitch cell with another note. One pass, no convert bake. */
export function countSharedSheetCells(song: Song): number {
  const cells = new Map<string, number>()
  for (const track of song.tracks) {
    if (track.muted) continue
    for (const note of track.notes) {
      const line = note.pitchLine ?? midiToLine(note.pitch)
      const key = `${noteStartColumn(note)}:${line}`
      cells.set(key, (cells.get(key) ?? 0) + 1)
    }
  }
  let extra = 0
  for (const n of cells.values()) {
    if (n > 1) extra += n - 1
  }
  return extra
}

/** Notes that lose a tile because another instrument already occupies it. */
export function countGtTileOverlaps(song: Song, modelId?: ConvertModelId): number {
  let extra = 0
  for (const track of song.tracks) {
    if (track.muted) continue
    for (const note of track.notes) {
      if (!isGtSheetNote(song, track.id, note, modelId)) extra++
    }
  }
  return extra
}

export type SheetMaterial = {
  numType: number
  count: number
}

export type SheetMaterialList = {
  items: SheetMaterial[]
  total: number
  columns: number
}

export function noteMaterialType(track: { gtNumType?: number }, note: Note): number {
  if (isAudioRackNote(note)) return GT_AUDIO_RACK
  return note.gtNumType ?? track.gtNumType ?? 0
}

/** Unique Growtopia tiles on the sheet, grouped by block type (one cell = one item). */
export function listSheetMaterials(song: Song, modelId?: ConvertModelId): SheetMaterialList {
  const byCell = new Map<string, number>()
  let maxCol = -1
  for (const track of song.tracks) {
    for (const note of track.notes) {
      const line = note.pitchLine ?? midiToLine(note.pitch)
      const col = noteStartColumn(note)
      if (col < 0) continue
      if (!isGtSheetNote(song, track.id, note, modelId)) continue
      const key = `${col}:${line}`
      if (byCell.has(key)) continue
      byCell.set(key, noteMaterialType(track, note))
      if (col > maxCol) maxCol = col
    }
  }
  const counts = new Map<number, number>()
  for (const numType of byCell.values()) {
    counts.set(numType, (counts.get(numType) ?? 0) + 1)
  }
  const items = [...counts.entries()]
    .map(([numType, count]) => ({ numType, count }))
    .sort((a, b) => b.count - a.count || a.numType - b.numType)
  return {
    items,
    total: byCell.size,
    columns: maxCol < 0 ? 0 : maxCol + 1,
  }
}
