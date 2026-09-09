import type { Song, WorldTheme } from '../music/types'
import { lineToLabel } from '../music/gtPitch'
import {
  beatToWorldX,
  densityFromSlider,
  getNoteWorldY,
  getVisibleBeatRange,
  getWorldMusicTop,
  getWorldDirtTop,
  musicOriginX,
  getGtCellOccupant,
  GT_BLOCK_SIZE,
  GT_PITCH_LANES,
  GT_WORLD_WIDTH,
  GT_WORLD_MINOR,
  WORLD_LABEL_WIDTH,
  WORLD_START_PAD_COLUMNS,
  WORLD_STATUS_BAR,
} from './worldLayout'
import { GT_COLUMNS_PER_BEAT } from '../music/gtPitch'
import type { WorldCamera } from './camera'
import { getTile, resolveNoteTileKey, warmTiles } from './tiles'
import type { GtCell } from './worldLayout'
import { isGtSheetNote, noteMaterialType } from '../music/gtSheet'
import { drawWeather } from './weather'

const GT_UI_FONT = 'Inter, system-ui, sans-serif'

function gtFillText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill = '#fff',
): void {
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillText(text, x + 1, y + 1)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
  ctx.restore()
}

const PLAYER_FRAME = 32
const PLAYER_SRC = `${import.meta.env.BASE_URL}world/robot.webp`

let playerSheet: HTMLCanvasElement | null = null
let playerProbed = false

function probePlayer(): void {
  if (playerProbed) return
  playerProbed = true
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ictx = c.getContext('2d')
    if (!ictx) return
    ictx.drawImage(img, 0, 0)
    const pix = ictx.getImageData(0, 0, c.width, c.height)
    const d = pix.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 18 && d[i + 1] < 18 && d[i + 2] < 18) d[i + 3] = 0
    }
    ictx.putImageData(pix, 0, 0)
    playerSheet = c
  }
  img.src = PLAYER_SRC
}

warmTiles()
probePlayer()
void document.fonts.load('500 16px Inter')
void document.fonts.load('600 16px Inter')

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  zoom: number,
  walking: boolean,
  beat: number,
): void {
  const size = PLAYER_FRAME * zoom
  const destX = x - size * 0.5
  const destY = groundY - size
  const frame = walking ? 1 + (Math.floor(beat * 4) % 2) : 0
  ctx.save()
  ctx.imageSmoothingEnabled = false
  if (playerSheet) {
    ctx.drawImage(
      playerSheet,
      frame * PLAYER_FRAME,
      0,
      PLAYER_FRAME,
      PLAYER_FRAME,
      destX,
      destY,
      size,
      size,
    )
  }
  ctx.restore()
}

function drawPlayhead(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number): void {
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y0)
  ctx.lineTo(x, y1)
  ctx.stroke()
  ctx.restore()
}

