import { useCallback, useEffect, useRef, useState } from 'react'
import { useToolbarFit } from '../layout/useToolbarFit'
import { useSong } from '../context/SongContext'
import { Transport, TransportLcd } from './Transport'
import { MasterVolume } from './MasterVolume'
import { CursorToolMenu } from './CursorToolMenu'
import { ComposerTools } from '../composer/ComposerTools'
import { importMidiFile } from '../music/midiImport'
import { downloadMidi, downloadProjectJson } from '../music/midiExport'
import { saveProject, listProjects, loadProject, createNewProject, deleteProject } from '../storage/projects'
import { downloadNotetopiaFile } from '../storage/notetopiaFile'
import { importGtMusicFile } from '../music/gtmusicImport'
import { downloadGmsf, downloadGtmusic, downloadLuaTxt } from '../music/gtmusicExport'
import { packSongToRacks } from '../music/packToRacks'
import { stopAndSnapToStart } from '../audio/seekPlayback'
import type { MidiImportSummary } from '../music/types'
import { APP_NAME, APP_AUTHOR, APP_STAGE } from '../branding'
import { useStudioMode } from '../layout/useStudioMode'
import { useT } from '../i18n/LanguageProvider'
import { LanguageSelect } from '../i18n/LanguageSelect'
import { songHasWork } from '../music/songWork'
import {
  AudioLines,
  AudioWaveform,
  CircleHelp,
  Download,
  FileCode,
  FileDown,
  FileJson,
  FilePlus,
  FolderOpen,
  Info,
  LayoutGrid,
  Layers,
  Megaphone,
  Music,
  Piano,
  Redo2,
  Save,
  Undo2,
  Upload,
} from './icons'

function MenuSep() {
  return <div className="menu-sep" role="separator" />
}

interface ToolbarProps {
  onImportSummary?: (summary: MidiImportSummary) => void
  onMidiImport?: (file: File) => void
  bouncing?: boolean
  onBounce?: (format: 'mp3' | 'wav') => void
}

