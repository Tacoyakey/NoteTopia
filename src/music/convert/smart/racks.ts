import {
  AUDIO_RACK_MAX_NOTES,
  AUDIO_RACK_TRACK_NAME,
  AUDIO_RACK_VOLUME_MAX,
  clampRackVolume,
  createAudioRackNote,
  encodeRackNotes,
  ensureAudioRackTrack,
  isAudioRackNote,
  noteToRackToken,
} from '../../audioRack'
import { GT_COLUMNS_PER_BEAT, midiToLine } from '../../gtPitch'
import { isRepeatNote, noteLine } from '../../sheetRepeats'
import type { Note, Song, Track } from '../../types'
import type { DetectedRole } from './roles'
import { roleWeight } from './roles'
import type { SameInstrumentChords } from './options'

export interface RackPackResult {
  packed: number
  overflow: number
}

function tokenPriority(role: DetectedRole): number {
  if (role === 'lead') return 0
  if (role === 'bass') return 1
  if (role === 'drums') return 2
  if (role === 'harmony') return 3
  return 4
}

export function mixedRackVolume(
  maxVelocity: number,
  voiceCount: number,
  mix: boolean,
  duck: boolean,
): number {
  const fromVel = mix
    ? Math.round((Math.max(1, maxVelocity) / 127) * AUDIO_RACK_VOLUME_MAX)
    : AUDIO_RACK_VOLUME_MAX
  if (!duck) return clampRackVolume(fromVel)
  const busy =
    voiceCount <= 1 ? 1 : voiceCount === 2 ? 0.9 : voiceCount === 3 ? 0.75 : voiceCount === 4 ? 0.65 : 0.55
  return clampRackVolume(Math.round(fromVel * busy))
}

function noteScore(
  track: Track,
  trackIndex: number,
  note: Note,
  roles: Map<string, DetectedRole>,
): number {
  const role = roles.get(track.id) ?? 'harmony'
  const line = note.pitchLine ?? midiToLine(note.pitch)
  const midi = note.pitch
  const inLowHalf = midi <= 59
  const register =
    (role === 'bass' && inLowHalf) || (role === 'lead' && !inLowHalf) ? 8 : 0
  return roleWeight(role, trackIndex) + note.velocity / 6 + register + (15 - line) * 0.05
}

export function packSmartRacks(
  song: Song,
  roles: Map<string, DetectedRole>,
  opts: {
    maxVoices: number
    mixVolume: boolean
    duck: boolean
    sameInstrumentChords: SameInstrumentChords
  },
): RackPackResult {
  type Hit = { track: Track; trackIndex: number; note: Note; token: string; score: number; role: DetectedRole }
  const byCell = new Map<string, Hit[]>()
  song.tracks.forEach((track, trackIndex) => {
    if (track.muted) return
    const role = roles.get(track.id) ?? 'harmony'
    for (const note of track.notes) {
      if (isRepeatNote(note) || isAudioRackNote(note)) continue
      const token = noteToRackToken(track, note)
      if (!token) continue
      const key = `${Math.round(note.startBeat * GT_COLUMNS_PER_BEAT)}:${noteLine(note)}`
      const list = byCell.get(key) ?? []
      list.push({
        track,
        trackIndex,
        note,
        token,
        score: noteScore(track, trackIndex, note, roles),
        role,
      })
      byCell.set(key, list)
    }
  })

  const packedIds = new Set<string>()
  let packed = 0
  let overflow = 0
  const maxVoices = Math.max(2, Math.min(AUDIO_RACK_MAX_NOTES, opts.maxVoices))

  for (const hits of byCell.values()) {
    if (hits.length < 2) continue
    const instruments = new Set(hits.map((hit) => hit.track.instrument))
    if (opts.sameInstrumentChords === 'sheet' && instruments.size === 1) continue

    hits.sort(
      (a, b) =>
        tokenPriority(a.role) - tokenPriority(b.role) ||
        b.score - a.score ||
        a.note.id.localeCompare(b.note.id),
    )
    const seen = new Set<string>()
    const unique: Hit[] = []
    for (const hit of hits) {
      if (seen.has(hit.token)) continue
      seen.add(hit.token)
      unique.push(hit)
    }
    if (unique.length < 2) continue
    if (unique.length > maxVoices) overflow += unique.length - maxVoices
    const chosen = unique.slice(0, maxVoices)
    const first = chosen[0]
    const maxVel = Math.max(...chosen.map((hit) => hit.note.velocity))
    const host = ensureAudioRackTrack(song)
    host.notes.push(
      createAudioRackNote(first.note.startBeat, noteLine(first.note), {
        volume: mixedRackVolume(maxVel, chosen.length, opts.mixVolume, opts.duck),
        notes: encodeRackNotes(chosen.map((hit) => hit.token)),
      }),
    )
    for (const hit of chosen) packedIds.add(hit.note.id)
    packed++
  }

  if (packedIds.size === 0) return { packed, overflow }
  for (const track of song.tracks) {
    if (track.name === AUDIO_RACK_TRACK_NAME) continue
    track.notes = track.notes.filter((note) => !packedIds.has(note.id))
  }
  return { packed, overflow }
}
