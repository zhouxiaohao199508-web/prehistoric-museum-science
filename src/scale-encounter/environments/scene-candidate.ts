import {
  SCALE_ENCOUNTER_DEFINITIONS,
  type ScaleEncounterAnimalId,
} from '../../viewer/scale-encounter'

/**
 * Development-only selector for the phase-two environment comparisons. An
 * absent or invalid URL value resolves to `off`; production always selects
 * the approved default and ignores prototype query parameters.
 */
// PROTOTYPE — four environment treatments on the existing scale-encounter
// route, shareable through ?scene-variant=A|B|C|D|E. E is the accepted
// mammoth real-DEM landscape; D is the accepted coherent sky/ocean treatment.
export type ScaleEncounterSceneCandidateVariant =
  | 'off'
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'

export const SCALE_ENCOUNTER_SCENE_CANDIDATE_VARIANTS = [
  'off',
  'A',
  'B',
  'C',
  'D',
  'E',
] as const satisfies readonly ScaleEncounterSceneCandidateVariant[]

export function parseScaleEncounterSceneCandidateVariant(
  value: string | null,
  animalId?: ScaleEncounterAnimalId,
): ScaleEncounterSceneCandidateVariant {
  const parsed = SCALE_ENCOUNTER_SCENE_CANDIDATE_VARIANTS.includes(
    value as ScaleEncounterSceneCandidateVariant,
  )
    ? (value as ScaleEncounterSceneCandidateVariant)
    : 'off'
  if (
    animalId &&
    SCALE_ENCOUNTER_DEFINITIONS[animalId].environmentTheme === 'glacier'
  ) {
    return parsed === 'D' ? 'C' : parsed
  }
  return parsed === 'E' ? 'off' : parsed
}

/** Owner-approved production defaults for the four formal encounter scenes. */
export function defaultScaleEncounterSceneCandidateVariant(
  animalId: ScaleEncounterAnimalId,
): ScaleEncounterSceneCandidateVariant {
  const theme = SCALE_ENCOUNTER_DEFINITIONS[animalId].environmentTheme
  if (theme === 'glacier') return 'E'
  if (theme === 'ocean' || theme === 'sky') return 'D'
  return 'off'
}

export function sceneCandidateSupportedFor(
  animalId: ScaleEncounterAnimalId,
): boolean {
  return SCALE_ENCOUNTER_DEFINITIONS[animalId].environmentTheme !== 'forest'
}

export function sceneCandidateSemanticName(
  animalId: ScaleEncounterAnimalId,
): 'mammoth-palaeoenvironment' | 'ocean' | 'sky' | null {
  const theme = SCALE_ENCOUNTER_DEFINITIONS[animalId].environmentTheme
  if (theme === 'glacier') return 'mammoth-palaeoenvironment'
  if (theme === 'ocean') return 'ocean'
  if (theme === 'sky') return 'sky'
  return null
}
