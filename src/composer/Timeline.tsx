import { useEffect, useState } from 'react'
import { useSong } from '../context/SongContext'
import { APP_CREDIT } from '../branding'
import { formatBeatTime, getSongDurationBeats } from '../music/timing'
import { sampleBank } from '../audio/SampleBank'
import { usePlayheadBeat } from '../audio/usePlayheadBeat'
import { useT } from '../i18n/LanguageProvider'
import { LANE_HEIGHT_MAX, LANE_HEIGHT_MIN } from './dawLayout'
import { SnapSelect } from '../components/SnapSelect'

export function StatusBar() {
  const { state, dispatch } = useSong()
  const { t } = useT()
  const duration = getSongDurationBeats(state.song)
  const currentBeat = usePlayheadBeat(state.isPlaying, state.currentBeat)
  const [hasSamples, setHasSamples] = useState(sampleBank.hasSamples())
  const track = state.song.tracks.find((t) => t.id === state.selectedTrackId)

  useEffect(() => {
    void sampleBank.probe().then(setHasSamples)
  }, [])

  return (
    <div className="status-bar">
      <span className="status-credit">{APP_CREDIT}</span>
      <span>
        {formatBeatTime(currentBeat, state.song.bpm)} /{' '}
        {formatBeatTime(duration, state.song.bpm)}
        {track ? `  ·  ${track.name}` : ''}
        {hasSamples ? `  ·  ${t('status.samples')}` : `  ·  ${t('status.synth')}`}
      </span>
      <div className="status-controls">
        <label title={t('ui.zoomHintComposer')}>
          {t('ui.zoom')}
          <input
            type="range"
            min={24}
            max={120}
            value={state.zoom}
            onChange={(e) => dispatch({ type: 'SET_ZOOM', zoom: parseInt(e.target.value) })}
          />
        </label>
        <label title={t('ui.lanesHint')}>
          {t('ui.lanes')}
          <input
            type="range"
            min={LANE_HEIGHT_MIN}
            max={LANE_HEIGHT_MAX}
            value={state.laneHeight}
            onChange={(e) =>
              dispatch({ type: 'SET_LANE_HEIGHT', laneHeight: parseInt(e.target.value) })
            }
          />
        </label>
        <label>
          {t('ui.snap')}
          <SnapSelect triggerClassName="snap-select-trigger" />
        </label>
      </div>
    </div>
  )
}
