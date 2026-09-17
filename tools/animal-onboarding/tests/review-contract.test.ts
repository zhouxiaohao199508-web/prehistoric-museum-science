import { describe, expect, it } from 'vitest'

import {
  parseReviewContract,
  stringifyReviewContract,
} from '../src/review-contract'
import {
  parseAssetInspection,
  routeAssetRisk,
  stringifyAssetInspection,
} from '../src/risk-routing'

function reviewContractFixture(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    contractId: 'carnotaurus-arm-repair',
    animalId: 'carnotaurus',
    baselineAssetSha256: 'a'.repeat(64),
    purpose: 'Repair the right arm without moving the teeth or initial camera.',
    targetIssues: [
      {
        id: 'right-arm-direction',
        category: 'anatomy',
        severity: 'must-fix',
        verification: 'agent-visual-pass',
        currentProblem: 'The right arm points backwards.',
        expectedOutcome: 'Both arms follow the shoulder-elbow-wrist direction.',
        requiredEvidence: ['candidate-arm-cycle'],
      },
    ],
    invariants: [
      {
        id: 'teeth-remain-attached',
        category: 'deformation',
        statement: 'Every tooth remains seated in its original jaw through Idle.',
        verification: 'agent-visual-pass',
        baselineEvidence: ['baseline-mouth'],
        candidateEvidence: ['candidate-mouth-cycle'],
      },
    ],
    stateSequences: [
      {
        id: 'initial-and-minimum-distance',
        category: 'interaction',
        verification: 'machine-pass',
        given: {
          state: 'viewer-opened',
          assertions: ['Camera uses the declared initial distance.'],
        },
        when: {
          action: 'Move the camera to the closest allowed distance.',
          conditions: ['The model is fully loaded.'],
        },
        then: {
          state: 'minimum-distance-reached',
          assertions: [
            'The camera stops at the declared minimum distance.',
            'The initial distance configuration remains unchanged.',
          ],
        },
        requiredEvidence: ['runtime-distance-state'],
      },
    ],
    evidenceRequirements: [
      {
        id: 'runtime-distance-state',
        category: 'interaction',
        kind: 'runtime-state',
        stage: 'runtime',
        description: 'Recorded initial and minimum camera states.',
        requiredFor: 'machine-pass',
        perspectives: ['initial', 'closest'],
        sampleTimesSeconds: [],
        fullCycle: false,
      },
      {
        id: 'candidate-arm-cycle',
        category: 'anatomy',
        kind: 'full-loop-video',
        stage: 'candidate',
        description: 'Complete Idle loop showing both arms from both sides.',
        requiredFor: 'agent-visual-pass',
        perspectives: ['left', 'right'],
        sampleTimesSeconds: [],
        fullCycle: true,
      },
      {
        id: 'baseline-mouth',
        category: 'deformation',
        kind: 'still',
        stage: 'baseline',
        description: 'Baseline jaw and tooth seating.',
        requiredFor: 'agent-visual-pass',
        perspectives: ['mouth-closeup'],
        sampleTimesSeconds: [0],
        fullCycle: false,
      },
      {
        id: 'candidate-mouth-cycle',
        category: 'deformation',
        kind: 'frame-sequence',
        stage: 'candidate',
        description: 'Candidate jaw close-ups across the complete loop.',
        requiredFor: 'agent-visual-pass',
        perspectives: ['mouth-closeup'],
        sampleTimesSeconds: [8, 0, 4],
        fullCycle: true,
      },
    ],
  }
}

function assetInspectionFixture(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    animalId: 'spinosaurus',
    inspectionId: 'spinosaurus-source-v1',
    sourcePackage: {
      modelPresent: true,
      directSourceVerified: true,
      modificationAllowed: true,
      redistributionAllowed: true,
      primaryFormat: 'glb',
      runtimeReadyGlb: true,
      editableSource: true,
      texturesComplete: true,
      topology: 'verified-clean',
      semanticParts: 'complete',
      rig: 'none',
      skinWeights: 'none',
      animations: 'none',
      transparency: 'none',
      evidencePaths: ['source/download.json', 'source/license.html'],
    },
    plannedOperations: ['metadata-only'],
    knownIssues: [],
    executionControls: {
      l3Acceptance: {
        status: 'not-accepted',
        acceptedBy: null,
        acceptedOn: null,
        recordPath: null,
        recordSha256: null,
        acceptedReviewContractSha256: null,
      },
      parallelRequested: false,
      animalWorkspacePath: '.handoff/animal-onboarding-runs/spinosaurus',
      stageLockId: 'spinosaurus-model-stage',
      stageLockPath:
        '.handoff/animal-onboarding-runs/spinosaurus/stage-lock.json',
      stageLockSha256: 'b'.repeat(64),
      reviewContractPath:
        '.handoff/animal-onboarding-runs/spinosaurus/review-contract.json',
      reviewContractSha256: 'c'.repeat(64),
    },
  }
}

