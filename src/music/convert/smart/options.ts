import type { InstrumentId } from '../../types'

export type SmartPreset =
  | 'balanced'
  | 'melodyFirst'
  | 'denseMix'
  | 'cleanSheet'
  | 'worldFit'
  | 'faithful'
  | 'custom'

export type SmartRole = 'auto' | 'lead' | 'harmony' | 'bass' | 'drums' | 'pad'

export type AccidentalSpelling = 'auto' | 'sharps' | 'flats' | 'key'

export type GraceNotes = 'drop' | 'keep' | 'attach'

export type SwingMode = 'auto' | 'straight' | 'keep'

export type TargetLength = 'none' | 400 | 200

export type SameInstrumentChords = 'sheet' | 'rack'

export type PadThin = 'off' | 'medium' | 'hard'

export type PadInstrument = 'piano' | 'spooky'

export type BellInstrument = 'lyre' | 'winterfest'

export type KeyLock = 'auto' | 'none'

export type OctaveNudge = -24 | -12 | 0 | 12 | 24

export interface SmartTrackOverride {
  trackId: string
  include: boolean
  role: SmartRole
  instrument?: InstrumentId
  octave: OctaveNudge
}

export interface SmartOptions {
  preset: SmartPreset
  fitKey: boolean
  preferLow: boolean
  keyLock: KeyLock
  accidentalSpelling: AccidentalSpelling
  splitAccidentals: boolean
  fallbackInstrument: InstrumentId
  padInstrument: PadInstrument
  bellInstrument: BellInstrument
  chordCap: number
  unisonCollapse: boolean
  octaveDoubleCollapse: boolean
  padThin: PadThin
  melodyIsolation: boolean
  packRacks: boolean
  mixRackVolume: boolean
  duckBusyRacks: boolean
  maxRackVoices: number
  sameInstrumentChords: SameInstrumentChords
  neverRacks: boolean
  skipDrums: boolean
  compactKit: boolean
  dropGhostHats: boolean
  ghostHatVelocity: number
  kickSnarePriority: boolean
  dropQuiet: boolean
  quietThreshold: number
  trimSilence: boolean
  pickupTrim: boolean
  graceNotes: GraceNotes
  swing: SwingMode
  compress: boolean
  targetColumns: TargetLength
  minBpm: number
  mergeSameInstruments: boolean
  flattenVelocities: boolean
  normalize: boolean
  tracks: SmartTrackOverride[]
}

export const SMART_PRESETS: readonly Exclude<SmartPreset, 'custom'>[] = [
  'balanced',
  'melodyFirst',
  'denseMix',
  'cleanSheet',
  'worldFit',
  'faithful',
]

export const DEFAULT_SMART_OPTIONS: SmartOptions = {
  preset: 'balanced',
  fitKey: true,
  preferLow: false,
  keyLock: 'auto',
  accidentalSpelling: 'auto',
  splitAccidentals: true,
  fallbackInstrument: 'piano',
  padInstrument: 'piano',
  bellInstrument: 'lyre',
  chordCap: 4,
  unisonCollapse: true,
  octaveDoubleCollapse: true,
  padThin: 'medium',
  melodyIsolation: false,
  packRacks: true,
  mixRackVolume: true,
  duckBusyRacks: true,
  maxRackVoices: 5,
  sameInstrumentChords: 'sheet',
  neverRacks: false,
  skipDrums: false,
  compactKit: true,
  dropGhostHats: true,
  ghostHatVelocity: 48,
  kickSnarePriority: true,
  dropQuiet: false,
  quietThreshold: 24,
  trimSilence: false,
  pickupTrim: false,
  graceNotes: 'drop',
  swing: 'auto',
  compress: false,
  targetColumns: 'none',
  minBpm: 40,
  mergeSameInstruments: true,
  flattenVelocities: false,
  normalize: true,
  tracks: [],
}

