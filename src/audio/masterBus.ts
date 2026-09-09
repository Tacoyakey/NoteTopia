import * as Tone from 'tone'

const STORAGE_KEY = 'notetopia-master-volume'
const FLOOR_DB = -48
const FFT = 1024
const HOLD_MS = 700
const VU_FALL = 6
const PEAK_FALL = 3.2

export type MasterLevels = {
  l: number
  r: number
  peakL: number
  peakR: number
}

let input: Tone.Gain | null = null
let fader: Tone.Gain | null = null
let analyser: AnalyserNode | null = null
let boundContext: ReturnType<typeof Tone.getContext> | null = null
let volume = loadVolume()
let shownL = 0
let shownR = 0
let holdL = 0
let holdUntilL = 0
let lastReadAt = 0

const wave = new Float32Array(FFT)

function loadVolume(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return 0.85
    const n = Number(raw)
    if (!Number.isFinite(n)) return 0.85
    return clamp01(n)
  } catch {
    return 0.85
  }
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** Map a linear peak (0–1) onto a 0–1 meter with a −48 dB floor. */
export function meterFromAmplitude(peak: number): number {
  if (peak <= 0) return 0
  const db = 20 * Math.log10(Math.min(1, peak))
  return clamp01((db - FLOOR_DB) / -FLOOR_DB)
}

function peakFrom(node: AnalyserNode, buf: Float32Array): number {
  node.getFloatTimeDomainData(buf)
  let peak = 0
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i]!)
    if (a > peak) peak = a
  }
  return peak
}

function disposeBus(): void {
  try {
    analyser?.disconnect()
  } catch {
    /* ignore */
  }
  analyser = null
  if (fader && !fader.disposed) fader.dispose()
  if (input && !input.disposed) input.dispose()
  fader = null
  input = null
}

function ensure(): Tone.Gain {
  const ctx = Tone.getContext()
  if (input && !input.disposed && boundContext === ctx) return input
  disposeBus()
  boundContext = ctx

  input = new Tone.Gain(1)
  fader = new Tone.Gain(volume)
  input.connect(fader)
  fader.toDestination()

  const nativeCtx = ctx.rawContext as AudioContext
  const tap = fader.output as AudioNode
  analyser = nativeCtx.createAnalyser()
  analyser.fftSize = FFT
  analyser.smoothingTimeConstant = 0
  tap.connect(analyser)
  return input
}

/** Tone nodes (synths / limiter) connect here. */
export function getMasterInput(): Tone.InputNode {
  return ensure()
}

/** Native Web Audio nodes (sample bank) connect here. */
export function getMasterNativeInput(): AudioNode {
  ensure()
  return input!.input as AudioNode
}

export function getMasterVolume(): number {
  return volume
}

export function setMasterVolume(next: number): void {
  volume = clamp01(next)
  try {
    localStorage.setItem(STORAGE_KEY, String(volume))
  } catch {
    /* ignore */
  }
  if (!fader || fader.disposed) return
  const now = Tone.now()
  fader.gain.cancelScheduledValues(now)
  fader.gain.setValueAtTime(fader.gain.value, now)
  fader.gain.linearRampToValueAtTime(volume, now + 0.02)
}

function decayHold(
  current: number,
  hold: number,
  holdUntil: number,
  now: number,
  dt: number,
): { hold: number; until: number } {
  if (current >= hold) return { hold: current, until: now + HOLD_MS }
  if (now < holdUntil) return { hold, until: holdUntil }
  const fall = dt > 0 ? Math.exp(-PEAK_FALL * dt) : 1
  return { hold: hold * fall, until: holdUntil }
}

export function readMasterLevels(): MasterLevels {
  ensure()
  const now = performance.now()
  const dt = lastReadAt ? Math.min(0.08, (now - lastReadAt) / 1000) : 0
  lastReadAt = now
  let amp = 0
  try {
    if (analyser) amp = peakFrom(analyser, wave)
  } catch {
    amp = 0
  }
  const instant = meterFromAmplitude(amp)
  const fall = dt > 0 ? Math.exp(-VU_FALL * dt) : 1
  shownL = Math.max(instant, shownL * fall)
  shownR = shownL
  const nextL = decayHold(shownL, holdL, holdUntilL, now, dt)
  holdL = nextL.hold
  holdUntilL = nextL.until
  return { l: shownL, r: shownR, peakL: holdL, peakR: holdL }
}
