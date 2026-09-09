import type { Note, Track, InstrumentId } from '../music/types'
import type { GtVariant } from '../music/gtPitch'

const TILE = 32
const TILES_BASE = `${import.meta.env.BASE_URL}tiles/`

type Palette = {
  paper: string
  paperHi: string
  paperLo: string
  ink: string
  accent: string
}

const PALETTES: Record<string, Palette> = {
  piano: { paper: '#e6d4a8', paperHi: '#f4e8c8', paperLo: '#c4b07a', ink: '#2a2218', accent: '#7a6230' },
  bass: { paper: '#c4a06a', paperHi: '#d8b888', paperLo: '#9a7848', ink: '#2a1810', accent: '#6a4020' },
  drum: { paper: '#d47848', paperHi: '#e89868', paperLo: '#a85830', ink: '#2a140c', accent: '#7a3018' },
  sax: { paper: '#e0b050', paperHi: '#f0cc78', paperLo: '#b88830', ink: '#2a2008', accent: '#8a6018' },
  spooky: { paper: '#6a48a0', paperHi: '#8a68c0', paperLo: '#4a2878', ink: '#f0e8ff', accent: '#c090ff' },
  festive: { paper: '#d05048', paperHi: '#e87870', paperLo: '#a03030', ink: '#fff4e0', accent: '#3a8a48' },
  flute: { paper: '#88c8b8', paperHi: '#b0e0d4', paperLo: '#5a9888', ink: '#183028', accent: '#2a6858' },
  spanish_guitar: { paper: '#c89858', paperHi: '#e0b878', paperLo: '#987038', ink: '#2a1808', accent: '#704818' },
  violin: { paper: '#b88858', paperHi: '#d0a878', paperLo: '#886038', ink: '#241808', accent: '#a05030' },
  lyre: { paper: '#e0c070', paperHi: '#f0d898', paperLo: '#b89848', ink: '#2a2008', accent: '#8a6820' },
  electric_guitar: { paper: '#6890a8', paperHi: '#90b0c4', paperLo: '#487088', ink: '#101820', accent: '#d0e8f0' },
  mexican_trumpet: { paper: '#e0a048', paperHi: '#f0c070', paperLo: '#b87828', ink: '#2a1808', accent: '#c04028' },
  blank: { paper: '#f0ead8', paperHi: '#faf6ec', paperLo: '#d0c8b0', ink: '#403828', accent: '#a09880' },
  audio_rack: { paper: '#2c2c32', paperHi: '#4a4a52', paperLo: '#1a1a1e', ink: '#e8e8ec', accent: '#6a8cff' },
  repeat_begin: { paper: '#e8dcc0', paperHi: '#f4ecdc', paperLo: '#c8b894', ink: '#2a2218', accent: '#7a6230' },
  repeat_end: { paper: '#e8dcc0', paperHi: '#f4ecdc', paperLo: '#c8b894', ink: '#2a2218', accent: '#7a6230' },
}

const INSTRUMENT_TILE: Record<InstrumentId, string> = {
  piano: 'piano',
  bass: 'bass',
  drums: 'drum',
  sax: 'sax',
  flute: 'flute',
  guitar: 'spanish_guitar',
  'electric-guitar': 'electric_guitar',
  violin: 'violin',
  lyre: 'lyre',
  trumpet: 'mexican_trumpet',
  spooky: 'spooky',
  winterfest: 'festive',
  synth: 'violin',
  bell: 'festive',
}

const NUM_TYPE_TILE: Record<number, string> = {
  0: 'piano',
  1: 'flat_piano',
  2: 'sharp_piano',
  3: 'drum',
  4: 'bass',
  5: 'flat_bass',
  6: 'sharp_bass',
  7: 'spooky',
  8: 'sax',
  9: 'flat_sax',
  10: 'sharp_sax',
  11: 'repeat_begin',
  12: 'repeat_end',
  13: 'blank',
  14: 'festive',
  15: 'flute',
  16: 'flat_flute',
  17: 'sharp_flute',
  18: 'spanish_guitar',
  19: 'flat_spanish_guitar',
  20: 'sharp_spanish_guitar',
  21: 'violin',
  22: 'flat_violin',
  23: 'sharp_violin',
  24: 'lyre',
  25: 'flat_lyre',
  26: 'sharp_lyre',
  27: 'electric_guitar',
  28: 'flat_electric_guitar',
  29: 'sharp_electric_guitar',
  30: 'mexican_trumpet',
  31: 'flat_mexican_trumpet',
  32: 'sharp_mexican_trumpet',
  33: 'audio_rack',
}

