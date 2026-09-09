import { useEffect, useRef, useState } from 'react'
import { useSong } from '../context/SongContext'
import { audioEngine } from '../audio/AudioEngine'
import { stopAndSnapToStart } from '../audio/seekPlayback'
import { getPlayheadBeat } from '../audio/playheadBus'
import { usePlayheadBeat } from '../audio/usePlayheadBeat'
import { Pause, Play, Repeat2, SkipBack, Square } from './icons'
import { useT } from '../i18n/LanguageProvider'

const MIN_BPM = 20
const MAX_BPM = 300

export function TransportLcd() {
  const { state, dispatch, pushHistory } = useSong()
  const { t } = useT()
  const currentBeat = usePlayheadBeat(state.isPlaying, state.currentBeat)
  const beatsPerBar = state.song.timeSignature.numerator || 4
  const bar = Math.floor(currentBeat / beatsPerBar) + 1
  const beatInBar = (Math.floor(currentBeat) % beatsPerBar) + 1
  const focused = useRef(false)
  const [draft, setDraft] = useState(String(state.song.bpm))
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    if (!focused.current) {
      const next = String(state.song.bpm)
      draftRef.current = next
      setDraft(next)
    }
  }, [state.song.bpm])

  const applyBpm = (newBpm: number) => {
    if (newBpm === state.song.bpm) return
    pushHistory()
    dispatch({ type: 'SET_BPM', bpm: newBpm })
    audioEngine.updateBpm(newBpm)
    if (state.isPlaying) {
      void audioEngine.play({ ...state.song, bpm: newBpm }, getPlayheadBeat())
    }
  }

  const commitBpm = () => {
    const parsed = parseInt(draftRef.current, 10)
    if (!Number.isFinite(parsed)) {
      const fallback = String(state.song.bpm)
      draftRef.current = fallback
      setDraft(fallback)
      return
    }
    const bpm = Math.max(MIN_BPM, Math.min(MAX_BPM, parsed))
    draftRef.current = String(bpm)
    setDraft(String(bpm))
    applyBpm(bpm)
  }

  return (
    <div className="lcd" title={t('ui.playheadLcd')}>
      <div className="lcd-pos">
        <strong>{bar}</strong>
        <span>{beatInBar}</span>
      </div>
      <label className="lcd-tempo">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          aria-label={t('ui.bpm')}
          onFocus={() => {
            focused.current = true
          }}
          onChange={(e) => {
            const next = e.target.value.replace(/[^\d]/g, '')
            draftRef.current = next
            setDraft(next)
          }}
          onBlur={() => {
            focused.current = false
            commitBpm()
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            focused.current = false
            commitBpm()
            e.currentTarget.blur()
          }}
        />
        <span>BPM</span>
      </label>
      <span className="lcd-sig">
        {state.song.timeSignature.numerator}/{state.song.timeSignature.denominator}
      </span>
    </div>
  )
}

export function Transport() {
  const { state, dispatch } = useSong()
  const { t } = useT()

  const playFrom = async (beat: number) => {
    audioEngine.setLooping(state.isLooping)
    audioEngine.refreshInstruments(state.song)
    dispatch({ type: 'SET_CURRENT_BEAT', beat })
    await audioEngine.play(state.song, beat)
    dispatch({ type: 'SET_PLAYING', isPlaying: true })
  }

  const togglePlay = async () => {
    if (state.isPlaying) {
      audioEngine.pause()
      dispatch({ type: 'SET_CURRENT_BEAT', beat: getPlayheadBeat() })
      dispatch({ type: 'SET_PLAYING', isPlaying: false })
    } else {
      await playFrom(getPlayheadBeat())
    }
  }

  const stop = () => {
    stopAndSnapToStart(dispatch)
  }

  const toggleLoop = () => {
    const looping = !state.isLooping
    audioEngine.setLooping(looping)
    dispatch({ type: 'SET_LOOPING', isLooping: looping })
  }

  return (
    <div className="tb-cluster transport" role="group" aria-label={t('ui.playback')} data-tour="play">
      <button
        className="btn-transport"
        onClick={stop}
        title={state.isPlaying ? t('ui.stop') : t('ui.backToStart')}
      >
        {state.isPlaying ? <Square size={15} fill="currentColor" /> : <SkipBack size={16} fill="currentColor" />}
      </button>
      <button
        className="btn-transport btn-play"
        onClick={() => void togglePlay()}
        title={t('ui.playFromPlayhead')}
      >
        {state.isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <button
        className={`btn-transport ${state.isLooping ? 'active' : ''}`}
        onClick={toggleLoop}
        title={t('ui.loop')}
      >
        <Repeat2 size={16} />
      </button>
    </div>
  )
}
