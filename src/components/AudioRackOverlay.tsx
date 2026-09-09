import { useEffect, useState } from 'react'
import { useSong } from '../context/SongContext'
import {
  AUDIO_RACK_MAX_NOTES,
  AUDIO_RACK_VOLUME_MAX,
  AUDIO_RACK_VOLUME_MIN,
  clampRackVolume,
  parseRackNotes,
} from '../music/audioRack'
import { Copy } from './icons'
import { useT } from '../i18n/LanguageProvider'

export interface AudioRackEditTarget {
  trackId: string
  noteId: string
}

export function AudioRackOverlay({
  target,
  onClose,
}: {
  target: AudioRackEditTarget | null
  onClose: () => void
}) {
  const { state, dispatch, pushHistory } = useSong()
  const { t } = useT()
  const track = target ? state.song.tracks.find((item) => item.id === target.trackId) : null
  const note = track?.notes.find((item) => item.id === target?.noteId)
  const rack = note?.audioRack
  const [volume, setVolume] = useState(String(rack?.volume ?? AUDIO_RACK_VOLUME_MAX))
  const [notes, setNotes] = useState(rack?.notes ?? '')

  const targetKey = target ? `${target.trackId}:${target.noteId}` : ''
  const [seenKey, setSeenKey] = useState(targetKey)
  if (targetKey !== seenKey) {
    setSeenKey(targetKey)
    setVolume(String(rack?.volume ?? AUDIO_RACK_VOLUME_MAX))
    setNotes(rack?.notes ?? '')
  }

  useEffect(() => {
    if (!target) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [target, onClose])

  if (!target || !track || !note || !rack) return null

  const parsed = parseRackNotes(notes)
  const save = () => {
    pushHistory()
    dispatch({
      type: 'UPDATE_NOTE',
      trackId: track.id,
      noteId: note.id,
      updates: {
        audioRack: {
          volume: clampRackVolume(Number(volume)),
          notes: notes.trim(),
        },
        velocity: Math.round(127 * (clampRackVolume(Number(volume)) / AUDIO_RACK_VOLUME_MAX)),
      },
    })
    onClose()
  }

  return (
    <div className="rack-overlay" onClick={onClose} role="presentation">
      <div
        className="rack-card"
        role="dialog"
        aria-labelledby="rack-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="convert-kicker">{t('rack.kicker')}</p>
        <h3 id="rack-title">{t('rack.title')}</h3>
        <p className="convert-body">{t('rack.help')}</p>
        <p className="rack-example">{t('rack.example')}</p>
        <label className="rack-field">
          <span>{t('rack.volume')}</span>
          <input
            type="number"
            min={AUDIO_RACK_VOLUME_MIN}
            max={AUDIO_RACK_VOLUME_MAX}
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
          />
        </label>
        <label className="rack-field">
          <span>{t('rack.notes')}</span>
          <span className="rack-notes-row">
            <input
              type="text"
              spellCheck={false}
              autoComplete="off"
              placeholder="PA# DB- BCb"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  save()
                }
              }}
            />
            <button
              type="button"
              className="btn-icon-tool"
              title={t('rack.copyCode')}
              onClick={() => {
                void navigator.clipboard.writeText(notes.trim())
              }}
            >
              <Copy size={14} />
            </button>
          </span>
        </label>
        <p className="rack-status">
          {t('rack.parsed', { count: parsed.length, max: AUDIO_RACK_MAX_NOTES })}
        </p>
        <div className="convert-actions">
          <button type="button" className="btn-tool" onClick={onClose}>
            {t('ui.cancel')}
          </button>
          <button type="button" className="btn-tool btn-tool-primary" onClick={save}>
            {t('rack.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
