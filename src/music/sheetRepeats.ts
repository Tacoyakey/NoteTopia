import { v4 as uuidv4 } from 'uuid'
import { cloneSong } from './SongModel'
import {
  GT_COLUMNS_PER_BEAT,
  GT_PITCH_LANES,
  GT_BLANK,
  GT_REPEAT_BEGIN,
  GT_REPEAT_END,
  columnToBeat,
  lineToMidi,
  midiToLine,
} from './gtPitch'
import type { Note, Song, Track } from './types'

const MIN_PERIOD_COLS = 4
const MAX_WALK_FACTOR = GT_PITCH_LANES + 2
const MAX_COLLAPSE_PASSES = 48

export function isRepeatNote(note: Note): boolean {
  return note.gtNumType === GT_REPEAT_BEGIN || note.gtNumType === GT_REPEAT_END
}

export function noteColumn(note: Note): number {
  return Math.round(note.startBeat * GT_COLUMNS_PER_BEAT)
}

export function noteLine(note: Note): number {
  return note.pitchLine ?? midiToLine(note.pitch)
}

export function songHasRepeats(song: Song): boolean {
  return song.tracks.some((track) => track.notes.some((note) => isRepeatNote(note)))
}

function lastSoundingColumn(song: Song): number {
  let max = -1
  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (isRepeatNote(note) || note.gtNumType === GT_BLANK) continue
      max = Math.max(max, noteColumn(note))
    }
  }
  return max
}

function firstSoundingColumn(song: Song): number {
  let min = Number.POSITIVE_INFINITY
  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (isRepeatNote(note) || note.gtNumType === GT_BLANK) continue
      min = Math.min(min, noteColumn(note))
    }
  }
  return Number.isFinite(min) ? min : -1
}

function soundingAt(song: Song, col: number): boolean {
  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (isRepeatNote(note) || note.gtNumType === GT_BLANK) continue
      if (noteColumn(note) === col) return true
    }
  }
  return false
}

const MIN_EMPTY_GAP = 8
const EMPTY_PERIODS = [4, 8, 12, 16]
const MAX_EMPTY_TIMES = GT_PITCH_LANES

function planEmptyLoop(length: number): { period: number; times: number } | null {
  if (length < MIN_EMPTY_GAP) return null
  let best: { period: number; times: number; visual: number } | null = null
  for (const period of EMPTY_PERIODS) {
    if (period >= length) continue
    const times = Math.min(MAX_EMPTY_TIMES, Math.floor(length / period))
    if (times < 2) continue
    const remainder = length - times * period
    const visual = period + remainder
    if (length - visual < MIN_PERIOD_COLS) continue
    if (!best || visual < best.visual || (visual === best.visual && period < best.period)) {
      best = { period, times, visual }
    }
  }
  return best
}

function dropColumnRange(song: Song, fromCol: number, toCol: number): void {
  const drop = toCol - fromCol
  if (drop <= 0) return
  const shiftBeats = drop / GT_COLUMNS_PER_BEAT
  for (const track of song.tracks) {
    track.notes = track.notes.filter((note) => {
      const col = noteColumn(note)
      return col < fromCol || col >= toCol
    })
    for (const note of track.notes) {
      if (noteColumn(note) >= toCol) note.startBeat -= shiftBeats
    }
  }
}

/**
 * Long silent stretches become a short empty window looped with stacked
 * Repeat Begin/End pairs (each pair plays the window one extra time).
 */
export function compressEmptyGaps(song: Song): Song {
  const first = firstSoundingColumn(song)
  const last = lastSoundingColumn(song)
  if (first < 0 || last - first < MIN_EMPTY_GAP) return song

  const gaps: { start: number; length: number }[] = []
  let run = -1
  for (let col = first; col <= last; col++) {
    if (!soundingAt(song, col)) {
      if (run < 0) run = col
    } else if (run >= 0) {
      gaps.push({ start: run, length: col - run })
      run = -1
    }
  }

  const worth = gaps.filter((gap) => planEmptyLoop(gap.length))
  if (worth.length === 0) return song

  const next = cloneSong(song)
  for (let i = worth.length - 1; i >= 0; i--) {
    const gap = worth[i]
    const plan = planEmptyLoop(gap.length)
    if (!plan) continue
    const { period, times: plannedTimes } = plan
    const beginCol = gap.start
    const endCol = gap.start + period - 1
    const rows = pickRepeatRows(next, beginCol, endCol, plannedTimes - 1)
    if (rows.length === 0) continue
    const times = rows.length + 1
    const dropFrom = gap.start + period
    const dropTo = gap.start + times * period
    dropColumnRange(next, dropFrom, dropTo)

    const host = ensureRepeatTrack(next)
    for (const line of rows) {
      host.notes.push(makeRepeatNote(beginCol, line, GT_REPEAT_BEGIN))
      host.notes.push(makeRepeatNote(endCol, line, GT_REPEAT_END))
    }
  }
  return next
}

