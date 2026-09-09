import { useEffect, useState } from 'react'
import {
  DEFAULT_CONVERT_MODEL_ID,
  EXPERIMENTAL_CONVERT_ID,
  getConvertModel,
  isConvertUnlocked,
  listConvertModels,
  mergeConvertPrefs,
  defaultConvertPrefs,
  type ConvertModelId,
  type ConvertPrefs,
  type ConvertProgress,
  type ConvertStats,
} from '../music/convert'
import { convertText } from '../i18n/i18n'
import { useT } from '../i18n/LanguageProvider'
import { INSTRUMENTS, type InstrumentId, type MidiImportSummary, type Song, type Track } from '../music/types'
import { gtFieldsForInstrument } from '../music/gtPitch'
import {
  convertMidiLayerAsync,
  layerAccidentalKinds,
  layerFileBaseName,
  mergeLayerStats,
  uniqueLayerName,
} from '../music/midiLayers'
import { SheetTileIcon } from './SheetTileIcon'
import { ProgressMeter } from './ProgressMeter'

export interface PendingMidiLayer {
  id: string
  fileName: string
  song: Song
  summary: MidiImportSummary
  instrument: InstrumentId
}

interface MidiLayerOverlayProps {
  pending: PendingMidiLayer[] | null
  existingTrackNames: string[]
  onAdded: (payload: {
    tracks: Track[]
    modelId: ConvertModelId
    summary: MidiImportSummary
    stats: ConvertStats
  }) => void
  onCancel: () => void
}

const PREFS_KEY = 'notetopia-convert-prefs'

function readPrefs(): ConvertPrefs {
  const fallback = defaultConvertPrefs(EXPERIMENTAL_CONVERT_ID)
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return fallback
    return mergeConvertPrefs(JSON.parse(raw), EXPERIMENTAL_CONVERT_ID)
  } catch {
    return fallback
  }
}

function writePrefs(prefs: ConvertPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* quota / private mode */
  }
}

