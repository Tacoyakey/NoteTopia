import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSong } from '../context/SongContext'
import { INSTRUMENTS, type InstrumentId } from '../music/types'
import { createTrack } from '../music/SongModel'
import { WEATHERS, getWeather } from '../world/weather'
import {
  gtFieldsForInstrument,
  getGtDefForNumType,
  sheetMusicLabel,
  sheetMusicName,
  GT_AUDIO_RACK,
  type GtVariant,
} from '../music/gtPitch'
import { AUDIO_RACK_TRACK_NAME } from '../music/audioRack'
import { listSheetMaterials } from '../music/gtSheet'
import { GT_SHEET_COLUMN_LIMIT } from '../music/convert/packSheet'
import { SheetTileIcon, type TilePreviewTrack } from './SheetTileIcon'
import { InstrumentPickerPop } from './InstrumentPickerPop'
import { AppMenu } from './AppMenu'
import { SnapSelect } from './SnapSelect'
import { WarnNote } from './WarnNote'
import { AudioLines, ChevronDown, Eye, Layers, LayoutGrid, Piano } from './icons'
import { useT } from '../i18n/LanguageProvider'
import { useStudioMode } from '../layout/useStudioMode'
import { tf } from '../i18n/i18n'
import { packSongToRacks } from '../music/packToRacks'

function WorldFoldCard({
  title,
  className,
  collapsed,
  onToggle,
  children,
  summary,
  tour,
}: {
  title: string
  className: string
  collapsed: boolean
  onToggle: () => void
  children: ReactNode
  summary?: ReactNode
  tour?: string
}) {
  const { t } = useT()
  const tip = collapsed ? t('ui.showPanel', { name: title }) : t('ui.minimizePanel', { name: title })
  return (
    <div className={`${className}${collapsed ? ' collapsed' : ''}`} data-tour={tour}>
      <div className="world-fold-head">
        <button
          type="button"
          className="world-fold-title"
          onClick={onToggle}
          aria-expanded={!collapsed}
          title={tip}
        >
          <h4>{title}</h4>
        </button>
        <div
          className="world-fold-mid"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('select, input, button, textarea, a')) return
            onToggle()
          }}
        >
          {collapsed ? summary : null}
        </div>
        <button type="button" className="world-fold-chevron-btn" onClick={onToggle} title={tip} aria-label={tip}>
          <ChevronDown size={16} className="world-fold-chevron" />
        </button>
      </div>
      <div
        className={`world-fold-body${collapsed ? ' is-collapsed' : ''}`}
        aria-hidden={collapsed}
      >
        <div className="world-fold-body-inner">{children}</div>
      </div>
    </div>
  )
}

