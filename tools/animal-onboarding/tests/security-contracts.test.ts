import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  contractProofErrors,
  digestAgentReviewEvidence,
  MACHINE_REVIEW_AUTHORITY,
  parseAgentVisualReview,
  type AgentVisualReview,
} from '../src/agent-review'
import type { VerifiedBrowserCaptureArtifact } from '../src/browser-capture'
import {
  ownerContractProofRecords,
  parseModelLockRecord,
} from '../src/model-lock'
import { parseReviewContract } from '../src/review-contract'

function contract() {
  return parseReviewContract({
    schemaVersion: 1,
    contractId: 'security-contract',
    animalId: 'test-animal',
    baselineAssetSha256: 'a'.repeat(64),
    purpose: 'Prove every declared requirement with its declared authority.',
    targetIssues: [
      {
        id: 'target-motion',
        category: 'motion',
        severity: 'must-fix',
        verification: 'agent-visual-pass',
        currentProblem: 'Motion is static.',
        expectedOutcome: 'Motion is visible.',
        requiredEvidence: ['target-evidence'],
      },
    ],
    invariants: [
      {
        id: 'owner-invariant',
        category: 'child-comfort',
        statement: 'The animal remains comfortable for children.',
        verification: 'owner-approval',
        baselineEvidence: ['baseline-evidence'],
        candidateEvidence: ['candidate-evidence'],
      },
    ],
    stateSequences: [
      {
        id: 'machine-sequence',
        category: 'interaction',
        verification: 'machine-pass',
        given: { state: 'initial', assertions: ['Initial state is loaded.'] },
        when: { action: 'Zoom in.', conditions: [] },
        then: { state: 'zoomed', assertions: ['Minimum distance is enforced.'] },
        requiredEvidence: ['runtime-evidence'],
      },
    ],
    evidenceRequirements: [
      {
        id: 'target-evidence',
        category: 'motion',
        kind: 'frame-sequence',
        stage: 'candidate',
        description: 'Full loop.',
        requiredFor: 'agent-visual-pass',
        perspectives: ['side'],
        sampleTimesSeconds: [0, 2, 4, 6, 8],
        fullCycle: true,
      },
      {
        id: 'baseline-evidence',
        category: 'child-comfort',
        kind: 'still',
        stage: 'baseline',
        description: 'Baseline comfort still.',
        requiredFor: 'owner-approval',
        perspectives: ['front'],
        sampleTimesSeconds: [0],
        fullCycle: false,
      },
      {
        id: 'candidate-evidence',
        category: 'child-comfort',
        kind: 'still',
        stage: 'candidate',
        description: 'Candidate comfort still.',
        requiredFor: 'owner-approval',
        perspectives: ['front'],
        sampleTimesSeconds: [0],
        fullCycle: false,
      },
      {
        id: 'runtime-evidence',
        category: 'interaction',
        kind: 'runtime-state',
        stage: 'runtime',
        description: 'Recorded zoom state.',
        requiredFor: 'machine-pass',
        perspectives: ['zoomed'],
        sampleTimesSeconds: [0],
        fullCycle: false,
      },
    ],
  })
}

async function validReview(): Promise<AgentVisualReview> {
  const directory = await mkdtemp(join(tmpdir(), 'agent-proof-'))
  const artifacts = await Promise.all(
    [0, 1, 2, 3, 4, 5, 6, 7].map(async (index) => {
      const path = join(directory, `evidence-${index}.bin`)
      await writeFile(path, `evidence-${index}`)
      return path
    }),
  )
  return {
    schemaVersion: 1,
    animalId: 'test-animal',
    reviewer: 'Singer',
    reviewerTaskId: '/review/test-animal',
    reviewedAt: '2026-08-31T00:00:00.000Z',
    modelContractSha256: 'a'.repeat(64),
    modelSha256: 'b'.repeat(64),
    reviewContractPath: join(directory, 'review-contract.json'),
    reviewContractSha256: 'c'.repeat(64),
    browserCaptureSha256: 'd'.repeat(64),
    browserCaptureValidationSha256: 'e'.repeat(64),
    overallStatus: 'pass',
    checks: [],
    contractProofs: [
      {
        subjectType: 'target-issue',
        subjectId: 'target-motion',
        requiredAuthority: 'agent-visual-pass',
        status: 'pass',
        verifiedBy: 'Singer',
        finding: 'Motion is visible through the complete loop.',
        evidence: [
          {
            requirementId: 'target-evidence',
            evidencePaths: artifacts.slice(0, 5),
          },
        ],
      },
      {
        subjectType: 'invariant',
        subjectId: 'owner-invariant',
        requiredAuthority: 'owner-approval',
        status: 'pass',
        verifiedBy: 'Leon',
        finding: 'Owner accepted the child-comfort invariant.',
        evidence: [
          { requirementId: 'baseline-evidence', evidencePaths: [artifacts[5]] },
          { requirementId: 'candidate-evidence', evidencePaths: [artifacts[6]] },
        ],
      },
      {
        subjectType: 'state-sequence',
        subjectId: 'machine-sequence',
        requiredAuthority: 'machine-pass',
        status: 'pass',
        verifiedBy: MACHINE_REVIEW_AUTHORITY,
        finding: 'The recorded state proves the declared minimum distance.',
        evidence: [
          { requirementId: 'runtime-evidence', evidencePaths: [artifacts[7]] },
        ],
      },
    ],
    motionSamples: [],
    blockers: [],
  }
}