const NOTE_GLYPH = [
  '........##..',
  '.......###..',
  '......##.#..',
  '.....##.....',
  '....##......',
  '...##.......',
  '..##........',
  '.##.........',
  '##..###.....',
  '#..#####....',
  '...#####....',
  '....###.....',
]

const DRUM_GLYPH = [
  '..............',
  '....######....',
  '...##....##...',
  '..##......##..',
  '..##########..',
  '..##......##..',
  '...##....##...',
  '....######....',
  '..#........#..',
  '.#..........#.',
]

const generated = new Map<string, HTMLCanvasElement>()
const sprites = new Map<string, HTMLImageElement>()
const listeners = new Set<() => void>()
let probed = false

function notify(): void {
  listeners.forEach((cb) => cb())
}

export function subscribeTiles(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = TILE
  c.height = TILE
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  return c
}

function hash2(x: number, y: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

function fill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

function stampGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: string[],
  ox: number,
  oy: number,
  color: string,
): void {
  ctx.fillStyle = color
  for (let gy = 0; gy < glyph.length; gy++) {
    const row = glyph[gy]
    for (let gx = 0; gx < row.length; gx++) {
      if (row[gx] === '#') ctx.fillRect(ox + gx, oy + gy, 1, 1)
    }
  }
}

function drawBevel(ctx: CanvasRenderingContext2D, pal: Palette): void {
  fill(ctx, 0, 0, TILE, TILE, '#1a140c')
  fill(ctx, 1, 1, TILE - 2, TILE - 2, pal.paper)
  fill(ctx, 1, 1, TILE - 3, 2, pal.paperHi)
  fill(ctx, 1, 1, 2, TILE - 3, pal.paperHi)
  fill(ctx, 2, TILE - 3, TILE - 4, 2, pal.paperLo)
  fill(ctx, TILE - 3, 2, 2, TILE - 4, pal.paperLo)
}

function drawAccidental(ctx: CanvasRenderingContext2D, kind: 'flat' | 'sharp', pal: Palette): void {
  ctx.fillStyle = pal.ink
  ctx.font = '600 10px Inter, system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText(kind === 'sharp' ? '#' : '♭', 29, 3)
}

function generateAudioRack(active: boolean): HTMLCanvasElement {
  const pal = PALETTES.audio_rack
  const c = makeCanvas()
  const ctx = c.getContext('2d')!
  fill(ctx, 0, 0, TILE, TILE, '#121218')
  fill(ctx, 1, 1, TILE - 2, TILE - 2, pal.paper)
  fill(ctx, 1, 1, TILE - 3, 2, pal.paperHi)
  fill(ctx, 1, 1, 2, TILE - 3, pal.paperHi)
  fill(ctx, 2, TILE - 3, TILE - 4, 2, pal.paperLo)
  fill(ctx, TILE - 3, 2, 2, TILE - 4, pal.paperLo)

  const knobs: [number, number, string][] = [
    [7, 8, '#ff6b6b'],
    [16, 8, '#ffe566'],
    [25, 8, '#6cff9e'],
    [7, 16, '#6c9eff'],
    [16, 16, '#c96cff'],
    [25, 16, '#ff9e6c'],
  ]
  for (const [x, y, color] of knobs) {
    fill(ctx, x - 2, y - 2, 5, 5, '#1a1a22')
    fill(ctx, x - 1, y - 1, 3, 3, color)
  }

  const sliders: [number, string][] = [
    [8, '#6c9eff'],
    [14, '#ffe566'],
    [20, '#ff6b6b'],
    [26, '#6cff9e'],
  ]
  for (const [x, color] of sliders) {
    fill(ctx, x, 22, 2, 7, '#1a1a22')
    fill(ctx, x, 24, 2, 4, color)
  }

  if (active) {
    ctx.fillStyle = 'rgba(255, 230, 80, 0.28)'
    ctx.fillRect(1, 1, TILE - 2, TILE - 2)
    ctx.strokeStyle = '#ffe566'
    ctx.lineWidth = 2
    ctx.strokeRect(2, 2, TILE - 4, TILE - 4)
  }
  return c
}