export function WorldTrackPalette({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const { state, dispatch, pushHistory } = useSong()
  const { t } = useT()
  const { simple } = useStudioMode()
  const [pickerTrackId, setPickerTrackId] = useState<string | null>(null)
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null)
  const pickerTrack = state.song.tracks.find((track) => track.id === pickerTrackId) ?? null

  useEffect(() => {
    if (pickerTrackId && !pickerTrack) {
      setPickerTrackId(null)
      setPickerAnchor(null)
    }
  }, [pickerTrack, pickerTrackId])

  useEffect(() => {
    if (!collapsed) return
    setPickerTrackId(null)
    setPickerAnchor(null)
  }, [collapsed])

  const openPicker = (trackId: string, el: HTMLElement) => {
    dispatch({ type: 'SELECT_TRACK', trackId })
    if (pickerTrackId === trackId) {
      closePicker()
      return
    }
    setPickerTrackId(trackId)
    setPickerAnchor(el)
  }

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

  const placingRack = state.worldPlace === 'rack'
  const selectedTrack = state.song.tracks.find((track) => track.id === state.selectedTrackId)
  const activeTrack =
    placingRack || selectedTrack?.name === AUDIO_RACK_TRACK_NAME
      ? null
      : selectedTrack ?? state.song.tracks.find((track) => track.name !== AUDIO_RACK_TRACK_NAME) ?? null
  const activeName = placingRack ? t('rack.title') : activeTrack?.name
  const activeTileTrack = placingRack
    ? { instrument: 'piano' as const, gtNumType: GT_AUDIO_RACK }
    : activeTrack

  return (
    <WorldFoldCard
      className="world-palette"
      title={t('ui.placeAs')}
      collapsed={collapsed}
      onToggle={onToggle}
      tour="place-as"
      summary={
        activeName && activeTileTrack ? (
          <span className="world-fold-active">
            <span className="world-fold-active-tile">
              <SheetTileIcon track={activeTileTrack} size={18} title={activeName} />
            </span>
            <span className="world-fold-active-name">{activeName}</span>
          </span>
        ) : null
      }
    >
      <div className="world-palette-items">
        {state.song.tracks
          .filter((track) => track.name !== AUDIO_RACK_TRACK_NAME)
          .map((track) => {
            const selected = track.id === state.selectedTrackId && state.worldPlace !== 'rack'
            const inst = INSTRUMENTS.find((i) => i.id === track.instrument)
            const instLabel = sheetMusicLabel(track.gtNumType, inst?.label)
            return (
              <div
                key={track.id}
                className={`world-palette-item ${selected ? 'selected' : ''} ${track.muted ? 'muted' : ''}`}
                onClick={() => dispatch({ type: 'SELECT_TRACK', trackId: track.id })}
              >
                <button
                  type="button"
                  className={`world-palette-tile ${pickerTrackId === track.id ? 'open' : ''}`}
                  title={t('ui.changeInstrument')}
                  aria-label={t('ui.changeInstrument')}
                  aria-haspopup="listbox"
                  aria-expanded={pickerTrackId === track.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    openPicker(track.id, e.currentTarget)
                  }}
                >
                  <SheetTileIcon track={track} size={24} title={instLabel} />
                </button>
                <span className="world-palette-copy">
                  <button
                    type="button"
                    className="world-palette-name"
                    onClick={() => dispatch({ type: 'SELECT_TRACK', trackId: track.id })}
                  >
                    {track.name}
                  </button>
                  <span className="world-palette-inst">{instLabel}</span>
                </span>
              </div>
            )
          })}
        <div
          className={`world-palette-item ${state.worldPlace === 'rack' ? 'selected' : ''}`}
          role="button"
          tabIndex={0}
          aria-pressed={state.worldPlace === 'rack'}
          onClick={() => dispatch({ type: 'SET_WORLD_PLACE', place: 'rack' })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              dispatch({ type: 'SET_WORLD_PLACE', place: 'rack' })
            }
          }}
        >
          <span className="world-palette-tile" aria-hidden>
            <SheetTileIcon
              track={{ instrument: 'piano', gtNumType: GT_AUDIO_RACK }}
              size={24}
              title={t('rack.title')}
            />
          </span>
          <span className="world-palette-copy">
            <span className="world-palette-name">{t('rack.title')}</span>
            <span className="world-palette-inst">{t('rack.placeHint')}</span>
          </span>
        </div>
      </div>
      <div className="world-palette-adds">
        <button
          type="button"
          className="btn-tool world-palette-add"
          onClick={() => {
            const track = createTrack(`Track ${state.song.tracks.length + 1}`)
            pushHistory()
            dispatch({ type: 'ADD_TRACK', track })
          }}
        >
          {simple ? t('intro.addLayer') : t('ui.track')}
        </button>
        <button
          type="button"
          className="btn-tool world-palette-add"
          title={t('ui.addMidiLayersTitle')}
          data-tour="midi-layers"
          onClick={() => window.dispatchEvent(new Event('notetopia-add-midi-layers'))}
        >
          <Layers size={15} />
          {t('ui.addMidiLayers')}
        </button>
      </div>
      {simple ? <p className="world-palette-hint">{t('intro.simpleHint')}</p> : null}
      {pickerTrack ? (
        <InstrumentPickerPop
          track={pickerTrack}
          open
          anchor={pickerAnchor}
          onClose={closePicker}
          onPick={(instrument, variant) => setInstrument(pickerTrack.id, instrument, variant)}
        />
      ) : null}
    </WorldFoldCard>
  )
}