function captureArtifact(
  path: string,
  options: {
    readonly cameraAngleId?: string
    readonly cameraAngleRole?: 'primary' | 'auxiliary'
    readonly stateId?: string
    readonly stateKind?: 'initial' | 'interaction'
    readonly requestedTimeSeconds?: number
    readonly actualTimeSeconds?: number
  } = {},
): VerifiedBrowserCaptureArtifact {
  const requestedTimeSeconds = options.requestedTimeSeconds ?? 0
  return {
    requestId: `request-${path}`,
    viewportId: 'desktop',
    cameraAngleId: options.cameraAngleId ?? 'side',
    cameraAngleRole: options.cameraAngleRole ?? 'primary',
    stateId: options.stateId ?? 'initial',
    stateKind: options.stateKind ?? 'initial',
    stateSequenceIndex: options.stateKind === 'interaction' ? 1 : 0,
    requestedTimeSeconds,
    actualTimeSeconds:
      options.actualTimeSeconds ?? (requestedTimeSeconds === 8 ? 0 : requestedTimeSeconds),
    animationDurationSeconds: 8,
    actualTimeToleranceSeconds: 0.02,
    purposes: ['full-loop'],
    actualCameraAngle: {
      id: options.cameraAngleId ?? 'side',
      yawDegrees: 0,
      pitchDegrees: 8,
      distance: options.stateKind === 'interaction' ? 3.5 : 4.5,
      target: [0, 0.5, 0],
    },
    relativePath: path,
    absolutePath: path,
    bytes: 10,
    sha256: 'a'.repeat(64),
    pixelWidth: 1440,
    pixelHeight: 900,
  }
}

function verifiedArtifactsForReview(
  review: AgentVisualReview,
): VerifiedBrowserCaptureArtifact[] {
  const targetPaths = review.contractProofs
    .find((proof) => proof.subjectId === 'target-motion')!
    .evidence[0].evidencePaths
  const candidatePath = review.contractProofs
    .find((proof) => proof.subjectId === 'owner-invariant')!
    .evidence.find(({ requirementId }) => requirementId === 'candidate-evidence')!
    .evidencePaths[0]
  const runtimePath = review.contractProofs
    .find((proof) => proof.subjectId === 'machine-sequence')!
    .evidence[0].evidencePaths[0]
  return [
    ...targetPaths.map((path, index) =>
      captureArtifact(path, {
        requestedTimeSeconds: [0, 2, 4, 6, 8][index % 5],
      }),
    ),
    captureArtifact(candidatePath, {
      cameraAngleId: 'front',
      cameraAngleRole: 'auxiliary',
    }),
    captureArtifact(runtimePath, {
      stateId: 'zoomed',
      stateKind: 'interaction',
    }),
  ]
}

function transparencyContract(sampleTimesSeconds: readonly number[]) {
  const baseContract = contract()
  return parseReviewContract({
    ...baseContract,
    targetIssues: baseContract.targetIssues.map((issue) =>
      issue.id === 'target-motion'
        ? { ...issue, category: 'transparency' }
        : issue,
    ),
    evidenceRequirements: baseContract.evidenceRequirements.map(
      (requirement) =>
        requirement.id === 'target-evidence'
          ? {
              ...requirement,
              category: 'transparency',
              perspectives: ['left', 'right'],
              sampleTimesSeconds,
            }
          : requirement,
    ),
  })
}

