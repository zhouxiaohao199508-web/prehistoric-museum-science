import { lstat } from 'node:fs/promises'
import { resolve } from 'node:path'

import { fileDigest, sha256 } from './io'
import { loadReviewContract } from './review-contract'
import type { AnimalOnboardingProfile } from './types'

/** The runtime contract is eight seconds; this only absorbs float32 encoding noise. */
export const IDLE_DURATION_SECONDS = 8
export const IDLE_DURATION_FLOAT_TOLERANCE_SECONDS = 0.00001

export function idleDurationMatchesContract(durationSeconds: number): boolean {
  return (
    Number.isFinite(durationSeconds) &&
    Math.abs(durationSeconds - IDLE_DURATION_SECONDS) <=
      IDLE_DURATION_FLOAT_TOLERANCE_SECONDS
  )
}

export interface SourceBaselineVerification {
  readonly pass: boolean
  readonly errors: readonly string[]
  readonly sourceModelPath: string
  readonly sourceModelSha256: string | null
  readonly baselineAssetSha256: string | null
  readonly reviewContractPath: string | null
}

async function nonSymlinkFile(path: string, label: string): Promise<void> {
  const entry = await lstat(path).catch(() => null)
  if (!entry?.isFile() || entry.isSymbolicLink() || entry.size <= 0) {
    throw new Error(`${label} must be a non-symlink, non-empty regular file`)
  }
}

/**
 * Re-hash the live intake source and compare it with the baseline fixed by the
 * active review contract. Paths alone are never sufficient: replacing the
 * source bytes after run initialization must reopen the model stage.
 */
export async function verifySourceBaseline(
  profile: AnimalOnboardingProfile,
  reviewContractPath: string | null,
): Promise<SourceBaselineVerification> {
  const sourceModelPath = resolve(profile.source.sourceModelPath)
  const normalizerInputPath = resolve(profile.model.inputPath)
  const contractPath =
    reviewContractPath === null ? null : resolve(reviewContractPath)
  const errors: string[] = []
  let sourceModelSha256: string | null = null
  let baselineAssetSha256: string | null = null

  if (normalizerInputPath !== sourceModelPath) {
    errors.push(
      'model input path is not the rights-verified source model path; derived inputs must be rejected until a machine-verifiable derivation chain exists',
    )
  }

  try {
    await nonSymlinkFile(sourceModelPath, 'profile source model')
    sourceModelSha256 = (await fileDigest(sourceModelPath)).sha256
  } catch (error) {
    errors.push(
      `source model cannot be verified: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (contractPath === null) {
    errors.push('active review contract path is missing')
  } else {
    try {
      await nonSymlinkFile(contractPath, 'active review contract')
      const contract = await loadReviewContract(contractPath)
      baselineAssetSha256 = contract.baselineAssetSha256
      if (contract.animalId !== profile.id) {
        errors.push('active review contract belongs to a different animal')
      }
    } catch (error) {
      errors.push(
        `active review contract cannot be verified: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  if (
    sourceModelSha256 !== null &&
    baselineAssetSha256 !== null &&
    sourceModelSha256 !== baselineAssetSha256
  ) {
    errors.push(
      'source model SHA-256 no longer matches reviewContract.baselineAssetSha256',
    )
  }

  return {
    pass: errors.length === 0,
    errors: [...new Set(errors)],
    sourceModelPath,
    sourceModelSha256,
    baselineAssetSha256,
    reviewContractPath: contractPath,
  }
}

/**
 * Hash only the fields that define the accepted model and its initial runtime
 * presentation. Later narration or derivative metadata must not invalidate a
 * model lock; changing source, science scope, model or presentation must.
 */
export function modelContractSha256(
  profile: AnimalOnboardingProfile,
): string {
  const contract = {
    schemaVersion: profile.schemaVersion,
    id: profile.id,
    source: {
      pageUrl: profile.source.pageUrl,
      licenseId: profile.source.licenseId,
      sourceModelPath: profile.source.sourceModelPath,
      evidencePaths: profile.source.evidencePaths,
    },
    science: {
      classificationLabel: profile.science.classificationLabel,
      identityScope: profile.science.identityScope,
      confidence: profile.science.confidence,
      uncertaintyNotes: profile.science.uncertaintyNotes,
    },
    model: profile.model,
    presentation: profile.presentation,
  }
  return sha256(Buffer.from(JSON.stringify(contract), 'utf8'))
}
