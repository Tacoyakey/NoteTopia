import type { Song, Note, WorldSettings } from '../music/types'
import { GT_BLOCK_SIZE, GT_COLUMNS_PER_BEAT, GT_PITCH_LANES, midiToLine, lineToLabel } from '../music/gtPitch'
import { getGtCellOccupant, noteStartColumn } from '../music/gtSheet'
import { DEFAULT_CONVERT_MODEL_ID } from '../music/convert'

export const BASE_PIXELS_PER_BEAT = 80
export const WORLD_GROUND_Y = 480
export const PITCH_PIXEL_HEIGHT = 6
export const WORLD_DIRT_ROWS = 2
export const WORLD_BEDROCK_ROWS = 0
export const WORLD_SKY_MIN = 80
/** Status bar drawn over the bottom of the world canvas (screen pixels). */
export const WORLD_STATUS_BAR = 32
/** Seek caret sits this many screen pixels above the music wall so it misses the top row. */
export const WORLD_PLAYHEAD_RAIL = 32
/** Key-label strip, in world units (multiplied by zoom when drawn). */
export const WORLD_LABEL_WIDTH = 48
/** Empty columns between the labels and the first music block. */
export const WORLD_START_PAD_COLUMNS = 4
/** Growtopia default world width — major marker every N music columns. */
export const GT_WORLD_WIDTH = 100
export const GT_WORLD_MINOR = 10

export function musicOriginX(density: number): number {
  return WORLD_LABEL_WIDTH + WORLD_START_PAD_COLUMNS * GT_BLOCK_SIZE * density
}

export function densityFromSlider(_sliderValue?: number): number {
  return 1
}

const KEEP_EMPTY_COLUMNS = 4
const identityCompress = {
  toVisual: (col: number) => col,
  toMusic: (col: number) => col,
}

type CompressMap = {
  toVisual: (musicCol: number) => number
  toMusic: (visualCol: number) => number
}

const compressCache = new WeakMap<Song, CompressMap>()

function soundingColumns(song: Song): { set: Set<number>; max: number } {
  const set = new Set<number>()
  let max = 0
  for (const track of song.tracks) {
    for (const note of track.notes) {
      const col = Math.round(note.startBeat * GT_COLUMNS_PER_BEAT)
      if (col < 0) continue
      set.add(col)
      if (col > max) max = col
    }
  }
  return { set, max }
}

/** Collapse long empty stretches so the world view stays tight. */
export function getCompressMap(song: Song, enabled: boolean): CompressMap {
  if (!enabled) return identityCompress
  const cached = compressCache.get(song)
  if (cached) return cached

  const { set: sounding, max } = soundingColumns(song)
  const musicToVisual: number[] = []
  const visualToMusic: number[] = []
  let visual = 0
  let emptyRun = 0
  for (let m = 0; m <= max; m++) {
    if (sounding.has(m)) {
      emptyRun = 0
      musicToVisual[m] = visual
      visualToMusic[visual] = m
      visual++
    } else {
      emptyRun++
      if (emptyRun <= KEEP_EMPTY_COLUMNS) {
        musicToVisual[m] = visual
        visualToMusic[visual] = m
        visual++
      } else {
        musicToVisual[m] = visual - 1
      }
    }
  }
  const lastVisual = Math.max(0, visual - 1)
  const lastMusic = max
  const map: CompressMap = {
    toVisual: (col) => {
      if (col <= 0) return 0
      if (col <= lastMusic) return musicToVisual[col] ?? lastVisual
      return lastVisual + (col - lastMusic)
    },
    toMusic: (col) => {
      if (col <= 0) return 0
      if (col < visualToMusic.length) return visualToMusic[col] ?? lastMusic
      return lastMusic + (col - lastVisual)
    },
  }
  compressCache.set(song, map)
  return map
}

/** GT-style: 4 columns per beat, 32px per column */
export function beatToWorldX(
  startBeat: number,
  density: number,
  autoCompress: boolean,
  song: Song,
): number {
  const column = getCompressMap(song, autoCompress).toVisual(startBeat * GT_COLUMNS_PER_BEAT)
  return musicOriginX(density) + column * GT_BLOCK_SIZE * density
}

/** Continuous pitch → Y (legacy) */
export function pitchToWorldY(pitch: number, canvasHeight: number): number {
  const normalized = (pitch - 36) / 60
  const range = canvasHeight * 0.5
  return WORLD_GROUND_Y - normalized * range - 40
}

/** Top of the 14-lane music wall. Vertically centered, with room above for the playhead caret. */
export function getWorldMusicTop(viewHeight: number, zoom = 1): number {
  const musicH = GT_PITCH_LANES * GT_BLOCK_SIZE
  const z = Math.max(zoom, 0.001)
  const usable = viewHeight - WORLD_STATUS_BAR / z
  const head = WORLD_PLAYHEAD_RAIL / z
  return Math.max(head, (usable - musicH) / 2)
}

/** True when the pointer is on the seek caret above the music wall, not on the top tile row. */
export function hitWorldPlayhead(
  screenX: number,
  screenY: number,
  playheadScreenX: number,
  musicTopScreen: number,
): boolean {
  const y0 = musicTopScreen - WORLD_PLAYHEAD_RAIL
  return Math.abs(screenX - playheadScreenX) <= 16 && screenY >= y0 && screenY < musicTopScreen
}

/** Top of the dirt rows under the music wall. */
export function getWorldDirtTop(viewHeight: number, zoom = 1): number {
  return getWorldMusicTop(viewHeight, zoom) + GT_PITCH_LANES * GT_BLOCK_SIZE
}

