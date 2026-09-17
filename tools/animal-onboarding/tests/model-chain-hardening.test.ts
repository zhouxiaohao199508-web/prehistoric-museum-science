import { mkdir, mkdtemp, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { processingStrategyRiskErrors } from '../src/gates'
import {
  keyModelEvidenceBindingErrors,
  keyModelEvidenceDigests,
  parseModelLockRecord,
} from '../src/model-lock'
import {
  parseQaReport,
  qaDecisionSha256,
  qaReportIntegrityErrors,
} from '../src/qa'
import type {
  PersistedAssetRiskRouteVerification,
  PlannedAssetOperation,
} from '../src/risk-routing'
import type { AnimalOnboardingProfile, QaReport } from '../src/types'

function profile(
  root: string,
  strategy: AnimalOnboardingProfile['model']['normalizationStrategy'] =
    'replace-with-project-morph',
): AnimalOnboardingProfile {
  return {
    id: 'microraptor',
    runDirectory: root,
    science: { confidence: 'high' },
    assets: { narration: {} },
    model: {
      inputPath: join(root, 'source.glb'),
      outputPath: join(root, 'model.glb'),
      normalizationLogPath: join(root, 'normalization.json'),
      normalizedBlendPath: join(root, 'normalized.blend'),
      landmarksPath: join(root, 'landmarks.json'),
      normalizationStrategy: strategy,
      animationStrategy: {
        mode: strategy,
        sourceArmature:
          strategy === 'preserve-source-rig-retime' ? 'present' : 'absent',
        sourceAnimation:
          strategy === 'preserve-source-rig-retime' ? 'present' : 'absent',
        destructiveReplacementAccepted: false,
        reason: 'Test strategy.',
      },
      habitat: 'air',
      mouthMotion: { mode: 'disabled', reason: 'Test fixture.' },
    },
  } as AnimalOnboardingProfile
}

function modelQa(profilePath: string, generatedAt: string): QaReport {
  return {
    schemaVersion: 1,
    animalId: 'microraptor',
    generatedAt,
    profilePath,
    profileSha256: 'a'.repeat(64),
    automatedPass: true,
    localDraftReady: false,
    ownerApproved: false,
    counts: { hardFailures: 0, warnings: 0, pendingHumanOnly: 0 },
    gates: [],
    artifacts: { normalizationLog: '/tmp/normalization.json' },
  }
}

function verifiedRoute(
  operations: readonly PlannedAssetOperation[],
): PersistedAssetRiskRouteVerification {
  return {
    pass: true,
    errors: [],
    inspection: { plannedOperations: operations },
    currentRoute: {
      classification: 'L3',
      underlyingRiskLevel: 'L3',
      canStart: true,
      controlBindings: {
        l3AcceptedBy: 'Leon',
        l3AcceptedOn: '2026-08-31',
        l3AcceptanceRecordPath: '/tmp/l3-acceptance.json',
        l3AcceptanceRecordSha256: 'a'.repeat(64),
        l3AcceptedReviewContractSha256: 'b'.repeat(64),
      },
    },
  } as unknown as PersistedAssetRiskRouteVerification
}

describe('owner model QA integrity', () => {
  it('rejects pass-shaped partial QA and requires the complete model-only gate set', () => {
    expect(() =>
      parseQaReport({
        schemaVersion: 1,
        animalId: 'microraptor',
        profilePath: '/tmp/profile.json',
        automatedPass: true,
      }),
    ).toThrow(/generatedAt is required/)

    const report = modelQa(
      '/tmp/profile.json',
      '2026-08-31T00:00:00.000Z',
    )
    const errors = qaReportIntegrityErrors(
      profile('/tmp/run'),
      parseQaReport(report),
      false,
    )
    expect(errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/missing required QA gates/)]),
    )
    expect(
      qaReportIntegrityErrors(profile('/tmp/run'), report, true).join('\n'),
    ).toMatch(/risk-evidence-completion/)
  })

  it('uses a stable decision digest that excludes only generation time', () => {
    const first = modelQa('/tmp/profile.json', '2026-08-31T00:00:00.000Z')
    const second = modelQa('/tmp/profile.json', '2026-08-31T00:00:01.000Z')
    expect(qaDecisionSha256(first)).toBe(qaDecisionSha256(second))
    expect(
      qaDecisionSha256({ ...second, automatedPass: false }),
    ).not.toBe(qaDecisionSha256(first))
  })

  it('invalidates normalization, blend, landmarks and validator evidence changes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'model-qa-evidence-'))
    await mkdir(root, { recursive: true })
    const candidate = profile(root)
    for (const [path, bytes] of [
      [candidate.model.normalizationLogPath, 'normalization-v1'],
      [candidate.model.normalizedBlendPath, 'blend-v1'],
      [candidate.model.landmarksPath, 'landmarks-v1'],
      [join(root, 'glb-validator.json'), 'validator-v1'],
    ] as const) {
      await writeFile(path, bytes)
    }
    const locked = await keyModelEvidenceDigests(candidate)
    expect(locked.errors).toEqual([])
    const lock = {
      normalizationLogSha256: locked.normalizationLogSha256!,
      normalizedBlendSha256: locked.normalizedBlendSha256!,
      landmarksSha256: locked.landmarksSha256!,
      glbValidatorSha256: locked.glbValidatorSha256!,
    }

    await writeFile(candidate.model.normalizationLogPath, 'normalization-v2')
    await unlink(candidate.model.normalizedBlendPath)
    await writeFile(candidate.model.landmarksPath, 'landmarks-v2')
    const current = await keyModelEvidenceDigests(candidate)
    expect(current.errors.join('\n')).toMatch(/normalized Blender file/)
    expect(keyModelEvidenceBindingErrors(lock, current)).toEqual(
      expect.arrayContaining([
        'model lock normalization log hash is stale',
        'model lock normalized Blender file hash is stale',
        'model lock landmarks hash is stale',
      ]),
    )
  })
})

describe('processing strategy and verified risk route', () => {
  it('requires preserve-source-rig-retime to bind both operations and an accepted L3 route', () => {
    const candidate = profile('/tmp/run', 'preserve-source-rig-retime')
    expect(
      processingStrategyRiskErrors(
        candidate,
        verifiedRoute(['animation-retime', 'source-rig-animation']),
      ),
    ).toEqual([])

    const wrong = verifiedRoute(['animation-retime'])
    ;(wrong.currentRoute as { classification: string }).classification = 'L2'
    expect(processingStrategyRiskErrors(candidate, wrong).join('\n')).toMatch(
      /record-verified L3 route.*source-rig-animation/s,
    )
  })

  it('requires custom rebuild to name a matching L3 rebuild operation', () => {
    const candidate = profile('/tmp/run', 'custom-rebuild')
    expect(
      processingStrategyRiskErrors(
        candidate,
        verifiedRoute(['axis-scale-normalization']),
      ).join('\n'),
    ).toMatch(/matching L3 rebuild operation/)
    expect(
      processingStrategyRiskErrors(
        candidate,
        verifiedRoute(['anatomy-reconstruction']),
      ),
    ).toEqual([])
  })
})

describe('model-lock v2 QA bindings', () => {
  it('rejects legacy model locks without live QA and key-evidence digests', () => {
    expect(() => parseModelLockRecord({ schemaVersion: 1 })).toThrow(
      /required|schemaVersion/,
    )
  })
})
