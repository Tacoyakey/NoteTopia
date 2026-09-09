import * as Tone from 'tone'
import type { Song } from '../music/types'
import { getActiveTracks } from '../music/SongModel'
import { isGtSheetNote } from '../music/gtSheet'
import { beatsToSeconds, getSongDurationBeats } from '../music/timing'
import { pitchToFrequency } from '../music/pitchUtils'
import {
  isRepeatNote,
  scheduleSheetNotes,
  songHasRepeats,
  sheetWalkDurationBeats,
} from '../music/sheetRepeats'
import { soundingMidiForNote } from '../music/gtPitch'
import { expandAudioRack, isAudioRackNote } from '../music/audioRack'
import { DrumKit, InstrumentManager } from './InstrumentManager'
import { sampleBank } from './SampleBank'
import {
  channelsFromAudioBuffer,
  downloadBlob,
  encodeMp3,
  encodeWav,
} from './encodeAudio'

export interface BounceOpts {
  /** When true, only notes that own a Growtopia tile are mixed (World playback). */
  sheet?: boolean
  convertModel?: string
}

export type BounceStage = 'samples' | 'mix' | 'encode'

export interface BounceProgress {
  ratio: number
  stage: BounceStage
}

function triggerOffline(
  inst: ReturnType<InstrumentManager['getInstrument']>,
  pitch: number,
  durationBeats: number,
  velocity: number,
  time: number,
  bpm: number,
): void {
  const freq = pitchToFrequency(pitch)
  const durSeconds = beatsToSeconds(durationBeats, bpm)
  const vel = velocity / 127
  try {
    if (inst instanceof DrumKit) {
      inst.trigger(pitch, time, velocity)
    } else if (inst instanceof Tone.PluckSynth) {
      inst.triggerAttackRelease(freq, durSeconds, time, vel)
    } else if (inst instanceof Tone.MonoSynth) {
      inst.triggerAttackRelease(freq, durSeconds, time, vel)
    } else if (inst instanceof Tone.PolySynth) {
      inst.triggerAttackRelease(freq, durSeconds, time, vel)
    }
  } catch {
    /* skip overlapping voice */
  }
}

function copyBuffer(ctx: BaseAudioContext, src: AudioBuffer): AudioBuffer {
  if (src.sampleRate === ctx.sampleRate) {
    const dst = ctx.createBuffer(src.numberOfChannels, src.length, ctx.sampleRate)
    for (let ch = 0; ch < src.numberOfChannels; ch++) {
      dst.copyToChannel(src.getChannelData(ch), ch)
    }
    return dst
  }
  const ratio = ctx.sampleRate / src.sampleRate
  const newLen = Math.max(1, Math.round(src.length * ratio))
  const dst = ctx.createBuffer(src.numberOfChannels, newLen, ctx.sampleRate)
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const input = src.getChannelData(ch)
    const output = dst.getChannelData(ch)
    for (let i = 0; i < newLen; i++) {
      const x = i / ratio
      const i0 = Math.min(input.length - 1, Math.floor(x))
      const i1 = Math.min(input.length - 1, i0 + 1)
      const f = x - i0
      output[i] = input[i0] * (1 - f) + input[i1] * f
    }
  }
  return dst
}

function mixDurationSeconds(song: Song, audibleIds: Set<string>, opts?: BounceOpts): number {
  const useWalk = opts?.sheet && songHasRepeats(song)
  let end = beatsToSeconds(useWalk ? sheetWalkDurationBeats(song) : getSongDurationBeats(song), song.bpm)
  if (useWalk) {
    for (const hit of scheduleSheetNotes(song)) {
      if (!audibleIds.has(hit.track.id)) continue
      const buf = sampleBank.getBufferForNote(hit.track, hit.note)
      const start = beatsToSeconds(hit.timeBeat, song.bpm)
      if (isAudioRackNote(hit.note)) {
        for (const slot of expandAudioRack(hit.track, hit.note)) {
          const slotBuf = sampleBank.getBufferForNote(slot.track, slot.note)
          end = Math.max(end, start + (slotBuf?.duration ?? beatsToSeconds(slot.note.durationBeats, song.bpm)))
        }
        continue
      }
      end = Math.max(end, start + (buf?.duration ?? beatsToSeconds(hit.note.durationBeats, song.bpm)))
    }
    return Math.max(1, end + 0.15)
  }
  for (const track of song.tracks) {
    if (!audibleIds.has(track.id)) continue
    for (const note of track.notes) {
      if (isRepeatNote(note)) continue
      const start = beatsToSeconds(note.startBeat, song.bpm)
      if (isAudioRackNote(note)) {
        for (const slot of expandAudioRack(track, note)) {
          const slotBuf = sampleBank.getBufferForNote(slot.track, slot.note)
          end = Math.max(end, start + (slotBuf?.duration ?? beatsToSeconds(slot.note.durationBeats, song.bpm)))
        }
        continue
      }
      const buf = sampleBank.getBufferForNote(track, note)
      end = Math.max(end, start + (buf?.duration ?? beatsToSeconds(note.durationBeats, song.bpm)))
    }
  }
  return Math.max(1, end + 0.15)
}

