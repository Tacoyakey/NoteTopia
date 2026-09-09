import * as Tone from 'tone'
import type { Note, Song, Track } from '../music/types'
import { getActiveTracks } from '../music/SongModel'
import { isGtSheetNote } from '../music/gtSheet'
import { GT_COLUMNS_PER_BEAT, soundingMidiForNote } from '../music/gtPitch'
import { getPlaybackDurationBeats } from '../music/timing'
import { pitchToFrequency } from '../music/pitchUtils'
import {
  expandSheetPlayback,
  isRepeatNote,
  sheetBeatFromWalk,
  songHasRepeats,
  scheduleSheetNotes,
} from '../music/sheetRepeats'
import { expandAudioRack, isAudioRackNote } from '../music/audioRack'
import { InstrumentManager, DrumKit } from './InstrumentManager'
import { sampleBank } from './SampleBank'
import { setPlayheadBeat } from './playheadBus'
import { getMasterInput } from './masterBus'

type BeatCallback = (beat: number) => void
type EndCallback = () => void

type PartEvent = {
  time: number
  track: Track
  pitch: number
  duration: number
  velocity: number
  note: Note
}

export class AudioEngine {
  private instrumentManager = new InstrumentManager()
  private scheduledPart: Tone.Part | null = null
  private beatCallback: BeatCallback | null = null
  private endCallback: EndCallback | null = null
  private animationFrame: number | null = null
  private beatTrackGen = 0
  private playGen = 0
  private isLooping = false
  private songDuration = 16
  private loopEndSeconds = 0
  private trackBpm = 120
  private liveRebuildTimer: ReturnType<typeof setTimeout> | null = null

  private liveSong: Song | null = null
  private sheetMode = false
  private useSamples = true
  private convertModelId: string | undefined
  private sheetWalk: number[] | null = null
  private loopStartBeat = 0
  private loopEndBeat: number | null = null
  private metronomeOn = false
  private metroSynth: Tone.MembraneSynth | null = null
  private metroEvent: number | null = null

  setUseSamples(use: boolean): void {
    this.useSamples = use
  }

  setSheetMode(sheet: boolean): void {
    this.sheetMode = sheet
  }

  setConvertModel(id: string | undefined): void {
    this.convertModelId = id
  }

  async init(): Promise<void> {
    await Tone.start()
    getMasterInput()
    await sampleBank.probe()
  }

  setBeatCallback(cb: BeatCallback): void {
    this.beatCallback = cb
  }

  setEndCallback(cb: EndCallback): void {
    this.endCallback = cb
  }

  private emitBeat(beat: number): void {
    setPlayheadBeat(beat)
    this.beatCallback?.(beat)
  }

  private collectEvents(song: Song): { events: PartEvent[]; steps: number[] | null } {
    const useWalk = this.sheetMode && songHasRepeats(song)
    const steps = useWalk ? expandSheetPlayback(song) : null
    const events: PartEvent[] = []
    if (steps) {
      for (const hit of scheduleSheetNotes(song)) {
        events.push({
          time: hit.timeBeat,
          track: hit.track,
          pitch: soundingMidiForNote(hit.note, hit.track),
          duration: hit.note.durationBeats,
          velocity: hit.note.velocity,
          note: hit.note,
        })
      }
    } else {
      for (const track of song.tracks) {
        for (const note of track.notes) {
          if (isRepeatNote(note)) continue
          events.push({
            time: note.startBeat,
            track,
            pitch: soundingMidiForNote(note, track),
            duration: note.durationBeats,
            velocity: note.velocity,
            note,
          })
        }
      }
    }
    events.sort((a, b) => a.time - b.time)
    return { events, steps }
  }

