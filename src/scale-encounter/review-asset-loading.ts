import { SCALE_ENCOUNTER_DEFINITIONS } from '../viewer/scale-encounter'
import {
  SCALE_ENCOUNTER_ENVIRONMENT_VARIANTS,
  type ScaleEncounterEnvironmentVariant,
} from '../viewer/scale-encounter-environment'
import type { ChildProfile, ScaleEncounterAnimalId } from './content'
import type { ReviewCandidateAvatarLease } from './avatar-review-candidate'
import type { ReviewCandidateEnvironmentLease } from './environment-review-candidate'
import { scaleEncounterEnvironmentThemePlanFor } from './environment-theme-registry'
import {
  defaultScaleEncounterSceneCandidateVariant,
  parseScaleEncounterSceneCandidateVariant,
  sceneCandidateSupportedFor,
  type ScaleEncounterSceneCandidateVariant,
} from './environments/scene-candidate'

interface NetworkInformationLike {
  readonly effectiveType?: string
  readonly saveData?: boolean
}

export function shouldPreloadScaleEncounterRichAssets(): boolean {
  const connection = (
    navigator as Navigator & { readonly connection?: NetworkInformationLike }
  ).connection
  return (
    !connection?.saveData &&
    !['slow-2g', '2g'].includes(connection?.effectiveType ?? '')
  )
}

export async function loadReviewCandidateAvatarLease(
  profile: ChildProfile,
  animalId: ScaleEncounterAnimalId,
  signal: AbortSignal,
): Promise<ReviewCandidateAvatarLease | null> {
  const { acquireReviewCandidateAvatarFactory } = await import(
    './avatar-review-candidate'
  )
  return acquireReviewCandidateAvatarFactory(profile, animalId, signal)
}

export function isScaleEncounterAssetAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export async function loadReviewCandidateEnvironmentLease(
  animalId: ScaleEncounterAnimalId,
  maximumTextureSize: number,
  environmentVariant: ScaleEncounterEnvironmentVariant,
): Promise<ReviewCandidateEnvironmentLease | null> {
  const definition = SCALE_ENCOUNTER_DEFINITIONS[animalId]
  const environmentThemePlan = scaleEncounterEnvironmentThemePlanFor(
    animalId,
    definition.environmentTheme,
  )
  if (environmentThemePlan.runtime.runtimeKind === 'procedural-biome') {
    const { acquireProceduralLandBiomeEnvironmentLease } = await import(
      './environments/land-biomes/load'
    )
    return acquireProceduralLandBiomeEnvironmentLease(
      environmentThemePlan.runtime.id,
      maximumTextureSize,
    )
  }
  const { acquireReviewCandidateEnvironment } = await import(
    './environment-review-candidate'
  )
  return acquireReviewCandidateEnvironment(
    animalId,
    undefined,
    maximumTextureSize,
    undefined,
    undefined,
    environmentVariant,
  )
}

export function initialScaleEncounterEnvironmentVariant(
  animalId: ScaleEncounterAnimalId,
): ScaleEncounterEnvironmentVariant {
  if (SCALE_ENCOUNTER_DEFINITIONS[animalId].environmentTheme !== 'forest') {
    return 'baseline'
  }
  if (import.meta.env.MODE === 'production') return 'production-slice'
  if (typeof window === 'undefined') return 'production-slice'
  const requested = new URLSearchParams(window.location.search).get('variant')
  return SCALE_ENCOUNTER_ENVIRONMENT_VARIANTS.includes(
    requested as ScaleEncounterEnvironmentVariant,
  )
    ? (requested as ScaleEncounterEnvironmentVariant)
    : 'production-slice'
}

export function initialScaleEncounterSceneCandidateVariant(
  animalId: ScaleEncounterAnimalId,
): ScaleEncounterSceneCandidateVariant {
  if (!sceneCandidateSupportedFor(animalId)) return 'off'
  if (import.meta.env.MODE === 'production') {
    return defaultScaleEncounterSceneCandidateVariant(animalId)
  }
  if (typeof window === 'undefined') {
    return defaultScaleEncounterSceneCandidateVariant(animalId)
  }
  const search = new URLSearchParams(window.location.search)
  return search.has('scene-variant')
    ? parseScaleEncounterSceneCandidateVariant(
        search.get('scene-variant'),
        animalId,
      )
    : defaultScaleEncounterSceneCandidateVariant(animalId)
}
