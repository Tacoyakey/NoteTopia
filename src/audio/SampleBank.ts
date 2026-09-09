import * as Tone from 'tone'
import {
  getSampleFilename,
  getGtDefForNumType,
  midiToLine,
  GT_BLANK,
  GT_REPEAT_BEGIN,
  GT_REPEAT_END,
  GT_AUDIO_RACK,
  type GtVariant,
} from '../music/gtPitch'
import type { Note, Track } from '../music/types'
import { expandAudioRack, isAudioRackNote } from '../music/audioRack'
import { getMasterNativeInput } from './masterBus'

const NOTES_BASE = `${import.meta.env.BASE_URL}notes/`
const SAMPLE_EXTS = ['wav', 'ogg', 'mp3'] as const

class SampleBank {
  private buffers = new Map<string, AudioBuffer>()
  private loading = new Map<string, Promise<AudioBuffer | null>>()
  private missing = new Set<string>()
  private available = false
  private checked = false
  private output: AudioNode | null = null
  private trackGains = new Map<string, GainNode>()
  private trackPanners = new Map<string, StereoPannerNode>()
  private voices = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }[]>()
  private graphCtx: AudioContext | null = null

  private MAX_VOICES = 256

  private syncContext(): AudioContext {
    const ctx = Tone.getContext().rawContext as AudioContext
    if (this.graphCtx !== ctx) {
      this.output = null
      this.trackGains.clear()
      this.trackPanners.clear()
      this.voices.clear()
      this.graphCtx = ctx
    }
    return ctx
  }

  private ensureOutput(): AudioNode {
    const ctx = this.syncContext()
    if (!this.output) {
      const master = ctx.createGain()
      master.gain.value = 0.38
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -18
      comp.ratio.value = 4
      comp.attack.value = 0.003
      comp.release.value = 0.12
      master.connect(comp)
      comp.connect(getMasterNativeInput())
      this.output = master
    }
    return this.output
  }

  async probe(): Promise<boolean> {
    if (this.checked) return this.available
    this.checked = true
    const test = await this.loadNamed('piano_1')
    this.available = test !== null
    if (!this.available) {
      const fallback = await this.loadNamed('piano_0')
      this.available = fallback !== null
    }
    return this.available
  }

  hasSamples(): boolean {
    return this.available
  }

  private stemOf(url: string): string {
    return url.replace(/\.(wav|ogg|mp3)$/i, '')
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(url)) return this.buffers.get(url)!
    if (this.missing.has(url)) return null
    if (this.loading.has(url)) return this.loading.get(url)!

    const promise = (async () => {
      try {
        const response = await fetch(url)
        if (!response.ok) {
          this.missing.add(url)
          return null
        }
        const data = await response.arrayBuffer()
        const buffer = await Tone.getContext().rawContext.decodeAudioData(data)
        this.buffers.set(url, buffer)
        return buffer
      } catch {
        this.missing.add(url)
        return null
      }
    })()

    this.loading.set(url, promise)
    return promise
  }

  private async loadNamed(stem: string): Promise<AudioBuffer | null> {
    const base = this.stemOf(stem)
    for (const ext of SAMPLE_EXTS) {
      const buf = await this.loadBuffer(`${NOTES_BASE}${base}.${ext}`)
      if (buf) return buf
    }
    return null
  }

  private getCached(stem: string): AudioBuffer | null {
    const base = this.stemOf(stem)
    for (const ext of SAMPLE_EXTS) {
      const url = `${NOTES_BASE}${base}.${ext}`
      const buf = this.buffers.get(url)
      if (buf) return buf
    }
    return null
  }

  resolveSampleStem(track: Track, note: Note): string | null {
    const numType = note.gtNumType ?? track.gtNumType
    if (numType === GT_REPEAT_BEGIN || numType === GT_REPEAT_END || numType === GT_BLANK || numType === GT_AUDIO_RACK) {
      return null
    }
    const pitchLine = note.pitchLine ?? midiToLine(note.pitch)
    const variant: GtVariant = note.gtVariant ?? track.gtVariant ?? 'natural'
    let stem = track.gtStem
    let fileStem: string | undefined

    if (numType != null) {
      const def = getGtDefForNumType(numType)
      if (def) {
        stem = def.stem
        fileStem = def.fileStem
      }
    }

    if (!stem) return null
    const filename = getSampleFilename(stem, variant, pitchLine, fileStem)
    return filename ? this.stemOf(filename) : null
  }

  async preloadForSong(tracks: Track[]): Promise<number> {
    const stems = new Set<string>()
    for (const track of tracks) {
      for (const note of track.notes) {
        if (isAudioRackNote(note)) {
          for (const slot of expandAudioRack(track, note)) {
            const stem = this.resolveSampleStem(slot.track, slot.note)
            if (stem) stems.add(stem)
          }
          continue
        }
        const stem = this.resolveSampleStem(track, note)
        if (stem) stems.add(stem)
      }
    }
    let loaded = 0
    await Promise.all(
      [...stems].map(async (stem) => {
        const buf = await this.loadNamed(stem)
        if (buf) loaded++
      }),
    )
    if (loaded > 0) this.available = true
    return loaded
  }

  getBufferForNote(track: Track, note: Note): AudioBuffer | null {
    const stem = this.resolveSampleStem(track, note)
    if (!stem) return null
    return this.getCached(stem)
  }

  maxCachedDuration(): number {
    let max = 0
    for (const buf of this.buffers.values()) max = Math.max(max, buf.duration)
    return max
  }

  /** Synchronous — only plays if the buffer is already cached. Plays the full sample. */
  playCached(stem: string, time: number, volume: number, trackId?: string): boolean {
    const buffer = this.getCached(stem)
    if (!buffer) return false
    const vel = Math.max(0, Math.min(1.15, volume))
    if (vel <= 0.0001) return false
    if (trackId && this.getTrackGain(trackId).gain.value <= 0.0001) return false

    this.ensureOutput()
    const ctx = this.syncContext()
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = vel
    source.connect(gain)
    gain.connect(trackId ? this.getTrackGain(trackId) : this.ensureOutput())
    try {
      source.start(time)
    } catch {
      return false
    }
    if (trackId) this.rememberVoice(trackId, source, gain)
    source.onended = () => {
      if (trackId) this.forgetVoice(trackId, source)
      try {
        source.disconnect()
        gain.disconnect()
      } catch {
        /* already disconnected */
      }
    }
    return true
  }

  playNote(track: Track, note: Note, time: number): boolean {
    const stem = this.resolveSampleStem(track, note)
    if (!stem) return false
    return this.playCached(stem, time, note.velocity / 127, track.id)
  }

  setTrackOutput(trackId: string, gain: number): void {
    const node = this.getTrackGain(trackId)
    const ctx = this.syncContext()
    const now = ctx.currentTime
    const next = Math.max(0, Math.min(1.15, gain))
    node.gain.cancelScheduledValues(now)
    node.gain.setValueAtTime(node.gain.value, now)
    node.gain.linearRampToValueAtTime(next, now + 0.018)
    if (next <= 0.0001) this.stopTrack(trackId)
  }

  setTrackPan(trackId: string, pan: number): void {
    this.getTrackGain(trackId)
    const panner = this.trackPanners.get(trackId)
    if (!panner) return
    panner.pan.value = Math.max(-1, Math.min(1, pan))
  }

  stopTrack(trackId: string): void {
    const list = this.voices.get(trackId)
    if (!list?.length) return
    const ctx = this.syncContext()
    const now = ctx.currentTime
    for (const voice of list) {
      try {
        voice.gain.gain.cancelScheduledValues(now)
        voice.gain.gain.setValueAtTime(Math.max(voice.gain.gain.value, 0.0001), now)
        voice.gain.gain.linearRampToValueAtTime(0.0001, now + 0.02)
        voice.source.stop(now + 0.025)
      } catch {
        /* already stopped */
      }
    }
    this.voices.set(trackId, [])
  }

  stopAll(): void {
    for (const id of [...this.voices.keys()]) this.stopTrack(id)
  }

  private rememberVoice(
    trackId: string,
    source: AudioBufferSourceNode,
    gain: GainNode,
  ): void {
    const list = this.voices.get(trackId) ?? []
    list.push({ source, gain })
    while (list.length > this.MAX_VOICES) {
      const dropped = list.shift()
      if (!dropped) break
      try {
        dropped.source.stop()
      } catch {
        /* already stopped */
      }
    }
    this.voices.set(trackId, list)
  }

  private forgetVoice(trackId: string, source: AudioBufferSourceNode): void {
    const list = this.voices.get(trackId)
    if (!list) return
    this.voices.set(
      trackId,
      list.filter((v) => v.source !== source),
    )
  }

  private getTrackGain(trackId: string): GainNode {
    const ctx = this.syncContext()
    let node = this.trackGains.get(trackId)
    if (!node) {
      node = ctx.createGain()
      node.gain.value = 1
      const panner = ctx.createStereoPanner()
      panner.pan.value = 0
      node.connect(panner)
      panner.connect(this.ensureOutput())
      this.trackGains.set(trackId, node)
      this.trackPanners.set(trackId, panner)
    }
    return node
  }
}

export const sampleBank = new SampleBank()