  private attachPart(song: Song, events: PartEvent[]): void {
    const bpm = song.bpm
    const beatToSeconds = (beat: number) => (beat * 60) / bpm
    const partEvents = events.map((e) => [beatToSeconds(e.time), e] as [number, PartEvent])
    this.scheduledPart = new Tone.Part((time, event) => {
      const { track, pitch, duration, velocity, note } = event as PartEvent
      const live = this.liveSong?.tracks.find((t) => t.id === track.id) ?? track
      if (!this.isLiveAudible(live.id)) return
      if (isRepeatNote(note)) return
      if (this.sheetMode && this.liveSong && !isGtSheetNote(this.liveSong, live.id, note, this.convertModelId)) {
        return
      }

      if (isAudioRackNote(note)) {
        for (const slot of expandAudioRack(live, note)) {
          if (this.useSamples && sampleBank.hasSamples()) {
            const stem = sampleBank.resolveSampleStem(slot.track, slot.note)
            if (stem && sampleBank.playCached(stem, time, slot.note.velocity / 127, live.id)) continue
          }
          this.playSynth(slot.track, slot.note.pitch, 0.25, slot.note.velocity, time, bpm)
        }
        return
      }

      const playDuration = this.sheetMode ? Math.min(duration, 0.25) : duration

      if (this.useSamples && sampleBank.hasSamples()) {
        if (sampleBank.playNote(live, note, time)) return
      }

      this.playSynth(live, pitch, playDuration, velocity, time, bpm)
    }, partEvents)

    this.scheduledPart.loop = false
    this.scheduledPart.start(0)
  }

  private applySongTiming(song: Song, steps: number[] | null): void {
    this.sheetWalk = steps
    this.trackBpm = song.bpm
    this.songDuration = steps
      ? Math.max(steps.length, 1) / GT_COLUMNS_PER_BEAT
      : getPlaybackDurationBeats(song)
    this.applyLoopToTransport(song.bpm)
  }

  setLoopRange(startBeat: number | null | undefined, endBeat: number | null | undefined): void {
    this.loopStartBeat = Math.max(0, startBeat ?? 0)
    this.loopEndBeat =
      endBeat != null && Number.isFinite(endBeat) && endBeat > this.loopStartBeat + 0.05 ? endBeat : null
    this.applyLoopToTransport(this.trackBpm)
  }

  private applyLoopToTransport(bpm: number): void {
    const start = this.loopStartBeat
    const end = this.loopEndBeat ?? this.songDuration
    this.loopEndSeconds = (Math.max(end, start + 0.25) * 60) / Math.max(1, bpm)
    Tone.Transport.bpm.value = bpm
    Tone.Transport.loop = this.isLooping
    Tone.Transport.loopStart = (start * 60) / Math.max(1, bpm)
    Tone.Transport.loopEnd = this.loopEndSeconds
  }

  scheduleSong(song: Song, startBeat = 0): void {
    this.clearSchedule()
    this.liveSong = song
    const { events, steps } = this.collectEvents(song)
    this.applySongTiming(song, steps)
    if (this.useSamples) {
      void sampleBank.preloadForSong(song.tracks)
    }
    this.attachPart(song, events)

    let transportBeat = startBeat
    if (steps && startBeat > 0) {
      const startCol = Math.round(startBeat * GT_COLUMNS_PER_BEAT)
      const found = steps.findIndex((col) => col >= startCol)
      transportBeat = (found >= 0 ? found : 0) / GT_COLUMNS_PER_BEAT
    }
    Tone.Transport.seconds = (transportBeat * 60) / song.bpm
    this.applyLiveMix()
    this.startBeatTracking(song.bpm)
  }

  /** Rebuild the scheduled part without restarting transport (live note edits). */
  private rebuildLiveSchedule(song: Song): void {
    const seconds = Tone.Transport.seconds
    this.scheduledPart?.dispose()
    this.scheduledPart = null
    const { events, steps } = this.collectEvents(song)
    this.applySongTiming(song, steps)
    this.attachPart(song, events)
    Tone.Transport.seconds = seconds
    this.applyLiveMix()
  }

