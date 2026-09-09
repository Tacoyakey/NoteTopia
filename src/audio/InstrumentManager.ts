import * as Tone from 'tone'
import type { InstrumentId } from '../music/types'
import { getMasterInput } from './masterBus'

type InstrumentInstance = Tone.PolySynth | Tone.MonoSynth | Tone.PluckSynth | Tone.AMSynth | Tone.FMSynth | DrumKit

class DrumKit {
  private kick: Tone.MembraneSynth
  private snare: Tone.NoiseSynth
  private hihat: Tone.MetalSynth
  private output: Tone.Gain

  constructor(destination: Tone.InputNode) {
    this.output = new Tone.Gain(0.8)
    this.output.connect(destination)
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
    }).connect(this.output)

    this.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
    }).connect(this.output)

    this.hihat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }).connect(this.output)
  }

  trigger(pitch: number, time: number, velocity: number): void {
    const vel = velocity / 127
    if (pitch <= 36) {
      this.kick.triggerAttackRelease('C1', '8n', time, vel)
    } else if (pitch <= 40) {
      this.snare.triggerAttackRelease('8n', time, vel * 0.8)
    } else {
      this.hihat.triggerAttackRelease('32n', time, vel * 0.5)
    }
  }

  dispose(): void {
    this.kick.dispose()
    this.snare.dispose()
    this.hihat.dispose()
    this.output.dispose()
  }
}

export class InstrumentManager {
  private instruments = new Map<string, InstrumentInstance>()
  private drumKits = new Map<string, DrumKit>()
  private buses = new Map<string, Tone.Gain>()
  private panners = new Map<string, Tone.Panner>()
  private fx = new Map<string, Tone.ToneAudioNode[]>()
  private kinds = new Map<string, InstrumentId>()
  private master: Tone.Limiter | null = null

  private getMaster(): Tone.Limiter {
    if (!this.master) {
      this.master = new Tone.Limiter(-1.5)
      this.master.connect(getMasterInput())
    }
    return this.master
  }

  getBus(trackId: string): Tone.Gain {
    let bus = this.buses.get(trackId)
    if (!bus) {
      bus = new Tone.Gain(1)
      const panner = new Tone.Panner(0)
      bus.connect(panner)
      panner.connect(this.getMaster())
      this.buses.set(trackId, bus)
      this.panners.set(trackId, panner)
    }
    return bus
  }

  getInstrument(trackId: string, instrumentId: InstrumentId): InstrumentInstance | DrumKit {
    const existing = this.kinds.get(trackId)
    if (existing && existing !== instrumentId) this.disposeVoice(trackId)
    this.kinds.set(trackId, instrumentId)

    if (instrumentId === 'drums') {
      if (!this.drumKits.has(trackId)) {
        this.drumKits.set(trackId, new DrumKit(this.getBus(trackId)))
      }
      return this.drumKits.get(trackId)!
    }

    if (!this.instruments.has(trackId)) {
      this.instruments.set(trackId, this.createSynth(trackId, instrumentId))
    }
    return this.instruments.get(trackId)!
  }

