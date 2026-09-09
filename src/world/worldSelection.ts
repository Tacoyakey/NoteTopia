import { GT_COLUMNS_PER_BEAT, GT_PITCH_LANES, lineToMidi } from '../music/gtPitch'
import { getGtCellOccupant, isGtSheetNote } from '../music/gtSheet'
import type { Note, Song } from '../music/types'
import {
  beatToWorldX,
  densityFromSlider,
  getNoteWorldY,
  GT_BLOCK_SIZE,
  noteToPitchLine,
} from './worldLayout'

export type WorldNoteOrig = {
  trackId: string
  noteId: string
  startBeat: number
  pitchLine: number
}

export type WorldNotePatch = {
  trackId: string
  noteId: string
  startBeat: number
  pitch: number
  pitchLine: number
}

export function collectSelectedWorldNotes(song: Song, ids: Set<string>): WorldNoteOrig[] {
  const out: WorldNoteOrig[] = []
  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (!ids.has(note.id)) continue
      out.push({
        trackId: track.id,
        noteId: note.id,
        startBeat: note.startBeat,
        pitchLine: noteToPitchLine(note),
      })
    }
  }
  return out
}

export function relocateWorldNotes(
  song: Song,
  origs: WorldNoteOrig[],
  dCol: number,
  dLine: number,
  convertModel?: string,
): WorldNotePatch[] | null {
  if (origs.length === 0) return []
  if (dCol === 0 && dLine === 0) return []
  const moving = new Set(origs.map((item) => item.noteId))
  const patches: WorldNotePatch[] = []
  for (const orig of origs) {
    const col = Math.round(orig.startBeat * GT_COLUMNS_PER_BEAT) + dCol
    const line = orig.pitchLine + dLine
    if (col < 0 || line < 1 || line > GT_PITCH_LANES) return null
    const beat = col / GT_COLUMNS_PER_BEAT
    const occ = getGtCellOccupant(song, beat, line, convertModel)
    if (occ && !moving.has(occ.noteId)) return null
    patches.push({
      trackId: orig.trackId,
      noteId: orig.noteId,
      startBeat: beat,
      pitch: lineToMidi(line),
      pitchLine: line,
    })
  }
  return patches
}

export function noteScreenRect(
  note: Note,
  cameraX: number,
  zoom: number,
  viewHeight: number,
  densitySlider: number,
  song: Song,
  autoCompress = false,
): { x: number; y: number; w: number; h: number } {
  const density = densityFromSlider(densitySlider)
  const wx = beatToWorldX(note.startBeat, density, autoCompress, song)
  const wy = getNoteWorldY(note, viewHeight, true, zoom)
  return {
    x: (wx - cameraX) * zoom,
    y: wy * zoom,
    w: GT_BLOCK_SIZE * density * zoom,
    h: GT_BLOCK_SIZE * zoom,
  }
}

export function notesIntersectingScreenRect(
  song: Song,
  rect: { x: number; y: number; w: number; h: number },
  cameraX: number,
  zoom: number,
  viewHeight: number,
  densitySlider: number,
  autoCompress = false,
  convertModel?: string,
): string[] {
  if (rect.w < 2 && rect.h < 2) return []
  const x2 = rect.x + rect.w
  const y2 = rect.y + rect.h
  const ids: string[] = []
  for (const track of song.tracks) {
    if (track.muted) continue
    for (const note of track.notes) {
      if (!isGtSheetNote(song, track.id, note, convertModel)) continue
      const box = noteScreenRect(
        note,
        cameraX,
        zoom,
        viewHeight,
        densitySlider,
        song,
        autoCompress,
      )
      if (box.x < x2 && box.x + box.w > rect.x && box.y < y2 && box.y + box.h > rect.y) {
        ids.push(note.id)
      }
    }
  }
  return ids
}