const PRESET_PATCH: Record<Exclude<SmartPreset, 'custom'>, Partial<SmartOptions>> = {
  balanced: {},
  melodyFirst: {
    melodyIsolation: true,
    padThin: 'hard',
    chordCap: 3,
    duckBusyRacks: true,
  },
  denseMix: {
    chordCap: 4,
    padThin: 'off',
    octaveDoubleCollapse: false,
    maxRackVoices: 5,
    melodyIsolation: false,
    sameInstrumentChords: 'rack',
  },
  cleanSheet: {
    neverRacks: true,
    packRacks: false,
    chordCap: 2,
    padThin: 'hard',
    dropQuiet: true,
  },
  worldFit: {
    compress: true,
    targetColumns: 400,
  },
  faithful: {
    preferLow: false,
    graceNotes: 'keep',
    padThin: 'off',
    unisonCollapse: false,
    octaveDoubleCollapse: false,
    mixRackVolume: false,
    duckBusyRacks: false,
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asNum(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

const INSTRUMENTS: readonly InstrumentId[] = [
  'piano',
  'bass',
  'drums',
  'sax',
  'flute',
  'guitar',
  'electric-guitar',
  'violin',
  'lyre',
  'trumpet',
  'spooky',
  'winterfest',
  'synth',
  'bell',
]

function asInstrument(value: unknown, fallback: InstrumentId): InstrumentId {
  return typeof value === 'string' && INSTRUMENTS.includes(value as InstrumentId)
    ? (value as InstrumentId)
    : fallback
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

function parseTrackOverride(raw: unknown): SmartTrackOverride | null {
  if (!isRecord(raw) || typeof raw.trackId !== 'string' || !raw.trackId) return null
  const octave = asNum(raw.octave, 0, -24, 24)
  const snapped: OctaveNudge = octave <= -18 ? -24 : octave <= -6 ? -12 : octave < 6 ? 0 : octave < 18 ? 12 : 24
  const instrument =
    typeof raw.instrument === 'string' && INSTRUMENTS.includes(raw.instrument as InstrumentId)
      ? (raw.instrument as InstrumentId)
      : undefined
  return {
    trackId: raw.trackId,
    include: raw.include !== false,
    role: asEnum(raw.role, ['auto', 'lead', 'harmony', 'bass', 'drums', 'pad'] as const, 'auto'),
    instrument,
    octave: snapped,
  }
}

export function mergeSmartOptions(raw: unknown): SmartOptions {
  const src = isRecord(raw) ? raw : {}
  const base = DEFAULT_SMART_OPTIONS
  const tracks = Array.isArray(src.tracks)
    ? src.tracks.map(parseTrackOverride).filter((row): row is SmartTrackOverride => row != null)
    : []
  const targetRaw = src.targetColumns
  const targetColumns: TargetLength =
    targetRaw === 200 || targetRaw === 400 || targetRaw === 'none' ? targetRaw : base.targetColumns
  return {
    preset: asEnum(src.preset, [...SMART_PRESETS, 'custom'] as const, base.preset),
    fitKey: asBool(src.fitKey, base.fitKey),
    preferLow: asBool(src.preferLow, base.preferLow),
    keyLock: asEnum(src.keyLock, ['auto', 'none'] as const, base.keyLock),
    accidentalSpelling: asEnum(
      src.accidentalSpelling,
      ['auto', 'sharps', 'flats', 'key'] as const,
      base.accidentalSpelling,
    ),
    splitAccidentals: asBool(src.splitAccidentals, base.splitAccidentals),
    fallbackInstrument: asInstrument(src.fallbackInstrument, base.fallbackInstrument),
    padInstrument: asEnum(src.padInstrument, ['piano', 'spooky'] as const, base.padInstrument),
    bellInstrument: asEnum(src.bellInstrument, ['lyre', 'winterfest'] as const, base.bellInstrument),
    chordCap: asNum(src.chordCap, base.chordCap, 1, 4),
    unisonCollapse: asBool(src.unisonCollapse, base.unisonCollapse),
    octaveDoubleCollapse: asBool(src.octaveDoubleCollapse, base.octaveDoubleCollapse),
    padThin: asEnum(src.padThin, ['off', 'medium', 'hard'] as const, base.padThin),
    melodyIsolation: asBool(src.melodyIsolation, base.melodyIsolation),
    packRacks: asBool(src.packRacks, base.packRacks),
    mixRackVolume: asBool(src.mixRackVolume, base.mixRackVolume),
    duckBusyRacks: asBool(src.duckBusyRacks, base.duckBusyRacks),
    maxRackVoices: asNum(src.maxRackVoices, base.maxRackVoices, 2, 5),
    sameInstrumentChords: asEnum(
      src.sameInstrumentChords,
      ['sheet', 'rack'] as const,
      base.sameInstrumentChords,
    ),
    neverRacks: asBool(src.neverRacks, base.neverRacks),
    skipDrums: asBool(src.skipDrums, base.skipDrums),
    compactKit: asBool(src.compactKit, base.compactKit),
    dropGhostHats: asBool(src.dropGhostHats, base.dropGhostHats),
    ghostHatVelocity: asNum(src.ghostHatVelocity, base.ghostHatVelocity, 1, 127),
    kickSnarePriority: asBool(src.kickSnarePriority, base.kickSnarePriority),
    dropQuiet: asBool(src.dropQuiet, base.dropQuiet),
    quietThreshold: asNum(src.quietThreshold, base.quietThreshold, 1, 80),
    trimSilence: asBool(src.trimSilence, base.trimSilence),
    pickupTrim: asBool(src.pickupTrim, base.pickupTrim),
    graceNotes: asEnum(src.graceNotes, ['drop', 'keep', 'attach'] as const, base.graceNotes),
    swing: asEnum(src.swing, ['auto', 'straight', 'keep'] as const, base.swing),
    compress: asBool(src.compress, base.compress),
    targetColumns,
    minBpm: asNum(src.minBpm, base.minBpm, 20, 80),
    mergeSameInstruments: asBool(src.mergeSameInstruments, base.mergeSameInstruments),
    flattenVelocities: asBool(src.flattenVelocities, base.flattenVelocities),
    normalize: asBool(src.normalize, base.normalize),
    tracks,
  }
}

export function smartPresetValues(preset: Exclude<SmartPreset, 'custom'>): SmartOptions {
  return mergeSmartOptions({ ...DEFAULT_SMART_OPTIONS, ...PRESET_PATCH[preset], preset, tracks: [] })
}

export function withPreset(current: SmartOptions, preset: Exclude<SmartPreset, 'custom'>): SmartOptions {
  return { ...smartPresetValues(preset), tracks: current.tracks }
}

const KNOB_KEYS: (keyof Omit<SmartOptions, 'preset' | 'tracks'>)[] = [
  'fitKey',
  'preferLow',
  'keyLock',
  'accidentalSpelling',
  'splitAccidentals',
  'fallbackInstrument',
  'padInstrument',
  'bellInstrument',
  'chordCap',
  'unisonCollapse',
  'octaveDoubleCollapse',
  'padThin',
  'melodyIsolation',
  'packRacks',
  'mixRackVolume',
  'duckBusyRacks',
  'maxRackVoices',
  'sameInstrumentChords',
  'neverRacks',
  'skipDrums',
  'compactKit',
  'dropGhostHats',
  'ghostHatVelocity',
  'kickSnarePriority',
  'dropQuiet',
  'quietThreshold',
  'trimSilence',
  'pickupTrim',
  'graceNotes',
  'swing',
  'compress',
  'targetColumns',
  'minBpm',
  'mergeSameInstruments',
  'flattenVelocities',
  'normalize',
]

export function markCustomIfChanged(options: SmartOptions): SmartOptions {
  if (options.preset === 'custom') return options
  const expected = smartPresetValues(options.preset)
  for (const key of KNOB_KEYS) {
    if (options[key] !== expected[key]) return { ...options, preset: 'custom' }
  }
  return options
}

export const CONVERT_PREFS_VERSION = 2

export interface ConvertPrefs {
  prefsVersion: number
  pickedId: string
  compress: boolean
  fitKey: boolean
  preferLow: boolean
  skipDrums: boolean
  trimSilence: boolean
  dropQuiet: boolean
  advancedOpen: boolean
  smart: SmartOptions
}

export function defaultConvertPrefs(pickedId: string): ConvertPrefs {
  return {
    prefsVersion: CONVERT_PREFS_VERSION,
    pickedId,
    compress: false,
    fitKey: false,
    preferLow: false,
    skipDrums: false,
    trimSilence: false,
    dropQuiet: false,
    advancedOpen: false,
    smart: { ...DEFAULT_SMART_OPTIONS },
  }
}

export function mergeConvertPrefs(raw: unknown, fallbackPickedId: string): ConvertPrefs {
  const base = defaultConvertPrefs(fallbackPickedId)
  if (!isRecord(raw)) return base
  const pickedId = typeof raw.pickedId === 'string' && raw.pickedId ? raw.pickedId : base.pickedId
  return {
    prefsVersion: CONVERT_PREFS_VERSION,
    pickedId,
    compress: asBool(raw.compress, base.compress),
    fitKey: asBool(raw.fitKey, base.fitKey),
    preferLow: asBool(raw.preferLow, base.preferLow),
    skipDrums: asBool(raw.skipDrums, base.skipDrums),
    trimSilence: asBool(raw.trimSilence, base.trimSilence),
    dropQuiet: asBool(raw.dropQuiet, base.dropQuiet),
    advancedOpen: asBool(raw.advancedOpen, base.advancedOpen),
    smart: mergeSmartOptions(raw.smart),
  }
}