  private playSynth(
    track: Track,
    pitch: number,
    duration: number,
    velocity: number,
    time: number,
    bpm: number,
  ): void {
    const inst = this.instrumentManager.getInstrument(track.id, track.instrument)
    const freq = pitchToFrequency(pitch)
    const durSeconds = (duration * 60) / bpm

    try {
      if (inst instanceof DrumKit) {
        inst.trigger(pitch, time, velocity)
      } else if (inst instanceof Tone.PluckSynth) {
        inst.triggerAttackRelease(freq, durSeconds, time, velocity / 127)
      } else if (inst instanceof Tone.MonoSynth) {
        inst.triggerAttackRelease(freq, durSeconds, time, velocity / 127)
      } else if (inst instanceof Tone.PolySynth) {
        inst.triggerAttackRelease(freq, durSeconds, time, velocity / 127)
      }
    } catch {
      /* overlapping voice — skip rather than crash playback */
    }
  }

  private startBeatTracking(bpm: number): void {
    this.stopBeatTracking()
    const gen = ++this.beatTrackGen
    const tick = () => {
      if (gen !== this.beatTrackGen) return
      if (Tone.Transport.state === 'started') {
        const seconds = Tone.Transport.seconds
        const beat = (seconds * bpm) / 60

        if (!this.isLooping && beat >= this.songDuration) {
          this.finish()
          return
        }

        this.emitBeat(this.sheetWalk ? sheetBeatFromWalk(this.sheetWalk, beat) : beat)
      }
      if (gen !== this.beatTrackGen) return
      this.animationFrame = requestAnimationFrame(tick)
    }
    this.animationFrame = requestAnimationFrame(tick)
  }

  syncLiveSong(song: Song): void {
    this.liveSong = song
    if (!this.getIsPlaying()) return
    this.applyLiveMix()
    if (this.liveRebuildTimer != null) clearTimeout(this.liveRebuildTimer)
    this.liveRebuildTimer = setTimeout(() => {
      this.liveRebuildTimer = null
      if (!this.getIsPlaying() || !this.liveSong) return
      this.rebuildLiveSchedule(this.liveSong)
    }, 60)
  }

  private isLiveAudible(trackId: string): boolean {
    const song = this.liveSong
    if (!song) return false
    return getActiveTracks(song).some((t) => t.id === trackId)
  }

  private applyLiveMix(): void {
    const song = this.liveSong
    if (!song) return
    const audible = new Set(getActiveTracks(song).map((t) => t.id))
    for (const track of song.tracks) {
      const vol = audible.has(track.id) ? track.volume : 0
      this.instrumentManager.setVolume(track.id, vol, track.instrument)
      this.instrumentManager.setPan(track.id, track.pan ?? 0)
      sampleBank.setTrackOutput(track.id, vol)
      sampleBank.setTrackPan(track.id, track.pan ?? 0)
    }
  }

  private silenceVoices(muteBuses = false): void {
    sampleBank.stopAll()
    this.instrumentManager.releaseAll()
    if (muteBuses) this.instrumentManager.muteAllBuses()
  }

  async play(song: Song, startBeat = 0): Promise<void> {
    const gen = ++this.playGen
    await this.init()
    if (gen !== this.playGen) return
    if (this.useSamples) {
      await sampleBank.preloadForSong(song.tracks)
    }
    if (gen !== this.playGen) return
    this.scheduleSong(song, startBeat)
    if (gen !== this.playGen) return
    Tone.Transport.start()
    this.syncMetronome()
  }

  pause(): void {
    this.playGen++
    Tone.Transport.pause()
    this.silenceVoices(true)
    this.stopBeatTracking()
    this.syncMetronome()
    this.emitBeat(this.getCurrentBeat(this.trackBpm))
  }

  /** Natural end: freeze the playhead and let one-shots ring. */
  finish(): void {
    this.playGen++
    Tone.Transport.pause()
    this.instrumentManager.releaseAll()
    this.stopBeatTracking()
    this.emitBeat(this.songDuration)
    this.endCallback?.()
  }

  stop(): void {
    this.playGen++
    Tone.Transport.stop()
    Tone.Transport.seconds = 0
    this.silenceVoices(true)
    this.clearSchedule()
    this.stopBeatTracking()
    this.syncMetronome()
    this.emitBeat(0)
  }

