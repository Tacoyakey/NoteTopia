import { useSong } from '../context/SongContext'
import { getPlayheadBeat } from '../audio/playheadBus'
import { ClipboardPaste, Copy, CopyPlus, Replace, Scissors, Trash2, X } from './icons'
import { useT } from '../i18n/LanguageProvider'
import { replaceSelectedWithTrack } from '../music/editTools'

export function SelectionBar() {
  const { state, dispatch, pushHistory } = useSong()
  const { t } = useT()
  const count = state.selectedNoteIds.size
  const canPaste = !!state.clipboard?.items.length
  if (count === 0 && !canPaste) return null

  const copy = () => dispatch({ type: 'COPY' })
  const cut = () => {
    if (count === 0) return
    dispatch({ type: 'COPY' })
    pushHistory()
    dispatch({ type: 'DELETE_SELECTED_NOTES' })
  }
  const paste = () => {
    if (!canPaste) return
    pushHistory()
    dispatch({ type: 'PASTE', atBeat: getPlayheadBeat() })
  }
  const duplicate = () => {
    if (count === 0) return
    pushHistory()
    dispatch({ type: 'DUPLICATE' })
  }
  const remove = () => {
    if (count === 0) return
    pushHistory()
    dispatch({ type: 'DELETE_SELECTED_NOTES' })
  }

  return (
    <div className="selection-bar" role="toolbar" aria-label={t('ui.selection')}>
      <span className="selection-bar-count">
        {count === 0 ? t('ui.clipboardReady') : t('ui.selectedCount', { count })}
      </span>
      <button type="button" className="btn-icon-tool" disabled={count === 0} onClick={copy} title={t('ui.copy')}>
        <Copy size={16} />
      </button>
      <button type="button" className="btn-icon-tool" disabled={count === 0} onClick={cut} title={t('ui.cut')}>
        <Scissors size={16} />
      </button>
      <button type="button" className="btn-icon-tool" disabled={!canPaste} onClick={paste} title={t('ui.paste')}>
        <ClipboardPaste size={16} />
      </button>
      <button
        type="button"
        className="btn-icon-tool"
        disabled={count === 0}
        onClick={duplicate}
        title={t('ui.duplicate')}
      >
        <CopyPlus size={16} />
      </button>
      <button
        type="button"
        className="btn-icon-tool"
        disabled={count === 0}
        onClick={remove}
        title={t('ui.deleteNotes')}
      >
        <Trash2 size={16} />
      </button>
      <button
        type="button"
        className="btn-icon-tool"
        disabled={count === 0 || !state.selectedTrackId}
        onClick={() => {
          const track = state.song.tracks.find((item) => item.id === state.selectedTrackId)
          if (!track || count === 0) return
          const patches = replaceSelectedWithTrack(state.song, state.selectedNoteIds, track)
          if (!patches.length) return
          pushHistory()
          dispatch({ type: 'PATCH_NOTES', patches })
        }}
        title={t('ui.replaceInstrumentHint')}
      >
        <Replace size={16} />
      </button>
      {count > 0 && (
        <button
          type="button"
          className="btn-icon-tool"
          onClick={() => dispatch({ type: 'CLEAR_SELECTION' })}
          title={t('ui.clearSelection')}
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
