import type { ModelProfile } from './types'

const MIB = 1024 * 1024

export type BudgetMetric =
  | 'bytes'
  | 'triangles'
  | 'drawCalls'
  | 'materials'
  | 'bones'

const BUDGET_METRICS: readonly BudgetMetric[] = [
  'bytes',
  'triangles',
  'drawCalls',
  'materials',
  'bones',
]

export interface ModelBudgetValues {
  readonly bytes: number
  readonly triangles: number
  readonly drawCalls: number
  readonly materials: number
  readonly bones: number
}

/**
 * Targets are optimisation goals. Review ceilings are the normal automated
 * contract. Absolute ceilings may be used only through an explicitly recorded
 * budget exception; they are not a second set of silent defaults.
 */
export const MODEL_BUDGET_POLICY = {
  targets: {
    bytes: 12 * MIB,
    triangles: 100_000,
    drawCalls: 12,
    materials: 8,
    bones: 120,
  },
  reviewCeilings: {
    bytes: 20 * MIB,
    triangles: 120_000,
    drawCalls: 24,
    materials: 16,
    bones: 160,
  },
  absoluteCeilings: {
    bytes: 20 * MIB,
    triangles: 250_000,
    drawCalls: 32,
    materials: 16,
    bones: 200,
  },
} as const satisfies Readonly<{
  targets: ModelBudgetValues
  reviewCeilings: ModelBudgetValues
  absoluteCeilings: ModelBudgetValues
}>

export function requestedModelCeilings(
  model: ModelProfile,
): ModelBudgetValues {
  return {
    bytes: model.maxBytes ?? MODEL_BUDGET_POLICY.reviewCeilings.bytes,
    triangles:
      model.maxTriangles ?? MODEL_BUDGET_POLICY.reviewCeilings.triangles,
    drawCalls:
      model.maxDrawCalls ?? MODEL_BUDGET_POLICY.reviewCeilings.drawCalls,
    materials:
      model.maxMaterials ?? MODEL_BUDGET_POLICY.reviewCeilings.materials,
    bones: model.maxBones ?? MODEL_BUDGET_POLICY.reviewCeilings.bones,
  }
}

export function metricsRequiringException(
  ceilings: ModelBudgetValues,
): BudgetMetric[] {
  return (Object.keys(ceilings) as BudgetMetric[]).filter(
    (metric) => ceilings[metric] > MODEL_BUDGET_POLICY.reviewCeilings[metric],
  )
}

export function validateModelBudgetPolicy(model: ModelProfile): void {
  const ceilings = requestedModelCeilings(model)
  const overAbsolute = (Object.keys(ceilings) as BudgetMetric[]).filter(
    (metric) => ceilings[metric] > MODEL_BUDGET_POLICY.absoluteCeilings[metric],
  )
  if (overAbsolute.length > 0) {
    throw new Error(
      `profile.model budget exceeds absolute ceiling for: ${overAbsolute.join(', ')}`,
    )
  }

  const exceptionMetrics = metricsRequiringException(ceilings)
  if (exceptionMetrics.length === 0) {
    if (model.budgetException !== undefined) {
      throw new Error(
        'profile.model.budgetException is present but no requested ceiling exceeds the review default',
      )
    }
    return
  }

  const exception = model.budgetException
  if (!exception) {
    throw new Error(
      `profile.model.budgetException is required for: ${exceptionMetrics.join(', ')}`,
    )
  }
  if (
    exception.metrics.length === 0 ||
    exception.metrics.some(
      (metric) => !BUDGET_METRICS.includes(metric),
    )
  ) {
    throw new Error(
      'profile.model.budgetException.metrics must contain supported budget metrics',
    )
  }
  if (new Set(exception.metrics).size !== exception.metrics.length) {
    throw new Error(
      'profile.model.budgetException.metrics must not contain duplicates',
    )
  }
  const declaredMetrics = [...exception.metrics].sort()
  const expectedMetrics = [...exceptionMetrics].sort()
  if (declaredMetrics.join(',') !== expectedMetrics.join(',')) {
    throw new Error(
      `profile.model.budgetException.metrics must exactly match: ${expectedMetrics.join(', ')}`,
    )
  }
  if (!exception.reason.trim()) {
    throw new Error('profile.model.budgetException.reason must be non-empty')
  }
  if (!exception.acceptedBy.trim()) {
    throw new Error(
      'profile.model.budgetException.acceptedBy must record the explicit risk owner',
    )
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.acceptedOn)) {
    throw new Error(
      'profile.model.budgetException.acceptedOn must be YYYY-MM-DD',
    )
  }
  const [year, month, day] = exception.acceptedOn.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(
      'profile.model.budgetException.acceptedOn must be a real calendar date',
    )
  }
}

export function exceededMetrics(
  measured: ModelBudgetValues,
  limits: ModelBudgetValues,
): BudgetMetric[] {
  return (Object.keys(measured) as BudgetMetric[]).filter(
    (metric) => measured[metric] > limits[metric],
  )
}