function lastSheetColumn(song: Song): number {
  let max = -1
  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (note.gtNumType === GT_BLANK) continue
      max = Math.max(max, noteColumn(note))
    }
  }
  return max
}

function columnSignature(song: Song, col: number): string {
  const parts: string[] = []
  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (noteColumn(note) !== col) continue
      if (isRepeatNote(note)) {
        parts.push(`${noteLine(note)}:rep:${note.gtNumType}`)
        continue
      }
      const kind = note.audioRack
        ? `rack:${note.audioRack.notes}:${note.audioRack.volume}`
        : (note.gtNumType ?? track.gtNumType ?? track.instrument)
      parts.push(`${noteLine(note)}:${kind}`)
    }
  }
  parts.sort()
  return parts.join(',')
}

function rangeHasRepeat(song: Song, start: number, len: number): boolean {
  const end = start + len
  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (!isRepeatNote(note)) continue
      const col = noteColumn(note)
      if (col >= start && col < end) return true
    }
  }
  return false
}

export function findRepeatedSection(
  song: Song,
  skip: ReadonlySet<string> = new Set(),
): { start: number; period: number; times: number } | null {
  const last = lastSoundingColumn(song)
  if (last < MIN_PERIOD_COLS) return null
  const nSound = last + 1
  if (nSound < MIN_PERIOD_COLS * 2) return null

  const sigId = new Map<string, number>([['', 0]])
  const ids = new Array<number>(nSound)
  for (let col = 0; col < nSound; col++) {
    const sig = columnSignature(song, col)
    let id = sigId.get(sig)
    if (id == null) {
      id = sigId.size
      sigId.set(sig, id)
    }
    ids[col] = id
  }

  const idAt = (col: number) => (col < 0 || col >= nSound ? 0 : ids[col])

  const repeatMark = new Array<number>(nSound).fill(0)
  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (!isRepeatNote(note)) continue
      const col = noteColumn(note)
      if (col >= 0 && col < nSound) repeatMark[col] = 1
    }
  }
  const repeatPref = new Array<number>(nSound + 1)
  repeatPref[0] = 0
  for (let c = 0; c < nSound; c++) repeatPref[c + 1] = repeatPref[c] + repeatMark[c]

  const soundPref = new Array<number>(nSound + 1)
  soundPref[0] = 0
  for (let c = 0; c < nSound; c++) {
    soundPref[c + 1] = soundPref[c] + (ids[c] !== 0 ? 1 : 0)
  }

  const rangeHasRepeatFast = (start: number, len: number) => {
    const a = Math.max(0, start)
    const b = Math.min(nSound, start + len)
    return a < b && repeatPref[b] - repeatPref[a] > 0
  }
  const hasSound = (start: number, len: number) => {
    const a = Math.max(0, start)
    const b = Math.min(nSound, start + len)
    return a < b && soundPref[b] - soundPref[a] > 0
  }

  let best: { start: number; period: number; times: number; saved: number } | null = null
  const maxPeriod = Math.floor((last + 1 + MIN_PERIOD_COLS) / 2)

  for (let period = MIN_PERIOD_COLS; period <= maxPeriod; period++) {
    const matchLen = nSound + period
    const mp = new Array<number>(matchLen + 1)
    mp[0] = 0
    for (let i = 0; i < matchLen; i++) {
      mp[i + 1] = mp[i] + (idAt(i) === idAt(i + period) ? 1 : 0)
    }
    const copiesEqual = (start: number, hops: number) => {
      const end = start + hops * period
      if (start < 0 || end > matchLen) return false
      return mp[end] - mp[start] === hops * period
    }

    for (let start = 0; start + period <= last; start++) {
      if (skip.has(`${start}:${period}`)) continue
      if (idAt(start) === 0) continue
      if (rangeHasRepeatFast(start, period)) continue
      if (!hasSound(start, period) || !hasSound(start + period, period)) continue
      if (!copiesEqual(start, 1)) continue
      let times = 2
      while (hasSound(start + times * period, period) && copiesEqual(start, times)) {
        times++
      }
      const saved = (times - 1) * period
      if (
        !best ||
        saved > best.saved ||
        (saved === best.saved && times > best.times) ||
        (saved === best.saved && times === best.times && period < best.period) ||
        (saved === best.saved && times === best.times && period === best.period && start < best.start)
      ) {
        best = { start, period, times, saved }
      }
    }
  }
  return best ? { start: best.start, period: best.period, times: best.times } : null
}

