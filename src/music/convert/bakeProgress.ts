import { collapseRepeatedSectionsAsync, compressEmptyGaps } from '../sheetRepeats'
import type { Song } from '../types'
import { usesConvertRacks } from './flags'
import { fitConvertedSheet, GT_SHEET_COLUMN_LIMIT, sheetColumnCount } from './packSheet'
import type {
  ConvertBakeOptions,
  ConvertModel,
  ConvertProgress,
  ConvertResult,
} from './types'

function waitPaint(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Runs a convert method in stages, yielding to the event loop so a progress
 * bar can track real work instead of a fake CSS animation.
 */
export async function bakeWithProgress(
  model: ConvertModel,
  song: Song,
  options: ConvertBakeOptions | undefined,
  onProgress: (progress: ConvertProgress) => void,
): Promise<ConvertResult> {
  const report = (ratio: number, stage: ConvertProgress['stage']) => {
    onProgress({ ratio: Math.max(0, Math.min(1, ratio)), stage })
  }

  const layered = usesConvertRacks(model.id)
  report(0.04, layered ? 'analyze' : 'snapping')
  await waitPaint()
  report(0.1, layered ? 'layers' : 'snapping')
  await waitPaint()
  report(0.18, layered ? 'racks' : 'snapping')
  await waitPaint()

  const result = model.bake(song, { ...options, skipFinish: true })

  report(0.42, 'repeats')
  await waitPaint()
  result.song = await collapseRepeatedSectionsAsync(result.song, (pass, max) => {
    report(0.42 + (0.4 * pass) / Math.max(1, max), 'repeats')
  })

  report(0.86, 'gaps')
  await waitPaint()
  result.song = compressEmptyGaps(result.song)

  report(0.93, 'packing')
  await waitPaint()
  result.song = fitConvertedSheet(result.song, options?.compress === true, {
    limit: options?.targetColumns ?? GT_SHEET_COLUMN_LIMIT,
    minBpm: options?.minBpm,
  })
  result.stats.notesOut = result.song.tracks.reduce((n, track) => n + track.notes.length, 0)
  result.stats.bpmOut = result.song.bpm
  result.stats.columns = sheetColumnCount(result.song)
  if (result.stats.bpmIn != null && result.song.bpm < result.stats.bpmIn) {
    const warnings = new Set(result.stats.warnings ?? [])
    warnings.add('bpm-halved')
    result.stats.warnings = [...warnings]
  }

  report(1, 'packing')
  return result
}
