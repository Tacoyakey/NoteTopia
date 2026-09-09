import { useState, useCallback, useRef, useEffect } from 'react'
import { SongProvider, useSong } from './context/SongContext'
import { Toolbar } from './components/Toolbar'
import { WorldSettingsPanel, WorldSheetBuildPanel, WorldTrackPalette } from './components/ModeSwitch'
import { ConvertSheetOverlay, type PendingMidiConvert } from './components/ConvertSheetOverlay'
import { MidiLayerOverlay, type PendingMidiLayer } from './components/MidiLayerOverlay'
import { AnnounceOverlay } from './components/AnnounceOverlay'
import { HelpOverlay } from './components/HelpOverlay'
import { AboutOverlay } from './components/AboutOverlay'
import { TutorialOverlay } from './components/TutorialOverlay'
import { hasSeenStartTour, isAwaitingStartTour, markAwaitingStartTour, startPrimaryTour } from './tutorial/firstRun'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ArrangeView } from './composer/ArrangeView'
import { PianoRoll } from './composer/PianoRoll'
import { StatusBar } from './composer/Timeline'
import { WorldCanvas } from './world/WorldCanvas'
import { bounceSong, type BounceProgress } from './audio/bounce'
import { SplitPane } from './layout/SplitPane'
import { useLayoutPrefs } from './layout/useLayoutPrefs'
import { usePhoneLayout } from './layout/usePhoneLayout'
import { useStudioMode } from './layout/useStudioMode'
import { IntroOverlay } from './components/IntroOverlay'
import { useSwipeToDismiss } from './hooks/useSwipeToDismiss'
import { ChevronLeft, Maximize2, PanelRight } from './components/icons'
import { ProgressMeter } from './components/ProgressMeter'
import { WarnNote } from './components/WarnNote'
import { SelectionBar } from './components/SelectionBar'
import { PhoneDock } from './components/PhoneDock'
import { PhoneFloatBar } from './components/PhoneFloatBar'
import { ActionToastHost } from './components/actionToast'
import type { MidiImportSummary, Song, Track } from './music/types'
import type { ConvertModelId, ConvertStats } from './music/convert'
import { importMidiFile } from './music/midiImport'
import { importGtMusicFile } from './music/gtmusicImport'
import { appendConvertedLayers, defaultLayerInstrument } from './music/midiLayers'
import { AUDIO_RACK_TRACK_NAME } from './music/audioRack'
import { importProjectFile, saveProject } from './storage/projects'
import { looksLikeNotetopia, isNotetopiaFilename } from './storage/notetopiaFile'
import { beatsToSeconds, formatDurationClock, getSongDurationBeats } from './music/timing'
import { useKeyboardShortcuts, useAudioSync } from './hooks/useKeyboardShortcuts'
import { stopAndSnapToStart } from './audio/seekPlayback'
import { LanguageProvider, useT } from './i18n/LanguageProvider'
import { convertText } from './i18n/i18n'
import './App.css'

function ImportSummaryToast({ summary, onClose }: { summary: MidiImportSummary; onClose: () => void }) {
  const { t } = useT()
  return (
    <div className="import-toast">
      <strong>
        {t(
          summary.kind === 'gt'
            ? 'toast.gtImported'
            : summary.kind === 'layers'
              ? 'toast.midiLayersAdded'
              : summary.kind === 'project'
                ? 'toast.projectOpened'
                : 'toast.midiImported',
        )}
      </strong>
      <span>{t('toast.tracksNotes', { tracks: summary.trackCount, notes: summary.noteCount })}</span>
      <span>{t('toast.bpmBeats', { bpm: summary.bpm, beats: summary.durationBeats.toFixed(1) })}</span>
      {summary.convertTag && (
        <span>
          {t('toast.convert', { name: convertText(summary.convertTag, 'label') || summary.convertTag })}
          {summary.overlapsResolved != null
            ? ` · ${t(summary.overlapsResolved === 1 ? 'toast.overlapsOne' : 'toast.overlapsMany', { count: summary.overlapsResolved })}`
            : ''}
          {summary.convertTag && (summary.keyShift != null || summary.racksCreated != null || summary.columns != null)
            ? ` · ${t('toast.smartDetail', {
                key: summary.keyShift != null ? `${summary.keyShift > 0 ? '+' : ''}${summary.keyShift}` : '—',
                racks: summary.racksCreated ?? 0,
                columns: summary.columns ?? '—',
              })}`
            : ''}
          {summary.warning ? ` · ${t(`toast.smartWarning.${summary.warning}`)}` : ''}
        </span>
      )}
      <button onClick={onClose}>×</button>
    </div>
  )
}