/** GT 14-lane grid: line 1 at top, line 14 near ground. Returns TOP of the tile. */
export function pitchLineToWorldY(pitchLine: number, canvasHeight: number, zoom = 1): number {
  const lane = Math.max(1, Math.min(GT_PITCH_LANES, pitchLine))
  return getWorldMusicTop(canvasHeight, zoom) + (lane - 1) * GT_BLOCK_SIZE
}

export function noteToPitchLine(note: Note): number {
  return note.pitchLine ?? midiToLine(note.pitch)
}

export function getNoteWorldY(note: Note, canvasHeight: number, gtGrid: boolean, zoom = 1): number {
  if (gtGrid) return pitchLineToWorldY(noteToPitchLine(note), canvasHeight, zoom)
  return pitchToWorldY(note.pitch, canvasHeight)
}

export function getNoteWorldBounds(
  note: Note,
  density: number,
  autoCompress: boolean,
  song: Song,
  canvasHeight: number,
  gtGrid: boolean,
  zoom = 1,
): { x: number; y: number; width: number; height: number } {
  const x = beatToWorldX(note.startBeat, density, autoCompress, song)
  const y = getNoteWorldY(note, canvasHeight, gtGrid, zoom)
  const block = gtGrid ? GT_BLOCK_SIZE : 24
  return {
    x,
    y,
    width: gtGrid ? block : Math.max(12, block * 0.5),
    height: block,
  }
}

export function getVisibleBeatRange(
  cameraX: number,
  viewportWidth: number,
  density: number,
  song?: Song,
  autoCompress = false,
): { start: number; end: number } {
  const origin = musicOriginX(density)
  const colW = GT_BLOCK_SIZE * density
  const startCol = (cameraX - origin) / colW
  const endCol = (cameraX + viewportWidth - origin) / colW
  const map = song ? getCompressMap(song, autoCompress) : identityCompress
  return {
    start: map.toMusic(startCol) / GT_COLUMNS_PER_BEAT - 2,
    end: map.toMusic(endCol) / GT_COLUMNS_PER_BEAT + 2,
  }
}

export function getDefaultWorldSettings(): WorldSettings {
  return {
    density: 100,
    autoCompress: false,
    followPlayhead: true,
    zoom: 1,
    gtGrid: true,
    useSamples: true,
    theme: 'sunny',
    solidColor: '#1c1c28',
    convertModel: DEFAULT_CONVERT_MODEL_ID,
    songLengthColumns: 100,
    composerFollowPlayhead: true,
    metronome: false,
  }
}

export interface GtCell {
  beat: number
  column: number
  pitchLine: number
}

export function screenXToBeat(
  screenX: number,
  cameraX: number,
  zoom: number,
  densitySlider: number,
  song?: Song,
  autoCompress = false,
): number {
  const density = densityFromSlider(densitySlider)
  const worldX = cameraX + screenX / zoom
  const origin = musicOriginX(density)
  const colW = GT_BLOCK_SIZE * density
  const visualCol = (worldX - origin) / colW
  const musicCol = song ? getCompressMap(song, autoCompress).toMusic(visualCol) : visualCol
  return Math.max(0, musicCol / GT_COLUMNS_PER_BEAT)
}

export function screenToGtCell(
  screenX: number,
  screenY: number,
  cameraX: number,
  zoom: number,
  viewHeight: number,
  densitySlider: number,
  song?: Song,
  autoCompress = false,
): GtCell | null {
  const density = densityFromSlider(densitySlider)
  const colW = GT_BLOCK_SIZE * density
  const musicTop = getWorldMusicTop(viewHeight, zoom)
  const worldX = cameraX + screenX / zoom
  const worldY = screenY / zoom
  const origin = musicOriginX(density)
  const visualCol = Math.floor((worldX - origin) / colW)
  if (visualCol < 0) return null
  const column = song ? Math.round(getCompressMap(song, autoCompress).toMusic(visualCol)) : visualCol
  if (column < 0) return null
  const lane = Math.floor((worldY - musicTop) / GT_BLOCK_SIZE) + 1
  if (lane < 1 || lane > GT_PITCH_LANES) return null
  return {
    column,
    beat: column / GT_COLUMNS_PER_BEAT,
    pitchLine: lane,
  }
}

export function findNoteAtCell(
  song: Song,
  beat: number,
  pitchLine: number,
  trackId?: string,
): { trackId: string; noteId: string } | null {
  if (trackId) {
    const snapped = Math.round(beat * GT_COLUMNS_PER_BEAT) / GT_COLUMNS_PER_BEAT
    const track = song.tracks.find((t) => t.id === trackId)
    if (!track || track.muted) return null
    for (const note of track.notes) {
      const line = note.pitchLine ?? midiToLine(note.pitch)
      if (line !== pitchLine) continue
      if (noteStartColumn(note) === Math.round(snapped * GT_COLUMNS_PER_BEAT)) {
        return { trackId: track.id, noteId: note.id }
      }
    }
    return null
  }
  return getGtCellOccupant(song, beat, pitchLine)
}

/** How many sheets already occupy this 16th-note column (any pitch / track). */
export function countNotesInColumn(song: Song, column: number): number {
  let count = 0
  for (const track of song.tracks) {
    if (track.muted) continue
    for (const note of track.notes) {
      const startCol = noteStartColumn(note)
      if (column === startCol) count++
    }
  }
  return count
}

export { GT_BLOCK_SIZE, GT_PITCH_LANES, lineToLabel }
export { getGtCellOccupant } from '../music/gtSheet'