  private createSynth(trackId: string, id: InstrumentId): InstrumentInstance {
    const bus = this.getBus(trackId)
    const extras: Tone.ToneAudioNode[] = []

    const toBus = (synth: Tone.PolySynth, voices = 8): Tone.PolySynth => {
      synth.maxPolyphony = voices
      synth.connect(bus)
      return synth
    }

    let inst: InstrumentInstance
    switch (id) {
      case 'piano':
        inst = toBus(
          new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.005, decay: 0.3, sustain: 0.4, release: 1.2 },
          }),
          12,
        )
        break

      case 'bass':
        inst = toBus(
          new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.55, release: 0.35 },
          }),
        )
        break

      case 'guitar':
        inst = new Tone.PluckSynth({
          attackNoise: 1,
          dampening: 4000,
          resonance: 0.9,
        }).connect(bus)
        break

      case 'lyre':
        inst = new Tone.PluckSynth({
          attackNoise: 0.6,
          dampening: 5500,
          resonance: 0.97,
        }).connect(bus)
        break

      case 'electric-guitar': {
        const dist = new Tone.Distortion(0.4)
        extras.push(dist)
        const synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.5 },
        })
        synth.maxPolyphony = 8
        synth.connect(dist)
        dist.connect(bus)
        inst = synth
        break
      }

      case 'sax':
        inst = toBus(
          new Tone.PolySynth(Tone.AMSynth, {
            harmonicity: 3,
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.04, decay: 0.2, sustain: 0.7, release: 0.25 },
          }),
        )
        break

      case 'flute':
        inst = toBus(
          new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sine' },
            envelope: { attack: 0.08, decay: 0.15, sustain: 0.55, release: 0.2 },
          }),
        )
        break

      case 'violin':
      case 'synth':
        inst = toBus(
          new Tone.PolySynth(Tone.AMSynth, {
            harmonicity: 2,
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.12, decay: 0.2, sustain: 0.65, release: 0.35 },
          }),
        )
        break

      case 'trumpet':
        inst = toBus(
          new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 2,
            modulationIndex: 4,
            oscillator: { type: 'square' },
            envelope: { attack: 0.03, decay: 0.15, sustain: 0.6, release: 0.2 },
            modulation: { type: 'sine' },
          }),
        )
        break

      case 'spooky':
        inst = toBus(
          new Tone.PolySynth(Tone.AMSynth, {
            harmonicity: 0.5,
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.2, decay: 0.4, sustain: 0.5, release: 1.2 },
          }),
        )
        break

      case 'winterfest':
      case 'bell':
        inst = toBus(
          new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 8,
            modulationIndex: 2,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.001, decay: 1.5, sustain: 0, release: 1.5 },
            modulation: { type: 'square' },
          }),
          10,
        )
        break

      default:
        inst = toBus(new Tone.PolySynth(Tone.Synth), 8)
    }

    if (extras.length) this.fx.set(trackId, extras)
    return inst
  }

  updateInstrument(trackId: string, instrumentId: InstrumentId): void {
    if (this.kinds.get(trackId) === instrumentId) {
      if (instrumentId === 'drums' ? this.drumKits.has(trackId) : this.instruments.has(trackId)) {
        return
      }
    }
    this.disposeVoice(trackId)
    this.getInstrument(trackId, instrumentId)
  }

  setVolume(trackId: string, volume: number, instrumentId: InstrumentId): void {
    this.getInstrument(trackId, instrumentId)
    const bus = this.getBus(trackId)
    const next = Math.max(0, Math.min(1, volume))
    const now = Tone.now()
    bus.gain.cancelScheduledValues(now)
    bus.gain.setValueAtTime(bus.gain.value, now)
    bus.gain.linearRampToValueAtTime(next, now + 0.02)
    if (next <= 0.0001) this.releaseTrack(trackId, now)
  }

  setPan(trackId: string, pan: number): void {
    this.getBus(trackId)
    const panner = this.panners.get(trackId)
    if (!panner) return
    const next = Math.max(-1, Math.min(1, pan))
    panner.pan.rampTo(next, 0.02)
  }

  releaseTrack(trackId: string, time = Tone.now()): void {
    const inst = this.instruments.get(trackId)
    if (inst && 'releaseAll' in inst && typeof inst.releaseAll === 'function') {
      try {
        inst.releaseAll(time)
      } catch {
        /* some synths reject overlap */
      }
    }
  }

  releaseAll(time = Tone.now()): void {
    for (const id of this.instruments.keys()) this.releaseTrack(id, time)
  }

  muteAllBuses(): void {
    const now = Tone.now()
    for (const bus of this.buses.values()) {
      bus.gain.cancelScheduledValues(now)
      bus.gain.setValueAtTime(bus.gain.value, now)
      bus.gain.linearRampToValueAtTime(0.0001, now + 0.02)
    }
  }

  private disposeVoice(trackId: string): void {
    this.kinds.delete(trackId)
    const inst = this.instruments.get(trackId)
    if (inst) {
      inst.dispose()
      this.instruments.delete(trackId)
    }
    const drum = this.drumKits.get(trackId)
    if (drum) {
      drum.dispose()
      this.drumKits.delete(trackId)
    }
    const extras = this.fx.get(trackId)
    if (extras) {
      for (const node of extras) node.dispose()
      this.fx.delete(trackId)
    }
  }

  disposeTrack(trackId: string): void {
    this.disposeVoice(trackId)
    const bus = this.buses.get(trackId)
    if (bus) {
      bus.dispose()
      this.buses.delete(trackId)
    }
    const panner = this.panners.get(trackId)
    if (panner) {
      panner.dispose()
      this.panners.delete(trackId)
    }
  }

  disposeAll(): void {
    for (const id of [...this.instruments.keys(), ...this.drumKits.keys(), ...this.buses.keys()]) {
      this.disposeTrack(id)
    }
    this.master?.dispose()
    this.master = null
  }
}

export { DrumKit }