function AppContent() {
  const { state, dispatch, pushHistory } = useSong()
  const { t } = useT()
  const [importSummary, setImportSummary] = useState<MidiImportSummary | null>(null)
  const [pendingMidi, setPendingMidi] = useState<PendingMidiConvert | null>(null)
  const [pendingLayers, setPendingLayers] = useState<PendingMidiLayer[] | null>(null)
  const layerInputRef = useRef<HTMLInputElement>(null)
  const [bouncing, setBouncing] = useState(false)
  const [bounceProgress, setBounceProgress] = useState<BounceProgress>({ ratio: 0, stage: 'samples' })
  const [bounceError, setBounceError] = useState<string | null>(null)
  const [bounceInfo, setBounceInfo] = useState<{ format: 'mp3' | 'wav'; seconds: number; notes: number } | null>(
    null,
  )
  const { prefs, update } = useLayoutPrefs()
  const phone = usePhoneLayout()
  const studio = useStudioMode()
  const showComposer = !studio.simple && state.mode === 'composer'
  const [worldSheetOpen, setWorldSheetOpen] = useState(false)
  const worldSheetSwipe = useSwipeToDismiss(() => setWorldSheetOpen(false))
  const [composerPane, setComposerPane] = useState<'arrange' | 'piano'>('arrange')
  const composerModeRef = useRef(state.mode)
  useKeyboardShortcuts()
  useAudioSync()

  useEffect(() => {
    if (studio.simple && state.mode === 'composer') {
      dispatch({ type: 'SET_MODE', mode: 'world' })
    }
  }, [studio.simple, state.mode, dispatch])

  useEffect(() => {
    if (!studio.chosen || hasSeenStartTour() || !isAwaitingStartTour()) return
    const id = window.setTimeout(() => startPrimaryTour(), 400)
    return () => window.clearTimeout(id)
  }, [studio.chosen])

  useEffect(() => {
    if (phone && state.mode === 'composer' && composerModeRef.current !== 'composer') {
      setComposerPane('arrange')
    }
    composerModeRef.current = state.mode
  }, [phone, state.mode])

  const selectedName = state.song.tracks.find((t) => t.id === state.selectedTrackId)?.name

  const handleBounce = useCallback(
    async (format: 'mp3' | 'wav') => {
      const notes = state.song.tracks.reduce((sum, track) => sum + track.notes.length, 0)
      const seconds = beatsToSeconds(getSongDurationBeats(state.song), state.song.bpm)
      setBounceError(null)
      setBounceInfo({ format, seconds, notes })
      setBounceProgress({ ratio: 0, stage: 'samples' })
      setBouncing(true)
      try {
        await bounceSong(
          state.song,
          format,
          {
            sheet: state.mode === 'world',
            convertModel: state.worldSettings.convertModel,
          },
          setBounceProgress,
        )
      } catch (err) {
        console.error('Export failed:', err)
        setBounceError(err instanceof Error ? err.message : t('toast.exportFailed'))
      } finally {
        setBouncing(false)
      }
    },
    [state.song, state.mode, state.worldSettings.convertModel, t],
  )

  const handleFileImport = useCallback(async (file: File) => {
    const lower = file.name.toLowerCase()
    const openProject = async () => {
      const project = await importProjectFile(file)
      await saveProject(project.id, project.name, project.song, project.worldSettings)
      dispatch({
        type: 'LOAD_PROJECT',
        song: project.song,
        worldSettings: project.worldSettings,
        projectId: project.id,
      })
      stopAndSnapToStart(dispatch)
      setImportSummary({
        trackCount: project.song.tracks.length,
        noteCount: project.song.tracks.reduce((n, track) => n + track.notes.length, 0),
        bpm: project.song.bpm,
        durationBeats: getSongDurationBeats(project.song),
        kind: 'project',
      })
    }
    try {
      if (isNotetopiaFilename(file.name) || lower.endsWith('.json')) {
        await openProject()
        return
      }
      if (lower.endsWith('.gtmusic') || lower.endsWith('.gmsf') || lower.endsWith('.gmf')) {
        const { song, summary } = await importGtMusicFile(file)
        pushHistory()
        dispatch({ type: 'SET_SONG', song })
        dispatch({ type: 'SELECT_TRACK', trackId: song.tracks[0]?.id ?? '' })
        stopAndSnapToStart(dispatch)
        setImportSummary({
          trackCount: summary.trackCount,
          noteCount: summary.noteCount,
          bpm: summary.bpm,
          durationBeats: summary.durationBeats,
          kind: 'gt',
        })
        return
      }
      if (lower.endsWith('.mid') || lower.endsWith('.midi')) {
        const { song, summary } = await importMidiFile(file)
        setPendingMidi({ song, summary })
        return
      }
      const sniff = new Uint8Array(await file.slice(0, 8).arrayBuffer())
      if (sniff[0] === 0x47 && sniff[1] === 0x4d && sniff[2] === 0x53 && sniff[3] === 0x46) {
        const { song, summary } = await importGtMusicFile(file)
        pushHistory()
        dispatch({ type: 'SET_SONG', song })
        dispatch({ type: 'SELECT_TRACK', trackId: song.tracks[0]?.id ?? '' })
        stopAndSnapToStart(dispatch)
        setImportSummary({
          trackCount: summary.trackCount,
          noteCount: summary.noteCount,
          bpm: summary.bpm,
          durationBeats: summary.durationBeats,
          kind: 'gt',
        })
        return
      }
      if (looksLikeNotetopia(sniff)) {
        await openProject()
      }
    } catch (err) {
      console.error('Import failed:', err)
      alert(t('toast.importFailed'))
    }
  }, [dispatch, pushHistory, t])

  const handleMidiConverted = useCallback(
    (payload: {
      song: Song
      modelId: ConvertModelId
      summary: MidiImportSummary
      stats: ConvertStats
    }) => {
      const { song, modelId, summary, stats } = payload
      pushHistory()
      dispatch({ type: 'SET_SONG', song })
      dispatch({ type: 'SELECT_TRACK', trackId: song.tracks[0]?.id ?? '' })
      dispatch({ type: 'SET_WORLD_SETTINGS', settings: { convertModel: modelId } })
      dispatch({ type: 'SET_MODE', mode: 'world' })
      stopAndSnapToStart(dispatch)
      setPendingMidi(null)
      setImportSummary({
        ...summary,
        noteCount: stats.notesOut,
        convertTag: modelId,
        overlapsResolved: stats.overlapsResolved,
        keyShift: stats.keyShift,
        racksCreated: stats.racksCreated,
        columns: stats.columns,
        warning: stats.warnings?.[0],
      })
    },
    [dispatch, pushHistory],
  )

  const handleLayerFiles = useCallback(async (files: FileList | File[]) => {
    const midiFiles = [...files].filter((file) => {
      const lower = file.name.toLowerCase()
      return lower.endsWith('.mid') || lower.endsWith('.midi')
    })
    if (midiFiles.length === 0) {
      alert(t('toast.midiImportFailed'))
      return
    }
    try {
      const pending: PendingMidiLayer[] = []
      for (let i = 0; i < midiFiles.length; i++) {
        const file = midiFiles[i]
        const { song, summary } = await importMidiFile(file)
        pending.push({
          id: `${file.name}:${i}:${summary.noteCount}`,
          fileName: file.name,
          song,
          summary,
          instrument: defaultLayerInstrument(song),
        })
      }
      setPendingLayers(pending)
    } catch (err) {
      console.error('MIDI layer import failed:', err)
      alert(t('toast.midiImportFailed'))
    }
  }, [t])

  const handleLayersAdded = useCallback(
    (payload: {
      tracks: Track[]
      modelId: ConvertModelId
      summary: MidiImportSummary
      stats: ConvertStats
    }) => {
      const { tracks, modelId, summary, stats } = payload
      if (tracks.length === 0) {
        setPendingLayers(null)
        alert(t('toast.midiLayersEmpty'))
        return
      }
      pushHistory()
      const song = appendConvertedLayers(state.song, tracks)
      const selected = tracks.find((track) => track.name !== AUDIO_RACK_TRACK_NAME) ?? tracks[0]
      dispatch({ type: 'SET_SONG', song })
      dispatch({ type: 'SELECT_TRACK', trackId: selected.id })
      dispatch({ type: 'SET_WORLD_SETTINGS', settings: { convertModel: modelId } })
      setPendingLayers(null)
      setImportSummary({
        ...summary,
        kind: 'layers',
        noteCount: stats.notesOut,
        convertTag: modelId,
        overlapsResolved: stats.overlapsResolved,
        keyShift: stats.keyShift,
        racksCreated: stats.racksCreated,
        columns: stats.columns,
        warning: stats.warnings?.[0],
      })
    },
    [dispatch, pushHistory, state.song, t],
  )

  useEffect(() => {
    const open = () => layerInputRef.current?.click()
    window.addEventListener('notetopia-add-midi-layers', open)
    return () => window.removeEventListener('notetopia-add-midi-layers', open)
  }, [])

  useEffect(() => {
    const openPanel = () => {
      dispatch({ type: 'SET_MODE', mode: 'world' })
      setWorldSheetOpen(true)
      update({ sidebarMin: false, paletteMin: true, settingsMin: false, sheetListMin: true })
    }
    window.addEventListener('notetopia-open-world-panel', openPanel)
    return () => window.removeEventListener('notetopia-open-world-panel', openPanel)
  }, [dispatch, update])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) void handleFileImport(file)
  }

  const worldPanels = (
    <>
      <WorldTrackPalette
        collapsed={prefs.paletteMin}
        onToggle={() => update({ paletteMin: !prefs.paletteMin })}
      />
      <WorldSettingsPanel
        collapsed={prefs.settingsMin}
        onToggle={() => update({ settingsMin: !prefs.settingsMin })}
      />
      <WorldSheetBuildPanel
        collapsed={prefs.sheetListMin}
        onToggle={() => update({ sheetListMin: !prefs.sheetListMin })}
      />
    </>
  )

  const desktopComposer = (
    <div className="daw-layout daw-split">
      <SplitPane
        axis="y"
        ratio={prefs.arrangeRatio}
        onRatio={(arrangeRatio) => update({ arrangeRatio })}
        collapsedA={prefs.arrangeMin}
        collapsedB={prefs.pianoMin}
        onToggleA={() => update({ arrangeMin: !prefs.arrangeMin })}
        onToggleB={() => update({ pianoMin: !prefs.pianoMin })}
        labelA={t('ui.arrange')}
        labelB={selectedName ? t('ui.pianoRollTrack', { name: selectedName }) : t('ui.pianoRoll')}
        first={<ArrangeView />}
        second={<PianoRoll />}
      />
      <StatusBar />
    </div>
  )

  return (
    <div className={`app${phone ? ' is-phone' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <Toolbar
        onImportSummary={setImportSummary}
        onMidiImport={handleFileImport}
        bouncing={bouncing}
        onBounce={(format) => void handleBounce(format)}
      />

      {importSummary && (
        <ImportSummaryToast summary={importSummary} onClose={() => setImportSummary(null)} />
      )}
      <ActionToastHost />
      {bounceError && (
        <div className="import-toast bounce-error">
          <strong>{t('toast.exportFailed')}</strong>
          <span>{bounceError}</span>
          <button onClick={() => setBounceError(null)}>×</button>
        </div>
      )}
      {bouncing && bounceInfo && (
        <div className="convert-overlay" aria-live="polite">
          <div className="convert-card export-mix-card">
            <h3>{t('exportMix.title')}</h3>
            <p className="export-mix-detail">
              {t('exportMix.detail', {
                format: bounceInfo.format.toUpperCase(),
                time: formatDurationClock(bounceInfo.seconds),
                notes: bounceInfo.notes,
              })}
            </p>
            {bounceInfo.seconds >= 60 || bounceInfo.notes >= 500 ? (
              <WarnNote className="export-mix-warn">
                {bounceInfo.format === 'mp3' ? t('exportMix.longMp3') : t('exportMix.longWav')}
              </WarnNote>
            ) : (
              <p className="export-mix-hint">{t('exportMix.keepOpen')}</p>
            )}
            <ProgressMeter
              percent={bounceProgress.ratio * 100}
              label={
                bounceProgress.stage === 'samples'
                  ? t('exportMix.samples')
                  : bounceProgress.stage === 'mix'
                    ? t('exportMix.mix')
                    : t('exportMix.encode')
              }
            />
          </div>
        </div>
      )}
      <div className="app-stage">
        {phone ? (
          <>
            <div className="world-layout">
              <WorldCanvas
                compactChrome
                panelOpen={worldSheetOpen && state.mode !== 'composer'}
                onTogglePanel={() => {
                  if (state.mode === 'composer') dispatch({ type: 'SET_MODE', mode: 'world' })
                  if (!worldSheetOpen) {
                    update({ paletteMin: true, settingsMin: false, sheetListMin: true })
                  }
                  setWorldSheetOpen((open) => !open)
                }}
              />
            </div>
            {showComposer && (
              <div className="phone-composer-sheet" role="dialog" aria-label={t('ui.composer')}>
                <div className="phone-composer-head">
                  <button
                    type="button"
                    className="phone-sheet-back"
                    onClick={() => dispatch({ type: 'SET_MODE', mode: 'world' })}
                    title={t('ui.backToWorld')}
                  >
                    <ChevronLeft size={20} />
                    <span>{t('ui.world')}</span>
                  </button>
                  <div className="phone-composer-tabs">
                    <button
                      type="button"
                      className={composerPane === 'arrange' ? 'active' : ''}
                      onClick={() => setComposerPane('arrange')}
                    >
                      {t('ui.arrange')}
                    </button>
                    <button
                      type="button"
                      className={composerPane === 'piano' ? 'active' : ''}
                      onClick={() => setComposerPane('piano')}
                    >
                      {t('ui.pianoRoll')}
                    </button>
                  </div>
                </div>
                <div className="phone-composer-body">
                  {composerPane === 'arrange' ? <ArrangeView /> : <PianoRoll />}
                </div>
              </div>
            )}
            {worldSheetOpen && state.mode !== 'composer' && (
              <div className="phone-sheet-backdrop" onClick={() => setWorldSheetOpen(false)}>
                <div
                  ref={worldSheetSwipe.nodeRef}
                  className="phone-world-sheet"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={worldSheetSwipe.onPointerDown}
                  onPointerMove={worldSheetSwipe.onPointerMove}
                  onPointerUp={worldSheetSwipe.onPointerUp}
                  onPointerCancel={worldSheetSwipe.onPointerUp}
                  role="dialog"
                  aria-label={t('ui.worldPanel')}
                >
                  <div className="phone-sheet-handle" />
                  <div className="phone-world-sheet-body">{worldPanels}</div>
                </div>
              </div>
            )}
          </>
        ) : showComposer ? (
          desktopComposer
        ) : (
          <div className="world-layout">
            <WorldCanvas />
            <div className="world-chrome">
              {prefs.sidebarMin ? (
                <button
                  type="button"
                  className="world-sidebar-rail"
                  title={t('ui.showWorldPanel')}
                  onClick={() => update({ sidebarMin: false })}
                >
                  <Maximize2 size={16} />
                  <span>{t('ui.world')}</span>
                </button>
              ) : (
                <div className="world-sidebar" style={{ width: prefs.sidebarWidth }}>
                  <div
                    className="world-sidebar-resizer"
                    onPointerDown={(e) => {
                      const startX = e.clientX
                      const startW = prefs.sidebarWidth
                      const move = (ev: PointerEvent) => {
                        const next = Math.max(200, Math.min(420, startW - (ev.clientX - startX)))
                        update({ sidebarWidth: next })
                      }
                      const up = () => {
                        window.removeEventListener('pointermove', move)
                        window.removeEventListener('pointerup', up)
                      }
                      window.addEventListener('pointermove', move)
                      window.addEventListener('pointerup', up)
                    }}
                  />
                  <div className="split-panel-head world-sidebar-head">
                    <span>{t('ui.world')}</span>
                    <button
                      type="button"
                      title={t('ui.minimizeWorldPanel')}
                      onClick={() => update({ sidebarMin: true })}
                    >
                      <PanelRight size={14} />
                    </button>
                  </div>
                  {worldPanels}
                </div>
              )}
            </div>
          </div>
        )}
        {phone ? (
          <div className="phone-overlays">
            <SelectionBar />
            <PhoneFloatBar />
          </div>
        ) : (
          <SelectionBar />
        )}
        <input
          ref={layerInputRef}
          type="file"
          accept=".mid,.midi"
          multiple
          hidden
          onChange={(e) => {
            const files = e.target.files
            if (files?.length) void handleLayerFiles(files)
            e.target.value = ''
          }}
        />
        <ConvertSheetOverlay
          pendingMidi={pendingMidi}
          onMidiConverted={handleMidiConverted}
          onMidiCancel={() => setPendingMidi(null)}
        />
        <MidiLayerOverlay
          pending={pendingLayers}
          existingTrackNames={state.song.tracks.map((track) => track.name)}
          onAdded={handleLayersAdded}
          onCancel={() => setPendingLayers(null)}
        />
      </div>
      {phone && <PhoneDock />}
      <HelpOverlay />
      <AboutOverlay />
      <AnnounceOverlay />
      <TutorialOverlay />
      {studio.picking ? (
        <IntroOverlay
          onChoose={(mode) => {
            const firstRun = !studio.chosen
            if (firstRun) markAwaitingStartTour()
            studio.setMode(mode)
            if (mode === 'simple') {
              dispatch({ type: 'SET_MODE', mode: 'world' })
              dispatch({ type: 'SET_WORLD_TOOL', tool: 'build' })
            }
          }}
        />
      ) : null}
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <SongProvider>
          <AppContent />
        </SongProvider>
      </LanguageProvider>
    </ErrorBoundary>
  )
}
