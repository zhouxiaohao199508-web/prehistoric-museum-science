import { describe, expect, it } from 'vitest'

import {
  MODEL_BUDGET_POLICY,
  metricsRequiringException,
  requestedModelCeilings,
  validateModelBudgetPolicy,
} from '../src/budget-policy'
import type { ModelProfile } from '../src/types'

function model(overrides: Partial<ModelProfile> = {}): ModelProfile {
  return {
    inputPath: 'source.glb',
    outputPath: 'assets/candidates/example/output/model.glb',
    normalizedBlendPath: 'assets/candidates/example/working/model.blend',
    normalizationLogPath: 'assets/candidates/example/evidence/normalization.json',
    landmarksPath: 'assets/candidates/example/evidence/landmarks.json',
    normalizationStrategy: 'custom-rebuild',
    animationStrategy: {
      mode: 'custom-rebuild',
      sourceArmature: 'absent',
      sourceAnimation: 'absent',
      destructiveReplacementAccepted: false,
      reason: 'Unit-test fixture.',
    },
    habitat: 'land',
    motionProfile: 'land-breathe-tail',
    mouthMotion: { mode: 'disabled', reason: 'No safe jaw target.' },
    tailAxisSign: 1,
    animationRequired: true,
    expectedClip: 'Idle',
    ...overrides,
  }
}

describe('model budget policy', () => {
  it('uses one normal review contract when a profile has no overrides', () => {
    const value = model()
    expect(requestedModelCeilings(value)).toEqual(
      MODEL_BUDGET_POLICY.reviewCeilings,
    )
    expect(() => validateModelBudgetPolicy(value)).not.toThrow()
  })

  it('requires a precisely scoped explicit exception above review ceilings', () => {
    const value = model({ maxTriangles: 134_666, maxBones: 167 })
    expect(metricsRequiringException(requestedModelCeilings(value))).toEqual([
      'triangles',
      'bones',
    ])
    expect(() => validateModelBudgetPolicy(value)).toThrow(
      /budgetException is required/,
    )

    expect(() =>
      validateModelBudgetPolicy(
        model({
          maxTriangles: 134_666,
          maxBones: 167,
          budgetException: {
            metrics: ['triangles', 'bones'],
            reason:
              'The reviewed silhouette and appendage topology are degraded by further reduction.',
            acceptedBy: 'Leon',
            acceptedOn: '2026-08-31',
          },
        }),
      ),
    ).not.toThrow()
  })

  it('never allows an exception to cross the absolute ceiling', () => {
    expect(() =>
      validateModelBudgetPolicy(
        model({
          maxBones: 201,
          budgetException: {
            metrics: ['bones'],
            reason: 'Test',
            acceptedBy: 'Leon',
            acceptedOn: '2026-08-31',
          },
        }),
      ),
    ).toThrow(/absolute ceiling/)
  })

  it('requires acceptedOn to be a real calendar date', () => {
    expect(() =>
      validateModelBudgetPolicy(
        model({
          maxBones: 167,
          budgetException: {
            metrics: ['bones'],
            reason: 'The reviewed rig needs the retained deformation bones.',
            acceptedBy: 'Leon',
            acceptedOn: '2026-02-31',
          },
        }),
      ),
    ).toThrow(/real calendar date/)

    expect(() =>
      validateModelBudgetPolicy(
        model({
          maxBones: 167,
          budgetException: {
            metrics: ['bones'],
            reason: 'The reviewed rig needs the retained deformation bones.',
            acceptedBy: 'Leon',
            acceptedOn: '2028-02-29',
          },
        }),
      ),
    ).not.toThrow()
  })

  it('does not silently normalize duplicate exception metrics', () => {
    expect(() =>
      validateModelBudgetPolicy(
        model({
          maxTriangles: 134_666,
          budgetException: {
            metrics: ['triangles', 'triangles'],
            reason: 'Test duplicate rejection.',
            acceptedBy: 'Leon',
            acceptedOn: '2026-08-31',
          },
        }),
      ),
    ).toThrow(/must not contain duplicates/)
  })
})