function applyRepeatedSection(
  song: Song,
  found: { start: number; period: number; times: number },
): Song | null {
  const { start, period } = found
  if (rangeHasRepeat(song, start, period)) return null
  const next = cloneSong(song)
  const beginCol = start
  const endCol = start + period - 1
  const rows = pickRepeatRows(next, beginCol, endCol, found.times - 1)
  if (rows.length === 0) return null

  const times = rows.length + 1
  const dropFrom = start + period
  const dropTo = start + times * period
  const shift = (times - 1) * period

  for (const track of next.tracks) {
    track.notes = track.notes.filter((note) => {
      const col = noteColumn(note)
      return col < dropFrom || col >= dropTo
    })
    for (const note of track.notes) {
      if (noteColumn(note) >= dropTo) {
        note.startBeat -= shift / GT_COLUMNS_PER_BEAT
      }
    }
  }

  const host = ensureRepeatTrack(next)
  for (const line of rows) {
    host.notes.push(makeRepeatNote(beginCol, line, GT_REPEAT_BEGIN))
    host.notes.push(makeRepeatNote(endCol, line, GT_REPEAT_END))
  }
  return next
}

function occupiedLinesAt(song: Song, col: number): Set<number> {
  const lines = new Set<number>()
  for (const track of song.tracks) {
    if (track.muted) continue
    for (const note of track.notes) {
      if (noteColumn(note) !== col) continue
      lines.add(noteLine(note))
    }
  }
  return lines
}

function pickRepeatRows(song: Song, beginCol: number, endCol: number, count: number): number[] {
  const blocked = new Set([...occupiedLinesAt(song, beginCol), ...occupiedLinesAt(song, endCol)])
  const rows: number[] = []
  for (let line = GT_PITCH_LANES; line >= 1 && rows.length < count; line--) {
    if (!blocked.has(line)) rows.push(line)
  }
  return rows
}

function makeRepeatNote(col: number, line: number, numType: number): Note {
  return {
    id: uuidv4(),
    pitch: lineToMidi(line),
    pitchLine: line,
    startBeat: columnToBeat(col),
    durationBeats: 1 / GT_COLUMNS_PER_BEAT,
    velocity: 0,
    gtNumType: numType,
  }
}

function ensureRepeatTrack(song: Song): Track {
  const existing = song.tracks.find((track) =>
    track.notes.some((note) => isRepeatNote(note)) || track.name === 'Repeat',
  )
  if (existing) return existing
  const track: Track = {
    id: uuidv4(),
    name: 'Repeat',
    instrument: 'piano',
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    notes: [],
  }
  song.tracks.push(track)
  return track
}

function collapseOnce(
  current: Song,
  skip: Set<string>,
): { song: Song; skip: Set<string>; done: boolean } {
  const found = findRepeatedSection(current, skip)
  if (!found) return { song: current, skip, done: true }
  const next = applyRepeatedSection(current, found)
  if (!next) {
    const blocked = new Set(skip)
    blocked.add(`${found.start}:${found.period}`)
    return { song: current, skip: blocked, done: false }
  }
  return { song: next, skip: new Set(), done: false }
}

/**
 * If the snapped sheet has the same phrase copied back-to-back, keep one copy
 * and wrap it with Repeat Begin/End. Extra copies need extra pairs on free rows
 * — each End only fires once. Runs until no more consecutive copies remain.
 */