async function transparencyEvidenceBundle(
  sampleTimesSeconds: readonly number[],
): Promise<{
  readonly review: AgentVisualReview
  readonly machineEvidencePaths: readonly string[]
  readonly verifiedCaptureArtifacts: readonly VerifiedBrowserCaptureArtifact[]
  readonly targetPaths: readonly string[]
}> {
  const baseReview = await validReview()
  const targetProofIndex = baseReview.contractProofs.findIndex(
    (proof) => proof.subjectId === 'target-motion',
  )
  const directory = join(
    baseReview.contractProofs[targetProofIndex].evidence[0].evidencePaths[0],
    '..',
  )
  const targetPaths = await Promise.all(
    ['left', 'right'].flatMap((perspective) =>
      sampleTimesSeconds.map(async (time, index) => {
        const path = join(
          directory,
          `transparency-${perspective}-${index}-${time}.bin`,
        )
        await writeFile(path, `${perspective}-${time}`)
        return path
      }),
    ),
  )
  const proofs = [...baseReview.contractProofs]
  proofs[targetProofIndex] = {
    ...proofs[targetProofIndex],
    evidence: [{ requirementId: 'target-evidence', evidencePaths: targetPaths }],
  }
  const review = { ...baseReview, contractProofs: proofs }
  const targetSet = new Set(targetPaths)
  const supportingArtifacts = verifiedArtifactsForReview(review).filter(
    (artifact) => !targetSet.has(artifact.absolutePath),
  )
  const targetArtifacts = targetPaths.map((path, index) => {
    const perspectiveIndex = Math.floor(index / sampleTimesSeconds.length)
    const time = sampleTimesSeconds[index % sampleTimesSeconds.length]
    return captureArtifact(path, {
      cameraAngleId: perspectiveIndex === 0 ? 'left' : 'right',
      cameraAngleRole: perspectiveIndex === 0 ? 'primary' : 'auxiliary',
      requestedTimeSeconds: time,
    })
  })
  const machineEvidencePaths = review.contractProofs.find(
    (proof) => proof.requiredAuthority === 'machine-pass',
  )!.evidence.flatMap((binding) => binding.evidencePaths)
  return {
    review,
    machineEvidencePaths,
    verifiedCaptureArtifacts: [...targetArtifacts, ...supportingArtifacts],
    targetPaths,
  }
}