  private stopBeatTracking(): void {
    this.beatTrackGen++
    if (this.animationFrame != null) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }

  setLooping(loop: boolean): void {
    this.isLooping = loop
    this.applyLoopToTransport(this.trackBpm)
    if (this.scheduledPart) {
      this.scheduledPart.loop = false
    }
  }

  setMetronome(on: boolean): void {
    this.metronomeOn = on
    this.syncMetronome()
  }

  private syncMetronome(): void {
    if (this.metroEvent != null) {
      Tone.Transport.clear(this.metroEvent)
      this.metroEvent = null
    }
    if (!this.metronomeOn || Tone.Transport.state !== 'started') return
    if (!this.metroSynth) {
      this.metroSynth = new Tone.MembraneSynth({
        pitchDecay: 0.008,
        octaves: 4,
        envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 },
      }).connect(getMasterInput())
    }
    this.metroEvent = Tone.Transport.scheduleRepeat(
      (time) => {
        const beats = this.liveSong?.timeSignature.numerator || 4
        const beatIndex = Math.round(Tone.Transport.getTicksAtTime(time) / Tone.Transport.PPQ)
        const down = ((beatIndex % beats) + beats) % beats === 0
        this.metroSynth?.triggerAttackRelease(down ? 'C5' : 'G4', '32n', time, down ? 0.35 : 0.18)
      },
      '4n',
      0,
    )
  }

  getIsPlaying(): boolean {
    return Tone.Transport.state === 'started'
  }

  getCurrentBeat(bpm: number): number {
    const transportBeat = (Tone.Transport.seconds * bpm) / 60
    return this.sheetWalk ? sheetBeatFromWalk(this.sheetWalk, transportBeat) : transportBeat
  }

  seekToBeat(beat: number, bpm: number): void {
    let transportBeat = Math.max(0, beat)
    if (this.sheetWalk && this.sheetWalk.length > 0) {
      const col = Math.round(beat * GT_COLUMNS_PER_BEAT)
      let found = this.sheetWalk.findIndex((c) => c === col)
      if (found < 0) found = this.sheetWalk.findIndex((c) => c >= col)
      transportBeat = Math.max(0, found) / GT_COLUMNS_PER_BEAT
    }
    Tone.Transport.seconds = (transportBeat * 60) / bpm
    this.silenceVoices(false)
    this.applyLiveMix()
    this.emitBeat(this.sheetWalk ? sheetBeatFromWalk(this.sheetWalk, transportBeat) : transportBeat)
  }

  /** Audition a single note immediately (piano-roll click, etc.). */
  async previewNote(track: Track, note: Note, bpm = 120): Promise<void> {
    await this.init()
    if (isRepeatNote(note)) return
    if (this.useSamples) void sampleBank.preloadForSong([track])
    const time = Tone.now()
    if (this.useSamples && sampleBank.hasSamples()) {
      if (sampleBank.playNote(track, note, time)) return
    }
    const duration = Math.min(Math.max(note.durationBeats, 0.25), 0.5)
    this.playSynth(track, soundingMidiForNote(note, track), duration, note.velocity, time, bpm)
  }

  updateBpm(bpm: number): void {
    this.trackBpm = bpm
    Tone.Transport.bpm.value = bpm
  }

  clearSchedule(): void {
    if (this.liveRebuildTimer != null) {
      clearTimeout(this.liveRebuildTimer)
      this.liveRebuildTimer = null
    }
    this.scheduledPart?.dispose()
    this.scheduledPart = null
    this.sheetWalk = null
  }

  refreshInstruments(song: Song): void {
    this.liveSong = song
    for (const track of song.tracks) {
      this.instrumentManager.updateInstrument(track.id, track.instrument)
    }
    this.applyLiveMix()
  }

  dispose(): void {
    this.stop()
    this.instrumentManager.disposeAll()
  }
}

export const audioEngine = new AudioEngine()