describe('review contract', () => {
  it('strictly parses target issues, unchanged invariants and Given/When/Then states', () => {
    const parsed = parseReviewContract(reviewContractFixture())
    expect(parsed).toMatchObject({
      animalId: 'carnotaurus',
      targetIssues: [{ id: 'right-arm-direction', category: 'anatomy' }],
      invariants: [{ id: 'teeth-remain-attached' }],
      stateSequences: [
        {
          id: 'initial-and-minimum-distance',
          given: { state: 'viewer-opened' },
          then: { state: 'minimum-distance-reached' },
        },
      ],
    })
    expect(parsed.evidenceRequirements.map((item) => item.id)).toEqual([
      'baseline-mouth',
      'candidate-arm-cycle',
      'candidate-mouth-cycle',
      'runtime-distance-state',
    ])
    expect(
      parsed.evidenceRequirements.find(
        (item) => item.id === 'candidate-mouth-cycle',
      )?.sampleTimesSeconds,
    ).toEqual([0, 4, 8])
  })

  it('rejects unknown fields and dangling evidence references', () => {
    expect(() =>
      parseReviewContract({ ...reviewContractFixture(), surprise: true }),
    ).toThrow(/surprise is not allowed/)

    const dangling = reviewContractFixture()
    const issues = dangling.targetIssues as Array<Record<string, unknown>>
    issues[0].requiredEvidence = ['missing-evidence']
    expect(() => parseReviewContract(dangling)).toThrow(
      /references unknown evidence missing-evidence/,
    )
  })

  it('rejects evidence from the wrong category, stage or review authority', () => {
    const wrongTargetCategory = reviewContractFixture()
    const targetEvidence = (
      wrongTargetCategory.evidenceRequirements as Array<Record<string, unknown>>
    ).find((item) => item.id === 'candidate-arm-cycle')!
    targetEvidence.category = 'motion'
    expect(() => parseReviewContract(wrongTargetCategory)).toThrow(
      /must use category anatomy/,
    )

    const wrongInvariantStage = reviewContractFixture()
    const baselineEvidence = (
      wrongInvariantStage.evidenceRequirements as Array<Record<string, unknown>>
    ).find((item) => item.id === 'baseline-mouth')!
    baselineEvidence.stage = 'candidate'
    expect(() => parseReviewContract(wrongInvariantStage)).toThrow(
      /has invalid candidate stage/,
    )

    const wrongInvariantAuthority = reviewContractFixture()
    const candidateEvidence = (
      wrongInvariantAuthority.evidenceRequirements as Array<
        Record<string, unknown>
      >
    ).find((item) => item.id === 'candidate-mouth-cycle')!
    candidateEvidence.requiredFor = 'machine-pass'
    expect(() => parseReviewContract(wrongInvariantAuthority)).toThrow(
      /must be required for agent-visual-pass/,
    )

    const wrongStateStage = reviewContractFixture()
    const stateEvidence = (
      wrongStateStage.evidenceRequirements as Array<Record<string, unknown>>
    ).find((item) => item.id === 'runtime-distance-state')!
    stateEvidence.stage = 'baseline'
    expect(() => parseReviewContract(wrongStateStage)).toThrow(
      /must use runtime stage/,
    )
  })

  it('rejects non-canonical identifiers and digests instead of trimming them', () => {
    expect(() =>
      parseReviewContract({
        ...reviewContractFixture(),
        animalId: ' carnotaurus ',
      }),
    ).toThrow(/leading or trailing whitespace/)
    expect(() =>
      parseReviewContract({
        ...reviewContractFixture(),
        baselineAssetSha256: ` ${'a'.repeat(64)} `,
      }),
    ).toThrow(/leading or trailing whitespace/)
  })

  it('requires complete-loop semantics instead of accepting a static proxy', () => {
    const fixture = reviewContractFixture()
    const evidence = fixture.evidenceRequirements as Array<
      Record<string, unknown>
    >
    const cycle = evidence.find((item) => item.id === 'candidate-arm-cycle')!
    cycle.fullCycle = false
    expect(() => parseReviewContract(fixture)).toThrow(
      /fullCycle must be true for full-loop-video/,
    )
  })

  it('emits byte-stable JSON for equivalent collection ordering', () => {
    const first = reviewContractFixture()
    const second = reviewContractFixture()
    ;(second.evidenceRequirements as unknown[]).reverse()
    ;(second.targetIssues as unknown[]).reverse()
    expect(stringifyReviewContract(first)).toBe(stringifyReviewContract(second))
    expect(stringifyReviewContract(first)).toBe(
      stringifyReviewContract(JSON.parse(stringifyReviewContract(first))),
    )
  })
})