export function collapseRepeatedSections(song: Song): Song {
  let current = song
  let skip = new Set<string>()
  for (let pass = 0; pass < MAX_COLLAPSE_PASSES; pass++) {
    const step = collapseOnce(current, skip)
    current = step.song
    skip = step.skip
    if (step.done) break
  }
  return current
}

/** Same as collapseRepeatedSections, yielding between passes so the UI can paint. */
export async function collapseRepeatedSectionsAsync(
  song: Song,
  onPass?: (pass: number, max: number) => void,
): Promise<Song> {
  let current = song
  let skip = new Set<string>()
  for (let pass = 0; pass < MAX_COLLAPSE_PASSES; pass++) {
    onPass?.(pass, MAX_COLLAPSE_PASSES)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    const step = collapseOnce(current, skip)
    current = step.song
    skip = step.skip
    if (step.done) break
  }
  return current
}

function hasRepeatAt(song: Song, col: number, line: number, numType: number): boolean {
  for (const track of song.tracks) {
    if (track.muted) continue
    for (const note of track.notes) {
      if (note.gtNumType !== numType) continue
      if (noteColumn(note) !== col) continue
      if (noteLine(note) !== line) continue
      return true
    }
  }
  return false
}

/**
 * Growtopia play order: walk columns left to right. Hitting an unused Repeat End
 * on a row jumps to the column after the latest Repeat Begin on that same row,
 * then ignores that End until repeats are reset.
 */
export function expandSheetPlayback(song: Song): number[] {
  const last = lastSheetColumn(song)
  if (last < 0) return []
  const steps: number[] = []
  const activated = new Set<string>()
  let col = 0
  let guard = 0
  const guardMax = (last + 2) * MAX_WALK_FACTOR

  while (col <= last && guard++ < guardMax) {
    steps.push(col)
    let jumped = false
    for (let line = GT_PITCH_LANES; line >= 1; line--) {
      if (!hasRepeatAt(song, col, line, GT_REPEAT_END)) continue
      const key = `${col}:${line}`
      if (activated.has(key)) continue
      activated.add(key)
      let beginCol = 0
      for (let c = 0; c < col; c++) {
        if (hasRepeatAt(song, c, line, GT_REPEAT_BEGIN)) beginCol = c
      }
      if (beginCol >= col) continue
      for (let c = beginCol + 1; c < col; c++) {
        for (let other = 1; other <= GT_PITCH_LANES; other++) {
          if (other === line) continue
          activated.delete(`${c}:${other}`)
        }
      }
      col = beginCol
      jumped = true
      break
    }
    if (!jumped) col++
  }
  return steps
}

export function sheetWalkDurationBeats(song: Song): number {
  const steps = expandSheetPlayback(song)
  return Math.max(steps.length, 1) / GT_COLUMNS_PER_BEAT
}

export function notesAtColumn(song: Song, col: number): { track: Track; note: Note }[] {
  const hits: { track: Track; note: Note }[] = []
  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (noteColumn(note) !== col) continue
      hits.push({ track, note })
    }
  }
  return hits
}

export function sheetBeatFromWalk(steps: number[], walkBeat: number): number {
  if (steps.length === 0) return walkBeat
  const colFloat = walkBeat * GT_COLUMNS_PER_BEAT
  const maxIdx = steps.length - 1
  const idx = Math.min(maxIdx, Math.max(0, Math.floor(colFloat)))
  const cur = steps[idx]
  if (idx >= maxIdx) return cur / GT_COLUMNS_PER_BEAT
  const next = steps[idx + 1]
  // Jump at loop/repeat boundaries; slide only when walking adjacent columns.
  if (Math.abs(next - cur) !== 1) return cur / GT_COLUMNS_PER_BEAT
  const frac = Math.min(1, Math.max(0, colFloat - idx))
  return (cur + frac * (next - cur)) / GT_COLUMNS_PER_BEAT
}

export function scheduleSheetNotes(song: Song): { timeBeat: number; track: Track; note: Note }[] {
  const steps = expandSheetPlayback(song)
  const out: { timeBeat: number; track: Track; note: Note }[] = []
  for (let i = 0; i < steps.length; i++) {
    for (const hit of notesAtColumn(song, steps[i])) {
      if (isRepeatNote(hit.note) || hit.note.gtNumType === GT_BLANK) continue
      out.push({ timeBeat: i / GT_COLUMNS_PER_BEAT, track: hit.track, note: hit.note })
    }
  }
  return out
}