function generateSheet(base: string, variant: GtVariant, active: boolean): HTMLCanvasElement {
  if (base === 'audio_rack') return generateAudioRack(active)
  const pal = PALETTES[base] ?? PALETTES.piano
  const c = makeCanvas()
  const ctx = c.getContext('2d')!
  drawBevel(ctx, pal)

  if (base === 'blank') {
    ctx.strokeStyle = pal.accent
    ctx.lineWidth = 1
    for (let i = 0; i < 5; i++) {
      const y = 8 + i * 4
      ctx.beginPath()
      ctx.moveTo(4, y)
      ctx.lineTo(28, y)
      ctx.stroke()
    }
  } else if (base === 'repeat_begin') {
    fill(ctx, 7, 6, 4, 20, pal.ink)
    fill(ctx, 13, 6, 2, 20, pal.ink)
    fill(ctx, 18, 10, 4, 4, pal.ink)
    fill(ctx, 18, 18, 4, 4, pal.ink)
  } else if (base === 'repeat_end') {
    fill(ctx, 10, 10, 4, 4, pal.ink)
    fill(ctx, 10, 18, 4, 4, pal.ink)
    fill(ctx, 17, 6, 2, 20, pal.ink)
    fill(ctx, 21, 6, 4, 20, pal.ink)
  } else if (base === 'drum') {
    stampGlyph(ctx, DRUM_GLYPH, 9, 9, pal.ink)
  } else {
    stampGlyph(ctx, NOTE_GLYPH, 9, 9, pal.ink)
  }

  if (variant === 'sharp' || variant === 'flat') drawAccidental(ctx, variant, pal)

  if (active) {
    ctx.fillStyle = 'rgba(255, 230, 80, 0.28)'
    ctx.fillRect(1, 1, TILE - 2, TILE - 2)
    ctx.strokeStyle = '#ffe566'
    ctx.lineWidth = 2
    ctx.strokeRect(2, 2, TILE - 4, TILE - 4)
  }
  return c
}

function generateNoiseTile(
  base: string,
  mid: string,
  hi: string,
  lo: string,
  seed: number,
): HTMLCanvasElement {
  const c = makeCanvas()
  const ctx = c.getContext('2d')!
  fill(ctx, 0, 0, TILE, TILE, base)
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash2(x + seed * 17, y + seed * 31) % 10
      if (n === 0) fill(ctx, x, y, 1, 1, hi)
      else if (n === 1) fill(ctx, x, y, 1, 1, lo)
      else if (n === 2) fill(ctx, x, y, 1, 1, mid)
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.strokeRect(0.5, 0.5, TILE - 1, TILE - 1)
  return c
}

function parseTileKey(key: string): { base: string; variant: GtVariant; active: boolean } {
  let rest = key
  const active = rest.endsWith('_on')
  if (active) rest = rest.slice(0, -3)
  let variant: GtVariant = 'natural'
  if (rest.startsWith('flat_')) {
    variant = 'flat'
    rest = rest.slice(5)
  } else if (rest.startsWith('sharp_')) {
    variant = 'sharp'
    rest = rest.slice(6)
  }
  return { base: rest, variant, active }
}