describe('contract-bound agent review', () => {
  it('requires exact proofs for every target, invariant and state sequence', async () => {
    const review = await validReview()
    const machineEvidencePaths = review.contractProofs.find(
      (proof) => proof.requiredAuthority === 'machine-pass',
    )!.evidence.flatMap((binding) => binding.evidencePaths)
    const verifiedCaptureArtifacts = verifiedArtifactsForReview(review)
    await expect(
      contractProofErrors(contract(), review, {
        machineEvidencePaths,
        verifiedCaptureArtifacts,
      }),
    ).resolves.toEqual([])

    const missing = {
      ...review,
      contractProofs: review.contractProofs.slice(1),
    }
    await expect(
      contractProofErrors(contract(), missing, {
        machineEvidencePaths,
        verifiedCaptureArtifacts,
      }),
    ).resolves.toEqual(
      expect.arrayContaining([expect.stringMatching(/missing contract proof target-issue/)]),
    )
  })

  it('rejects authority substitution and evidence-set substitution', async () => {
    const review = await validReview()
    const machineEvidencePaths = review.contractProofs.find(
      (proof) => proof.requiredAuthority === 'machine-pass',
    )!.evidence.flatMap((binding) => binding.evidencePaths)
    const verifiedCaptureArtifacts = verifiedArtifactsForReview(review)
    const machineIndex = review.contractProofs.findIndex(
      (proof) => proof.subjectType === 'state-sequence',
    )
    const proofs = [...review.contractProofs]
    proofs[machineIndex] = {
      ...proofs[machineIndex],
      requiredAuthority: 'agent-visual-pass',
      verifiedBy: review.reviewer,
      evidence: [
        ...proofs[machineIndex].evidence,
        { requirementId: 'target-evidence', evidencePaths: [] },
      ],
    }
    const errors = await contractProofErrors(
      contract(),
      { ...review, contractProofs: proofs },
      { machineEvidencePaths, verifiedCaptureArtifacts },
    )
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/authority does not match/),
        expect.stringMatching(/does not bind the exact required evidence set/),
      ]),
    )
  })

  it('strictly rejects legacy reviews that do not bind the contract and validation', async () => {
    const review = await validReview()
    const legacy = { ...review } as unknown as Record<string, unknown>
    delete legacy.reviewContractSha256
    delete legacy.browserCaptureValidationSha256
    expect(() => parseAgentVisualReview(legacy)).toThrow(/required/)

    const missingReviewerTask = { ...review } as unknown as Record<
      string,
      unknown
    >
    delete missingReviewerTask.reviewerTaskId
    expect(() => parseAgentVisualReview(missingReviewerTask)).toThrow(
      /reviewerTaskId is required/,
    )
  })

  it('allows owner proof to remain pending until the explicit model-lock decision', async () => {
    const review = await validReview()
    const ownerIndex = review.contractProofs.findIndex(
      (proof) => proof.requiredAuthority === 'owner-approval',
    )
    const proofs = [...review.contractProofs]
    proofs[ownerIndex] = {
      ...proofs[ownerIndex],
      status: 'pending',
      verifiedBy: '',
      finding: '',
    }
    const machineEvidencePaths = review.contractProofs.find(
      (proof) => proof.requiredAuthority === 'machine-pass',
    )!.evidence.flatMap((binding) => binding.evidencePaths)
    const verifiedCaptureArtifacts = verifiedArtifactsForReview(review)
    await expect(
      contractProofErrors(
        contract(),
        { ...review, contractProofs: proofs },
        {
          machineEvidencePaths,
          verifiedCaptureArtifacts,
          allowPendingOwner: true,
        },
      ),
    ).resolves.toEqual([])
    const resolved = await ownerContractProofRecords(
      { ...review, contractProofs: proofs },
      'Leon',
      '2026-08-31',
    )
    expect(resolved).toHaveLength(1)
    expect(resolved[0]).toMatchObject({
      subjectType: 'invariant',
      subjectId: 'owner-invariant',
      verifiedBy: 'Leon',
      verifiedOn: '2026-08-31',
    })
    expect(resolved[0]?.evidenceSha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rejects sparse transparency loops and one angle masquerading as two', async () => {
    const sampleTimes = [0, 2, 4, 6, 8]
    const bundle = await transparencyEvidenceBundle(sampleTimes)
    const transparency = transparencyContract(sampleTimes)
    const allLeftArtifacts = bundle.verifiedCaptureArtifacts.map((artifact) =>
      bundle.targetPaths.includes(artifact.absolutePath)
        ? { ...artifact, cameraAngleId: 'left' }
        : artifact,
    )
    const bypassErrors = await contractProofErrors(
      transparency,
      bundle.review,
      {
        machineEvidencePaths: bundle.machineEvidencePaths,
        verifiedCaptureArtifacts: allLeftArtifacts,
      },
    )
    expect(bypassErrors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/distinct verified camera\/viewport\/state channels/),
        expect.stringMatching(/perspective × sample-time combination/),
        expect.stringMatching(/sample gap larger than 0\.25 seconds/),
      ]),
    )

    const sparseErrors = await contractProofErrors(
      transparency,
      bundle.review,
      {
        machineEvidencePaths: bundle.machineEvidencePaths,
        verifiedCaptureArtifacts: bundle.verifiedCaptureArtifacts,
      },
    )
    expect(sparseErrors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/sample gap larger than 0\.25 seconds/),
      ]),
    )
  })

  it('accepts exact two-sided transparency coverage sampled every 0.25 seconds', async () => {
    const sampleTimes = Array.from({ length: 33 }, (_, index) => index / 4)
    const bundle = await transparencyEvidenceBundle(sampleTimes)
    await expect(
      contractProofErrors(
        transparencyContract(sampleTimes),
        bundle.review,
        {
          machineEvidencePaths: bundle.machineEvidencePaths,
          verifiedCaptureArtifacts: bundle.verifiedCaptureArtifacts,
        },
      ),
    ).resolves.toEqual([])
  })

  it('rejects a dense transparency loop that omits a mandatory checkpoint', async () => {
    const sampleTimes = Array.from({ length: 33 }, (_, index) => index / 4).filter(
      (time) => time !== 2,
    )
    const bundle = await transparencyEvidenceBundle(sampleTimes)
    const errors = await contractProofErrors(
      transparencyContract(sampleTimes),
      bundle.review,
      {
        machineEvidencePaths: bundle.machineEvidencePaths,
        verifiedCaptureArtifacts: bundle.verifiedCaptureArtifacts,
      },
    )
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/mandatory 0\/2\/4\/6\/8-second checkpoints/),
      ]),
    )
  })

  it('rejects stale time metadata, wrong runtime states, and PNGs posing as a video', async () => {
    const review = await validReview()
    const machineEvidencePaths = review.contractProofs.find(
      (proof) => proof.requiredAuthority === 'machine-pass',
    )!.evidence.flatMap((binding) => binding.evidencePaths)
    const verified = verifiedArtifactsForReview(review)
    const staleTime = verified.map((artifact) =>
      artifact.requestedTimeSeconds === 2
        ? { ...artifact, actualTimeSeconds: 1.5 }
        : artifact,
    )
    const timeErrors = await contractProofErrors(contract(), review, {
      machineEvidencePaths,
      verifiedCaptureArtifacts: staleTime,
    })
    expect(timeErrors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/perspective × sample-time combination/),
      ]),
    )

    const wrongState = verified.map((artifact) =>
      artifact.stateId === 'zoomed'
        ? { ...artifact, stateId: 'initial', stateKind: 'initial' as const }
        : artifact,
    )
    const stateErrors = await contractProofErrors(contract(), review, {
      machineEvidencePaths,
      verifiedCaptureArtifacts: wrongState,
    })
    expect(stateErrors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/perspective × sample-time combination/),
      ]),
    )

    const baseContract = contract()
    const videoContract = parseReviewContract({
      ...baseContract,
      evidenceRequirements: baseContract.evidenceRequirements.map(
        (requirement) =>
          requirement.id === 'target-evidence'
            ? {
                ...requirement,
                kind: 'full-loop-video',
                sampleTimesSeconds: [],
              }
            : requirement,
      ),
    })
    const videoErrors = await contractProofErrors(videoContract, review, {
      machineEvidencePaths,
      verifiedCaptureArtifacts: verified,
    })
    expect(videoErrors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/continuous-video evidence/),
      ]),
    )
  })

  it('rejects machine metric, rig and structure files without a dedicated semantic verifier', async () => {
    const review = await validReview()
    const baseContract = contract()
    const unsupportedKinds = ['metric', 'rig-report', 'structure-inventory'] as const
    for (const kind of unsupportedKinds) {
      const unsupported = parseReviewContract({
        ...baseContract,
        evidenceRequirements: baseContract.evidenceRequirements.map(
          (requirement) =>
            requirement.id === 'runtime-evidence'
              ? {
                  ...requirement,
                  kind,
                  perspectives: [],
                  sampleTimesSeconds: [],
                }
              : requirement,
        ),
      })
      const machineEvidencePaths = review.contractProofs.find(
        (proof) => proof.requiredAuthority === 'machine-pass',
      )!.evidence.flatMap((binding) => binding.evidencePaths)
      const errors = await contractProofErrors(unsupported, review, {
        machineEvidencePaths,
        verifiedCaptureArtifacts: verifiedArtifactsForReview(review),
      })
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            new RegExp(`${kind}.*no dedicated machine semantic verifier`),
          ),
        ]),
      )
    }
  })

  it('requires every declared owner human-review perspective before model-lock preparation', async () => {
    const review = await validReview()
    const baseContract = contract()
    const ownerContract = parseReviewContract({
      ...baseContract,
      evidenceRequirements: baseContract.evidenceRequirements.map(
        (requirement) =>
          requirement.id === 'candidate-evidence'
            ? {
                ...requirement,
                kind: 'human-review',
                perspectives: [
                  'viewport:desktop',
                  'viewport:phone-landscape',
                  'viewport:phone-portrait',
                ],
              }
            : requirement,
      ),
    })
    const machineEvidencePaths = review.contractProofs.find(
      (proof) => proof.requiredAuthority === 'machine-pass',
    )!.evidence.flatMap((binding) => binding.evidencePaths)
    const errors = await contractProofErrors(ownerContract, review, {
      machineEvidencePaths,
      verifiedCaptureArtifacts: verifiedArtifactsForReview(review),
    })
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/candidate-evidence has insufficient artifacts/),
        expect.stringMatching(/candidate-evidence.*perspective × sample-time/),
      ]),
    )
  })

  it('rejects arbitrary candidate/runtime files and fingerprints evidence tampering', async () => {
    const review = await validReview()
    const machineEvidencePaths = review.contractProofs.find(
      (proof) => proof.requiredAuthority === 'machine-pass',
    )!.evidence.flatMap((binding) => binding.evidencePaths)
    const errors = await contractProofErrors(contract(), review, {
      machineEvidencePaths,
      verifiedCaptureArtifacts: [],
    })
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /not an integrity-validated collector-attested capture artifact/,
        ),
      ]),
    )

    const before = await digestAgentReviewEvidence(review)
    await writeFile(before.files[0].path, 'tampered evidence')
    const after = await digestAgentReviewEvidence(review)
    expect(after.sha256).not.toBe(before.sha256)
  })
})