export function MidiLayerOverlay({
  pending,
  existingTrackNames,
  onAdded,
  onCancel,
}: MidiLayerOverlayProps) {
  const { t } = useT()
  const [rows, setRows] = useState<PendingMidiLayer[]>(pending ?? [])
  const pendingKey = pending?.map((item) => item.id).join('|') ?? null
  const [seenKey, setSeenKey] = useState(pendingKey)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ConvertProgress>({ ratio: 0, stage: 'snapping' })
  const [status, setStatus] = useState('')
  const [prefs, setPrefs] = useState(readPrefs)

  if (pendingKey !== seenKey) {
    setSeenKey(pendingKey)
    setRows(pending ?? [])
    setRunning(false)
    setProgress({ ratio: 0, stage: 'snapping' })
    setStatus('')
    setPrefs(readPrefs())
  }

  useEffect(() => {
    if (!pending || running) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, running, onCancel])

  if (!pending || rows.length === 0) return null

  const setInstrument = (id: string, instrument: InstrumentId) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, instrument } : row)))
  }

  const applyAll = (instrument: InstrumentId) => {
    setRows((prev) => prev.map((row) => ({ ...row, instrument })))
  }

  const patchPrefs = (partial: Partial<ConvertPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial }
      writePrefs(next)
      return next
    })
  }

  const run = async () => {
    setRunning(true)
    setProgress({ ratio: 0, stage: 'snapping' })
    const modelId = isConvertUnlocked(prefs.pickedId) ? prefs.pickedId : DEFAULT_CONVERT_MODEL_ID
    const model = getConvertModel(modelId)
    const usingSmart = modelId === EXPERIMENTAL_CONVERT_ID
    const prepare = usingSmart
      ? {
          skipDrums: prefs.smart.skipDrums,
          trimSilence: prefs.smart.trimSilence,
          dropQuiet: prefs.smart.dropQuiet,
          quietThreshold: prefs.smart.quietThreshold,
        }
      : {
          skipDrums: prefs.skipDrums,
          trimSilence: prefs.trimSilence,
          dropQuiet: prefs.dropQuiet,
        }
    const bakeOptions = usingSmart
      ? {
          compress: prefs.smart.compress,
          fitKey: prefs.smart.fitKey,
          preferLow: prefs.smart.preferLow,
          smart: {
            ...prefs.smart,
            fallbackInstrument: rows[0]?.instrument ?? prefs.smart.fallbackInstrument,
            splitAccidentals: true,
          },
          targetColumns: prefs.smart.targetColumns === 'none' ? undefined : prefs.smart.targetColumns,
          minBpm: prefs.smart.minBpm,
        }
      : {
          compress: prefs.compress,
          fitKey: modelId === 'v1.5-beta' && prefs.fitKey,
          preferLow: modelId === 'v1.5-beta' && prefs.preferLow,
        }

    const usedNames = [...existingTrackNames]
    const tracks: Track[] = []
    const statsParts: ConvertStats[] = []
    let noteCount = 0
    let durationBeats = 0

    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const base = uniqueLayerName(usedNames, layerFileBaseName(row.fileName))
        usedNames.push(base)
        setStatus(t('midiLayer.convertingFile', { name: row.fileName, current: i + 1, total: rows.length }))
        const { song, stats } = await convertMidiLayerAsync(
          row.song,
          row.instrument,
          base,
          model,
          prepare,
          bakeOptions,
          (next) => {
            const start = i / rows.length
            setProgress({
              ...next,
              ratio: start + next.ratio / rows.length,
            })
          },
        )
        tracks.push(...song.tracks)
        statsParts.push(stats)
        noteCount += stats.notesOut
        durationBeats = Math.max(durationBeats, row.summary.durationBeats)
        for (const track of song.tracks) usedNames.push(track.name)
      }
      const stats = mergeLayerStats(statsParts)
      onAdded({
        tracks,
        modelId: model.id,
        summary: {
          trackCount: tracks.length,
          noteCount,
          bpm: rows[0]?.summary.bpm ?? 120,
          durationBeats,
          convertTag: model.id,
          overlapsResolved: stats.overlapsResolved,
          keyShift: stats.keyShift,
          racksCreated: stats.racksCreated,
          columns: stats.columns,
          warning: stats.warnings?.[0],
        },
        stats,
      })
    } catch (err) {
      console.error('MIDI layer convert failed:', err)
      alert(t('toast.midiImportFailed'))
    } finally {
      setRunning(false)
    }
  }

  const percent = Math.round(progress.ratio * 100)

  return (
    <div className="convert-overlay">
      <div className="convert-card midi-layer-card">
        <p className="convert-kicker">{t('midiLayer.kicker')}</p>
        <h3>{running ? t('midiLayer.converting') : t('midiLayer.title')}</h3>
        {running ? (
          <div aria-live="polite">
            <ProgressMeter percent={percent} label={status || t('convert.converting')} />
          </div>
        ) : (
          <>
            <p className="convert-body">{t('midiLayer.body')}</p>
            <ul className="midi-layer-files">
              {rows.map((row) => {
                const kinds = layerAccidentalKinds(row.song, row.instrument)
                const extra = [kinds.sharps && t('midiLayer.sharps'), kinds.flats && t('midiLayer.flats')].filter(
                  Boolean,
                )
                return (
                  <li key={row.id} className="midi-layer-file">
                    <div className="midi-layer-file-head">
                      <strong>{row.fileName}</strong>
                      <span>
                        {t('midiLayer.fileStats', {
                          tracks: row.summary.trackCount,
                          notes: row.summary.noteCount,
                        })}
                      </span>
                    </div>
                    {extra.length > 0 ? (
                      <p className="convert-callout">{t('midiLayer.extraLayers', { kinds: extra.join(', ') })}</p>
                    ) : (
                      <p className="midi-layer-file-hint">{t('midiLayer.noAccidentals')}</p>
                    )}
                    <div className="midi-layer-instruments" role="listbox" aria-label={t('midiLayer.chooseInstrument')}>
                      {INSTRUMENTS.map((inst) => {
                        const fields = gtFieldsForInstrument(inst.id)
                        const selected = row.instrument === inst.id
                        const label = t(`instruments.${inst.id}`)
                        return (
                          <button
                            key={inst.id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className={`instrument-pop-choice${selected ? ' selected' : ''}`}
                            title={label}
                            onClick={() => setInstrument(row.id, inst.id)}
                          >
                            <SheetTileIcon track={{ instrument: inst.id, ...fields }} size={24} title={label} />
                            <span>{label}</span>
                          </button>
                        )
                      })}
                    </div>
                    {rows.length > 1 ? (
                      <button
                        type="button"
                        className="midi-layer-apply-all"
                        onClick={() => applyAll(row.instrument)}
                      >
                        {t('midiLayer.applyAll')}
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            <div className="convert-models midi-layer-models" role="listbox" aria-label={t('convert.methodList')}>
              {listConvertModels().map((model) => {
                const locked = !isConvertUnlocked(model.id)
                const selected = !locked && model.id === (isConvertUnlocked(prefs.pickedId) ? prefs.pickedId : DEFAULT_CONVERT_MODEL_ID)
                const label = convertText(model.id, 'label') || model.label
                return (
                  <div key={model.id} className={`convert-model${selected ? ' selected' : ''}${locked ? ' is-locked' : ''}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      aria-disabled={locked}
                      className="convert-model-pick"
                      disabled={locked}
                      onClick={() => {
                        if (locked) return
                        patchPrefs({ pickedId: model.id })
                      }}
                    >
                      <span className="convert-model-name">{label}</span>
                    </button>
                  </div>
                )
              })}
            </div>
            <label className="checkbox-row midi-layer-skip-drums">
              <input
                type="checkbox"
                checked={prefs.pickedId === EXPERIMENTAL_CONVERT_ID ? prefs.smart.skipDrums : prefs.skipDrums}
                onChange={(e) => {
                  const checked = e.target.checked
                  if (prefs.pickedId === EXPERIMENTAL_CONVERT_ID) {
                    patchPrefs({ smart: { ...prefs.smart, skipDrums: checked } })
                  } else {
                    patchPrefs({ skipDrums: checked })
                  }
                }}
              />
              <span>{t('convert.skipDrums')}</span>
            </label>
            <div className="convert-actions">
              <button type="button" className="btn-tool" onClick={onCancel}>
                {t('ui.cancel')}
              </button>
              <button type="button" className="btn-tool btn-tool-primary" onClick={() => void run()}>
                {t('midiLayer.add')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

