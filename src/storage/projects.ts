import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ProjectData, Song, WorldSettings } from '../music/types'
import { createEmptySong } from '../music/SongModel'
import { getDefaultWorldSettings } from '../world/worldLayout'
import { v4 as uuidv4 } from 'uuid'
import { parseSong, parseWorldSettings, assertFileSize, MAX_IMPORT_BYTES } from './projectSchema'
import { decodeNotetopiaFile, isNotetopiaFilename, looksLikeNotetopia } from './notetopiaFile'

interface MusicWorldDB extends DBSchema {
  projects: {
    key: string
    value: ProjectData
    indexes: { 'by-updated': number }
  }
}

let dbPromise: Promise<IDBPDatabase<MusicWorldDB>> | null = null

function getDB(): Promise<IDBPDatabase<MusicWorldDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MusicWorldDB>('music-world', 1, {
      upgrade(db) {
        const store = db.createObjectStore('projects', { keyPath: 'id' })
        store.createIndex('by-updated', 'updatedAt')
      },
    })
  }
  return dbPromise
}

export async function saveProject(
  id: string,
  name: string,
  song: Song,
  worldSettings: WorldSettings,
): Promise<ProjectData> {
  const db = await getDB()
  const now = Date.now()
  const existing = await db.get('projects', id)
  const project: ProjectData = {
    id,
    name,
    song,
    worldSettings,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  await db.put('projects', project)
  return project
}

export async function loadProject(id: string): Promise<ProjectData | undefined> {
  const db = await getDB()
  return db.get('projects', id)
}

export async function listProjects(): Promise<ProjectData[]> {
  const db = await getDB()
  return db.getAllFromIndex('projects', 'by-updated')
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('projects', id)
}

export async function createNewProject(name?: string): Promise<ProjectData> {
  const id = uuidv4()
  const song = createEmptySong(name ?? 'Untitled')
  return saveProject(id, song.name, song, getDefaultWorldSettings())
}

export function importProjectFromJson(json: string): ProjectData {
  if (json.length > 8_000_000) throw new Error('Project file is too large')
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Invalid project')
  const data = parsed as { song?: unknown; worldSettings?: unknown }
  const song = parseSong(data.song)
  const id = uuidv4()
  return {
    id,
    name: song.name,
    song,
    worldSettings: parseWorldSettings(data.worldSettings),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export async function importProjectFile(file: File): Promise<ProjectData> {
  assertFileSize(file, MAX_IMPORT_BYTES)
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (looksLikeNotetopia(bytes) || isNotetopiaFilename(file.name)) {
    return decodeNotetopiaFile(bytes)
  }
  return importProjectFromJson(new TextDecoder().decode(bytes))
}
