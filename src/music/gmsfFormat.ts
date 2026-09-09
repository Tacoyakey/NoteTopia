/** GMSF v1 used by kixnoway.com (KixDev GrowtopiaMusicSimulatorFinal-Web). */

export const GMSF_MAGIC = 'GMSF'
export const GMSF_META = 'META'
export const GMSF_FOOTER = 'FSMG'
export const GMSF_VERSION = 1
export const GMSF_AUDIO_GEAR_ID = 15
export const GMSF_HEIGHT = 14
export const GMSF_GEAR_SLOTS = 5
export const GMSF_MAX_COLUMNS = 16_384
export const GMSF_MAX_BPM = 32_766
export const GMSF_MAX_META_BYTES = 255

export type GmsfGearCell = {
  id: typeof GMSF_AUDIO_GEAR_ID
  slots: { noteId: number; position: number }[]
  volume: number
}

export type GmsfCell = number | GmsfGearCell

export type GmsfSong = {
  ver: number
  audioGearID: number
  bpm: number
  width: number
  height: number
  grid: GmsfCell[][]
  metadata: string
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

export function looksLikeGmsf(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && ascii(bytes, 0, 4) === GMSF_MAGIC
}

export function clampGmsfBpm(bpm: number): number {
  const rounded = Math.round(Number.isFinite(bpm) ? bpm : 120)
  return Math.max(1, Math.min(GMSF_MAX_BPM, rounded))
}

function encodeMetadata(raw: string | undefined): Uint8Array {
  const bytes = new TextEncoder().encode((raw ?? '').slice(0, GMSF_MAX_META_BYTES * 2))
  return bytes.byteLength > GMSF_MAX_META_BYTES ? bytes.subarray(0, GMSF_MAX_META_BYTES) : bytes
}

export function encodeGmsfV1(song: {
  bpm: number
  width: number
  height?: number
  grid: GmsfCell[][]
  metadata?: string
  audioGearID?: number
}): Uint8Array {
  const audioGearID = song.audioGearID ?? GMSF_AUDIO_GEAR_ID
  const height = song.height ?? GMSF_HEIGHT
  const width = Math.max(1, Math.min(GMSF_MAX_COLUMNS, Math.round(song.width)))
  const meta = encodeMetadata(song.metadata)
  let size = 12
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = song.grid[y]?.[x] ?? 0
      size += 1
      if ((typeof cell === 'number' ? cell : cell.id) === audioGearID) {
        size += GMSF_GEAR_SLOTS * 2 + 1
      }
    }
  }
  size += 4 + 1 + meta.length + 4

  const bytes = new Uint8Array(size)
  const view = new DataView(bytes.buffer)
  let p = 0
  bytes[p++] = 0x47
  bytes[p++] = 0x4d
  bytes[p++] = 0x53
  bytes[p++] = 0x46
  view.setUint8(p++, GMSF_VERSION)
  view.setUint8(p++, audioGearID)
  view.setUint16(p, clampGmsfBpm(song.bpm), true)
  p += 2
  view.setUint16(p, width, true)
  p += 2
  view.setUint16(p, height, true)
  p += 2

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = song.grid[y]?.[x] ?? 0
      const id = typeof cell === 'number' ? cell : cell.id
      view.setUint8(p++, id)
      if (id !== audioGearID) continue
      const slots = typeof cell === 'number' ? [] : cell.slots
      for (let k = 0; k < GMSF_GEAR_SLOTS; k++) {
        const slot = slots[k]
        view.setUint8(p++, slot?.noteId ?? 0)
        view.setUint8(p++, slot?.position ?? 0)
      }
      view.setUint8(p++, typeof cell === 'number' ? 100 : cell.volume)
    }
  }

  bytes[p++] = 0x4d
  bytes[p++] = 0x45
  bytes[p++] = 0x54
  bytes[p++] = 0x41
  view.setUint8(p++, meta.length)
  bytes.set(meta, p)
  p += meta.length
  bytes[p++] = 0x46
  bytes[p++] = 0x53
  bytes[p++] = 0x4d
  bytes[p++] = 0x47
  return bytes
}

export function decodeGmsfV1(buffer: ArrayBuffer): GmsfSong {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  if (!looksLikeGmsf(bytes)) throw new Error('Invalid .GMSF file')
  let p = 4
  const ver = view.getUint8(p++)
  if (ver !== GMSF_VERSION) throw new Error(`Unsupported GMSF version: ${ver}`)
  const audioGearID = view.getUint8(p++)
  const bpm = view.getUint16(p, true)
  p += 2
  const width = view.getUint16(p, true)
  p += 2
  const height = view.getUint16(p, true)
  p += 2
  if (width < 1 || width > GMSF_MAX_COLUMNS) throw new Error('GMSF row length is too large')
  if (height < 1 || height > 64) throw new Error('GMSF height is invalid')

  const readU8 = (): number => {
    if (p >= bytes.length) throw new Error('Truncated .GMSF file')
    return bytes[p++]
  }

  const grid: GmsfCell[][] = Array.from({ length: height }, () => Array<GmsfCell>(width).fill(0))
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const id = readU8()
      if (id === audioGearID) {
        const slots: { noteId: number; position: number }[] = []
        for (let k = 0; k < GMSF_GEAR_SLOTS; k++) {
          const noteId = readU8()
          const position = readU8()
          if (noteId) slots.push({ noteId, position })
        }
        const volume = readU8()
        grid[y][x] = { id: GMSF_AUDIO_GEAR_ID, slots, volume }
      } else {
        grid[y][x] = id
      }
    }
  }

  let metadata = ''
  if (p + 5 <= bytes.length && ascii(bytes, p, 4) === GMSF_META) {
    p += 4
    const metaLen = readU8()
    if (p + metaLen > bytes.length) throw new Error('Truncated .GMSF file')
    metadata = new TextDecoder().decode(bytes.subarray(p, p + metaLen))
    p += metaLen
    if (p + 4 <= bytes.length && ascii(bytes, p, 4) !== GMSF_FOOTER) {
      throw new Error('Invalid .GMSF file')
    }
  }

  return { ver, audioGearID, bpm, width, height, grid, metadata }
}
