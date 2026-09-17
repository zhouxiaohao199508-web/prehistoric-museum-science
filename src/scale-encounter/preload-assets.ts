import type { ChildProfile, ScaleEncounterAnimalId } from './content'
import type { ReviewCandidateAvatarLease } from './avatar-review-candidate'
import type { ReviewCandidateEnvironmentLease } from './environment-review-candidate'
import {
  initialScaleEncounterEnvironmentVariant,
  initialScaleEncounterSceneCandidateVariant,
  loadReviewCandidateAvatarLease,
  loadReviewCandidateEnvironmentLease,
  shouldPreloadScaleEncounterRichAssets,
} from './review-asset-loading'

export interface DirectScaleEncounterPreloadOptions {
  readonly animalId: ScaleEncounterAnimalId
  readonly maximumTextureSize: number
  readonly profile: ChildProfile | null
  readonly signal: AbortSignal
}

/**
 * Warms only the current encounter target. Leases are released immediately;
 * their bounded source caches keep the decoded package available for the
 * component to acquire without loading any other animal or environment.
 */
export async function preloadDirectScaleEncounterAssets({
  animalId,
  maximumTextureSize,
  profile,
  signal,
}: DirectScaleEncounterPreloadOptions): Promise<void> {
  if (
    signal.aborted ||
    !shouldPreloadScaleEncounterRichAssets()
  ) {
    return
  }
  const sceneCandidateVariant =
    initialScaleEncounterSceneCandidateVariant(animalId)
  const environmentVariant =
    initialScaleEncounterEnvironmentVariant(animalId)
  const requests: Array<
    Promise<ReviewCandidateAvatarLease | ReviewCandidateEnvironmentLease | null>
  > = []
  if (profile) {
    requests.push(
      loadReviewCandidateAvatarLease(profile, animalId, signal),
    )
  }
  if (sceneCandidateVariant === 'off') {
    requests.push(
      loadReviewCandidateEnvironmentLease(
        animalId,
        maximumTextureSize,
        environmentVariant,
      ),
    )
  }
  const results = await Promise.allSettled(requests)
  for (const result of results) {
    if (result.status === 'fulfilled') result.value?.release()
  }
}
