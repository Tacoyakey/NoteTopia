import { GT_COLUMNS_PER_BEAT } from '../../gtPitch'
import type { Song, Track } from '../../types'
import type { SmartTrackOverride } from './options'

export type DetectedRole = 'lead' | 'harmony' | 'bass' | 'drums' | 'pad'

function median(values: number[]): number {
  if (values.length === 0) return 60
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function uniqueness(track: Track): number {
  const cells = new Set<string>()
  const pitches = new Set<number>()
  for (const note of track.notes) {
    cells.add(`${Math.round(note.startBeat * GT_COLUMNS_PER_BEAT)}:${note.pitch}`)
    pitches.add(note.pitch)
  }
  return cells.size + pitches.size * 0.25
}

function topLineUniqueness(track: Track): number {
  const top = new Map<number, number>()
  for (const note of track.notes) {
    const col = Math.round(note.startBeat * GT_COLUMNS_PER_BEAT)
    const prev = top.get(col)
    if (prev == null || note.pitch > prev) top.set(col, note.pitch)
  }
  const pitches = new Set(top.values())
  return top.size + pitches.size * 0.25
}

function meanDuration(track: Track): number {
  if (track.notes.length === 0) return 0
  return track.notes.reduce((sum, note) => sum + note.durationBeats, 0) / track.notes.length
}

function overlapRatio(track: Track): number {
  if (track.notes.length < 2) return 0
  const byCol = new Map<number, number>()
  for (const note of track.notes) {
    const col = Math.round(note.startBeat * GT_COLUMNS_PER_BEAT)
    byCol.set(col, (byCol.get(col) ?? 0) + 1)
  }
  let crowded = 0
  for (const count of byCol.values()) if (count >= 3) crowded++
  return crowded / Math.max(1, byCol.size)
}

function monophonicRatio(track: Track): number {
  if (track.notes.length === 0) return 0
  const byCol = new Map<number, number>()
  for (const note of track.notes) {
    const col = Math.round(note.startBeat * GT_COLUMNS_PER_BEAT)
    byCol.set(col, (byCol.get(col) ?? 0) + 1)
  }
  let single = 0
  for (const count of byCol.values()) if (count === 1) single++
  return single / Math.max(1, byCol.size)
}

function isLeadInstrument(track: Track): boolean {
  return (
    track.instrument === 'flute' ||
    track.instrument === 'sax' ||
    track.instrument === 'violin' ||
    track.instrument === 'trumpet' ||
    track.instrument === 'lyre'
  )
}

export function inferRoleFromInstrument(track: Track): DetectedRole {
  if (track.instrument === 'drums') return 'drums'
  if (track.instrument === 'bass') return 'bass'
  if (isLeadInstrument(track)) return 'lead'
  if (
    track.instrument === 'spooky' ||
    track.instrument === 'synth' ||
    track.instrument === 'bell' ||
    track.instrument === 'winterfest'
  ) {
    return 'pad'
  }
  return 'harmony'
}

function detectRole(track: Track): DetectedRole {
  if (track.instrument === 'drums') return 'drums'
  const pitches = track.notes.map((note) => note.pitch)
  const med = median(pitches)
  if (track.instrument === 'bass' || (pitches.length > 0 && med <= 51)) return 'bass'
  if (meanDuration(track) >= 1 && overlapRatio(track) >= 0.35) return 'pad'
  if (
    track.instrument === 'spooky' ||
    track.instrument === 'synth' ||
    track.instrument === 'bell' ||
    track.instrument === 'winterfest'
  ) {
    return 'pad'
  }
  return 'harmony'
}

function melodyScore(track: Track, index: number): number {
  const top = topLineUniqueness(track)
  const mono = monophonicRatio(track)
  let score = top + mono * 16 + median(track.notes.map((note) => note.pitch)) * 0.08
  if (index === 0) score += 6
  if (track.instrument === 'piano' || track.instrument === 'guitar' || track.instrument === 'electric-guitar') score += 8
  if (isLeadInstrument(track)) score += 4
  if (overlapRatio(track) >= 0.35) score -= uniqueness(track) * 0.35
  return score
}

export function resolveTrackRoles(song: Song, overrides: SmartTrackOverride[] = []): Map<string, DetectedRole> {
  const byId = new Map(overrides.map((row) => [row.trackId, row]))
  const auto = new Map<string, DetectedRole>()
  const candidates: { track: Track; index: number; score: number }[] = []

  song.tracks.forEach((track, index) => {
    const override = byId.get(track.id)
    if (override && override.role !== 'auto') {
      auto.set(track.id, override.role)
      return
    }
    const role = detectRole(track)
    auto.set(track.id, role)
    if (role === 'harmony') {
      candidates.push({ track, index, score: melodyScore(track, index) })
    }
  })

  const forcedLead = [...auto.values()].includes('lead')
  if (!forcedLead && candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score || a.index - b.index || a.track.id.localeCompare(b.track.id))
    auto.set(candidates[0].track.id, 'lead')
  }
  return auto
}

export function roleWeight(role: DetectedRole, trackIndex: number): number {
  const base = role === 'lead' ? 90 : role === 'drums' ? 55 : role === 'harmony' ? 45 : role === 'pad' ? 28 : 32
  return base - trackIndex * 2
}

export function targetCenter(role: DetectedRole, preferLow = false): number {
  if (role === 'bass') return 52
  if (role === 'lead') return preferLow ? 62 : 67
  if (role === 'pad') return preferLow ? 55 : 60
  return preferLow ? 55 : 60
}

export function overrideFor(trackId: string, overrides: SmartTrackOverride[]): SmartTrackOverride | undefined {
  return overrides.find((row) => row.trackId === trackId)
}
