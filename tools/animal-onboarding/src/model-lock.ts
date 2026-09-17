import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  digestAgentReviewEvidence,
  digestEvidencePaths,
  parseAgentVisualReview,
  validateAgentVisualReview,
  verifyCurrentBrowserCapture,
  type AgentVisualReview,
} from './agent-review'
import { requestedModelCeilings, MODEL_BUDGET_POLICY } from './budget-policy'
import { fileDigest, regularFile, writeJson, writeText } from './io'
import {
  modelContractSha256,
  verifySourceBaseline,
} from './model-contract'
import { loadProfile } from './profile'
import {
  evaluateCurrentQa,
  parseQaReport,
  qaDecisionSha256,
  qaReportIntegrityErrors,
} from './qa'
import { verifyPersistedAssetRiskRoute } from './risk-routing'
import type { AnimalOnboardingProfile, QaReport } from './types'

export interface ModelLockRecord {
  readonly schemaVersion: 2
  readonly animalId: string
  readonly decision: 'accepted-for-finishing'
  readonly acceptedBy: string
  readonly acceptedOn: string
  readonly modelContractSha256: string
  readonly modelSha256: string
  readonly sourceModelPath: string
  readonly sourceModelSha256: string
  readonly baselineAssetSha256: string
  readonly reviewContractPath: string
  readonly reviewContractSha256: string
  readonly stageLockId: string
  readonly stageLockPath: string
  readonly stageLockSha256: string
  readonly riskRoutePath: string
  readonly riskRouteSha256: string
  readonly riskEvidenceManifestPath: string
  readonly riskEvidenceManifestSha256: string
  readonly browserCapturePlanPath: string
  readonly browserCapturePlanSha256: string
  readonly browserCapturePath: string
  readonly browserCaptureSha256: string
  readonly browserCaptureValidationPath: string
  readonly browserCaptureValidationSha256: string
  readonly agentReviewPath: string
  readonly agentReviewSha256: string
  readonly reviewEvidenceBundleSha256: string
  readonly modelQaPath: string
  readonly modelQaSha256: string
  readonly modelQaDecisionSha256: string
  readonly normalizationLogSha256: string
  readonly normalizedBlendSha256: string
  readonly landmarksSha256: string
  readonly glbValidatorSha256: string
  readonly ownerContractProofs: readonly OwnerContractProofRecord[]
}

export interface OwnerContractProofRecord {
  readonly subjectType: 'target-issue' | 'invariant' | 'state-sequence'
  readonly subjectId: string
  readonly verifiedBy: string
  readonly verifiedOn: string
  readonly evidenceSha256: string
}

type JsonObject = Record<string, unknown>

function exactObject(
  value: unknown,
  label: string,
  keys: readonly string[],
): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  const source = value as JsonObject
  const expected = new Set(keys)
  for (const key of Object.keys(source)) {
    if (!expected.has(key)) throw new Error(`${label}.${key} is not allowed`)
  }
  for (const key of keys) {
    if (!(key in source)) throw new Error(`${label}.${key} is required`)
  }
  return source
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  if (value !== value.trim()) {
    throw new Error(`${label} must not have leading or trailing whitespace`)
  }
  return value
}

