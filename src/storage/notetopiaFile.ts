import { APP_NAME } from '../branding'
import type { ProjectData, Song, WorldSettings } from '../music/types'
import { v4 as uuidv4 } from 'uuid'
import { parseSong, parseWorldSettings, MAX_PROJECT_JSON_BYTES } from './projectSchema'

export const NOTETOPIA_EXTENSION = '.notetopia'
export const NOTETOPIA_MIME = 'application/x-notetopia'
export const NOTETOPIA_FORMAT = 'notetopia'
export const NOTETOPIA_FORMAT_VERSION = 1

const MAGIC = new Uint8Array([0x4e, 0x54, 0x4f, 0x50]) // NTOP
const HEADER_BYTES = 8

function textEncoder(): TextEncoder {
  return new TextEncoder()
}

function textDecoder(): TextDecoder {
  return new TextDecoder()
}

export function safeDownloadName(name: string): string {
  const trimmed = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim()
  return trimmed || 'Untitled'
}

export function downloadBlob(data: Blob, filename: string): void {
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function looksLikeNotetopia(bytes: Uint8Array): boolean {
  if (bytes.length < HEADER_BYTES) return false
  return MAGIC.every((byte, i) => bytes[i] === byte)
}

export function encodeNotetopiaFile(project: {
  id?: string
  name: string
  song: Song
  worldSettings: WorldSettings
  createdAt?: number
  updatedAt?: number
}): Uint8Array {
  const now = Date.now()
  const payload = JSON.stringify({
    format: NOTETOPIA_FORMAT,
    formatVersion: NOTETOPIA_FORMAT_VERSION,
    app: APP_NAME,
    id: project.id,
    name: project.name,
    song: project.song,
    worldSettings: project.worldSettings,
    createdAt: project.createdAt ?? now,
    updatedAt: project.updatedAt ?? now,
  })
  const body = textEncoder().encode(payload)
  const out = new Uint8Array(HEADER_BYTES + body.length)
  out.set(MAGIC, 0)
  out[4] = NOTETOPIA_FORMAT_VERSION
  out.set(body, HEADER_BYTES)
  return out
}

export function decodeNotetopiaFile(bytes: Uint8Array): ProjectData {
  if (!looksLikeNotetopia(bytes)) throw new Error('Not a NoteTopia file')
  const version = bytes[4]
  if (version > NOTETOPIA_FORMAT_VERSION) {
    throw new Error('This NoteTopia file needs a newer app')
  }
  const json = textDecoder().decode(bytes.subarray(HEADER_BYTES))
  if (json.length > MAX_PROJECT_JSON_BYTES) throw new Error('Project file is too large')
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid NoteTopia file')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid NoteTopia file')
  }
  const data = parsed as {
    format?: unknown
    song?: unknown
    worldSettings?: unknown
    id?: unknown
    name?: unknown
    createdAt?: unknown
    updatedAt?: unknown
  }
  if (data.format != null && data.format !== NOTETOPIA_FORMAT) {
    throw new Error('Invalid NoteTopia file')
  }
  const song = parseSong(data.song)
  const now = Date.now()
  return {
    id: typeof data.id === 'string' && data.id ? data.id : uuidv4(),
    name: typeof data.name === 'string' && data.name ? data.name : song.name,
    song,
    worldSettings: parseWorldSettings(data.worldSettings),
    createdAt: typeof data.createdAt === 'number' && Number.isFinite(data.createdAt) ? data.createdAt : now,
    updatedAt: typeof data.updatedAt === 'number' && Number.isFinite(data.updatedAt) ? data.updatedAt : now,
  }
}

export function downloadNotetopiaFile(project: {
  id?: string
  name: string
  song: Song
  worldSettings: WorldSettings
}): void {
  const bytes = encodeNotetopiaFile(project)
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const blob = new Blob([copy], { type: NOTETOPIA_MIME })
  downloadBlob(blob, `${safeDownloadName(project.song.name)}${NOTETOPIA_EXTENSION}`)
}

export function isNotetopiaFilename(name: string): boolean {
  return name.toLowerCase().endsWith(NOTETOPIA_EXTENSION)
}