export function Toolbar({ onImportSummary, onMidiImport, bouncing, onBounce }: ToolbarProps) {
  const { state, dispatch, undo, redo, pushHistory, canUndo, canRedo } = useSong()
  const { t, locale } = useT()
  const { simple } = useStudioMode()
  const toolbarRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileMenuRef = useRef<HTMLDivElement>(null)
  const bounceMenuRef = useRef<HTMLDivElement>(null)
  const holdExportForTour = useRef(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [showProjects, setShowProjects] = useState(false)
  const [showFileMenu, setShowFileMenu] = useState(false)
  const [showBounceMenu, setShowBounceMenu] = useState(false)
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof listProjects>>>([])
  const [newProjectPrompt, setNewProjectPrompt] = useState(false)
  const pack = useToolbarFit(toolbarRef, `${locale}:${saveStatus}:${bouncing ? 1 : 0}:${state.mode}:${simple ? 1 : 0}`)

  useEffect(() => {
    if (!showFileMenu && !showBounceMenu) return
    const onPointer = (e: PointerEvent) => {
      if (holdExportForTour.current) return
      const t = e.target as Node
      if (showFileMenu && !fileMenuRef.current?.contains(t)) setShowFileMenu(false)
      if (showBounceMenu && !bounceMenuRef.current?.contains(t)) setShowBounceMenu(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowFileMenu(false)
        setShowBounceMenu(false)
      }
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [showFileMenu, showBounceMenu])

  useEffect(() => {
    const openForTour = () => {
      holdExportForTour.current = true
      const bounceHidden =
        !bounceMenuRef.current || getComputedStyle(bounceMenuRef.current).display === 'none'
      if (bounceHidden) {
        setShowFileMenu(true)
        setShowBounceMenu(false)
      } else {
        setShowBounceMenu(true)
        setShowFileMenu(false)
      }
    }
    const closeForTour = () => {
      holdExportForTour.current = false
      setShowFileMenu(false)
      setShowBounceMenu(false)
    }
    window.addEventListener('notetopia-open-export-menu', openForTour)
    window.addEventListener('notetopia-close-export-menu', closeForTour)
    return () => {
      window.removeEventListener('notetopia-open-export-menu', openForTour)
      window.removeEventListener('notetopia-close-export-menu', closeForTour)
    }
  }, [])

  useEffect(() => {
    if (!holdExportForTour.current || (!showFileMenu && !showBounceMenu)) return
    document.querySelectorAll<HTMLElement>('[data-tour="export-gmsf"]').forEach((el) => {
      if (el.getClientRects().length > 0) el.scrollIntoView({ block: 'nearest' })
    })
  }, [showFileMenu, showBounceMenu])

  const handleFileImport = async (file: File) => {
    if (onMidiImport) {
      onMidiImport(file)
      return
    }
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.gtmusic') || lower.endsWith('.gmsf') || lower.endsWith('.gmf')) {
      try {
        const { song, summary } = await importGtMusicFile(file)
        pushHistory()
        dispatch({ type: 'SET_SONG', song })
        dispatch({ type: 'SELECT_TRACK', trackId: song.tracks[0]?.id ?? '' })
        stopAndSnapToStart(dispatch)
        onImportSummary?.({
          trackCount: summary.trackCount,
          noteCount: summary.noteCount,
          bpm: summary.bpm,
          durationBeats: summary.durationBeats,
          kind: 'gt',
        })
      } catch (err) {
        console.error('GT import failed:', err)
        alert(t('toast.gtImportFailed'))
      }
      return
    }
    if (lower.endsWith('.mid') || lower.endsWith('.midi')) {
      await handleMidiImport(file)
    }
  }

  const handleSaveAs = () => {
    downloadNotetopiaFile({
      id: state.projectId,
      name: state.song.name,
      song: state.song,
      worldSettings: state.worldSettings,
    })
    void saveProject(state.projectId, state.song.name, state.song, state.worldSettings)
    setSaveStatus(t('ui.savedAs'))
    setTimeout(() => setSaveStatus(''), 2000)
  }

  const handleMidiImport = async (file: File) => {
    if (onMidiImport) {
      onMidiImport(file)
      return
    }
    try {
      const { song, summary } = await importMidiFile(file)
      pushHistory()
      dispatch({ type: 'SET_SONG', song })
      dispatch({ type: 'SELECT_TRACK', trackId: song.tracks[0]?.id ?? '' })
      stopAndSnapToStart(dispatch)
      onImportSummary?.(summary)
    } catch (err) {
      console.error('MIDI import failed:', err)
      alert(t('toast.midiImportFailed'))
    }
  }

  const handleSave = useCallback(async () => {
    await saveProject(state.projectId, state.song.name, state.song, state.worldSettings)
    localStorage.setItem('music-world-last-project', state.projectId)
    setSaveStatus(t('ui.saved'))
    setTimeout(() => setSaveStatus(''), 2000)
  }, [state.projectId, state.song, state.worldSettings, t])

  const stopPlayback = () => {
    stopAndSnapToStart(dispatch)
  }

  const handleNewProject = async () => {
    setShowFileMenu(false)
    if (songHasWork(state.song)) {
      setNewProjectPrompt(true)
      return
    }
    await startBlankProject()
  }

  const startBlankProject = async () => {
    const project = await createNewProject()
    dispatch({
      type: 'LOAD_PROJECT',
      song: project.song,
      worldSettings: project.worldSettings,
      projectId: project.id,
    })
    stopPlayback()
  }

  const refreshProjects = async () => {
    const list = await listProjects()
    setProjects(list.reverse())
  }

  const openProjects = useCallback(async () => {
    const list = await listProjects()
    setProjects(list.reverse())
    setShowProjects(true)
  }, [])

  useEffect(() => {
    const onSave = () => {
      void handleSave()
    }
    const onOpen = () => {
      void openProjects()
    }
    window.addEventListener('music-world-save', onSave)
    window.addEventListener('music-world-open-projects', onOpen)
    return () => {
      window.removeEventListener('music-world-save', onSave)
      window.removeEventListener('music-world-open-projects', onOpen)
    }
  }, [handleSave, openProjects])

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm(t('ui.deleteProjectConfirm'))) {
      await deleteProject(id)
      await refreshProjects()
    }
  }

  const loadExisting = async (id: string) => {
    const project = await loadProject(id)
    if (project) {
      dispatch({
        type: 'LOAD_PROJECT',
        song: project.song,
        worldSettings: project.worldSettings,
        projectId: project.id,
      })
      stopPlayback()
    }
    setShowProjects(false)
  }

  const runBounce = (format: 'mp3' | 'wav') => {
    setShowBounceMenu(false)
    setShowFileMenu(false)
    onBounce?.(format)
  }

  return (
    <div
      ref={toolbarRef}
      className={`toolbar is-fitted is-stacked${pack === 'compact' ? ' is-compact' : ''}`}
    >
      <div className="toolbar-left">
        <button
          type="button"
          className="app-logo"
          title={t('ui.aboutTitle')}
          onClick={() => window.dispatchEvent(new Event('notetopia-toggle-about'))}
        >
          <span className="app-logo-copy">
            <span className="app-logo-text">{APP_NAME}</span>
            <span className="app-logo-by">
              by {APP_AUTHOR} · {APP_STAGE}
            </span>
          </span>
        </button>
        <input
          className="project-name-input"
          value={state.song.name}
          onChange={(e) => dispatch({ type: 'SET_NAME', name: e.target.value })}
        />
        {simple ? null : (
        <div className="tb-cluster mode-switch-pills" data-tour="mode-pills">
          <button
            type="button"
            className={`mode-btn ${state.mode === 'composer' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_MODE', mode: 'composer' })}
            title={t('ui.composer')}
          >
            <Piano size={15} />
            <span>{t('ui.composer')}</span>
          </button>
          <button
            type="button"
            className={`mode-btn ${state.mode === 'world' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_MODE', mode: 'world' })}
            title={t('ui.world')}
          >
            <LayoutGrid size={15} />
            <span>{t('ui.world')}</span>
          </button>
        </div>
        )}
      </div>

      <div className="toolbar-play-row">
        <div className="toolbar-center">
          <Transport />
          <TransportLcd />
          <MasterVolume />
        </div>
        <div className="toolbar-edit-tools">
          <CursorToolMenu />
          <ComposerTools />
        </div>
      </div>

      <div className={`toolbar-right${showFileMenu || showBounceMenu ? ' is-menu-open' : ''}`}>
        <div className="tb-cluster">
          <button
            className={`btn-icon-tool${canUndo ? ' is-ready' : ''}`}
            onClick={undo}
            disabled={!canUndo}
            title={t('ui.undo')}
          >
            <Undo2 size={16} />
          </button>
          <button
            className={`btn-icon-tool${canRedo ? ' is-ready' : ''}`}
            onClick={redo}
            disabled={!canRedo}
            title={t('ui.redo')}
          >
            <Redo2 size={16} />
          </button>
        </div>
        <div className="toolbar-menu" ref={fileMenuRef}>
          <button
            className={`btn-icon-tool ${showFileMenu ? 'active' : ''}`}
            onClick={() => {
              setShowFileMenu((v) => !v)
              setShowBounceMenu(false)
            }}
            title={t('ui.file')}
          >
            <FolderOpen size={16} />
            <span className="btn-icon-label">{t('ui.file')}</span>
          </button>
          {showFileMenu && (
            <div className="toolbar-menu-list" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  handleSaveAs()
                  setShowFileMenu(false)
                }}
              >
                <FileDown size={14} />
                {t('ui.saveAs')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  fileInputRef.current?.click()
                  setShowFileMenu(false)
                }}
              >
                <FolderOpen size={14} />
                {t('ui.openFile')}
              </button>
              <MenuSep />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowFileMenu(false)
                  window.dispatchEvent(new Event('notetopia-add-midi-layers'))
                }}
              >
                <Layers size={14} />
                {t('ui.addMidiLayers')}
              </button>
              <button
                type="button"
                role="menuitem"
                title={t('ui.packToRacksHint')}
                onClick={() => {
                  pushHistory()
                  const packed = packSongToRacks(state.song, state.worldSettings.convertModel)
                  dispatch({ type: 'SET_SONG', song: packed })
                  dispatch({ type: 'SELECT_TRACK', trackId: packed.tracks[0]?.id ?? '' })
                  setShowFileMenu(false)
                }}
              >
                <LayoutGrid size={14} />
                {t('ui.packToRacks')}
              </button>
              <MenuSep />
              <button
                type="button"
                role="menuitem"
                data-tour="export-gmsf"
                onClick={() => {
                  downloadGmsf(state.song, state.worldSettings.convertModel, state.worldSettings.songLengthColumns)
                  setShowFileMenu(false)
                }}
              >
                <LayoutGrid size={14} />
                {t('ui.exportGmsf')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  downloadGtmusic(state.song, state.worldSettings.convertModel)
                  setShowFileMenu(false)
                }}
              >
                <FileDown size={14} />
                {t('ui.exportGtmusic')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  downloadLuaTxt(state.song, state.worldSettings.convertModel)
                  setShowFileMenu(false)
                }}
              >
                <FileCode size={14} />
                {t('ui.exportLua')}
              </button>
              <MenuSep />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  downloadMidi(state.song)
                  setShowFileMenu(false)
                }}
              >
                <AudioLines size={14} />
                {t('ui.exportMidi')}
              </button>
              <button type="button" role="menuitem" onClick={() => runBounce('mp3')}>
                <Music size={14} />
                {t('ui.exportMp3')}
              </button>
              <button type="button" role="menuitem" onClick={() => runBounce('wav')}>
                <AudioWaveform size={14} />
                {t('ui.exportWav')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  downloadProjectJson(state.song, state.worldSettings)
                  setShowFileMenu(false)
                }}
              >
                <FileJson size={14} />
                {t('ui.exportJson')}
              </button>
              <MenuSep />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowFileMenu(false)
                  void openProjects()
                }}
              >
                <FolderOpen size={14} />
                {t('ui.loadProject')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowFileMenu(false)
                  void handleNewProject()
                }}
              >
                <FilePlus size={14} />
                {t('ui.newProject')}
              </button>
              <MenuSep />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowFileMenu(false)
                  window.dispatchEvent(new Event('notetopia-open-intro'))
                }}
              >
                <LayoutGrid size={14} />
                {t('intro.change')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowFileMenu(false)
                  window.dispatchEvent(new Event('notetopia-open-announce'))
                }}
              >
                <Megaphone size={14} />
                {t('announce.open')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowFileMenu(false)
                  window.dispatchEvent(new Event('notetopia-open-about'))
                }}
              >
                <Info size={14} />
                {t('ui.about')}
              </button>
            </div>
          )}
        </div>
        <button
          className="btn-icon-tool"
          data-tour="open"
          onClick={() => fileInputRef.current?.click()}
          title={t('ui.importTitle')}
        >
          <Upload size={16} />
          <span className="btn-icon-label">{t('ui.import')}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".notetopia,.json,.mid,.midi,.gtmusic,.gmsf,.gmf"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFileImport(file)
            e.target.value = ''
          }}
        />
        <div className="toolbar-menu toolbar-phone-hide" ref={bounceMenuRef}>
          <button
            className={`btn-icon-tool ${showBounceMenu ? 'active' : ''}`}
            disabled={bouncing}
            onClick={() => {
              setShowBounceMenu((v) => !v)
              setShowFileMenu(false)
            }}
            title={t('ui.exportTitle')}
            data-tour="export"
          >
            <Download size={16} />
            <span className="btn-icon-label">{t('ui.export')}</span>
          </button>
          {showBounceMenu && (
            <div className="toolbar-menu-list" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  handleSaveAs()
                  setShowBounceMenu(false)
                }}
              >
                <FileDown size={14} />
                {t('ui.exportNotetopia')}
              </button>
              <MenuSep />
              <button
                type="button"
                role="menuitem"
                data-tour="export-gmsf"
                onClick={() => {
                  downloadGmsf(state.song, state.worldSettings.convertModel, state.worldSettings.songLengthColumns)
                  setShowBounceMenu(false)
                }}
              >
                <LayoutGrid size={14} />
                {t('ui.exportGmsf')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  downloadGtmusic(state.song, state.worldSettings.convertModel)
                  setShowBounceMenu(false)
                }}
              >
                <FileDown size={14} />
                {t('ui.exportGtmusic')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  downloadLuaTxt(state.song, state.worldSettings.convertModel)
                  setShowBounceMenu(false)
                }}
              >
                <FileCode size={14} />
                {t('ui.exportLua')}
              </button>
              <MenuSep />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  downloadMidi(state.song)
                  setShowBounceMenu(false)
                }}
              >
                <AudioLines size={14} />
                {t('ui.exportMidi')}
              </button>
              <MenuSep />
              <button type="button" role="menuitem" onClick={() => runBounce('mp3')}>
                <Music size={14} />
                {t('ui.exportMp3')}
              </button>
              <button type="button" role="menuitem" onClick={() => runBounce('wav')}>
                <AudioWaveform size={14} />
                {t('ui.exportWav')}
              </button>
              <MenuSep />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  downloadProjectJson(state.song, state.worldSettings)
                  setShowBounceMenu(false)
                }}
              >
                <FileJson size={14} />
                {t('ui.exportJson')}
              </button>
            </div>
          )}
        </div>
        <button className="btn-tool btn-tool-primary" data-tour="save" onClick={handleSave} title={t('ui.saveTitle')}>
          <Save size={15} />
          {saveStatus || t('ui.save')}
        </button>
        <span className="toolbar-phone-hide">
          <LanguageSelect compact />
        </span>
        <button
          className="btn-icon-tool"
          title={t('ui.aboutTitle')}
          onClick={() => window.dispatchEvent(new Event('notetopia-open-about'))}
        >
          <Info size={16} />
        </button>
        <button
          className="btn-icon-tool toolbar-phone-hide"
          title={t('ui.helpTitle')}
          onClick={() => window.dispatchEvent(new Event('music-world-toggle-help'))}
        >
          <CircleHelp size={16} />
        </button>
      </div>

      {showProjects && (
        <div className="project-modal-overlay" onClick={() => setShowProjects(false)}>
          <div className="project-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('ui.loadProjectTitle')}</h3>
            {projects.length === 0 ? (
              <p className="empty-projects">{t('ui.noProjects')}</p>
            ) : (
              <ul className="project-list">
                {projects.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="project-list-open" onClick={() => void loadExisting(p.id)}>
                      <div>
                        <strong>{p.name}</strong>
                        <span>{new Date(p.updatedAt).toLocaleString()}</span>
                      </div>
                    </button>
                    <button
                      className="btn-mini btn-danger"
                      onClick={(e) => handleDeleteProject(e, p.id)}
                      title={t('ui.delete')}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button className="btn-tool" onClick={() => setShowProjects(false)}>
              {t('ui.close')}
            </button>
          </div>
        </div>
      )}

      {newProjectPrompt ? (
        <div className="project-modal-overlay" onClick={() => setNewProjectPrompt(false)}>
          <div className="project-modal new-project-prompt" onClick={(e) => e.stopPropagation()}>
            <h3>{t('ui.newProject')}</h3>
            <p className="new-project-copy">{t('ui.newProjectDirty')}</p>
            <div className="new-project-actions">
              <button
                type="button"
                className="btn-tool btn-tool-primary"
                onClick={() => {
                  handleSaveAs()
                  setNewProjectPrompt(false)
                  void startBlankProject()
                }}
              >
                {t('ui.newProjectSaveNotetopia')}
              </button>
              <button
                type="button"
                className="btn-tool"
                onClick={() => {
                  downloadGmsf(state.song, state.worldSettings.convertModel, state.worldSettings.songLengthColumns)
                  setNewProjectPrompt(false)
                  void startBlankProject()
                }}
              >
                {t('ui.newProjectSaveGmsf')}
              </button>
              <button
                type="button"
                className="btn-tool"
                onClick={() => {
                  setNewProjectPrompt(false)
                  void startBlankProject()
                }}
              >
                {t('ui.newProjectDiscard')}
              </button>
              <button type="button" className="btn-tool" onClick={() => setNewProjectPrompt(false)}>
                {t('ui.close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