function sha256Value(value: unknown, label: string): string {
  const result = nonEmptyString(value, label)
  if (!/^[a-f0-9]{64}$/.test(result)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`)
  }
  return result
}

function absoluteNormalizedPath(value: unknown, label: string): string {
  const result = nonEmptyString(value, label)
  if (resolve(result) !== result) {
    throw new Error(`${label} must be an absolute normalized path`)
  }
  return result
}

function isoDate(value: unknown, label = 'model lock date'): string {
  const result = nonEmptyString(value, label)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
    throw new Error(`${label} must be YYYY-MM-DD`)
  }
  const [year, month, day] = result.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`${label} must be a real calendar date`)
  }
  return result
}

export function parseModelLockRecord(value: unknown): ModelLockRecord {
  const source = exactObject(value, 'modelLock', [
    'schemaVersion',
    'animalId',
    'decision',
    'acceptedBy',
    'acceptedOn',
    'modelContractSha256',
    'modelSha256',
    'sourceModelPath',
    'sourceModelSha256',
    'baselineAssetSha256',
    'reviewContractPath',
    'reviewContractSha256',
    'stageLockId',
    'stageLockPath',
    'stageLockSha256',
    'riskRoutePath',
    'riskRouteSha256',
    'riskEvidenceManifestPath',
    'riskEvidenceManifestSha256',
    'browserCapturePlanPath',
    'browserCapturePlanSha256',
    'browserCapturePath',
    'browserCaptureSha256',
    'browserCaptureValidationPath',
    'browserCaptureValidationSha256',
    'agentReviewPath',
    'agentReviewSha256',
    'reviewEvidenceBundleSha256',
    'modelQaPath',
    'modelQaSha256',
    'modelQaDecisionSha256',
    'normalizationLogSha256',
    'normalizedBlendSha256',
    'landmarksSha256',
    'glbValidatorSha256',
    'ownerContractProofs',
  ])
  if (source.schemaVersion !== 2) {
    throw new Error('modelLock.schemaVersion must be 2')
  }
  if (source.decision !== 'accepted-for-finishing') {
    throw new Error('modelLock.decision must be accepted-for-finishing')
  }
  if (!Array.isArray(source.ownerContractProofs)) {
    throw new Error('modelLock.ownerContractProofs must be an array')
  }
  const ownerContractProofs = source.ownerContractProofs.map(
    (value, index): OwnerContractProofRecord => {
      const proof = exactObject(value, `modelLock.ownerContractProofs[${index}]`, [
        'subjectType',
        'subjectId',
        'verifiedBy',
        'verifiedOn',
        'evidenceSha256',
      ])
      const subjectType = nonEmptyString(
        proof.subjectType,
        `modelLock.ownerContractProofs[${index}].subjectType`,
      )
      if (!['target-issue', 'invariant', 'state-sequence'].includes(subjectType)) {
        throw new Error(`modelLock.ownerContractProofs[${index}].subjectType is invalid`)
      }
      return {
        subjectType: subjectType as OwnerContractProofRecord['subjectType'],
        subjectId: nonEmptyString(
          proof.subjectId,
          `modelLock.ownerContractProofs[${index}].subjectId`,
        ),
        verifiedBy: nonEmptyString(
          proof.verifiedBy,
          `modelLock.ownerContractProofs[${index}].verifiedBy`,
        ),
        verifiedOn: isoDate(
          proof.verifiedOn,
          `modelLock.ownerContractProofs[${index}].verifiedOn`,
        ),
        evidenceSha256: sha256Value(
          proof.evidenceSha256,
          `modelLock.ownerContractProofs[${index}].evidenceSha256`,
        ),
      }
    },
  )
  return {
    schemaVersion: 2,
    animalId: nonEmptyString(source.animalId, 'modelLock.animalId'),
    decision: 'accepted-for-finishing',
    acceptedBy: nonEmptyString(source.acceptedBy, 'modelLock.acceptedBy'),
    acceptedOn: isoDate(source.acceptedOn, 'modelLock.acceptedOn'),
    modelContractSha256: sha256Value(
      source.modelContractSha256,
      'modelLock.modelContractSha256',
    ),
    modelSha256: sha256Value(source.modelSha256, 'modelLock.modelSha256'),
    sourceModelPath: absoluteNormalizedPath(
      source.sourceModelPath,
      'modelLock.sourceModelPath',
    ),
    sourceModelSha256: sha256Value(
      source.sourceModelSha256,
      'modelLock.sourceModelSha256',
    ),
    baselineAssetSha256: sha256Value(
      source.baselineAssetSha256,
      'modelLock.baselineAssetSha256',
    ),
    reviewContractPath: absoluteNormalizedPath(
      source.reviewContractPath,
      'modelLock.reviewContractPath',
    ),
    reviewContractSha256: sha256Value(
      source.reviewContractSha256,
      'modelLock.reviewContractSha256',
    ),
    stageLockId: nonEmptyString(source.stageLockId, 'modelLock.stageLockId'),
    stageLockPath: absoluteNormalizedPath(
      source.stageLockPath,
      'modelLock.stageLockPath',
    ),
    stageLockSha256: sha256Value(
      source.stageLockSha256,
      'modelLock.stageLockSha256',
    ),
    riskRoutePath: absoluteNormalizedPath(
      source.riskRoutePath,
      'modelLock.riskRoutePath',
    ),
    riskRouteSha256: sha256Value(
      source.riskRouteSha256,
      'modelLock.riskRouteSha256',
    ),
    riskEvidenceManifestPath: absoluteNormalizedPath(
      source.riskEvidenceManifestPath,
      'modelLock.riskEvidenceManifestPath',
    ),
    riskEvidenceManifestSha256: sha256Value(
      source.riskEvidenceManifestSha256,
      'modelLock.riskEvidenceManifestSha256',
    ),
    browserCapturePlanPath: absoluteNormalizedPath(
      source.browserCapturePlanPath,
      'modelLock.browserCapturePlanPath',
    ),
    browserCapturePlanSha256: sha256Value(
      source.browserCapturePlanSha256,
      'modelLock.browserCapturePlanSha256',
    ),
    browserCapturePath: absoluteNormalizedPath(
      source.browserCapturePath,
      'modelLock.browserCapturePath',
    ),
    browserCaptureSha256: sha256Value(
      source.browserCaptureSha256,
      'modelLock.browserCaptureSha256',
    ),
    browserCaptureValidationPath: absoluteNormalizedPath(
      source.browserCaptureValidationPath,
      'modelLock.browserCaptureValidationPath',
    ),
    browserCaptureValidationSha256: sha256Value(
      source.browserCaptureValidationSha256,
      'modelLock.browserCaptureValidationSha256',
    ),
    agentReviewPath: absoluteNormalizedPath(
      source.agentReviewPath,
      'modelLock.agentReviewPath',
    ),
    agentReviewSha256: sha256Value(
      source.agentReviewSha256,
      'modelLock.agentReviewSha256',
    ),
    reviewEvidenceBundleSha256: sha256Value(
      source.reviewEvidenceBundleSha256,
      'modelLock.reviewEvidenceBundleSha256',
    ),
    modelQaPath: absoluteNormalizedPath(
      source.modelQaPath,
      'modelLock.modelQaPath',
    ),
    modelQaSha256: sha256Value(
      source.modelQaSha256,
      'modelLock.modelQaSha256',
    ),
    modelQaDecisionSha256: sha256Value(
      source.modelQaDecisionSha256,
      'modelLock.modelQaDecisionSha256',
    ),
    normalizationLogSha256: sha256Value(
      source.normalizationLogSha256,
      'modelLock.normalizationLogSha256',
    ),
    normalizedBlendSha256: sha256Value(
      source.normalizedBlendSha256,
      'modelLock.normalizedBlendSha256',
    ),
    landmarksSha256: sha256Value(
      source.landmarksSha256,
      'modelLock.landmarksSha256',
    ),
    glbValidatorSha256: sha256Value(
      source.glbValidatorSha256,
      'modelLock.glbValidatorSha256',
    ),
    ownerContractProofs,
  }
}

export async function ownerContractProofRecords(
  review: AgentVisualReview,
  verifiedBy: string,
  verifiedOn: string,
): Promise<OwnerContractProofRecord[]> {
  return Promise.all(
    review.contractProofs
      .filter((proof) => proof.requiredAuthority === 'owner-approval')
      .sort((left, right) =>
        `${left.subjectType}:${left.subjectId}`.localeCompare(
          `${right.subjectType}:${right.subjectId}`,
        ),
      )
      .map(async (proof) => ({
        subjectType: proof.subjectType,
        subjectId: proof.subjectId,
        verifiedBy,
        verifiedOn,
        evidenceSha256: (
          await digestEvidencePaths(
            proof.evidence.flatMap((binding) => binding.evidencePaths),
          )
        ).sha256,
      })),
  )
}

async function activeRiskContext(profile: AnimalOnboardingProfile): Promise<{
  readonly errors: readonly string[]
  readonly reviewContractPath: string | null
  readonly reviewContractSha256: string | null
  readonly sourceModelPath: string
  readonly sourceModelSha256: string | null
  readonly baselineAssetSha256: string | null
  readonly stageLockId: string | null
  readonly stageLockPath: string | null
  readonly stageLockSha256: string | null
  readonly routePath: string
  readonly routeSha256: string | null
  readonly classification: string
  readonly recommendedRoute: string
  readonly requiredEvidence: readonly string[]
  readonly l3AcceptedBy: string | null
  readonly l3AcceptedOn: string | null
  readonly riskEvidenceManifestPath: string
  readonly riskEvidenceManifestSha256: string | null
  readonly riskEvidenceSatisfied: readonly string[]
  readonly riskEvidenceMissing: readonly string[]
}> {
  const runDirectory = resolve(profile.runDirectory)
  const verification = await verifyPersistedAssetRiskRoute(
    resolve(runDirectory, 'asset-inspection.json'),
    resolve(runDirectory, 'asset-risk-route.json'),
  )
  const errors = [...verification.errors]
  if (!verification.evidenceCompletion.pass) {
    errors.push(...verification.evidenceCompletion.errors)
    if (verification.evidenceCompletion.missing.length > 0) {
      errors.push(
        `risk evidence is incomplete: ${verification.evidenceCompletion.missing.join(', ')}`,
      )
    }
  }
  const bindings = verification.currentRoute.controlBindings
  const sourceBaseline = await verifySourceBaseline(
    profile,
    bindings.reviewContractPath,
  )
  errors.push(...sourceBaseline.errors)
  if (verification.currentRoute.animalId !== profile.id) {
    errors.push('active risk route belongs to a different animal')
  }
  if (
    bindings.animalWorkspacePath === null ||
    resolve(bindings.animalWorkspacePath) !== runDirectory
  ) {
    errors.push('active risk route binds a different animal workspace')
  }
  return {
    errors,
    reviewContractPath: bindings.reviewContractPath,
    reviewContractSha256: bindings.reviewContractSha256,
    sourceModelPath: sourceBaseline.sourceModelPath,
    sourceModelSha256: sourceBaseline.sourceModelSha256,
    baselineAssetSha256: sourceBaseline.baselineAssetSha256,
    stageLockId: bindings.stageLockId,
    stageLockPath: bindings.stageLockPath,
    stageLockSha256: bindings.stageLockSha256,
    routePath: verification.routePath,
    routeSha256: verification.routeSha256,
    classification: verification.currentRoute.classification,
    recommendedRoute: verification.currentRoute.recommendedRoute,
    requiredEvidence: verification.currentRoute.requiredEvidence,
    l3AcceptedBy: bindings.l3AcceptedBy,
    l3AcceptedOn: bindings.l3AcceptedOn,
    riskEvidenceManifestPath: verification.evidenceCompletion.manifestPath,
    riskEvidenceManifestSha256:
      verification.evidenceCompletion.manifestSha256,
    riskEvidenceSatisfied: verification.evidenceCompletion.satisfied,
    riskEvidenceMissing: verification.evidenceCompletion.missing,
  }
}

export interface ModelQaBinding {
  readonly report: QaReport
  readonly path: string
  readonly sha256: string | null
  readonly decisionSha256: string
  readonly normalizationLogSha256: string | null
  readonly normalizedBlendSha256: string | null
  readonly landmarksSha256: string | null
  readonly glbValidatorSha256: string | null
  readonly errors: readonly string[]
}

export interface KeyModelEvidenceDigests {
  readonly normalizationLogSha256: string | null
  readonly normalizedBlendSha256: string | null
  readonly landmarksSha256: string | null
  readonly glbValidatorSha256: string | null
  readonly errors: readonly string[]
}

export async function keyModelEvidenceDigests(
  profile: AnimalOnboardingProfile,
): Promise<KeyModelEvidenceDigests> {
  const inputs = [
    ['normalization log', resolve(profile.model.normalizationLogPath)],
    ['normalized Blender file', resolve(profile.model.normalizedBlendPath)],
    ['landmarks', resolve(profile.model.landmarksPath)],
    ['GLB validator report', resolve(profile.runDirectory, 'glb-validator.json')],
  ] as const
  const values = await Promise.all(
    inputs.map(async ([label, path]) => {
      try {
        return { label, sha256: (await fileDigest(path)).sha256, error: null }
      } catch (error) {
        return {
          label,
          sha256: null,
          error: `model QA key evidence ${label} is missing or unreadable: ${error instanceof Error ? error.message : String(error)}`,
        }
      }
    }),
  )
  return {
    normalizationLogSha256: values[0].sha256,
    normalizedBlendSha256: values[1].sha256,
    landmarksSha256: values[2].sha256,
    glbValidatorSha256: values[3].sha256,
    errors: values.flatMap(({ error }) => (error === null ? [] : [error])),
  }
}

export function keyModelEvidenceBindingErrors(
  lock: Pick<
    ModelLockRecord,
    | 'normalizationLogSha256'
    | 'normalizedBlendSha256'
    | 'landmarksSha256'
    | 'glbValidatorSha256'
  >,
  current: KeyModelEvidenceDigests,
): string[] {
  const bindings = [
    [
      'normalization log',
      lock.normalizationLogSha256,
      current.normalizationLogSha256,
    ],
    [
      'normalized Blender file',
      lock.normalizedBlendSha256,
      current.normalizedBlendSha256,
    ],
    ['landmarks', lock.landmarksSha256, current.landmarksSha256],
    [
      'GLB validator report',
      lock.glbValidatorSha256,
      current.glbValidatorSha256,
    ],
  ] as const
  return bindings.flatMap(([label, recorded, actual]) =>
    actual === null || actual !== recorded
      ? [`model lock ${label} hash is stale`]
      : [],
  )
}

async function evaluateModelQaBinding(
  profilePath: string,
  options: {
    readonly persist: boolean
    readonly requireCanonicalQa: boolean
  },
): Promise<ModelQaBinding> {
  const profile = await loadProfile(profilePath)
  const evaluated = await evaluateCurrentQa(profilePath, false, {
    preserveGeneratedArtifacts: !options.persist,
  })
  // Round-trip through the strict parser so the owner workflow never relies
  // on a TypeScript shape assertion or a pass-shaped partial JSON object.
  const report = parseQaReport(JSON.parse(JSON.stringify(evaluated)) as unknown)
  const errors = qaReportIntegrityErrors(profile, report, false)
  const profileDigest = await fileDigest(resolve(profilePath))
  if (resolve(report.profilePath) !== resolve(profilePath)) {
    errors.push('model QA profile path is stale')
  }
  if (report.profileSha256 !== profileDigest.sha256) {
    errors.push('model QA profile SHA-256 is stale')
  }
  if (!report.automatedPass) {
    errors.push('fresh model-only machine QA has automated failures')
  }
  if (options.requireCanonicalQa) {
    const canonicalQaPath = resolve(profile.runDirectory, 'qa.json')
    try {
      const canonicalQa = parseQaReport(
        JSON.parse(await readFile(canonicalQaPath, 'utf8')) as unknown,
      )
      errors.push(...qaReportIntegrityErrors(profile, canonicalQa, false))
      if (
        resolve(canonicalQa.profilePath) !== resolve(profilePath) ||
        canonicalQa.profileSha256 !== profileDigest.sha256
      ) {
        errors.push('canonical model-only qa.json profile binding is stale')
      }
      if (qaDecisionSha256(canonicalQa) !== qaDecisionSha256(report)) {
        errors.push('canonical model-only qa.json does not match fresh machine QA')
      }
    } catch (error) {
      errors.push(
        `canonical model-only qa.json is missing or invalid: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  const path = resolve(profile.runDirectory, 'owner-model-qa.json')
  if (options.persist) await writeJson(path, report)
  let persistedSha256: string | null = null
  if (options.persist) {
    try {
      const source = await readFile(path, 'utf8')
      const persisted = parseQaReport(JSON.parse(source) as unknown)
      errors.push(...qaReportIntegrityErrors(profile, persisted, false))
      persistedSha256 = (await fileDigest(path)).sha256
      if (qaDecisionSha256(persisted) !== qaDecisionSha256(report)) {
        errors.push('persisted owner model QA does not match fresh machine QA')
      }
    } catch (error) {
      errors.push(
        `persisted owner model QA is invalid: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  const evidence = await keyModelEvidenceDigests(profile)
  errors.push(...evidence.errors)
  return {
    report,
    path,
    sha256: persistedSha256,
    decisionSha256: qaDecisionSha256(report),
    normalizationLogSha256: evidence.normalizationLogSha256,
    normalizedBlendSha256: evidence.normalizedBlendSha256,
    landmarksSha256: evidence.landmarksSha256,
    glbValidatorSha256: evidence.glbValidatorSha256,
    errors: [...new Set(errors)],
  }
}

export async function prepareOwnerModelReview(
  profilePath: string,
  browserCapturePath: string,
  agentReviewPath: string,
): Promise<{
  readonly ready: boolean
  readonly outputPath: string
  readonly errors: readonly string[]
  readonly modelQa: ModelQaBinding
}> {
  const profile = await loadProfile(profilePath)
  const [review, risk, captureValidation, modelQa] = await Promise.all([
    validateAgentVisualReview(profilePath, browserCapturePath, agentReviewPath),
    activeRiskContext(profile),
    verifyCurrentBrowserCapture(profile, browserCapturePath),
    evaluateModelQaBinding(profilePath, {
      persist: true,
      requireCanonicalQa: true,
    }),
  ])
  const errors = [
    ...review.errors,
    ...risk.errors,
    ...captureValidation.errors,
    ...modelQa.errors,
  ]
  if (
    !risk.reviewContractPath ||
    !risk.reviewContractSha256 ||
    !risk.sourceModelSha256 ||
    !risk.baselineAssetSha256 ||
    !risk.stageLockId ||
    !risk.stageLockPath ||
    !risk.stageLockSha256 ||
    !risk.routeSha256 ||
    !risk.riskEvidenceManifestSha256
  ) {
    errors.push(
      'risk route is missing current contract, stage-lock or completed evidence bindings',
    )
  }
  const model = await fileDigest(resolve(profile.model.outputPath))
  const reviewEvidence = await digestAgentReviewEvidence(review.review)
  const ceilings = requestedModelCeilings(profile.model)
  const outputPath = resolve(profile.runDirectory, 'owner-model-review.md')
  const budgetException = profile.model.budgetException
  const budgetGate = modelQa.report.gates.find(({ id }) => id === 'model-budget')
  const measured = budgetGate?.measured ?? {}
  const qaWarnings = modelQa.report.gates.filter(
    (gate) => gate.kind === 'warning' && gate.status !== 'pass',
  )
  const agentFindings = [
    ...review.review.checks.map((check) => ({
      id: check.id,
      finding: check.finding,
    })),
    ...review.review.contractProofs.map((proof) => ({
      id: `${proof.subjectType}:${proof.subjectId}`,
      finding: proof.finding,
    })),
  ]
    .filter(
      (finding, index, all) =>
        finding.finding.trim().length > 0 &&
        all.findIndex((candidate) => candidate.finding === finding.finding) ===
          index,
    )
    .slice(0, 5)
  if (review.pass && agentFindings.length < 3) {
    errors.push('passing agent review must provide at least three owner-facing findings')
  }
  const uniqueErrors = [...new Set(errors)]
  await writeText(
    outputPath,
    `# Owner model-lock review: ${profile.id}\n\n` +
      `## Decision requested\n\n` +
      `Accept this exact model revision for visual finishing and derivative generation. This does **not** approve narration, publication or production promotion.\n\n` +
      `- Ready for decision: ${uniqueErrors.length === 0 ? 'YES' : 'NO'}\n` +
      `- Model SHA-256: \`${model.sha256}\`\n` +
      `- Source-model SHA-256: \`${risk.sourceModelSha256 ?? 'missing'}\`\n` +
      `- Contract baseline SHA-256: \`${risk.baselineAssetSha256 ?? 'missing'}\`\n` +
      `- Review-contract SHA-256: \`${risk.reviewContractSha256 ?? 'missing'}\`\n` +
      `- Stage-lock SHA-256: \`${risk.stageLockSha256 ?? 'missing'}\`\n` +
      `- Risk-route SHA-256: \`${risk.routeSha256 ?? 'missing'}\`\n` +
      `- Risk-evidence manifest SHA-256: \`${risk.riskEvidenceManifestSha256 ?? 'missing'}\`\n` +
      `- Capture-validation SHA-256: \`${captureValidation.validationSha256 ?? 'missing'}\`\n` +
      `- Capture collector: ${captureValidation.report?.provenance.collector ?? 'missing'} (${captureValidation.report?.provenance.collectorTaskId ?? 'missing task'})\n` +
      `- Capture provenance: ${captureValidation.report?.provenance.assurance ?? 'missing'}; cryptographically verified: no\n` +
      `- Capture provenance boundary: ${captureValidation.report?.provenance.warning ?? 'missing'}\n` +
      `- Review evidence bundle SHA-256: \`${reviewEvidence.sha256}\`\n` +
      `- Fresh machine QA: ${modelQa.report.automatedPass && modelQa.errors.length === 0 ? 'PASS' : 'FAIL'}\n` +
      `- Machine QA snapshot SHA-256: \`${modelQa.sha256 ?? 'missing'}\`\n` +
      `- Machine QA decision SHA-256: \`${modelQa.decisionSha256}\`\n` +
      `- Agent visual review: ${review.pass ? 'PASS' : 'FAIL'}\n` +
      `- Risk route: ${risk.classification} (${risk.recommendedRoute})\n` +
      `- L3 acceptance: ${risk.l3AcceptedBy && risk.l3AcceptedOn ? `${risk.l3AcceptedBy} on ${risk.l3AcceptedOn}` : 'not required / not recorded'}\n\n` +
      `## Budget\n\n` +
      `| Metric | Measured | Target | Recorded ceiling |\n| --- | ---: | ---: | ---: |\n` +
      `| GLB bytes | ${String(measured.bytes ?? 'missing')} | ${MODEL_BUDGET_POLICY.targets.bytes} | ${ceilings.bytes} |\n` +
      `| Triangles | ${String(measured.triangles ?? 'missing')} | ${MODEL_BUDGET_POLICY.targets.triangles} | ${ceilings.triangles} |\n` +
      `| Draw calls | ${String(measured.drawCalls ?? 'missing')} | ${MODEL_BUDGET_POLICY.targets.drawCalls} | ${ceilings.drawCalls} |\n` +
      `| Materials | ${String(measured.materials ?? 'missing')} | ${MODEL_BUDGET_POLICY.targets.materials} | ${ceilings.materials} |\n` +
      `| Bones | ${String(measured.bones ?? 'missing')} | ${MODEL_BUDGET_POLICY.targets.bones} | ${ceilings.bones} |\n\n` +
      (budgetException
        ? `Budget exception record: ${budgetException.metrics.join(', ')} — ${budgetException.reason} (recorded risk owner ${budgetException.acceptedBy} on ${budgetException.acceptedOn}). This record allows the machine gate to assess the requested ceiling; it does not approve the model. Only the owner model-lock decision below accepts this exact revision for finishing.\n\n`
        : 'Budget exception: none.\n\n') +
      `## QA warnings\n\n${qaWarnings.map((warning) => `- ${warning.id}: ${warning.summary}`).join('\n') || '- None'}\n\n` +
      `## Route evidence\n\n${risk.requiredEvidence.map((item) => `- ${risk.riskEvidenceSatisfied.includes(item) ? 'COMPLETE' : 'MISSING'}: ${item}`).join('\n') || '- No additional route evidence declared.'}\n\n` +
      `## Agent findings\n\n${agentFindings.map((check) => `- ${check.id}: ${check.finding}`).join('\n') || '- No passing findings were recorded.'}\n\nFull review: \`${review.summaryPath}\`.\n\n` +
      `## Blocking errors\n\n${uniqueErrors.map((error) => `- ${error}`).join('\n') || '- None'}\n\n` +
      `## Explicit boundary\n\nA model lock authorizes backgrounds, posters, thumbnails and narration drafts for this SHA only. Final public distribution still requires the separate production approval record.\n`,
  )
  return {
    ready: uniqueErrors.length === 0,
    outputPath,
    errors: uniqueErrors,
    modelQa,
  }
}

export async function recordModelLock(
  profilePath: string,
  browserCapturePath: string,
  agentReviewPath: string,
  acceptedBy: string,
  acceptedOn: string,
): Promise<ModelLockRecord> {
  const owner = nonEmptyString(acceptedBy, 'model lock approver')
  const date = isoDate(acceptedOn)
  const profile = await loadProfile(profilePath)
  const packet = await prepareOwnerModelReview(
    profilePath,
    browserCapturePath,
    agentReviewPath,
  )
  if (!packet.ready) {
    throw new Error(`model lock is blocked: ${packet.errors.join('; ')}`)
  }
  const [risk, captureValidation, model, browserCapture, agentReview] =
    await Promise.all([
      activeRiskContext(profile),
      verifyCurrentBrowserCapture(profile, browserCapturePath),
      fileDigest(resolve(profile.model.outputPath)),
      fileDigest(resolve(browserCapturePath)),
      fileDigest(resolve(agentReviewPath)),
    ])
  const review = parseAgentVisualReview(
    JSON.parse(await readFile(resolve(agentReviewPath), 'utf8')) as unknown,
  )
  const [reviewEvidence, ownerProofs] = await Promise.all([
    digestAgentReviewEvidence(review),
    ownerContractProofRecords(review, owner, date),
  ])
  const finalModelQa = await evaluateModelQaBinding(profilePath, {
    persist: false,
    requireCanonicalQa: false,
  })
  const riskEvidenceManifestSha256 = risk.riskEvidenceManifestSha256
  if (
    !risk.reviewContractPath ||
    !risk.reviewContractSha256 ||
    !risk.sourceModelSha256 ||
    !risk.baselineAssetSha256 ||
    !risk.stageLockId ||
    !risk.stageLockPath ||
    !risk.stageLockSha256 ||
    !risk.routeSha256 ||
    !riskEvidenceManifestSha256 ||
    !captureValidation.planSha256 ||
    !captureValidation.evidenceSha256 ||
    !captureValidation.validationSha256 ||
    !packet.modelQa.sha256 ||
    !packet.modelQa.normalizationLogSha256 ||
    !packet.modelQa.normalizedBlendSha256 ||
    !packet.modelQa.landmarksSha256 ||
    !packet.modelQa.glbValidatorSha256
  ) {
    throw new Error('model lock inputs lost a required hash binding')
  }
  if (
    finalModelQa.errors.length > 0 ||
    finalModelQa.decisionSha256 !== packet.modelQa.decisionSha256 ||
    finalModelQa.normalizationLogSha256 !==
      packet.modelQa.normalizationLogSha256 ||
    finalModelQa.normalizedBlendSha256 !==
      packet.modelQa.normalizedBlendSha256 ||
    finalModelQa.landmarksSha256 !== packet.modelQa.landmarksSha256 ||
    finalModelQa.glbValidatorSha256 !== packet.modelQa.glbValidatorSha256
  ) {
    throw new Error(
      `model QA or its key evidence changed during owner review: ${finalModelQa.errors.join('; ') || 'decision/evidence digest changed'}`,
    )
  }
  const sourceModelSha256 = risk.sourceModelSha256
  const baselineAssetSha256 = risk.baselineAssetSha256
  const finalSourceBaseline = await verifySourceBaseline(
    profile,
    risk.reviewContractPath,
  )
  if (
    !finalSourceBaseline.pass ||
    finalSourceBaseline.sourceModelSha256 !== sourceModelSha256 ||
    finalSourceBaseline.baselineAssetSha256 !== baselineAssetSha256
  ) {
    throw new Error(
      `model lock source baseline changed during review: ${finalSourceBaseline.errors.join('; ') || 'source digest changed'}`,
    )
  }
  const record: ModelLockRecord = {
    schemaVersion: 2,
    animalId: profile.id,
    decision: 'accepted-for-finishing',
    acceptedBy: owner,
    acceptedOn: date,
    modelContractSha256: modelContractSha256(profile),
    modelSha256: model.sha256,
    sourceModelPath: finalSourceBaseline.sourceModelPath,
    sourceModelSha256,
    baselineAssetSha256,
    reviewContractPath: resolve(risk.reviewContractPath),
    reviewContractSha256: risk.reviewContractSha256,
    stageLockId: risk.stageLockId,
    stageLockPath: resolve(risk.stageLockPath),
    stageLockSha256: risk.stageLockSha256,
    riskRoutePath: risk.routePath,
    riskRouteSha256: risk.routeSha256,
    riskEvidenceManifestPath: risk.riskEvidenceManifestPath,
    riskEvidenceManifestSha256,
    browserCapturePlanPath: captureValidation.planPath,
    browserCapturePlanSha256: captureValidation.planSha256,
    browserCapturePath: captureValidation.evidencePath,
    browserCaptureSha256: browserCapture.sha256,
    browserCaptureValidationPath: captureValidation.validationPath,
    browserCaptureValidationSha256: captureValidation.validationSha256,
    agentReviewPath: resolve(agentReviewPath),
    agentReviewSha256: agentReview.sha256,
    reviewEvidenceBundleSha256: reviewEvidence.sha256,
    modelQaPath: packet.modelQa.path,
    modelQaSha256: packet.modelQa.sha256,
    modelQaDecisionSha256: packet.modelQa.decisionSha256,
    normalizationLogSha256: packet.modelQa.normalizationLogSha256,
    normalizedBlendSha256: packet.modelQa.normalizedBlendSha256,
    landmarksSha256: packet.modelQa.landmarksSha256,
    glbValidatorSha256: packet.modelQa.glbValidatorSha256,
    ownerContractProofs: ownerProofs,
  }
  await writeJson(resolve(profile.runDirectory, 'model-lock.json'), record)
  return record
}

export async function verifyModelLock(
  profilePath: string,
): Promise<{ readonly pass: boolean; readonly errors: readonly string[] }> {
  const profile = await loadProfile(profilePath)
  return verifyModelLockForProfile(profile, profilePath)
}

export async function verifyModelLockForProfile(
  profile: AnimalOnboardingProfile,
  profilePath?: string,
): Promise<{ readonly pass: boolean; readonly errors: readonly string[] }> {
  const lockPath = resolve(profile.runDirectory, 'model-lock.json')
  if (!(await regularFile(lockPath))) {
    return { pass: false, errors: ['model-lock.json is missing'] }
  }
  let lock: ModelLockRecord
  try {
    lock = parseModelLockRecord(
      JSON.parse(await readFile(lockPath, 'utf8')) as unknown,
    )
  } catch (error) {
    return {
      pass: false,
      errors: [
        `model-lock.json is invalid: ${error instanceof Error ? error.message : String(error)}`,
      ],
    }
  }
  const errors: string[] = []
  const actualProfilePath = profilePath ?? resolve(profile.runDirectory, 'profile.json')
  const [risk, captureValidation, model] = await Promise.all([
    activeRiskContext(profile),
    verifyCurrentBrowserCapture(profile, lock.browserCapturePath),
    fileDigest(resolve(profile.model.outputPath)),
  ])
  errors.push(...risk.errors, ...captureValidation.errors)
  const expectedModelQaPath = resolve(profile.runDirectory, 'owner-model-qa.json')
  if (resolve(lock.modelQaPath) !== expectedModelQaPath) {
    errors.push('model lock QA snapshot path is non-canonical')
  }
  try {
    const source = await readFile(lock.modelQaPath, 'utf8')
    const storedModelQa = parseQaReport(JSON.parse(source) as unknown)
    const digest = await fileDigest(lock.modelQaPath)
    if (digest.sha256 !== lock.modelQaSha256) {
      errors.push('model lock QA snapshot hash is stale')
    }
    errors.push(...qaReportIntegrityErrors(profile, storedModelQa, false))
    if (
      resolve(storedModelQa.profilePath) !== resolve(actualProfilePath) ||
      storedModelQa.profileSha256 !== (await fileDigest(actualProfilePath)).sha256
    ) {
      errors.push('model lock QA snapshot profile binding is stale')
    }
    if (qaDecisionSha256(storedModelQa) !== lock.modelQaDecisionSha256) {
      errors.push('model lock QA decision digest is stale')
    }
  } catch (error) {
    errors.push(
      `model lock QA snapshot is invalid: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  try {
    const currentModelQa = await evaluateModelQaBinding(actualProfilePath, {
      persist: false,
      requireCanonicalQa: false,
    })
    errors.push(...currentModelQa.errors)
    if (currentModelQa.decisionSha256 !== lock.modelQaDecisionSha256) {
      errors.push('model lock QA no longer matches fresh machine evaluation')
    }
    errors.push(...keyModelEvidenceBindingErrors(lock, currentModelQa))
  } catch (error) {
    errors.push(
      `fresh model-only QA could not be evaluated: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  let reviewResult: Awaited<ReturnType<typeof validateAgentVisualReview>> | null = null
  try {
    reviewResult = await validateAgentVisualReview(
      actualProfilePath,
      lock.browserCapturePath,
      lock.agentReviewPath,
    )
    errors.push(...reviewResult.errors)
  } catch (error) {
    errors.push(
      `model lock agent review is invalid: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (lock.animalId !== profile.id) errors.push('model lock animalId is stale')
  if (lock.modelContractSha256 !== modelContractSha256(profile)) {
    errors.push('model lock model-contract hash is stale')
  }
  if (lock.modelSha256 !== model.sha256) errors.push('model lock GLB hash is stale')
  if (
    lock.sourceModelPath !== risk.sourceModelPath ||
    lock.sourceModelSha256 !== risk.sourceModelSha256 ||
    lock.baselineAssetSha256 !== risk.baselineAssetSha256 ||
    risk.sourceModelSha256 !== risk.baselineAssetSha256
  ) {
    errors.push('model lock source-model baseline binding is stale')
  }
  const expectedBindings: Array<readonly [string, string, string | null, string | null]> = [
    ['review contract', lock.reviewContractPath, risk.reviewContractPath, risk.reviewContractSha256],
    ['stage lock', lock.stageLockPath, risk.stageLockPath, risk.stageLockSha256],
    ['risk route', lock.riskRoutePath, risk.routePath, risk.routeSha256],
    ['risk evidence manifest', lock.riskEvidenceManifestPath, risk.riskEvidenceManifestPath, risk.riskEvidenceManifestSha256],
    ['browser capture plan', lock.browserCapturePlanPath, captureValidation.planPath, captureValidation.planSha256],
    ['browser capture', lock.browserCapturePath, captureValidation.evidencePath, captureValidation.evidenceSha256],
    ['browser capture validation', lock.browserCaptureValidationPath, captureValidation.validationPath, captureValidation.validationSha256],
  ]
  const lockDigests = [
    lock.reviewContractSha256,
    lock.stageLockSha256,
    lock.riskRouteSha256,
    lock.riskEvidenceManifestSha256,
    lock.browserCapturePlanSha256,
    lock.browserCaptureSha256,
    lock.browserCaptureValidationSha256,
  ]
  for (const [index, [label, recordedPath, currentPath, currentSha256]] of expectedBindings.entries()) {
    if (
      currentPath === null ||
      resolve(recordedPath) !== resolve(currentPath) ||
      lockDigests[index] !== currentSha256
    ) {
      errors.push(`model lock ${label} binding is stale`)
    }
  }
  if (lock.stageLockId !== risk.stageLockId) {
    errors.push('model lock stage-lock ID is stale')
  }
  const agentReviewDigest = await fileDigest(lock.agentReviewPath).catch(() => null)
  if (agentReviewDigest?.sha256 !== lock.agentReviewSha256) {
    errors.push('model lock agent review is stale')
  }
  if (reviewResult) {
    const reviewEvidence = await digestAgentReviewEvidence(reviewResult.review)
    if (reviewEvidence.sha256 !== lock.reviewEvidenceBundleSha256) {
      errors.push('model lock review evidence bundle is stale')
    }
    const expectedOwnerProofs = await ownerContractProofRecords(
      reviewResult.review,
      lock.acceptedBy,
      lock.acceptedOn,
    )
    if (JSON.stringify(expectedOwnerProofs) !== JSON.stringify(lock.ownerContractProofs)) {
      errors.push('model lock owner contract proofs are stale or incomplete')
    }
  }
  return { pass: errors.length === 0, errors: [...new Set(errors)] }
}