function SettingBentoTile({
  pressed,
  title,
  label,
  icon,
  onClick,
  wide,
}: {
  pressed?: boolean
  title: string
  label: string
  icon: ReactNode
  onClick: () => void
  wide?: boolean
}) {
  return (
    <button
      type="button"
      className={`setting-bento-tile${pressed ? ' is-on' : ''}${wide ? ' is-wide' : ''}`}
      aria-pressed={pressed == null ? undefined : pressed}
      title={title}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

export function WorldSettingsPanel({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const { state, dispatch, pushHistory } = useSong()
  const { t } = useT()
  const { simple } = useStudioMode()
  const ws = state.worldSettings
  const weatherId = getWeather(ws.theme).id

  const renderWeatherSelect = () => (
    <AppMenu
      label={t('ui.weather')}
      title={t('ui.weatherHint')}
      triggerClassName="weather-select"
      value={weatherId}
      items={WEATHERS.map((w) => ({
        id: w.id,
        label: tf(`weather.${w.id}`, w.label),
      }))}
      onChange={(id) =>
        dispatch({
          type: 'SET_WORLD_SETTINGS',
          settings: { theme: id as typeof ws.theme },
        })
      }
    />
  )

  const renderSolidColor = () =>
    weatherId === 'solid' ? (
      <input
        type="color"
        className="weather-color"
        aria-label={t('ui.color')}
        title={t('ui.colorHint')}
        value={ws.solidColor ?? '#1c1c28'}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) =>
          dispatch({
            type: 'SET_WORLD_SETTINGS',
            settings: { solidColor: e.target.value },
          })
        }
      />
    ) : null

  return (
    <WorldFoldCard
      className="world-settings"
      title={t('ui.world')}
      collapsed={collapsed}
      onToggle={onToggle}
      summary={
        <span className="world-fold-weather">
          <span className="world-fold-active-name">
            {tf(`weather.${weatherId}`, getWeather(ws.theme).label)}
          </span>
          {renderSolidColor()}
        </span>
      }
    >
      <label className="setting-row" title={t('ui.weatherHint')}>
        <span>{t('ui.weather')}</span>
        {renderWeatherSelect()}
      </label>
      {weatherId === 'solid' ? (
        <label className="setting-row" title={t('ui.colorHint')}>
          <span>{t('ui.color')}</span>
          {renderSolidColor()}
        </label>
      ) : null}
      <label className="setting-row" title={t('ui.zoomHint')}>
        <span>{t('ui.zoom')}</span>
        <input
          type="range"
          min={50}
          max={200}
          value={ws.zoom * 100}
          onChange={(e) =>
            dispatch({
              type: 'SET_WORLD_SETTINGS',
              settings: { zoom: parseInt(e.target.value) / 100 },
            })
          }
        />
        <span className="setting-value">{Math.round(ws.zoom * 100)}%</span>
      </label>
      <label className="setting-row" title={t('ui.snap')}>
        <span>{t('ui.snap')}</span>
        <SnapSelect />
      </label>
      <label className="setting-row" title={t('ui.songLengthHint')}>
        <span>{t('ui.songLength')}</span>
        <input
          type="number"
          min={1}
          max={16384}
          className="setting-number"
          value={ws.songLengthColumns ?? 100}
          onChange={(e) =>
            dispatch({
              type: 'SET_WORLD_SETTINGS',
              settings: {
                songLengthColumns: Math.max(1, Math.min(16384, parseInt(e.target.value, 10) || 1)),
              },
            })
          }
        />
      </label>
      <div className="setting-bento">
        <SettingBentoTile
          pressed={ws.gtGrid ?? true}
          title={t('ui.gridHint')}
          label={t('ui.grid')}
          icon={<LayoutGrid size={16} />}
          onClick={() =>
            dispatch({
              type: 'SET_WORLD_SETTINGS',
              settings: { gtGrid: !(ws.gtGrid ?? true) },
            })
          }
        />
        <SettingBentoTile
          pressed={ws.followPlayhead}
          title={t('ui.followHint')}
          label={t('ui.follow')}
          icon={<Eye size={16} />}
          onClick={() =>
            dispatch({
              type: 'SET_WORLD_SETTINGS',
              settings: { followPlayhead: !ws.followPlayhead },
            })
          }
        />
        <SettingBentoTile
          pressed={ws.useSamples ?? true}
          title={t('ui.samplesHint')}
          label={t('ui.samples')}
          icon={<AudioLines size={16} />}
          wide={simple}
          onClick={() =>
            dispatch({
              type: 'SET_WORLD_SETTINGS',
              settings: { useSamples: !(ws.useSamples ?? true) },
            })
          }
        />
        {simple ? null : (
          <SettingBentoTile
            pressed={ws.composerFollowPlayhead !== false}
            title={t('ui.composerFollowHint')}
            label={t('ui.composerFollow')}
            icon={<Piano size={16} />}
            onClick={() =>
              dispatch({
                type: 'SET_WORLD_SETTINGS',
                settings: { composerFollowPlayhead: !(ws.composerFollowPlayhead !== false) },
              })
            }
          />
        )}
        <SettingBentoTile
          title={t('ui.packToRacksHint')}
          label={t('ui.packToRacks')}
          icon={<Layers size={16} />}
          wide
          onClick={() => {
            pushHistory()
            const packed = packSongToRacks(state.song, state.worldSettings.convertModel)
            dispatch({ type: 'SET_SONG', song: packed })
            dispatch({ type: 'SELECT_TRACK', trackId: packed.tracks[0]?.id ?? '' })
          }}
        />
      </div>
    </WorldFoldCard>
  )
}

function tilePreviewForNumType(numType: number): TilePreviewTrack {
  if (numType === GT_AUDIO_RACK) return { instrument: 'piano', gtNumType: GT_AUDIO_RACK }
  const def = getGtDefForNumType(numType)
  return {
    instrument: (def?.appInstrument ?? 'piano') as InstrumentId,
    gtNumType: numType,
  }
}

export function WorldSheetBuildPanel({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const { state, dispatch } = useSong()
  const { t } = useT()
  const materials = useMemo(
    () => listSheetMaterials(state.song, state.worldSettings.convertModel),
    [state.song, state.worldSettings.convertModel],
  )
  const focus = state.focusMaterial

  useEffect(() => {
    if (focus == null) return
    if (!materials.items.some((item) => item.numType === focus)) {
      dispatch({ type: 'SET_FOCUS_MATERIAL', numType: null })
    }
  }, [dispatch, focus, materials.items])

  return (
    <WorldFoldCard
      className="world-sheet-build"
      title={t('ui.sheetList')}
      collapsed={collapsed}
      onToggle={onToggle}
      summary={
        <span className="world-fold-active">
          <span className="world-fold-active-name">
            {t('ui.sheetListTotal', { count: materials.total })}
          </span>
        </span>
      }
    >
      <p className="sheet-build-meta" title={t('ui.sheetListHint')}>
        {t('ui.sheetListMeta', { count: materials.total, cols: materials.columns })}
      </p>
      {materials.columns > GT_SHEET_COLUMN_LIMIT ? (
        <WarnNote className="sheet-build-warn">
          {t('ui.sheetListOver', { max: GT_SHEET_COLUMN_LIMIT })}
        </WarnNote>
      ) : null}
      {materials.items.length === 0 ? (
        <p className="sheet-build-empty">{t('ui.sheetListEmpty')}</p>
      ) : (
        <ul className={`sheet-build-list${focus != null ? ' is-filtering' : ''}`}>
          {materials.items.map((item) => {
            const name = sheetMusicName(item.numType)
            const solo = focus === item.numType
            return (
              <li key={item.numType} title={sheetMusicLabel(item.numType)}>
                <button
                  type="button"
                  className={`sheet-build-tile${solo ? ' is-solo' : ''}`}
                  aria-pressed={solo}
                  title={solo ? t('ui.sheetListSoloOff') : t('ui.sheetListSolo', { name })}
                  onClick={() =>
                    dispatch({
                      type: 'SET_FOCUS_MATERIAL',
                      numType: solo ? null : item.numType,
                    })
                  }
                >
                  <SheetTileIcon track={tilePreviewForNumType(item.numType)} size={18} title={name} />
                </button>
                <span className="sheet-build-name">{name}</span>
                <span className="sheet-build-count">×{item.count}</span>
              </li>
            )
          })}
        </ul>
      )}
    </WorldFoldCard>
  )
}