/** Offline-render the song, preferring Growtopia note WAVs when they are loaded. */
export async function renderSongOffline(
  song: Song,
  opts?: BounceOpts,
  onProgress?: (ratio: number) => void,
): Promise<AudioBuffer> {
  onProgress?.(0.06)
  await sampleBank.probe()
  onProgress?.(0.22)
  const audible = getActiveTracks(song)
  const audibleIds = new Set(audible.map((track) => track.id))
  await sampleBank.preloadForSong(audible)
  onProgress?.(0.4)
  const seconds = mixDurationSeconds(song, audibleIds, opts)
  const sampleRate = Tone.getContext().sampleRate || 44100

  let mix = 0.4
  let mixing = true
  const tick = setInterval(() => {
    if (!mixing) return
    mix = Math.min(0.92, mix + 0.035)
    onProgress?.(mix)
  }, 200)
  let rendered: Awaited<ReturnType<typeof Tone.Offline>>
  try {
    rendered = await Tone.Offline(
    () => {
      const ctx = Tone.getContext().rawContext
      const master = ctx.createGain()
      master.gain.value = 0.38
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -18
      comp.ratio.value = 4
      comp.attack.value = 0.003
      comp.release.value = 0.12
      master.connect(comp)
      comp.connect(ctx.destination)

      const copies = new Map<AudioBuffer, AudioBuffer>()
      const trackGains = new Map<string, GainNode>()
      const trackGain = (trackId: string, volume: number): GainNode => {
        let node = trackGains.get(trackId)
        if (!node) {
          node = ctx.createGain()
          node.gain.value = volume
          node.connect(master)
          trackGains.set(trackId, node)
        }
        return node
      }
      const localBuf = (src: AudioBuffer): AudioBuffer => {
        let copy = copies.get(src)
        if (!copy) {
          copy = copyBuffer(ctx, src)
          copies.set(src, copy)
        }
        return copy
      }

      const mgr = new InstrumentManager()
      for (const track of song.tracks) {
        if (!audibleIds.has(track.id)) continue
        mgr.setVolume(track.id, track.volume, track.instrument)
      }

      const playHit = (
        track: (typeof song.tracks)[number],
        note: (typeof song.tracks)[number]['notes'][number],
        timeBeat: number,
      ) => {
        if (isRepeatNote(note)) return
        if (opts?.sheet && !isGtSheetNote(song, track.id, note, opts.convertModel)) return
        const time = beatsToSeconds(timeBeat, song.bpm)
        if (isAudioRackNote(note)) {
          for (const slot of expandAudioRack(track, note)) {
            const slotBuf = sampleBank.getBufferForNote(slot.track, slot.note)
            if (slotBuf) {
              const source = ctx.createBufferSource()
              source.buffer = localBuf(slotBuf)
              const gain = ctx.createGain()
              gain.gain.value = Math.max(0, Math.min(1.15, slot.note.velocity / 127))
              source.connect(gain)
              gain.connect(trackGain(track.id, track.volume))
              source.start(time)
              continue
            }
            const inst = mgr.getInstrument(slot.track.id, slot.track.instrument)
            triggerOffline(inst, slot.note.pitch, slot.note.durationBeats, slot.note.velocity, time, song.bpm)
          }
          return
        }
        const buf = sampleBank.getBufferForNote(track, note)
        if (buf) {
          const source = ctx.createBufferSource()
          source.buffer = localBuf(buf)
          const gain = ctx.createGain()
          gain.gain.value = Math.max(0, Math.min(1.15, note.velocity / 127))
          source.connect(gain)
          gain.connect(trackGain(track.id, track.volume))
          source.start(time)
          return
        }
        const inst = mgr.getInstrument(track.id, track.instrument)
            triggerOffline(inst, soundingMidiForNote(note, track), note.durationBeats, note.velocity, time, song.bpm)
      }

      if (opts?.sheet && songHasRepeats(song)) {
        for (const hit of scheduleSheetNotes(song)) {
          if (!audibleIds.has(hit.track.id)) continue
          playHit(hit.track, hit.note, hit.timeBeat)
        }
      } else {
        for (const track of song.tracks) {
          if (!audibleIds.has(track.id)) continue
          for (const note of track.notes) {
            playHit(track, note, note.startBeat)
          }
        }
      }
    },
    seconds,
    2,
    sampleRate,
  )
  } finally {
    mixing = false
    clearInterval(tick)
  }
  onProgress?.(1)
  const buffer = rendered.get()
  if (!buffer) throw new Error('Offline render produced no audio')
  return buffer
}

export async function bounceSong(
  song: Song,
  format: 'mp3' | 'wav',
  opts?: BounceOpts,
  onProgress?: (progress: BounceProgress) => void,
): Promise<void> {
  const report = (ratio: number, stage: BounceStage) => {
    onProgress?.({ ratio: Math.max(0, Math.min(1, ratio)), stage })
  }
  report(0.03, 'samples')
  const buffer = await renderSongOffline(song, opts, (ratio) => {
    report(0.03 + ratio * 0.5, ratio < 0.45 ? 'samples' : 'mix')
  })
  report(0.55, 'encode')
  const channels = channelsFromAudioBuffer(buffer)
  const blob =
    format === 'mp3'
      ? await encodeMp3(channels, buffer.sampleRate, (ratio) => {
          report(0.55 + ratio * 0.43, 'encode')
        })
      : encodeWav(channels, buffer.sampleRate)
  report(1, 'encode')
  downloadBlob(blob, `${song.name}.${format}`)
}
