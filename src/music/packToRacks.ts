import type { Song } from './types'
import { getConvertModel, type ConvertModelId } from './convert'

/** Bake the current sheet with the active convert model (packs overlaps into Audio Racks). */
export function packSongToRacks(song: Song, modelId?: string | null): Song {
  return getConvertModel((modelId ?? undefined) as ConvertModelId | undefined).bake(song).song
}