describe('strict model lock record', () => {
  it('requires contract, stage, route, plan and capture-validation hashes', () => {
    const value = {
      schemaVersion: 2,
      animalId: 'test-animal',
      decision: 'accepted-for-finishing',
      acceptedBy: 'Leon',
      acceptedOn: '2026-08-31',
      modelContractSha256: 'a'.repeat(64),
      modelSha256: 'b'.repeat(64),
      sourceModelPath: '/tmp/source.glb',
      sourceModelSha256: '6'.repeat(64),
      baselineAssetSha256: '6'.repeat(64),
      reviewContractPath: '/tmp/review-contract.json',
      reviewContractSha256: 'c'.repeat(64),
      stageLockId: 'test-animal-model-stage',
      stageLockPath: '/tmp/stage-lock.json',
      stageLockSha256: 'd'.repeat(64),
      riskRoutePath: '/tmp/asset-risk-route.json',
      riskRouteSha256: 'e'.repeat(64),
      riskEvidenceManifestPath: '/tmp/risk-evidence-manifest.json',
      riskEvidenceManifestSha256: '0'.repeat(64),
      browserCapturePlanPath: '/tmp/browser-capture-plan.json',
      browserCapturePlanSha256: 'f'.repeat(64),
      browserCapturePath: '/tmp/browser-capture-evidence.json',
      browserCaptureSha256: '1'.repeat(64),
      browserCaptureValidationPath: '/tmp/browser-capture-validation.json',
      browserCaptureValidationSha256: '2'.repeat(64),
      agentReviewPath: '/tmp/agent-review.json',
      agentReviewSha256: '3'.repeat(64),
      reviewEvidenceBundleSha256: '4'.repeat(64),
      modelQaPath: '/tmp/owner-model-qa.json',
      modelQaSha256: '7'.repeat(64),
      modelQaDecisionSha256: '8'.repeat(64),
      normalizationLogSha256: '9'.repeat(64),
      normalizedBlendSha256: 'a'.repeat(64),
      landmarksSha256: 'b'.repeat(64),
      glbValidatorSha256: 'c'.repeat(64),
      ownerContractProofs: [
        {
          subjectType: 'invariant',
          subjectId: 'owner-invariant',
          verifiedBy: 'Leon',
          verifiedOn: '2026-08-31',
          evidenceSha256: '5'.repeat(64),
        },
      ],
    }
    expect(parseModelLockRecord(value)).toMatchObject({
      animalId: 'test-animal',
      browserCaptureValidationSha256: '2'.repeat(64),
    })
    const bypass = { ...value } as Record<string, unknown>
    delete bypass.browserCaptureValidationSha256
    expect(() => parseModelLockRecord(bypass)).toThrow(
      /browserCaptureValidationSha256 is required/,
    )

    const missingSourceBinding = { ...value } as Record<string, unknown>
    delete missingSourceBinding.sourceModelSha256
    expect(() => parseModelLockRecord(missingSourceBinding)).toThrow(
      /sourceModelSha256 is required/,
    )

    const missingRiskEvidence = { ...value } as Record<string, unknown>
    delete missingRiskEvidence.riskEvidenceManifestSha256
    expect(() => parseModelLockRecord(missingRiskEvidence)).toThrow(
      /riskEvidenceManifestSha256 is required/,
    )

    expect(() =>
      parseModelLockRecord({ ...value, sourceModelPath: 'relative/source.glb' }),
    ).toThrow(/sourceModelPath must be an absolute normalized path/)

    expect(() =>
      parseModelLockRecord({ ...value, acceptedOn: '2026-02-31' }),
    ).toThrow(/real calendar date/)
  })
})
