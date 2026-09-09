import { useEffect, useState } from 'react'
import { useSong } from '../context/SongContext'
import { TransportLcd } from './Transport'
import { MasterVolume } from './MasterVolume'
import { InstrumentPickerPop } from './InstrumentPickerPop'
import { SheetTileIcon } from './SheetTileIcon'
import { Plus, Layers } from './icons'
import { INSTRUMENTS, type InstrumentId } from '../music/types'
import { createTrack } from '../music/SongModel'
import { gtFieldsForInstrument, sheetMusicLabel, GT_AUDIO_RACK, type GtVariant } from '../music/gtPitch'
import { AUDIO_RACK_TRACK_NAME } from '../music/audioRack'
import { useT } from '../i18n/LanguageProvider'
import { ComposerTools } from '../composer/ComposerTools'
import { CursorToolMenu } from './CursorToolMenu'
import { SnapSelect } from './SnapSelect'
import { useStudioMode } from '../layout/useStudioMode'
import { usePhoneFloatOpen } from '../layout/phoneFloat'

export function PhoneFloatBar() {
  const { state } = useSong()
  const { t } = useT()
  const open = usePhoneFloatOpen()
  const composer = state.mode === 'composer'
  const build = !composer && state.worldTool === 'build'

  return (
    <div className={`phone-float-slot${open ? '' : ' is-min'}`}>
      <div className="phone-float-slot-inner">
        <div
          id="phone-float-bar"
          className={`phone-float${build ? ' is-build' : ''}${composer ? ' is-composer' : ''}`}
          role="region"
          aria-label={t('ui.phoneFloat')}
          aria-hidden={!open}
          inert={!open}
        >
          <div className="phone-float-info">
            <TransportLcd />
            <MasterVolume />
          </div>
          <div className="phone-float-extras">
            <div className="toolbar-edit-tools">
              <CursorToolMenu drop="up" />
              <ComposerTools />
            </div>
            {composer ? <PhoneComposerExtras /> : <PhoneWorldSnap />}
          </div>
          {build && <PhoneBuildStrip />}
        </div>
      </div>
    </div>
  )
}

function PhoneSnapField() {
  const { t } = useT()
  return (
    <label className="phone-float-snap">
      <span>{t('ui.snap')}</span>
      <SnapSelect triggerClassName="snap-select-trigger" />
    </label>
  )
}

function PhoneWorldSnap() {
  return <PhoneSnapField />
}

function PhoneComposerExtras() {
  const { state, dispatch } = useSong()
  const { t } = useT()
  return (
    <>
      <PhoneSnapField />
      <label className="phone-float-zoom" title={t('ui.zoomHintComposer')}>
        <span>{t('ui.zoom')}</span>
        <input
          type="range"
          min={24}
          max={120}
          value={state.zoom}
          aria-label={t('ui.zoom')}
          onChange={(e) => dispatch({ type: 'SET_ZOOM', zoom: parseInt(e.target.value) })}
        />
      </label>
    </>
  )
}

function PhoneBuildStrip() {
  const { state, dispatch, pushHistory } = useSong()
  const { t } = useT()
  const { simple } = useStudioMode()
  const [pickerTrackId, setPickerTrackId] = useState<string | null>(null)
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null)
  const pickerTrack = state.song.tracks.find((track) => track.id === pickerTrackId) ?? null
  const tracks = state.song.tracks.filter((track) => track.name !== AUDIO_RACK_TRACK_NAME)
  const rackOn = state.worldPlace === 'rack'

  useEffect(() => {
    if (pickerTrackId && !pickerTrack) {
      setPickerTrackId(null)
      setPickerAnchor(null)
    }
  }, [pickerTrack, pickerTrackId])

  const closePicker = () => {
    setPickerTrackId(null)
    setPickerAnchor(null)
  }

  const setInstrument = (trackId: string, instrument: InstrumentId, variant: GtVariant) => {
    pushHistory()
    dispatch({
      type: 'UPDATE_TRACK',
      trackId,
      updates: {
        instrument,
        ...gtFieldsForInstrument(instrument, variant),
      },
    })
    closePicker()
  }

  return (
    <div className="phone-build-strip" aria-label={t('ui.placeAs')}>
      {tracks.map((track) => {
        const selected = track.id === state.selectedTrackId && !rackOn
        const inst = INSTRUMENTS.find((i) => i.id === track.instrument)
        const instLabel = sheetMusicLabel(track.gtNumType, inst?.label)
        return (
          <button
            key={track.id}
            type="button"
            className={`phone-build-chip${selected ? ' selected' : ''}${track.muted ? ' muted' : ''}`}
            title={instLabel}
            aria-pressed={selected}
            onClick={(e) => {
              if (selected) {
                if (pickerTrackId === track.id) closePicker()
                else {
                  setPickerTrackId(track.id)
                  setPickerAnchor(e.currentTarget)
                }
                return
              }
              closePicker()
              dispatch({ type: 'SELECT_TRACK', trackId: track.id })
            }}
          >
            <SheetTileIcon track={track} size={28} title={instLabel} />
            <span>{track.name}</span>
          </button>
        )
      })}
      <button
        type="button"
        className={`phone-build-chip${rackOn ? ' selected' : ''}`}
        title={t('rack.title')}
        aria-pressed={rackOn}
        onClick={() => {
          closePicker()
          dispatch({ type: 'SET_WORLD_PLACE', place: 'rack' })
        }}
      >
        <SheetTileIcon
          track={{ instrument: 'piano', gtNumType: GT_AUDIO_RACK }}
          size={28}
          title={t('rack.title')}
        />
        <span>{t('rack.title')}</span>
      </button>
      <button
        type="button"
        className="phone-build-chip phone-build-add"
        title={t('ui.addTrack')}
        onClick={() => {
          const track = createTrack(`Track ${state.song.tracks.length + 1}`)
          pushHistory()
          dispatch({ type: 'ADD_TRACK', track })
        }}
      >
        <Plus size={22} />
        <span>{simple ? t('intro.addLayer') : t('ui.track')}</span>
      </button>
      <button
        type="button"
        className="phone-build-chip phone-build-add"
          title={t('ui.addMidiLayersTitle')}
          data-tour="midi-layers"
          onClick={() => window.dispatchEvent(new Event('notetopia-add-midi-layers'))}
      >
        <Layers size={22} />
        <span>{t('ui.midiLayer')}</span>
      </button>
      {pickerTrack ? (
        <InstrumentPickerPop
          track={pickerTrack}
          open
          anchor={pickerAnchor}
          onClose={closePicker}
          onPick={(instrument, variant) => setInstrument(pickerTrack.id, instrument, variant)}
        />
      ) : null}
    </div>
  )
}
