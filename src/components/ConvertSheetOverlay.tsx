import { useEffect, useMemo, useState } from 'react'
import { countSharedSheetCells } from '../music/gtSheet'
import {
  DEFAULT_CONVERT_MODEL_ID,
  EXPERIMENTAL_CONVERT_ID,
  bakeWithProgress,
  getConvertModel,
  isConvertUnlocked,
  listConvertModels,
  mergeConvertPrefs,
  defaultConvertPrefs,
  prepareImportSong,
  type ConvertModelId,
  type ConvertPrefs,
  type ConvertProgress,
  type ConvertStats,
} from '../music/convert'
import { analyzeSong } from '../music/convert/smart/analyze'
import { GT_SHEET_COLUMN_LIMIT } from '../music/convert/packSheet'
import { convertText } from '../i18n/i18n'
import { useT } from '../i18n/LanguageProvider'
import { ChevronDown, CircleHelp } from './icons'
import { WarnNote } from './WarnNote'
import { ProgressMeter } from './ProgressMeter'
import { ConvertSmartOptions, smartExtraLabels } from './ConvertSmartOptions'
import type { MidiImportSummary, Song } from '../music/types'

export interface PendingMidiConvert {
  song: Song
  summary: MidiImportSummary
}

interface ConvertSheetOverlayProps {
  pendingMidi: PendingMidiConvert | null
  onMidiConverted: (payload: {
    song: Song
    modelId: ConvertModelId
    summary: MidiImportSummary
    stats: ConvertStats
  }) => void
  onMidiCancel: () => void
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

function Hint({ text }: { text: string }) {
  return (
    <span className="convert-hint" onClick={(e) => e.stopPropagation()}>
      <span className="convert-hint-btn" tabIndex={0} role="note" aria-label={text}>
        <CircleHelp size={14} strokeWidth={2} />
      </span>
      <span className="convert-hint-tip" role="tooltip">
        {text}
      </span>
    </span>
  )
}

export function ConvertSheetOverlay({
  pendingMidi,
  onMidiConverted,
  onMidiCancel,
}: ConvertSheetOverlayProps) {
  const { t } = useT()
  const [midiRun, setMidiRun] = useState(false)
  const [progress, setProgress] = useState<ConvertProgress>({ ratio: 0, stage: 'snapping' })
  const [prefs, setPrefs] = useState<ConvertPrefs>(readPrefs)
  const pendingKey = pendingMidi
    ? `${pendingMidi.song.name}:${pendingMidi.summary.noteCount}:${pendingMidi.summary.durationBeats}`
    : null
  const [seenPendingKey, setSeenPendingKey] = useState(pendingKey)

  if (pendingKey !== seenPendingKey) {
    setSeenPendingKey(pendingKey)
    if (pendingMidi) {
      setMidiRun(false)
      setProgress({ ratio: 0, stage: 'snapping' })
    }
  }

  const patchPrefs = (partial: Partial<ConvertPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...partial }))
  }

  useEffect(() => {
    writePrefs(prefs)
  }, [prefs])

  const { pickedId, compress, fitKey, preferLow, skipDrums, trimSilence, dropQuiet, advancedOpen, smart } =
    prefs
  const usingSmart = (isConvertUnlocked(pickedId) ? pickedId : DEFAULT_CONVERT_MODEL_ID) === EXPERIMENTAL_CONVERT_ID
  const prepared = useMemo(() => {
    if (!pendingMidi) return null
    const skip = usingSmart ? smart.skipDrums : skipDrums
    const trim = usingSmart ? smart.trimSilence : trimSilence
    const quiet = usingSmart ? smart.dropQuiet : dropQuiet
    if (!skip && !trim && !quiet) return pendingMidi.song
    return prepareImportSong(pendingMidi.song, {
      skipDrums: skip,
      trimSilence: trim,
      dropQuiet: quiet,
      quietThreshold: usingSmart ? smart.quietThreshold : undefined,
    })
  }, [pendingMidi, skipDrums, trimSilence, dropQuiet, usingSmart, smart])

  const overlaps = useMemo(
    () => (prepared ? countSharedSheetCells(prepared) : 0),
    [prepared],
  )
  const analysis = useMemo(
    () => (prepared && usingSmart ? analyzeSong(prepared, pendingMidi?.summary.tempoChanges ?? 1) : null),
    [prepared, usingSmart, pendingMidi],
  )

  useEffect(() => {
    if (!midiRun || !pendingMidi || !prepared) return
    const modelId = isConvertUnlocked(pickedId) ? pickedId : DEFAULT_CONVERT_MODEL_ID
    const model = getConvertModel(modelId)
    const advanced = modelId === 'v1.5-beta'
    const smartPicked = modelId === EXPERIMENTAL_CONVERT_ID
    let cancelled = false
    const run = async () => {
      setProgress({ ratio: 0, stage: 'snapping' })
      try {
        const { song, stats } = await bakeWithProgress(
          model,
          prepared,
          smartPicked
            ? {
                compress: smart.compress,
                fitKey: smart.fitKey,
                preferLow: smart.preferLow,
                smart,
                targetColumns: smart.targetColumns === 'none' ? undefined : smart.targetColumns,
                minBpm: smart.minBpm,
              }
            : {
                compress,
                fitKey: advanced && fitKey,
                preferLow: advanced && preferLow,
              },
          (next) => {
            if (!cancelled) setProgress(next)
          },
        )
        if (cancelled) return
        const warnings = [...(stats.warnings ?? [])]
        if ((pendingMidi.summary.tempoChanges ?? 1) > 1 && !warnings.includes('tempo-map')) {
          warnings.unshift('tempo-map')
        }
        onMidiConverted({
          song,
          modelId: model.id,
          summary: pendingMidi.summary,
          stats: { ...stats, warnings: warnings.length ? warnings : undefined },
        })
      } finally {
        if (!cancelled) setMidiRun(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [
    midiRun,
    pendingMidi,
    prepared,
    pickedId,
    compress,
    fitKey,
    preferLow,
    smart,
    onMidiConverted,
  ])

  useEffect(() => {
    if (!pendingMidi || midiRun) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onMidiCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingMidi, midiRun, onMidiCancel])

  if (!pendingMidi || !prepared) return null

  const models = listConvertModels()
  const effectiveId = isConvertUnlocked(pickedId) ? pickedId : DEFAULT_CONVERT_MODEL_ID
  const pickingMidi = !midiRun
  const advanced = effectiveId === 'v1.5-beta'
  const smartPicked = effectiveId === EXPERIMENTAL_CONVERT_ID
  const percent = Math.round(progress.ratio * 100)
  const statusText =
    progress.stage === 'analyze'
      ? t('convert.analyzing')
      : progress.stage === 'layers'
        ? t('convert.splitting')
        : progress.stage === 'racks'
          ? overlaps > 0
            ? t('convert.packingRacks', { count: overlaps })
            : t('convert.snapping')
          : progress.stage === 'repeats'
            ? t('convert.loopingRepeats')
            : progress.stage === 'gaps'
              ? t('convert.loopingGaps')
              : progress.stage === 'packing'
                ? t('convert.packingSheet')
                : t('convert.snapping')

  const bars = Math.max(1, Math.ceil(pendingMidi.summary.durationBeats / 4))
  const columns = Math.round(pendingMidi.summary.durationBeats * 4)
  const longSheet = columns > GT_SHEET_COLUMN_LIMIT
  const preparedNotes = prepared.tracks.reduce((n, track) => n + track.notes.length, 0)

  const extraOn: string[] = smartPicked
    ? smartExtraLabels(smart, t)
    : [
        ...(compress ? [t('convert.compress')] : []),
        ...(advanced && fitKey ? [t('convert.fitKey')] : []),
        ...(advanced && preferLow ? [t('convert.lower')] : []),
        ...(skipDrums ? [t('convert.skipDrums')] : []),
        ...(trimSilence ? [t('convert.trimSilence')] : []),
        ...(dropQuiet ? [t('convert.dropQuiet')] : []),
      ]

  return (
    <div className="convert-overlay">
      <div className={`convert-card${smartPicked ? ' is-wide' : ''}`}>
        <p className="convert-kicker">{t('convert.kicker', { name: pendingMidi.song.name })}</p>
        <h3>{pickingMidi ? t('convert.choose') : t('convert.converting')}</h3>

        {pickingMidi ? (
          <>
            <p className="convert-stats">
              {t('convert.stats', {
                tracks: pendingMidi.summary.trackCount,
                notes: pendingMidi.summary.noteCount,
                bpm: pendingMidi.summary.bpm,
                bars,
              })}
            </p>
            {overlaps > 0 && (
              <p className="convert-callout">
                {t(smartPicked ? 'convert.overlapHintSmart' : 'convert.overlapHint', { count: overlaps })}
              </p>
            )}
            {longSheet && (
              <WarnNote className="convert-callout is-warn">
                {t('convert.longSheet', { limit: GT_SHEET_COLUMN_LIMIT })}
              </WarnNote>
            )}
            {analysis && (
              <p className="convert-callout">
                {t('convert.smartPreview', {
                  key: analysis.key.name,
                  columns: analysis.columnCount,
                })}
              </p>
            )}
            {preparedNotes !== pendingMidi.summary.noteCount && (
              <p className="convert-callout">
                {t('convert.afterFilter', { notes: preparedNotes, tracks: prepared.tracks.length })}
              </p>
            )}

            <div className="convert-models" role="listbox" aria-label={t('convert.methodList')}>
              {models.map((model) => {
                const locked = !isConvertUnlocked(model.id)
                const selected = !locked && model.id === effectiveId
                const label = convertText(model.id, 'label') || model.label
                const desc = convertText(model.id, 'description') || model.description
                const hint = convertText(model.id, 'hint') || desc
                const classes = [
                  'convert-model',
                  selected ? 'selected' : '',
                  locked ? 'is-locked' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <div key={model.id} className={classes}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      aria-disabled={locked}
                      className="convert-model-pick"
                      title={locked ? t('convert.lockedHint') : undefined}
                      onClick={() => {
                        if (locked) return
                        patchPrefs({ pickedId: model.id })
                      }}
                    >
                      <span className="convert-model-label">
                        <span className="convert-model-name">
                          {label}
                          {hint ? <Hint text={hint} /> : null}
                        </span>
                        {model.recommended ? (
                          <span className="convert-rec">{t('convert.rec')}</span>
                        ) : null}
                        {model.experimental ? (
                          <span className="convert-badge">{t('convert.experimental')}</span>
                        ) : null}
                        {locked ? (
                          <span className="convert-badge is-locked">{t('convert.locked')}</span>
                        ) : null}
                      </span>
                      {desc ? <span className="convert-model-desc">{desc}</span> : null}
                    </button>
                  </div>
                )
              })}
            </div>

            <div className={`convert-advanced${advancedOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className={`convert-advanced-toggle${advancedOpen ? ' is-open' : ''}`}
                aria-expanded={advancedOpen}
                onClick={() => patchPrefs({ advancedOpen: !advancedOpen })}
              >
                <ChevronDown size={16} strokeWidth={2} />
                <span>{t('convert.advanced')}</span>
                {!advancedOpen && extraOn.length > 0 ? (
                  <span className="convert-advanced-on">{extraOn.join(' · ')}</span>
                ) : null}
              </button>
              <div className="convert-options" hidden={!advancedOpen}>
                {smartPicked ? (
                  <ConvertSmartOptions
                    smart={smart}
                    song={prepared}
                    onChange={(next) => patchPrefs({ smart: next })}
                  />
                ) : (
                  <>
                    <div className="convert-option">
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={compress}
                          onChange={(e) => patchPrefs({ compress: e.target.checked })}
                        />
                        <span>{t('convert.compress')}</span>
                      </label>
                      <Hint text={t('convert.compressHint')} />
                    </div>
                    {advanced && (
                      <>
                        <div className="convert-option">
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={fitKey}
                              onChange={(e) => patchPrefs({ fitKey: e.target.checked })}
                            />
                            <span>{t('convert.fitKey')}</span>
                          </label>
                          <Hint text={t('convert.fitKeyHint')} />
                        </div>
                        <div className="convert-option">
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={preferLow}
                              onChange={(e) => patchPrefs({ preferLow: e.target.checked })}
                            />
                            <span>{t('convert.lower')}</span>
                          </label>
                          <Hint text={t('convert.lowerHint')} />
                        </div>
                      </>
                    )}
                    <div className="convert-option">
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={skipDrums}
                          onChange={(e) => patchPrefs({ skipDrums: e.target.checked })}
                        />
                        <span>{t('convert.skipDrums')}</span>
                      </label>
                      <Hint text={t('convert.skipDrumsHint')} />
                    </div>
                    <div className="convert-option">
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={trimSilence}
                          onChange={(e) => patchPrefs({ trimSilence: e.target.checked })}
                        />
                        <span>{t('convert.trimSilence')}</span>
                      </label>
                      <Hint text={t('convert.trimSilenceHint')} />
                    </div>
                    <div className="convert-option">
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={dropQuiet}
                          onChange={(e) => patchPrefs({ dropQuiet: e.target.checked })}
                        />
                        <span>{t('convert.dropQuiet')}</span>
                      </label>
                      <Hint text={t('convert.dropQuietHint')} />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="convert-actions">
              <button type="button" className="btn-tool" onClick={onMidiCancel}>
                {t('ui.cancel')}
              </button>
              <button
                type="button"
                className="btn-tool btn-tool-primary"
                onClick={() => setMidiRun(true)}
              >
                {t('convert.run')}
              </button>
            </div>
          </>
        ) : (
          <div aria-live="polite">
            <ProgressMeter percent={percent} label={statusText} />
          </div>
        )}
      </div>
    </div>
  )
}