function generate(key: string): HTMLCanvasElement {
  if (key.startsWith('dirt')) {
    const seed = Number(key.split('_')[1] ?? 0)
    return generateNoiseTile('#8a5a32', '#a07040', '#c49860', '#5a3818', seed)
  }
  if (key.startsWith('cave')) {
    const seed = Number(key.split('_')[1] ?? 0)
    return generateNoiseTile('#3a3a44', '#4a4a54', '#5a5a64', '#2a2a32', seed)
  }
  if (key === 'bedrock') {
    return generateNoiseTile('#4a4a52', '#3a3a42', '#6a6a72', '#2a2a30', 9)
  }
  if (key === 'grass') {
    const c = generateNoiseTile('#8a5a32', '#a07040', '#c49860', '#5a3818', 2)
    const ctx = c.getContext('2d')!
    fill(ctx, 0, 0, TILE, 6, '#4a8a30')
    fill(ctx, 0, 0, TILE, 3, '#68a848')
    for (let x = 0; x < TILE; x++) {
      if (hash2(x, 3) % 3 === 0) fill(ctx, x, 5, 1, 2, '#3a6a20')
    }
    return c
  }

  const { base, variant, active } = parseTileKey(key)
  return generateSheet(base, variant, active)
}

function getGenerated(key: string): HTMLCanvasElement {
  let tile = generated.get(key)
  if (!tile) {
    tile = generate(key)
    generated.set(key, tile)
  }
  return tile
}

function loadSprite(name: string): void {
  if (sprites.has(name) || typeof Image === 'undefined') return
  const img = new Image()
  img.onload = () => {
    sprites.set(name, img)
    notify()
  }
  img.onerror = () => {
    /* keep procedural fallback */
  }
  img.src = `${TILES_BASE}${name}.png`
}

export async function probeTiles(): Promise<void> {
  if (probed) return
  probed = true
  const names = [
    'blank',
    'piano',
    'flat_piano',
    'sharp_piano',
    'drum',
    'bass',
    'flat_bass',
    'sharp_bass',
    'spooky',
    'sax',
    'flat_sax',
    'sharp_sax',
    'festive',
    'flute',
    'flat_flute',
    'sharp_flute',
    'spanish_guitar',
    'flat_spanish_guitar',
    'sharp_spanish_guitar',
    'violin',
    'flat_violin',
    'sharp_violin',
    'lyre',
    'flat_lyre',
    'sharp_lyre',
    'electric_guitar',
    'flat_electric_guitar',
    'sharp_electric_guitar',
    'mexican_trumpet',
    'flat_mexican_trumpet',
    'sharp_mexican_trumpet',
    'repeat_begin',
    'repeat_end',
    'audio_rack',
    'dirt',
    'cave',
    'bedrock',
    'sunny',
  ]
  await Promise.all(
    names.map(
      (name) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => {
            sprites.set(name, img)
            resolve()
          }
          img.onerror = () => resolve()
          img.src = `${TILES_BASE}${name}.png`
        }),
    ),
  )
  if (sprites.size > 0) notify()
}

export function getTile(key: string): CanvasImageSource {
  const sprite = sprites.get(key) ?? sprites.get(key.replace(/_on$/, ''))
  if (sprite) return sprite
  return getGenerated(key)
}

export function resolveTrackTileKey(track: Track, active = false): string {
  return resolveNoteTileKey(
    track,
    {
      id: '',
      pitch: 60,
      startBeat: 0,
      durationBeats: 0.25,
      velocity: 1,
      gtNumType: track.gtNumType,
      gtVariant: track.gtVariant,
    },
    active,
  )
}

export function resolveNoteTileKey(track: Track, note: Note, active: boolean): string {
  const numType = note.gtNumType ?? track.gtNumType
  let key: string | undefined
  if (numType != null) key = NUM_TYPE_TILE[numType]

  if (!key) {
    if (note.audioRack) key = 'audio_rack'
    else {
      const variant: GtVariant = note.gtVariant ?? 'natural'
      const base = INSTRUMENT_TILE[track.instrument] ?? 'piano'
      key = variant === 'natural' ? base : `${variant}_${base}`
    }
  }

  return active ? `${key}_on` : key
}

export function hasSunnySprite(): HTMLImageElement | undefined {
  return sprites.get('sunny')
}

/** Warm the procedural cache so the first world frame is instant. */
export function warmTiles(): void {
  ;['piano', 'bass', 'drum', 'sax', 'audio_rack', 'dirt_0', 'cave_0', 'bedrock', 'grass'].forEach((k) => getGenerated(k))
}

export { loadSprite }
