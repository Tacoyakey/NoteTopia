import type { ConvertModel, ConvertModelId } from './types'
import { convertV1 } from './v1'
import { convertV15 } from './v1_5'
import { convertV3 } from './v3'

export type {
  ArrangeDecision,
  ConvertBakeOptions,
  ConvertModel,
  ConvertModelId,
  ConvertProgress,
  ConvertResult,
  ConvertStage,
  ConvertStats,
  TileOccupant,
} from './types'
export { bakeWithProgress } from './bakeProgress'
export {
  EXPERIMENTAL_CONVERT,
  EXPERIMENTAL_CONVERT_ID,
  isConvertUnlocked,
  usesConvertRacks,
} from './flags'
export { prepareImportSong, QUIET_VELOCITY, type PrepareImportOptions } from './prepareImport'
export {
  DEFAULT_SMART_OPTIONS,
  mergeSmartOptions,
  mergeConvertPrefs,
  smartPresetValues,
  withPreset,
  markCustomIfChanged,
  defaultConvertPrefs,
  type SmartOptions,
  type SmartPreset,
  type ConvertPrefs,
} from './smart/options'
export { analyzeSong } from './smart/analyze'
export { mapGmProgram } from './smart/gmMap'

/**
 * Methods shown in the MIDI convert picker. Saved songs keep their id.
 * Old "prefer louder" (`v2`) projects load as Adapt. Adapt stays listed even
 * when EXPERIMENTAL_CONVERT is false (the overlay grays it out).
 */
export const CONVERT_MODELS: readonly ConvertModel[] = [convertV1, convertV15, convertV3]

/** Default for new projects and MIDI imports. */
export const DEFAULT_CONVERT_MODEL_ID: ConvertModelId = 'v1'

export function getConvertModel(id?: ConvertModelId | null): ConvertModel {
  if (id === 'v2') return convertV3
  const found = CONVERT_MODELS.find((model) => model.id === id)
  if (found) return found
  return convertV1
}

export function listConvertModels(): readonly ConvertModel[] {
  return CONVERT_MODELS
}
