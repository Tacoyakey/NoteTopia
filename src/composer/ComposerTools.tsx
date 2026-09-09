import { useSong } from '../context/SongContext'
import { quantizeSongNotes } from '../music/quantize'
import { selectSamePitchIds, sliceSongAtBeat } from '../music/editTools'
import { getPlayheadBeat } from '../audio/playheadBus'
import { showActionToast } from '../components/actionToast'
import { Layers2, Magnet, Metronome, Music, Scissors } from '../components/icons'
import { useT } from '../i18n/LanguageProvider'

export function ComposerTools() {
  const { state, dispatch, pushHistory } = useSong()
  const { t } = useT()
  const composer = state.mode === 'composer'
  const hasNotes = state.selectedNoteIds.size > 0
  const metro = !!state.worldSettings.metronome

  const quantize = () => {
    const ids = hasNotes ? state.selectedNoteIds : null
    const patches = quantizeSongNotes(state.song, ids, state.snap, state.quantizeStrength)
    if (!patches.length) return
    pushHistory()
    dispatch({ type: 'PATCH_NOTES', patches })
    showActionToast(t('ui.quantize'))
  }

  const sliceHere = () => {
    pushHistory()
    dispatch({
      type: 'SET_SONG',
      song: sliceSongAtBeat(
        state.song,
        getPlayheadBeat(),
        hasNotes ? state.selectedNoteIds : null,
      ),
    })
    showActionToast(t('ui.sliceHere'))
  }

  const selectSame = () => {
    if (!hasNotes) return
    dispatch({
      type: 'SELECT_NOTES',
      noteIds: selectSamePitchIds(state.song, state.selectedNoteIds, true),
    })
    showActionToast(t('ui.selectSame'))
  }

  return (
    <div className="composer-tools" role="toolbar" aria-label={t('ui.editTools')}>
      <button
        type="button"
        className="btn-icon-tool"
        data-tip={`${t('ui.quantize')} (Q)`}
        aria-label={t('ui.quantize')}
        onClick={quantize}
      >
        <Magnet size={16} />
      </button>
      <button
        type="button"
        className="btn-icon-tool"
        data-tip={`${t('ui.sliceHere')} (E)`}
        aria-label={t('ui.sliceHere')}
        onClick={sliceHere}
      >
        <Scissors size={16} />
      </button>
      {composer ? (
        <>
          <button
            type="button"
            className="btn-icon-tool"
            disabled={!hasNotes}
            data-tip={`${t('ui.selectSame')} (P)`}
            aria-label={t('ui.selectSame')}
            onClick={selectSame}
          >
            <Music size={16} />
          </button>
          <button
            type="button"
            className={`btn-icon-tool${state.ghostNotes ? ' active' : ''}`}
            data-tip={`${t('ui.ghostNotes')} (G)`}
            aria-label={t('ui.ghostNotes')}
            aria-pressed={state.ghostNotes}
            onClick={() => {
              const next = !state.ghostNotes
              dispatch({ type: 'SET_GHOST_NOTES', ghostNotes: next })
              showActionToast(t(next ? 'ui.ghostNotesOn' : 'ui.ghostNotesOff'))
            }}
          >
            <Layers2 size={16} />
          </button>
        </>
      ) : null}
      <button
        type="button"
        className={`btn-icon-tool${metro ? ' active' : ''}`}
        data-tip={`${t('ui.metronome')} (U)`}
        aria-label={t('ui.metronome')}
        aria-pressed={metro}
        onClick={() => {
          const next = !metro
          dispatch({
            type: 'SET_WORLD_SETTINGS',
            settings: { metronome: next },
          })
          showActionToast(t(next ? 'ui.metronomeOn' : 'ui.metronomeOff'))
        }}
      >
        <Metronome size={16} />
      </button>
    </div>
  )
}