describe('source-package risk routing', () => {
  it('routes an already usable source through L0 validation', () => {
    expect(routeAssetRisk(assetInspectionFixture())).toMatchObject({
      classification: 'L0',
      underlyingRiskLevel: 'L0',
      canStart: true,
      recommendedRoute: 'direct-runtime-validation',
      parallelExecution: 'not-requested',
    })
  })

  it('distinguishes deterministic L1 normalization from bounded L2 repair', () => {
    const normalization = assetInspectionFixture()
    normalization.plannedOperations = [
      'axis-scale-normalization',
      'animation-retime',
    ]
    expect(routeAssetRisk(normalization)).toMatchObject({
      classification: 'L1',
      recommendedRoute: 'deterministic-normalization',
    })

    const boundedRepair = assetInspectionFixture()
    boundedRepair.plannedOperations = ['bounded-part-transform']
    expect(routeAssetRisk(boundedRepair)).toMatchObject({
      classification: 'L2',
      recommendedRoute: 'bounded-structural-repair',
    })
  })

  it('allows explicitly accepted L3 animals to run in parallel when isolated', () => {
    const inspection = assetInspectionFixture()
    inspection.plannedOperations = ['mouth-reconstruction', 'full-rebind']
    inspection.executionControls = {
      l3Acceptance: {
        status: 'accepted',
        acceptedBy: 'Leon',
        acceptedOn: '2026-08-31',
        recordPath:
          '.handoff/animal-onboarding-runs/spinosaurus/l3-acceptance.json',
        recordSha256: 'd'.repeat(64),
        acceptedReviewContractSha256: 'c'.repeat(64),
      },
      parallelRequested: true,
      animalWorkspacePath: '.handoff/animal-onboarding-runs/spinosaurus',
      stageLockId: 'spinosaurus-model-stage',
      stageLockPath:
        '.handoff/animal-onboarding-runs/spinosaurus/stage-lock.json',
      stageLockSha256: 'b'.repeat(64),
      reviewContractPath:
        '.handoff/animal-onboarding-runs/spinosaurus/review-contract.json',
      reviewContractSha256: 'c'.repeat(64),
    }
    const routed = routeAssetRisk(inspection)
    expect(routed).toMatchObject({
      classification: 'L3',
      underlyingRiskLevel: 'L3',
      canStart: true,
      recommendedRoute: 'isolated-expert-rebuild',
      parallelExecution: 'allowed',
    })
    expect(routed.requiredEvidence).toEqual(
      expect.arrayContaining([
        'independent-agent-review',
        'mouth-full-cycle-closeups',
        'owner-l3-acceptance',
        'stage-lock-record',
      ]),
    )
    expect(routed.requiredStageLocks).toContain('model-accepted-for-finishing')
  })

  it('blocks parallel L3 execution without per-animal isolation or its own lock', () => {
    const inspection = assetInspectionFixture()
    inspection.plannedOperations = ['new-rig']
    inspection.executionControls = {
      l3Acceptance: {
        status: 'accepted',
        acceptedBy: 'Leon',
        acceptedOn: '2026-08-31',
        recordPath:
          '.handoff/animal-onboarding-runs/spinosaurus/l3-acceptance.json',
        recordSha256: 'd'.repeat(64),
        acceptedReviewContractSha256: 'c'.repeat(64),
      },
      parallelRequested: true,
      animalWorkspacePath: '.handoff/animal-onboarding-runs/spinosaurus',
      stageLockId: 'spinosaurus-model-stage',
      stageLockPath: null,
      stageLockSha256: null,
      reviewContractPath:
        '.handoff/animal-onboarding-runs/spinosaurus/review-contract.json',
      reviewContractSha256: 'c'.repeat(64),
    }
    expect(routeAssetRisk(inspection)).toMatchObject({
      classification: 'blocked',
      underlyingRiskLevel: 'L3',
      canStart: false,
      recommendedRoute: 'establish-isolation-and-stage-lock',
      parallelExecution: 'blocked',
    })
  })

  it('rejects copied workspace, lock, contract and acceptance bindings', () => {
    const inspection = assetInspectionFixture()
    inspection.plannedOperations = ['new-rig']
    inspection.executionControls = {
      l3Acceptance: {
        status: 'accepted',
        acceptedBy: 'Leon',
        acceptedOn: '2026-08-31',
        recordPath:
          '.handoff/animal-onboarding-runs/archaeopteryx/l3-acceptance.json',
        recordSha256: 'd'.repeat(64),
        acceptedReviewContractSha256: 'c'.repeat(64),
      },
      parallelRequested: true,
      animalWorkspacePath:
        '.handoff/animal-onboarding-runs/archaeopteryx',
      stageLockId: 'archaeopteryx-model-stage',
      stageLockPath:
        '.handoff/animal-onboarding-runs/archaeopteryx/stage-lock.json',
      stageLockSha256: 'b'.repeat(64),
      reviewContractPath:
        '.handoff/animal-onboarding-runs/archaeopteryx/review-contract.json',
      reviewContractSha256: 'c'.repeat(64),
    }
    const routed = routeAssetRisk(inspection)
    expect(routed).toMatchObject({
      classification: 'blocked',
      underlyingRiskLevel: 'L3',
      canStart: false,
      parallelExecution: 'blocked',
    })
    expect(routed.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/isolated workspace path/),
        expect.stringMatching(/stage-lock ID/),
      ]),
    )
  })

  it('rejects sibling and traversal paths outside the declared workspace', () => {
    const inspection = assetInspectionFixture()
    inspection.plannedOperations = ['new-rig']
    inspection.executionControls = {
      l3Acceptance: {
        status: 'accepted',
        acceptedBy: 'Leon',
        acceptedOn: '2026-08-31',
        recordPath: '/shared/other/spinosaurus/l3-acceptance.json',
        recordSha256: 'd'.repeat(64),
        acceptedReviewContractSha256: 'c'.repeat(64),
      },
      parallelRequested: true,
      animalWorkspacePath: '/isolated/spinosaurus',
      stageLockId: 'spinosaurus-model-stage',
      stageLockPath:
        '/isolated/spinosaurus/../../shared/other/spinosaurus/stage-lock.json',
      stageLockSha256: 'b'.repeat(64),
      reviewContractPath: '/shared/other/spinosaurus/review-contract.json',
      reviewContractSha256: 'c'.repeat(64),
    }
    const routed = routeAssetRisk(inspection)
    expect(routed).toMatchObject({
      classification: 'blocked',
      underlyingRiskLevel: 'L3',
      canStart: false,
      parallelExecution: 'blocked',
    })
    expect(routed.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/stage-lock record/),
        expect.stringMatching(/review contract/),
        expect.stringMatching(/L3 acceptance record/),
      ]),
    )
  })

  it('keeps L3 visible while requiring an explicit per-animal acceptance', () => {
    const inspection = assetInspectionFixture()
    inspection.plannedOperations = ['anatomy-reconstruction']
    inspection.executionControls = {
      l3Acceptance: {
        status: 'not-accepted',
        acceptedBy: null,
        acceptedOn: null,
        recordPath: null,
        recordSha256: null,
        acceptedReviewContractSha256: null,
      },
      parallelRequested: false,
      animalWorkspacePath: '.handoff/animal-onboarding-runs/spinosaurus',
      stageLockId: 'spinosaurus-model-stage',
      stageLockPath:
        '.handoff/animal-onboarding-runs/spinosaurus/stage-lock.json',
      stageLockSha256: 'b'.repeat(64),
      reviewContractPath:
        '.handoff/animal-onboarding-runs/spinosaurus/review-contract.json',
      reviewContractSha256: 'c'.repeat(64),
    }
    expect(routeAssetRisk(inspection)).toMatchObject({
      classification: 'blocked',
      underlyingRiskLevel: 'L3',
      recommendedRoute: 'obtain-l3-acceptance',
    })
  })

  it('hard-blocks missing public-use rights regardless of technical readiness', () => {
    const inspection = assetInspectionFixture()
    const source = inspection.sourcePackage as Record<string, unknown>
    source.redistributionAllowed = false
    expect(routeAssetRisk(inspection)).toMatchObject({
      classification: 'blocked',
      underlyingRiskLevel: 'L0',
      canStart: false,
      recommendedRoute: 'resolve-source-rights',
    })
  })

  it('strictly parses inspections and emits byte-stable JSON', () => {
    const first = assetInspectionFixture()
    const second = assetInspectionFixture()
    ;(second.sourcePackage as Record<string, unknown>).evidencePaths = [
      'source/license.html',
      'source/download.json',
    ]
    expect(stringifyAssetInspection(first)).toBe(
      stringifyAssetInspection(second),
    )
    expect(parseAssetInspection(first)).toMatchObject({
      inspectionId: 'spinosaurus-source-v1',
    })
    expect(() =>
      parseAssetInspection({ ...first, undeclared: 'no' }),
    ).toThrow(/undeclared is not allowed/)
    expect(() =>
      parseAssetInspection({ ...first, animalId: ' spinosaurus ' }),
    ).toThrow(/leading or trailing whitespace/)
  })
})