export interface WorldRenderOptions {
  song: Song
  camera: WorldCamera
  currentBeat: number
  densitySlider: number
  autoCompress: boolean
  isPlaying: boolean
  gtGrid: boolean
  theme: WorldTheme
  solidColor?: string
  hoverCell?: GtCell | null
  convertModel?: string
  selectedNoteIds?: Set<string>
  worldTool?: 'select' | 'draw' | 'slice' | 'build'
  statusHint?: string
  credit?: string
  /** When set, other sheet-music types draw faded. */
  focusMaterial?: number | null
  marquee?: { x: number; y: number; w: number; h: number } | null
  hideStatusBar?: boolean
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: WorldRenderOptions,
): void {
  const { song, camera, currentBeat, densitySlider, autoCompress, isPlaying, gtGrid, theme, solidColor, hoverCell, convertModel, selectedNoteIds, worldTool, statusHint, credit, focusMaterial, marquee, hideStatusBar } = options
  const density = densityFromSlider(densitySlider)
  const zoom = camera.zoom
  const viewH = height / zoom
  const musicTop = getWorldMusicTop(viewH, zoom)
  const dirtTop = getWorldDirtTop(viewH, zoom)
  const colW = GT_BLOCK_SIZE * density
  const tileW = colW * zoom
  const tileH = GT_BLOCK_SIZE * zoom

  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, width, height)

  const weather = drawWeather(ctx, width, height, camera.x, zoom, theme, { solidColor })
  const dark = weather.dark

  const origin = musicOriginX(density)
  const labelW = WORLD_LABEL_WIDTH * zoom

  const top = musicTop * zoom
  const gridH = GT_PITCH_LANES * tileH
  const groundBottom = dirtTop * zoom

  if (gtGrid) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(labelW, top, Math.max(0, width - labelW), gridH)
    ctx.clip()
    ctx.strokeStyle = dark ? 'rgba(180, 210, 255, 0.16)' : 'rgba(30, 50, 90, 0.22)'
    ctx.lineWidth = 1
    for (let lane = 0; lane <= GT_PITCH_LANES; lane++) {
      const y = top + lane * tileH
      ctx.beginPath()
      ctx.moveTo(labelW, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
    const firstMusicCol = Math.floor((camera.x - origin) / colW) - 1
    const lastMusicCol = Math.ceil((camera.x + width / zoom - origin) / colW) + 1
    for (let col = firstMusicCol; col <= lastMusicCol; col++) {
      if (col < -WORLD_START_PAD_COLUMNS) continue
      const sx = (origin + col * colW - camera.x) * zoom
      ctx.beginPath()
      ctx.moveTo(sx, top)
      ctx.lineTo(sx, top + gridH)
      ctx.stroke()
    }
    ctx.restore()
  }

  const firstMusicCol = Math.floor((camera.x - origin) / colW) - 1
  const lastMusicCol = Math.ceil((camera.x + width / zoom - origin) / colW) + 1

  const minorStart = Math.floor(Math.max(0, firstMusicCol) / GT_WORLD_MINOR) * GT_WORLD_MINOR
  for (let mark = minorStart; mark <= lastMusicCol + GT_WORLD_MINOR; mark += GT_WORLD_MINOR) {
    if (mark % GT_WORLD_WIDTH === 0) continue
    const wx = origin + mark * colW
    const sx = (wx - camera.x) * zoom
    if (sx < labelW - 4 || sx > width + 20) continue
    ctx.strokeStyle = dark ? 'rgba(200, 220, 255, 0.22)' : 'rgba(255, 255, 255, 0.28)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(sx, top)
    ctx.lineTo(sx, groundBottom)
    ctx.stroke()
    ctx.fillStyle = dark ? 'rgba(200, 220, 255, 0.45)' : 'rgba(20, 40, 60, 0.45)'
  ctx.font = `600 ${Math.max(9, 10 * zoom)}px ${GT_UI_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    gtFillText(ctx, String(mark), sx, groundBottom + 2)
  }

  const markStart = Math.floor(Math.max(0, firstMusicCol) / GT_WORLD_WIDTH) * GT_WORLD_WIDTH
  for (let mark = markStart; mark <= lastMusicCol + GT_WORLD_WIDTH; mark += GT_WORLD_WIDTH) {
    const wx = origin + mark * colW
    const sx = (wx - camera.x) * zoom
    if (sx < labelW - 8 || sx > width + 40) continue

    ctx.fillStyle = dark ? 'rgba(255, 210, 80, 0.08)' : 'rgba(40, 60, 90, 0.1)'
    ctx.fillRect(sx, top, tileW * 0.45, gridH)

    ctx.strokeStyle = dark ? 'rgba(255, 220, 120, 0.9)' : 'rgba(255, 240, 160, 0.95)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(sx, Math.max(8, top - 22))
    ctx.lineTo(sx, groundBottom)
    ctx.stroke()

    ctx.fillStyle = dark ? '#ffe566' : '#fff4c0'
  ctx.font = `600 ${Math.max(12, 13 * zoom)}px ${GT_UI_FONT}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    gtFillText(ctx, mark === 0 ? 'START' : `${mark}`, sx + 5, Math.max(18, top - 6), '#fff')
    ctx.textBaseline = 'alphabetic'
  }

  const visible = getVisibleBeatRange(camera.x, width / zoom, density, song, autoCompress)
  const playheadWorldX = beatToWorldX(currentBeat, density, autoCompress, song)
  const playheadScreenX = (playheadWorldX - camera.x) * zoom

  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 230, 90, 0.16)'
  ctx.fillRect(playheadScreenX, top, 3, gridH)
  ctx.restore()

  if (hoverCell && (worldTool === 'build' || worldTool === 'draw')) {
    const hx = (beatToWorldX(hoverCell.beat, density, autoCompress, song) - camera.x) * zoom
    const hy = (musicTop + (hoverCell.pitchLine - 1) * GT_BLOCK_SIZE) * zoom
    const occupied = !!getGtCellOccupant(song, hoverCell.beat, hoverCell.pitchLine, convertModel)
    ctx.fillStyle = occupied ? 'rgba(255, 200, 80, 0.22)' : 'rgba(255, 255, 255, 0.18)'
    ctx.fillRect(hx, hy, tileW, tileH)
    ctx.strokeStyle = occupied ? 'rgba(255, 220, 120, 0.95)' : 'rgba(255, 230, 120, 0.9)'
    ctx.lineWidth = 2
    ctx.strokeRect(hx + 1, hy + 1, tileW - 2, tileH - 2)
  }

  for (const track of song.tracks) {
    if (track.muted) continue
    for (const note of track.notes) {
      if (note.startBeat < visible.start) continue
      if (note.startBeat > visible.end) continue
      if (!isGtSheetNote(song, track.id, note, convertModel)) continue

      const wy = getNoteWorldY(note, viewH, true, zoom)
      const sy = wy * zoom
      const noteCol = Math.round(note.startBeat * GT_COLUMNS_PER_BEAT)
      const playCol = Math.floor(currentBeat * GT_COLUMNS_PER_BEAT)
      const isActive = isPlaying && playCol === noteCol

      const key = resolveNoteTileKey(track, note, isActive)
      const wx = beatToWorldX(note.startBeat, density, autoCompress, song)
      const sx = (wx - camera.x) * zoom
      const soloing = focusMaterial != null
      const focused = !soloing || noteMaterialType(track, note) === focusMaterial
      ctx.globalAlpha = focused ? 1 : 0.18
      ctx.drawImage(getTile(key), sx, sy, tileW, tileH)
      if (selectedNoteIds?.has(note.id)) {
        ctx.strokeStyle = 'rgba(120, 200, 255, 0.95)'
        ctx.lineWidth = Math.max(2, 2 * zoom)
        ctx.strokeRect(sx + 1, sy + 1, tileW - 2, tileH - 2)
      }
      if (isActive) {
        ctx.fillStyle = 'rgba(255, 229, 80, 0.5)'
        ctx.fillRect(sx, sy, tileW, tileH)
        ctx.strokeStyle = 'rgba(255, 236, 120, 0.95)'
        ctx.lineWidth = Math.max(2, 2 * zoom)
        ctx.strokeRect(sx + 1, sy + 1, tileW - 2, tileH - 2)
      }
      ctx.globalAlpha = 1
    }
  }

  if (hoverCell && (worldTool === 'select' || worldTool === 'slice')) {
    const occupied = !!getGtCellOccupant(song, hoverCell.beat, hoverCell.pitchLine, convertModel)
    if (occupied) {
      const hx = (beatToWorldX(hoverCell.beat, density, autoCompress, song) - camera.x) * zoom
      const hy = (musicTop + (hoverCell.pitchLine - 1) * GT_BLOCK_SIZE) * zoom
      ctx.save()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)'
      ctx.fillRect(hx, hy, tileW, tileH)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)'
      ctx.lineWidth = Math.max(2, 2 * zoom)
      ctx.strokeRect(hx + 1, hy + 1, tileW - 2, tileH - 2)
      ctx.restore()
    }
  }

  if (marquee && (marquee.w > 2 || marquee.h > 2)) {
    ctx.save()
    ctx.fillStyle = 'rgba(120, 200, 255, 0.16)'
    ctx.strokeStyle = 'rgba(140, 210, 255, 0.95)'
    ctx.lineWidth = 1.5
    ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h)
    ctx.strokeRect(marquee.x + 0.5, marquee.y + 0.5, marquee.w, marquee.h)
    ctx.restore()
  }

  drawPlayhead(
    ctx,
    playheadScreenX,
    top - 4,
    groundBottom,
  )

  drawPlayer(
    ctx,
    playheadScreenX + tileW * 0.5,
    dirtTop * zoom,
    zoom,
    isPlaying,
    currentBeat,
  )

  weather.overlay?.(ctx, width, height, camera.x, zoom)

  ctx.fillStyle = dark ? 'rgba(8, 12, 28, 0.82)' : 'rgba(20, 24, 40, 0.82)'
  ctx.fillRect(0, top, labelW, gridH)
  ctx.font = `600 ${Math.max(10, 12 * zoom)}px ${GT_UI_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let lane = 1; lane <= GT_PITCH_LANES; lane++) {
    const y = top + (lane - 1) * tileH
    gtFillText(ctx, lineToLabel(lane), labelW * 0.5, y + tileH * 0.5)
  }
  ctx.textBaseline = 'alphabetic'

  if (!hideStatusBar) {
    ctx.fillStyle = '#121212'
    ctx.fillRect(0, height - WORLD_STATUS_BAR, width, WORLD_STATUS_BAR)
    ctx.fillStyle = '#2a2a2a'
    ctx.fillRect(0, height - WORLD_STATUS_BAR, width, 1)
    ctx.font = `500 12px ${GT_UI_FONT}`
    ctx.textAlign = 'left'
    gtFillText(ctx, credit ? `${credit}` : song.name, 12, height - 12)
    ctx.textAlign = 'right'
    gtFillText(ctx, statusHint ?? `${song.bpm} BPM`, width - 12, height - 12)
  }
}

export function getPlayheadWorldX(
  currentBeat: number,
  densitySlider: number,
  autoCompress: boolean,
  song: Song,
): number {
  return beatToWorldX(currentBeat, densityFromSlider(densitySlider), autoCompress, song)
}
