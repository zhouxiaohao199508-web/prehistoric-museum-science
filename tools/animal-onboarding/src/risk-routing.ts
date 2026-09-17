import { lstat, readFile, realpath } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import { fileDigest, sha256, writeJson } from './io'
import {
  REVIEW_ISSUE_CATEGORIES,
  type ReviewContract,
  type ReviewIssueCategory,
} from './review-contract'
import { loadReviewContract } from './review-contract'
import {
  loadL3AcceptanceDecisionRecord,
  loadStageLockRecord,
} from './stage-lock'

export const PLANNED_ASSET_OPERATIONS = [
  'reuse-as-is',
  'metadata-only',
  'presentation-tuning',
  'axis-scale-normalization',
  'material-relink',
  'texture-repack',
  'animation-rename',
  'animation-retime',
  'mesh-decimation',
  'bounded-part-transform',
  'bounded-component-removal',
  'topology-repair',
  'bone-adjustment',
  'skin-weight-repair',
  'source-rig-animation',
  'material-rebuild',
  'new-rig',
  'full-rebind',
  'anatomy-reconstruction',
  'complex-transparency-rebuild',
  'mouth-reconstruction',
] as const

export type PlannedAssetOperation = (typeof PLANNED_ASSET_OPERATIONS)[number]
export type AssetRiskLevel = 'L0' | 'L1' | 'L2' | 'L3'
export type RiskClassification = AssetRiskLevel | 'blocked'

export interface InspectedSourcePackage {
  readonly modelPresent: boolean
  readonly directSourceVerified: boolean
  readonly modificationAllowed: boolean
  readonly redistributionAllowed: boolean
  readonly primaryFormat: 'glb' | 'gltf' | 'blend' | 'fbx' | 'obj' | 'other'
  readonly runtimeReadyGlb: boolean
  readonly editableSource: boolean
  readonly texturesComplete: boolean
  readonly topology: 'verified-clean' | 'repairable' | 'broken' | 'unknown'
  readonly semanticParts: 'complete' | 'partial' | 'none' | 'unknown'
  readonly rig: 'verified' | 'unverified' | 'none'
  readonly skinWeights: 'verified' | 'unverified' | 'none'
  readonly animations: 'verified' | 'unverified' | 'none'
  readonly transparency: 'none' | 'simple' | 'complex' | 'unknown'
  readonly evidencePaths: readonly string[]
}

export interface InspectedAssetIssue {
  readonly id: string
  readonly category: ReviewIssueCategory
  readonly severity: 'warning' | 'must-fix'
  readonly scope: 'localized' | 'distributed' | 'unknown'
  readonly description: string
  readonly reviewContractBinding: {
    readonly subjectType: 'target-issue' | 'invariant' | 'state-sequence'
    readonly subjectId: string
    readonly evidenceRequirementIds: readonly string[]
  }
}

export interface L3AcceptanceRecord {
  readonly status: 'accepted' | 'not-accepted'
  readonly acceptedBy: string | null
  readonly acceptedOn: string | null
  readonly recordPath: string | null
  readonly recordSha256: string | null
  readonly acceptedReviewContractSha256: string | null
}

export interface AssetExecutionControls {
  readonly l3Acceptance: L3AcceptanceRecord
  readonly parallelRequested: boolean
  readonly animalWorkspacePath: string | null
  readonly stageLockId: string | null
  readonly stageLockPath: string | null
  readonly stageLockSha256: string | null
  readonly reviewContractPath: string | null
  readonly reviewContractSha256: string | null
}

export interface AssetInspection {
  readonly schemaVersion: 1
  readonly animalId: string
  readonly inspectionId: string
  readonly sourcePackage: InspectedSourcePackage
  readonly plannedOperations: readonly PlannedAssetOperation[]
  readonly knownIssues: readonly InspectedAssetIssue[]
  readonly executionControls: AssetExecutionControls
}

export type RecommendedAssetRoute =
  | 'direct-runtime-validation'
  | 'deterministic-normalization'
  | 'bounded-structural-repair'
  | 'isolated-expert-rebuild'
  | 'resolve-source-rights'
  | 'resolve-scientific-identity'
  | 'obtain-l3-acceptance'
  | 'establish-isolation-and-stage-lock'

export interface AssetRiskRoutingResult {
  readonly schemaVersion: 1
  readonly animalId: string
  readonly classification: RiskClassification
  readonly underlyingRiskLevel: AssetRiskLevel
  readonly canStart: boolean
  readonly recommendedRoute: RecommendedAssetRoute
  readonly parallelExecution: 'not-requested' | 'allowed' | 'blocked'
  readonly reasons: readonly string[]
  readonly blockingReasons: readonly string[]
  readonly requiredEvidence: readonly string[]
  readonly requiredStageLocks: readonly string[]
  readonly controlBindings: {
    readonly animalWorkspacePath: string | null
    readonly stageLockId: string | null
    readonly stageLockPath: string | null
    readonly stageLockSha256: string | null
    readonly reviewContractPath: string | null
    readonly reviewContractSha256: string | null
    readonly l3AcceptedBy: string | null
    readonly l3AcceptedOn: string | null
    readonly l3AcceptanceRecordPath: string | null
    readonly l3AcceptanceRecordSha256: string | null
    readonly l3AcceptedReviewContractSha256: string | null
  }
}

export interface PersistedAssetRiskRouteVerification {
  readonly pass: boolean
  readonly errors: readonly string[]
  readonly inspection: AssetInspection
  readonly currentRoute: AssetRiskRoutingResult
  readonly routePath: string
  readonly routeSha256: string | null
  readonly evidenceCompletion: AssetRiskEvidenceCompletion
}

export interface AssetRiskEvidenceArtifact {
  readonly path: string
  readonly bytes: number
  readonly sha256: string
}

export interface AssetRiskEvidenceManifest {
  readonly schemaVersion: 1
  readonly kind: 'animal-risk-evidence-manifest'
  readonly animalId: string
  readonly inspectionPath: string
  readonly inspectionSha256: string
  readonly routePath: string
  readonly routeSha256: string
  readonly evidence: readonly {
    readonly id: string
    readonly artifacts: readonly AssetRiskEvidenceArtifact[]
  }[]
}

export interface AssetRiskEvidenceCompletion {
  readonly pass: boolean
  readonly manifestPath: string
  readonly manifestSha256: string | null
  readonly required: readonly string[]
  readonly satisfied: readonly string[]
  readonly missing: readonly string[]
  readonly errors: readonly string[]
}

type JsonObject = Record<string, unknown>

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/
const sha256Pattern = /^[a-f0-9]{64}$/

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

const riskRank: Readonly<Record<AssetRiskLevel, number>> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
}

const operationRisk: Readonly<Record<PlannedAssetOperation, AssetRiskLevel>> = {
  'reuse-as-is': 'L0',
  'metadata-only': 'L0',
  'presentation-tuning': 'L1',
  'axis-scale-normalization': 'L1',
  'material-relink': 'L1',
  'texture-repack': 'L1',
  'animation-rename': 'L1',
  'animation-retime': 'L1',
  'mesh-decimation': 'L2',
  'bounded-part-transform': 'L2',
  'bounded-component-removal': 'L2',
  'topology-repair': 'L2',
  'bone-adjustment': 'L2',
  'skin-weight-repair': 'L2',
  'source-rig-animation': 'L3',
  'material-rebuild': 'L2',
  'new-rig': 'L3',
  'full-rebind': 'L3',
  'anatomy-reconstruction': 'L3',
  'complex-transparency-rebuild': 'L3',
  'mouth-reconstruction': 'L3',
}

function objectWithExactKeys(
  value: unknown,
  label: string,
  keys: readonly string[],
): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  const result = value as JsonObject
  const allowed = new Set(keys)
  for (const key of Object.keys(result)) {
    if (!allowed.has(key)) throw new Error(`${label}.${key} is not allowed`)
  }
  for (const key of keys) {
    if (!(key in result)) throw new Error(`${label}.${key} is required`)
  }
  return result
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  if (value !== value.trim()) {
    throw new Error(`${label} must not have leading or trailing whitespace`)
  }
  return value
}

function identifier(value: unknown, label: string): string {
  const result = stringValue(value, label)
  if (!idPattern.test(result)) {
    throw new Error(`${label} must be a lowercase kebab-case identifier`)
  }
  return result
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`)
  return value
}

function nullableString(value: unknown, label: string): string | null {
  return value === null ? null : stringValue(value, label)
}

function nullableIdentifier(value: unknown, label: string): string | null {
  return value === null ? null : identifier(value, label)
}

function nullableSha256(value: unknown, label: string): string | null {
  if (value === null) return null
  const result = stringValue(value, label)
  if (!sha256Pattern.test(result)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest or null`)
  }
  return result
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new Error(`${label} must be one of ${values.join(', ')}`)
  }
  return value as T
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty string array`)
  }
  const result = value.map((entry, index) =>
    stringValue(entry, `${label}[${index}]`),
  )
  if (new Set(result).size !== result.length) {
    throw new Error(`${label} must not contain duplicates`)
  }
  return result.sort(compareStrings)
}

function parseSourcePackage(value: unknown): InspectedSourcePackage {
  const label = 'assetInspection.sourcePackage'
  const source = objectWithExactKeys(value, label, [
    'modelPresent',
    'directSourceVerified',
    'modificationAllowed',
    'redistributionAllowed',
    'primaryFormat',
    'runtimeReadyGlb',
    'editableSource',
    'texturesComplete',
    'topology',
    'semanticParts',
    'rig',
    'skinWeights',
    'animations',
    'transparency',
    'evidencePaths',
  ])
  return {
    modelPresent: booleanValue(source.modelPresent, `${label}.modelPresent`),
    directSourceVerified: booleanValue(
      source.directSourceVerified,
      `${label}.directSourceVerified`,
    ),
    modificationAllowed: booleanValue(
      source.modificationAllowed,
      `${label}.modificationAllowed`,
    ),
    redistributionAllowed: booleanValue(
      source.redistributionAllowed,
      `${label}.redistributionAllowed`,
    ),
    primaryFormat: enumValue(
      source.primaryFormat,
      ['glb', 'gltf', 'blend', 'fbx', 'obj', 'other'] as const,
      `${label}.primaryFormat`,
    ),
    runtimeReadyGlb: booleanValue(
      source.runtimeReadyGlb,
      `${label}.runtimeReadyGlb`,
    ),
    editableSource: booleanValue(
      source.editableSource,
      `${label}.editableSource`,
    ),
    texturesComplete: booleanValue(
      source.texturesComplete,
      `${label}.texturesComplete`,
    ),
    topology: enumValue(
      source.topology,
      ['verified-clean', 'repairable', 'broken', 'unknown'] as const,
      `${label}.topology`,
    ),
    semanticParts: enumValue(
      source.semanticParts,
      ['complete', 'partial', 'none', 'unknown'] as const,
      `${label}.semanticParts`,
    ),
    rig: enumValue(
      source.rig,
      ['verified', 'unverified', 'none'] as const,
      `${label}.rig`,
    ),
    skinWeights: enumValue(
      source.skinWeights,
      ['verified', 'unverified', 'none'] as const,
      `${label}.skinWeights`,
    ),
    animations: enumValue(
      source.animations,
      ['verified', 'unverified', 'none'] as const,
      `${label}.animations`,
    ),
    transparency: enumValue(
      source.transparency,
      ['none', 'simple', 'complex', 'unknown'] as const,
      `${label}.transparency`,
    ),
    evidencePaths: stringArray(source.evidencePaths, `${label}.evidencePaths`),
  }
}

function parseKnownIssues(value: unknown): InspectedAssetIssue[] {
  const label = 'assetInspection.knownIssues'
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  const issues = value.map((entry, index): InspectedAssetIssue => {
    const itemLabel = `${label}[${index}]`
    const source = objectWithExactKeys(entry, itemLabel, [
      'id',
      'category',
      'severity',
      'scope',
      'description',
      'reviewContractBinding',
    ])
    const bindingLabel = `${itemLabel}.reviewContractBinding`
    const binding = objectWithExactKeys(
      source.reviewContractBinding,
      bindingLabel,
      ['subjectType', 'subjectId', 'evidenceRequirementIds'],
    )
    return {
      id: identifier(source.id, `${itemLabel}.id`),
      category: enumValue(
        source.category,
        REVIEW_ISSUE_CATEGORIES,
        `${itemLabel}.category`,
      ),
      severity: enumValue(
        source.severity,
        ['warning', 'must-fix'] as const,
        `${itemLabel}.severity`,
      ),
      scope: enumValue(
        source.scope,
        ['localized', 'distributed', 'unknown'] as const,
        `${itemLabel}.scope`,
      ),
      description: stringValue(
        source.description,
        `${itemLabel}.description`,
      ),
      reviewContractBinding: {
        subjectType: enumValue(
          binding.subjectType,
          ['target-issue', 'invariant', 'state-sequence'] as const,
          `${bindingLabel}.subjectType`,
        ),
        subjectId: identifier(
          binding.subjectId,
          `${bindingLabel}.subjectId`,
        ),
        evidenceRequirementIds: stringArray(
          binding.evidenceRequirementIds,
          `${bindingLabel}.evidenceRequirementIds`,
        ).map((id, evidenceIndex) =>
          identifier(id, `${bindingLabel}.evidenceRequirementIds[${evidenceIndex}]`),
        ),
      },
    }
  })
  const ids = issues.map((issue) => issue.id)
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} must not contain duplicate ids`)
  }
  return issues.sort((left, right) => compareStrings(left.id, right.id))
}

function parsePlannedOperations(value: unknown): PlannedAssetOperation[] {
  const label = 'assetInspection.plannedOperations'
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array`)
  }
  const operations = value.map((entry, index) =>
    enumValue(entry, PLANNED_ASSET_OPERATIONS, `${label}[${index}]`),
  )
  if (new Set(operations).size !== operations.length) {
    throw new Error(`${label} must not contain duplicates`)
  }
  if (
    operations.includes('reuse-as-is') &&
    operations.some(
      (operation) => operation !== 'reuse-as-is' && operation !== 'metadata-only',
    )
  ) {
    throw new Error(
      `${label} cannot combine reuse-as-is with an asset mutation`,
    )
  }
  return operations.sort(compareStrings)
}

function parseL3Acceptance(value: unknown): L3AcceptanceRecord {
  const label = 'assetInspection.executionControls.l3Acceptance'
  const source = objectWithExactKeys(value, label, [
    'status',
    'acceptedBy',
    'acceptedOn',
    'recordPath',
    'recordSha256',
    'acceptedReviewContractSha256',
  ])
  const status = enumValue(
    source.status,
    ['accepted', 'not-accepted'] as const,
    `${label}.status`,
  )
  if (status === 'not-accepted') {
    for (const key of [
      'acceptedBy',
      'acceptedOn',
      'recordPath',
      'recordSha256',
      'acceptedReviewContractSha256',
    ]) {
      if (source[key] !== null) {
        throw new Error(`${label}.${key} must be null when status is not-accepted`)
      }
    }
    return {
      status,
      acceptedBy: null,
      acceptedOn: null,
      recordPath: null,
      recordSha256: null,
      acceptedReviewContractSha256: null,
    }
  }
  const acceptedBy = stringValue(source.acceptedBy, `${label}.acceptedBy`)
  const acceptedOn = stringValue(source.acceptedOn, `${label}.acceptedOn`)
  if (!isoDatePattern.test(acceptedOn)) {
    throw new Error(`${label}.acceptedOn must be YYYY-MM-DD`)
  }
  const recordPath = stringValue(source.recordPath, `${label}.recordPath`)
  const recordSha256 = nullableSha256(
    source.recordSha256,
    `${label}.recordSha256`,
  )
  if (recordSha256 === null) {
    throw new Error(`${label}.recordSha256 is required when status is accepted`)
  }
  const acceptedReviewContractSha256 = nullableSha256(
    source.acceptedReviewContractSha256,
    `${label}.acceptedReviewContractSha256`,
  )
  if (acceptedReviewContractSha256 === null) {
    throw new Error(
      `${label}.acceptedReviewContractSha256 is required when status is accepted`,
    )
  }
  return {
    status,
    acceptedBy,
    acceptedOn,
    recordPath,
    recordSha256,
    acceptedReviewContractSha256,
  }
}

function parseExecutionControls(value: unknown): AssetExecutionControls {
  const label = 'assetInspection.executionControls'
  const source = objectWithExactKeys(value, label, [
    'l3Acceptance',
    'parallelRequested',
    'animalWorkspacePath',
    'stageLockId',
    'stageLockPath',
    'stageLockSha256',
    'reviewContractPath',
    'reviewContractSha256',
  ])
  return {
    l3Acceptance: parseL3Acceptance(source.l3Acceptance),
    parallelRequested: booleanValue(
      source.parallelRequested,
      `${label}.parallelRequested`,
    ),
    animalWorkspacePath: nullableString(
      source.animalWorkspacePath,
      `${label}.animalWorkspacePath`,
    ),
    stageLockId: nullableIdentifier(source.stageLockId, `${label}.stageLockId`),
    stageLockPath: nullableString(
      source.stageLockPath,
      `${label}.stageLockPath`,
    ),
    stageLockSha256: nullableSha256(
      source.stageLockSha256,
      `${label}.stageLockSha256`,
    ),
    reviewContractPath: nullableString(
      source.reviewContractPath,
      `${label}.reviewContractPath`,
    ),
    reviewContractSha256: nullableSha256(
      source.reviewContractSha256,
      `${label}.reviewContractSha256`,
    ),
  }
}

export function parseAssetInspection(value: unknown): AssetInspection {
  const source = objectWithExactKeys(value, 'assetInspection', [
    'schemaVersion',
    'animalId',
    'inspectionId',
    'sourcePackage',
    'plannedOperations',
    'knownIssues',
    'executionControls',
  ])
  if (source.schemaVersion !== 1) {
    throw new Error('assetInspection.schemaVersion must be 1')
  }
  return {
    schemaVersion: 1,
    animalId: identifier(source.animalId, 'assetInspection.animalId'),
    inspectionId: identifier(source.inspectionId, 'assetInspection.inspectionId'),
    sourcePackage: parseSourcePackage(source.sourcePackage),
    plannedOperations: parsePlannedOperations(source.plannedOperations),
    knownIssues: parseKnownIssues(source.knownIssues),
    executionControls: parseExecutionControls(source.executionControls),
  }
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return value as number
}

function sha256Value(value: unknown, label: string): string {
  const result = nullableSha256(value, label)
  if (result === null) throw new Error(`${label} must be a lowercase SHA-256 digest`)
  return result
}

function absoluteNormalizedPath(value: unknown, label: string): string {
  const path = stringValue(value, label)
  if (!isAbsolute(path) || resolve(path) !== path) {
    throw new Error(`${label} must be an absolute normalized path`)
  }
  return path
}

export function parseAssetRiskEvidenceManifest(
  value: unknown,
): AssetRiskEvidenceManifest {
  const label = 'assetRiskEvidenceManifest'
  const source = objectWithExactKeys(value, label, [
    'schemaVersion',
    'kind',
    'animalId',
    'inspectionPath',
    'inspectionSha256',
    'routePath',
    'routeSha256',
    'evidence',
  ])
  if (source.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`)
  }
  if (source.kind !== 'animal-risk-evidence-manifest') {
    throw new Error(`${label}.kind must be animal-risk-evidence-manifest`)
  }
  if (!Array.isArray(source.evidence)) {
    throw new Error(`${label}.evidence must be an array`)
  }
  const evidence = source.evidence.map((entry, index) => {
    const entryLabel = `${label}.evidence[${index}]`
    const item = objectWithExactKeys(entry, entryLabel, ['id', 'artifacts'])
    if (!Array.isArray(item.artifacts) || item.artifacts.length === 0) {
      throw new Error(`${entryLabel}.artifacts must be a non-empty array`)
    }
    const artifacts = item.artifacts.map((artifact, artifactIndex) => {
      const artifactLabel = `${entryLabel}.artifacts[${artifactIndex}]`
      const record = objectWithExactKeys(artifact, artifactLabel, [
        'path',
        'bytes',
        'sha256',
      ])
      return {
        path: absoluteNormalizedPath(record.path, `${artifactLabel}.path`),
        bytes: positiveInteger(record.bytes, `${artifactLabel}.bytes`),
        sha256: sha256Value(record.sha256, `${artifactLabel}.sha256`),
      }
    })
    if (new Set(artifacts.map(({ path }) => path)).size !== artifacts.length) {
      throw new Error(`${entryLabel}.artifacts must not contain duplicate paths`)
    }
    return {
      id: identifier(item.id, `${entryLabel}.id`),
      artifacts: artifacts.sort((left, right) =>
        compareStrings(left.path, right.path),
      ),
    }
  })
  if (new Set(evidence.map(({ id }) => id)).size !== evidence.length) {
    throw new Error(`${label}.evidence must not contain duplicate ids`)
  }
  return {
    schemaVersion: 1,
    kind: 'animal-risk-evidence-manifest',
    animalId: identifier(source.animalId, `${label}.animalId`),
    inspectionPath: absoluteNormalizedPath(
      source.inspectionPath,
      `${label}.inspectionPath`,
    ),
    inspectionSha256: sha256Value(
      source.inspectionSha256,
      `${label}.inspectionSha256`,
    ),
    routePath: absoluteNormalizedPath(source.routePath, `${label}.routePath`),
    routeSha256: sha256Value(source.routeSha256, `${label}.routeSha256`),
    evidence: evidence.sort((left, right) => compareStrings(left.id, right.id)),
  }
}

function maximumRisk(left: AssetRiskLevel, right: AssetRiskLevel): AssetRiskLevel {
  return riskRank[left] >= riskRank[right] ? left : right
}

function issueRisk(issue: InspectedAssetIssue): AssetRiskLevel {
  if (issue.severity === 'warning') return 'L0'
  if (issue.category === 'scientific-identity') return 'L0'
  if (
    ['anatomy', 'rigging', 'deformation', 'transparency'].includes(
      issue.category,
    )
  ) {
    return issue.scope === 'localized' ? 'L2' : 'L3'
  }
  if (['topology', 'motion', 'child-comfort'].includes(issue.category)) {
    return issue.scope === 'unknown' ? 'L3' : 'L2'
  }
  if (issue.category === 'interaction' || issue.category === 'presentation') {
    return issue.scope === 'localized' ? 'L1' : 'L2'
  }
  return issue.scope === 'localized' ? 'L1' : 'L2'
}

function evidenceForRisk(
  inspection: AssetInspection,
  level: AssetRiskLevel,
): string[] {
  const evidence = new Set<string>([
    'baseline-asset-digest',
    'review-contract',
    'source-package-inventory',
    'source-rights-record',
  ])
  if (level === 'L0') {
    evidence.add('runtime-smoke-test')
    evidence.add('multi-view-stills')
  }
  if (riskRank[level] >= riskRank.L1) {
    evidence.add('before-after-structure-inventory')
    evidence.add('normalization-log')
    evidence.add('runtime-state-evidence')
  }
  if (riskRank[level] >= riskRank.L2) {
    evidence.add('target-region-map')
    evidence.add('before-after-topology-inventory')
    evidence.add('full-loop-multiview-evidence')
    evidence.add('agent-visual-review')
  }
  if (level === 'L3') {
    evidence.add('rig-and-weight-inventory')
    evidence.add('deformation-stress-evidence')
    evidence.add('independent-agent-review')
    evidence.add('owner-l3-acceptance')
    evidence.add('stage-lock-record')
  }
  const operations = new Set(inspection.plannedOperations)
  if (
    inspection.sourcePackage.transparency === 'complex' ||
    operations.has('complex-transparency-rebuild')
  ) {
    evidence.add('full-cycle-frame-flicker-scan')
  }
  if (
    inspection.knownIssues.some((issue) => issue.category === 'motion') ||
    operations.has('source-rig-animation') ||
    operations.has('new-rig') ||
    operations.has('full-rebind')
  ) {
    evidence.add('region-motion-coverage')
  }
  if (operations.has('mouth-reconstruction')) {
    evidence.add('mouth-full-cycle-closeups')
  }
  if (inspection.executionControls.parallelRequested) {
    evidence.add('isolated-workspace-record')
    evidence.add('stage-lock-record')
  }
  for (const issue of inspection.knownIssues) {
    for (const evidenceId of issue.reviewContractBinding.evidenceRequirementIds) {
      evidence.add(evidenceId)
    }
  }
  return [...evidence].sort(compareStrings)
}

function knownIssueContractBindingErrors(
  inspection: AssetInspection,
  contract: ReviewContract,
): string[] {
  const errors: string[] = []
  const boundSubjects = new Map<string, InspectedAssetIssue[]>()
  for (const issue of inspection.knownIssues) {
    const binding = issue.reviewContractBinding
    let subject:
      | ReviewContract['targetIssues'][number]
      | ReviewContract['invariants'][number]
      | ReviewContract['stateSequences'][number]
      | undefined
    let expectedEvidence: readonly string[] = []
    if (binding.subjectType === 'target-issue') {
      subject = contract.targetIssues.find(({ id }) => id === binding.subjectId)
      if (subject && 'requiredEvidence' in subject) {
        expectedEvidence = subject.requiredEvidence
      }
    } else if (binding.subjectType === 'invariant') {
      subject = contract.invariants.find(({ id }) => id === binding.subjectId)
      if (subject && 'baselineEvidence' in subject) {
        expectedEvidence = [
          ...subject.baselineEvidence,
          ...subject.candidateEvidence,
        ]
      }
    } else {
      subject = contract.stateSequences.find(({ id }) => id === binding.subjectId)
      if (subject && 'requiredEvidence' in subject) {
        expectedEvidence = subject.requiredEvidence
      }
    }
    if (!subject) {
      errors.push(
        `Known issue ${issue.id} binds missing review-contract ${binding.subjectType} ${binding.subjectId}.`,
      )
      continue
    }
    const subjectKey = `${binding.subjectType}:${binding.subjectId}`
    const existing = boundSubjects.get(subjectKey) ?? []
    existing.push(issue)
    boundSubjects.set(subjectKey, existing)
    if (subject.category !== issue.category) {
      errors.push(
        `Known issue ${issue.id} category does not match review-contract subject ${binding.subjectId}.`,
      )
    }
    const declared = [...binding.evidenceRequirementIds].sort(compareStrings)
    const required = [...new Set(expectedEvidence)].sort(compareStrings)
    if (!isDeepStrictEqual(declared, required)) {
      errors.push(
        `Known issue ${issue.id} does not bind the exact evidence closure for review-contract subject ${binding.subjectId}.`,
      )
    }
    if (
      binding.subjectType === 'target-issue' &&
      'severity' in subject &&
      subject.severity === 'must-fix' &&
      issue.severity !== 'must-fix'
    ) {
      errors.push(
        `Review-contract must-fix target ${binding.subjectId} cannot be downgraded to ${issue.severity} in knownIssues.`,
      )
    }
    if (
      (binding.subjectType === 'invariant' ||
        binding.subjectType === 'state-sequence') &&
      issue.severity !== 'must-fix'
    ) {
      errors.push(
        `Known issue ${issue.id} describes a violated ${binding.subjectType} and must use must-fix severity.`,
      )
    }
  }
  for (const target of contract.targetIssues.filter(
    ({ severity }) => severity === 'must-fix',
  )) {
    const key = `target-issue:${target.id}`
    const matches = boundSubjects.get(key) ?? []
    if (matches.length === 0) {
      errors.push(
        `Review-contract must-fix target ${target.id} is not covered by knownIssues.`,
      )
    } else if (matches.length > 1) {
      errors.push(
        `Review-contract must-fix target ${target.id} must be covered exactly once; found ${matches.length} knownIssues.`,
      )
    }
  }
  for (const [subjectKey, issues] of boundSubjects) {
    if (issues.length > 1 && !subjectKey.startsWith('target-issue:')) {
      errors.push(
        `Review-contract subject ${subjectKey} must be covered at most once; found ${issues.length} knownIssues.`,
      )
    }
  }
  return errors
}

function routeForRisk(level: AssetRiskLevel): RecommendedAssetRoute {
  if (level === 'L0') return 'direct-runtime-validation'
  if (level === 'L1') return 'deterministic-normalization'
  if (level === 'L2') return 'bounded-structural-repair'
  return 'isolated-expert-rebuild'
}

function isAnimalWorkspace(path: string, animalId: string): boolean {
  return basename(resolve(path)) === animalId
}

function isStrictWorkspaceChild(path: string, workspacePath: string): boolean {
  const child = relative(resolve(workspacePath), resolve(path))
  return (
    child.length > 0 &&
    child !== '..' &&
    !child.startsWith(`..${sep}`) &&
    !isAbsolute(child)
  )
}

/**
 * Produces a deterministic route. L3 and parallel work are allowed when the
 * decision is explicit and every animal has its own workspace and stage lock.
 */
export function routeAssetRisk(value: unknown): AssetRiskRoutingResult {
  const inspection = parseAssetInspection(value)
  const source = inspection.sourcePackage
  let level: AssetRiskLevel = 'L0'
  const reasons = new Set<string>()
  const blockers = new Set<string>()
  let scientificIdentityRequiresLock = false

  for (const operation of inspection.plannedOperations) {
    level = maximumRisk(level, operationRisk[operation])
    reasons.add(`${operation} requires ${operationRisk[operation]}`)
  }
  for (const issue of inspection.knownIssues) {
    const required = issueRisk(issue)
    level = maximumRisk(level, required)
    reasons.add(`${issue.id} (${issue.category}, ${issue.scope}) requires ${required}`)
    if (issue.category === 'scientific-identity' && issue.severity === 'must-fix') {
      scientificIdentityRequiresLock = true
    }
  }

  if (!source.modelPresent) blockers.add('The source model package is missing.')
  if (!source.directSourceVerified) {
    blockers.add('The direct source has not been verified.')
  }
  if (!source.modificationAllowed) {
    blockers.add('The recorded source rights do not allow modification.')
  }
  if (!source.redistributionAllowed) {
    blockers.add('The recorded source rights do not allow redistribution.')
  }

  if (!source.runtimeReadyGlb) {
    level = maximumRisk(level, 'L1')
    reasons.add('The source is not a runtime-ready GLB and requires normalization.')
  }
  if (!source.texturesComplete) {
    level = maximumRisk(level, 'L1')
    reasons.add('The source package does not contain a complete texture set.')
  }
  if (source.topology === 'repairable') {
    level = maximumRisk(level, 'L2')
    reasons.add('The inspected topology requires bounded repair.')
  } else if (source.topology === 'broken' || source.topology === 'unknown') {
    level = maximumRisk(level, 'L3')
    reasons.add(`The inspected topology is ${source.topology}.`)
  }
  if (source.transparency === 'complex' || source.transparency === 'unknown') {
    level = maximumRisk(level, 'L3')
    reasons.add(`Transparency is ${source.transparency} and needs full-cycle review.`)
  }

  const operations = new Set(inspection.plannedOperations)
  if (
    (operations.has('bounded-part-transform') ||
      operations.has('bounded-component-removal')) &&
    (source.semanticParts === 'none' || source.semanticParts === 'unknown')
  ) {
    level = maximumRisk(level, 'L3')
    reasons.add('The planned bounded part edit lacks verified semantic parts.')
  }
  if (
    (operations.has('bone-adjustment') ||
      operations.has('skin-weight-repair') ||
      operations.has('source-rig-animation')) &&
    (source.rig !== 'verified' || source.skinWeights !== 'verified')
  ) {
    level = maximumRisk(level, 'L3')
    reasons.add('The planned rig operation lacks a verified rig and skin weights.')
  }
  if (
    riskRank[level] >= riskRank.L2 &&
    !source.editableSource &&
    source.primaryFormat !== 'glb'
  ) {
    level = maximumRisk(level, 'L3')
    reasons.add('Structural work lacks an editable source or a directly editable GLB.')
  }

  const controls = inspection.executionControls
  if (
    scientificIdentityRequiresLock &&
    (controls.stageLockId === null ||
      controls.stageLockPath === null ||
      controls.stageLockSha256 === null)
  ) {
    blockers.add('Scientific identity must be resolved before asset work starts.')
  }
  if (
    controls.animalWorkspacePath === null ||
    !isAnimalWorkspace(controls.animalWorkspacePath, inspection.animalId)
  ) {
    blockers.add(
      'The isolated workspace path must resolve to a directory named for this animal ID.',
    )
  }
  if (
    controls.stageLockId === null ||
    !controls.stageLockId.startsWith(`${inspection.animalId}-`)
  ) {
    blockers.add('The stage-lock ID must be namespaced to this animal.')
  }
  if (
    controls.stageLockPath === null ||
    controls.stageLockSha256 === null ||
    controls.animalWorkspacePath === null ||
    !isStrictWorkspaceChild(controls.stageLockPath, controls.animalWorkspacePath)
  ) {
    blockers.add(
      'The stage-lock record must be hash-bound inside this animal workspace.',
    )
  }
  if (
    controls.reviewContractPath === null ||
    controls.reviewContractSha256 === null ||
    controls.animalWorkspacePath === null ||
    !isStrictWorkspaceChild(
      controls.reviewContractPath,
      controls.animalWorkspacePath,
    )
  ) {
    blockers.add(
      'The review contract must be hash-bound inside this animal workspace.',
    )
  }
  if (level === 'L3' && controls.l3Acceptance.status !== 'accepted') {
    blockers.add('L3 work requires an explicit acceptance decision for this animal.')
  }
  if (
    level === 'L3' &&
    controls.l3Acceptance.status === 'accepted' &&
    (controls.l3Acceptance.recordPath === null ||
      controls.l3Acceptance.recordSha256 === null ||
      controls.animalWorkspacePath === null ||
      !isStrictWorkspaceChild(
        controls.l3Acceptance.recordPath,
        controls.animalWorkspacePath,
      ))
  ) {
    blockers.add(
      'The L3 acceptance record must be hash-bound inside this animal workspace.',
    )
  }
  if (
    level === 'L3' &&
    controls.l3Acceptance.status === 'accepted' &&
    controls.l3Acceptance.acceptedReviewContractSha256 !==
      controls.reviewContractSha256
  ) {
    blockers.add(
      'The L3 acceptance record must name the active review-contract digest.',
    )
  }
  if (
    controls.parallelRequested &&
    (controls.animalWorkspacePath === null ||
      controls.stageLockId === null ||
      controls.stageLockPath === null ||
      controls.stageLockSha256 === null)
  ) {
    blockers.add(
      'Parallel work requires a hash-bound per-animal workspace and independent stage lock.',
    )
  }

  const blockingReasons = [...blockers].sort(compareStrings)
  let recommendedRoute = routeForRisk(level)
  if (blockingReasons.some((reason) => reason.includes('source') || reason.includes('rights'))) {
    recommendedRoute = 'resolve-source-rights'
  } else if (blockingReasons.some((reason) => reason.includes('Scientific identity'))) {
    recommendedRoute = 'resolve-scientific-identity'
  } else if (blockingReasons.some((reason) => reason.includes('acceptance decision'))) {
    recommendedRoute = 'obtain-l3-acceptance'
  } else if (blockingReasons.length > 0) {
    recommendedRoute = 'establish-isolation-and-stage-lock'
  }

  const canStart = blockingReasons.length === 0
  return {
    schemaVersion: 1,
    animalId: inspection.animalId,
    classification: canStart ? level : 'blocked',
    underlyingRiskLevel: level,
    canStart,
    recommendedRoute,
    parallelExecution: controls.parallelRequested
      ? canStart
        ? 'allowed'
        : 'blocked'
      : 'not-requested',
    reasons: [...reasons].sort(compareStrings),
    blockingReasons,
    requiredEvidence: evidenceForRisk(inspection, level),
    requiredStageLocks: [
      'source-inspected',
      ...(riskRank[level] >= riskRank.L2 ? ['repair-plan-accepted'] : []),
      'model-accepted-for-finishing',
      'asset-sha-bound-to-evidence',
    ],
    controlBindings: {
      animalWorkspacePath: controls.animalWorkspacePath,
      stageLockId: controls.stageLockId,
      stageLockPath: controls.stageLockPath,
      stageLockSha256: controls.stageLockSha256,
      reviewContractPath: controls.reviewContractPath,
      reviewContractSha256: controls.reviewContractSha256,
      l3AcceptedBy: controls.l3Acceptance.acceptedBy,
      l3AcceptedOn: controls.l3Acceptance.acceptedOn,
      l3AcceptanceRecordPath: controls.l3Acceptance.recordPath,
      l3AcceptanceRecordSha256: controls.l3Acceptance.recordSha256,
      l3AcceptedReviewContractSha256:
        controls.l3Acceptance.acceptedReviewContractSha256,
    },
  }
}

function routeWithControlErrors(
  route: AssetRiskRoutingResult,
  errors: readonly string[],
): AssetRiskRoutingResult {
  if (errors.length === 0) return route
  const blockingReasons = [...new Set([...route.blockingReasons, ...errors])].sort(
    compareStrings,
  )
  let recommendedRoute = route.recommendedRoute
  if (
    recommendedRoute !== 'resolve-source-rights' &&
    recommendedRoute !== 'resolve-scientific-identity' &&
    recommendedRoute !== 'obtain-l3-acceptance'
  ) {
    recommendedRoute = 'establish-isolation-and-stage-lock'
  }
  return {
    ...route,
    classification: 'blocked',
    canStart: false,
    recommendedRoute,
    parallelExecution:
      route.parallelExecution === 'not-requested' ? 'not-requested' : 'blocked',
    blockingReasons,
  }
}

/**
 * Verifies that every hash-bound control file is the record it claims to be.
 * A matching digest alone is intentionally insufficient: the record contents
 * must cross-bind the animal, workspace, lock, review contract and L3 owner.
 */
export async function routeAssetRiskWithVerifiedRecords(
  value: unknown,
): Promise<AssetRiskRoutingResult> {
  const inspection = parseAssetInspection(value)
  const route = routeAssetRisk(inspection)
  const controls = inspection.executionControls
  const errors: string[] = []
  const workspace =
    controls.animalWorkspacePath === null
      ? null
      : resolve(controls.animalWorkspacePath)
  const contractPath =
    controls.reviewContractPath === null
      ? null
      : resolve(controls.reviewContractPath)
  const stageLockPath =
    controls.stageLockPath === null ? null : resolve(controls.stageLockPath)

  let contractDigest: Awaited<ReturnType<typeof fileDigest>> | null = null
  let activeContract: ReviewContract | null = null
  if (contractPath !== null && controls.reviewContractSha256 !== null) {
    try {
      const contract = await loadReviewContract(contractPath)
      activeContract = contract
      contractDigest = await fileDigest(contractPath)
      if (contract.animalId !== inspection.animalId) {
        errors.push('The active review contract belongs to a different animal.')
      }
      if (contractDigest.sha256 !== controls.reviewContractSha256) {
        errors.push('The active review-contract SHA-256 is stale.')
      }
      errors.push(...knownIssueContractBindingErrors(inspection, contract))
    } catch (error) {
      errors.push(
        `The active review contract is not a valid review-contract record: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  if (inspection.knownIssues.length > 0 && activeContract === null) {
    errors.push(
      'Known issues cannot be verified without the active hash-bound review contract.',
    )
  }

  let stageLockDigest: Awaited<ReturnType<typeof fileDigest>> | null = null
  if (
    stageLockPath !== null &&
    controls.stageLockSha256 !== null &&
    workspace !== null &&
    contractPath !== null
  ) {
    try {
      const stageLock = await loadStageLockRecord(stageLockPath)
      stageLockDigest = await fileDigest(stageLockPath)
      if (stageLockDigest.sha256 !== controls.stageLockSha256) {
        errors.push('The stage-lock SHA-256 is stale.')
      }
      if (stageLock.animalId !== inspection.animalId) {
        errors.push('The stage-lock record belongs to a different animal.')
      }
      if (stageLock.workspacePath !== workspace) {
        errors.push('The stage-lock record binds a different animal workspace.')
      }
      if (stageLock.lockId !== controls.stageLockId) {
        errors.push('The stage-lock record does not match the declared stage-lock ID.')
      }
      if (stageLock.reviewContract.path !== contractPath) {
        errors.push('The stage-lock record binds a different review-contract path.')
      }
      if (
        stageLock.reviewContract.sha256 !== controls.reviewContractSha256 ||
        (contractDigest !== null &&
          (stageLock.reviewContract.sha256 !== contractDigest.sha256 ||
            stageLock.reviewContract.bytes !== contractDigest.bytes))
      ) {
        errors.push('The stage-lock record binds a stale review contract.')
      }
    } catch (error) {
      errors.push(
        `The stage-lock file is not a valid stage-lock record: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  if (controls.l3Acceptance.status === 'accepted') {
    const acceptancePath = controls.l3Acceptance.recordPath
    if (
      acceptancePath !== null &&
      controls.l3Acceptance.recordSha256 !== null &&
      workspace !== null &&
      contractPath !== null &&
      stageLockPath !== null
    ) {
      try {
        const acceptance = await loadL3AcceptanceDecisionRecord(acceptancePath)
        const acceptanceDigest = await fileDigest(resolve(acceptancePath))
        if (acceptanceDigest.sha256 !== controls.l3Acceptance.recordSha256) {
          errors.push('The L3 acceptance record SHA-256 is stale.')
        }
        if (acceptance.animalId !== inspection.animalId) {
          errors.push('The L3 acceptance record belongs to a different animal.')
        }
        if (acceptance.workspacePath !== workspace) {
          errors.push('The L3 acceptance record binds a different animal workspace.')
        }
        if (
          acceptance.stageLockId !== controls.stageLockId ||
          acceptance.stageLockPath !== stageLockPath ||
          acceptance.stageLockSha256 !== controls.stageLockSha256 ||
          (stageLockDigest !== null &&
            acceptance.stageLockSha256 !== stageLockDigest.sha256)
        ) {
          errors.push('The L3 acceptance record binds a different or stale stage lock.')
        }
        if (
          acceptance.reviewContractPath !== contractPath ||
          acceptance.reviewContractSha256 !== controls.reviewContractSha256 ||
          acceptance.reviewContractSha256 !==
            controls.l3Acceptance.acceptedReviewContractSha256 ||
          (contractDigest !== null &&
            acceptance.reviewContractSha256 !== contractDigest.sha256)
        ) {
          errors.push('The L3 acceptance record binds a different or stale review contract.')
        }
        if (
          acceptance.acceptedBy !== controls.l3Acceptance.acceptedBy ||
          acceptance.acceptedOn !== controls.l3Acceptance.acceptedOn
        ) {
          errors.push('The L3 acceptance owner or date does not match the inspection.')
        }
        const preAcceptanceInspection: AssetInspection = {
          ...inspection,
          executionControls: {
            ...inspection.executionControls,
            l3Acceptance: {
              status: 'not-accepted',
              acceptedBy: null,
              acceptedOn: null,
              recordPath: null,
              recordSha256: null,
              acceptedReviewContractSha256: null,
            },
          },
        }
        const canonicalInspectionSha256 = sha256(
          Buffer.from(stringifyAssetInspection(preAcceptanceInspection), 'utf8'),
        )
        if (
          acceptance.inspectionPath !==
            resolve(workspace, 'asset-inspection.json') ||
          acceptance.inspectionSha256 !== canonicalInspectionSha256
        ) {
          errors.push(
            'The L3 acceptance record does not bind the canonical pre-acceptance inspection revision.',
          )
        }
        const preAcceptanceRoute = await routeAssetRiskWithVerifiedRecords(
          preAcceptanceInspection,
        )
        const expectedRouteScope = {
          classification: 'blocked' as const,
          underlyingRiskLevel: 'L3' as const,
          recommendedRoute: 'obtain-l3-acceptance' as const,
          reasons: preAcceptanceRoute.reasons,
          blockingReasons: preAcceptanceRoute.blockingReasons,
          plannedOperations: preAcceptanceInspection.plannedOperations,
          parallelRequested:
            preAcceptanceInspection.executionControls.parallelRequested,
        }
        if (!isDeepStrictEqual(acceptance.routeScope, expectedRouteScope)) {
          errors.push(
            'The L3 acceptance route scope is stale or does not bind current reasons, operations and parallel intent.',
          )
        }
        if (
          preAcceptanceRoute.classification !== 'blocked' ||
          preAcceptanceRoute.underlyingRiskLevel !== 'L3' ||
          preAcceptanceRoute.recommendedRoute !== 'obtain-l3-acceptance' ||
          preAcceptanceRoute.blockingReasons.length !== 1 ||
          preAcceptanceRoute.blockingReasons[0] !==
            'L3 work requires an explicit acceptance decision for this animal.'
        ) {
          errors.push(
            'The accepted inspection no longer reconstructs a valid L3 pre-acceptance route.',
          )
        }
      } catch (error) {
        errors.push(
          `The L3 acceptance file is not a valid acceptance record: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  return routeWithControlErrors(route, errors)
}

function riskEvidenceRoots(workspace: string, animalId: string): string[] {
  const roots = [resolve(workspace)]
  const runsRoot = dirname(workspace)
  const handoffRoot = dirname(runsRoot)
  if (
    basename(runsRoot) === 'animal-onboarding-runs' &&
    basename(handoffRoot) === '.handoff'
  ) {
    roots.push(resolve(dirname(handoffRoot), 'assets', 'candidates', animalId))
  }
  return roots
}

async function secureEvidenceArtifact(
  artifact: AssetRiskEvidenceArtifact,
  allowedRoots: readonly string[],
): Promise<string | null> {
  const path = resolve(artifact.path)
  const entry = await lstat(path).catch(() => null)
  if (!entry?.isFile() || entry.isSymbolicLink()) {
    return `Risk evidence must be a non-symlink regular file: ${path}`
  }
  const realFile = await realpath(path)
  let contained = false
  for (const root of allowedRoots) {
    const rootEntry = await lstat(root).catch(() => null)
    if (!rootEntry?.isDirectory() || rootEntry.isSymbolicLink()) continue
    const realRoot = await realpath(root)
    if (isStrictWorkspaceChild(realFile, realRoot)) {
      contained = true
      break
    }
  }
  if (!contained) {
    return `Risk evidence must resolve inside the run or this animal's candidate workspace: ${path}`
  }
  const digest = await fileDigest(path)
  if (digest.bytes !== artifact.bytes || digest.sha256 !== artifact.sha256) {
    return `Risk evidence digest is stale: ${path}`
  }
  return null
}

async function verifyRiskEvidenceManifestAgainstRoute(
  inspectionPath: string,
  routePath: string,
  routeSha256: string | null,
  currentRoute: AssetRiskRoutingResult,
  manifestPath = resolve(dirname(inspectionPath), 'risk-evidence-manifest.json'),
): Promise<AssetRiskEvidenceCompletion> {
  const absoluteInspectionPath = resolve(inspectionPath)
  const absoluteRoutePath = resolve(routePath)
  const absoluteManifestPath = resolve(manifestPath)
  const workspace = dirname(absoluteInspectionPath)
  const required = [...currentRoute.requiredEvidence].sort(compareStrings)
  const errors: string[] = []
  let manifestSha256: string | null = null
  let manifest: AssetRiskEvidenceManifest | null = null
  try {
    if (absoluteManifestPath !== resolve(workspace, 'risk-evidence-manifest.json')) {
      throw new Error('risk evidence manifest must use the canonical run path')
    }
    const entry = await lstat(absoluteManifestPath).catch(() => null)
    if (!entry?.isFile() || entry.isSymbolicLink()) {
      throw new Error('risk evidence manifest must be a non-symlink regular file')
    }
    const [realWorkspace, realManifest] = await Promise.all([
      realpath(workspace),
      realpath(absoluteManifestPath),
    ])
    if (!isStrictWorkspaceChild(realManifest, realWorkspace)) {
      throw new Error('risk evidence manifest must resolve inside the animal run')
    }
    manifest = parseAssetRiskEvidenceManifest(
      JSON.parse(await readFile(absoluteManifestPath, 'utf8')) as unknown,
    )
    manifestSha256 = (await fileDigest(absoluteManifestPath)).sha256
  } catch (error) {
    errors.push(
      `risk-evidence-manifest.json is missing or invalid: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (manifest === null) {
    return {
      pass: false,
      manifestPath: absoluteManifestPath,
      manifestSha256,
      required,
      satisfied: [],
      missing: required,
      errors,
    }
  }

  const [inspectionDigest, actualRouteDigest] = await Promise.all([
    fileDigest(absoluteInspectionPath).catch(() => null),
    fileDigest(absoluteRoutePath).catch(() => null),
  ])
  if (manifest.animalId !== currentRoute.animalId) {
    errors.push('Risk evidence manifest belongs to a different animal.')
  }
  if (
    manifest.inspectionPath !== absoluteInspectionPath ||
    inspectionDigest === null ||
    manifest.inspectionSha256 !== inspectionDigest.sha256
  ) {
    errors.push('Risk evidence manifest binds a stale or different asset inspection.')
  }
  if (
    manifest.routePath !== absoluteRoutePath ||
    actualRouteDigest === null ||
    manifest.routeSha256 !== actualRouteDigest.sha256 ||
    routeSha256 === null ||
    manifest.routeSha256 !== routeSha256
  ) {
    errors.push('Risk evidence manifest binds a stale or different risk route.')
  }

  const requiredSet = new Set(required)
  const unexpected = manifest.evidence
    .map(({ id }) => id)
    .filter((id) => !requiredSet.has(id))
  if (unexpected.length > 0) {
    errors.push(`Risk evidence manifest contains unexpected IDs: ${unexpected.join(', ')}.`)
  }
  const entries = new Map(manifest.evidence.map((entry) => [entry.id, entry]))
  const allowedRoots = riskEvidenceRoots(workspace, currentRoute.animalId)
  const expectedPaths = new Map<string, ReadonlySet<string>>()
  const bindings = currentRoute.controlBindings
  let stageLock: Awaited<ReturnType<typeof loadStageLockRecord>> | null = null
  if (bindings.stageLockPath !== null) {
    stageLock = await loadStageLockRecord(bindings.stageLockPath).catch(() => null)
  }
  if (bindings.reviewContractPath !== null) {
    expectedPaths.set('review-contract', new Set([resolve(bindings.reviewContractPath)]))
  }
  if (bindings.stageLockPath !== null) {
    const stagePath = resolve(bindings.stageLockPath)
    expectedPaths.set('stage-lock-record', new Set([stagePath]))
    expectedPaths.set('isolated-workspace-record', new Set([stagePath]))
  }
  if (stageLock !== null) {
    expectedPaths.set(
      'baseline-asset-digest',
      new Set([resolve(stageLock.sourceRecord.path)]),
    )
    expectedPaths.set(
      'source-rights-record',
      new Set(stageLock.rightsEvidence.map(({ path }) => resolve(path))),
    )
  }
  expectedPaths.set('source-package-inventory', new Set([absoluteInspectionPath]))
  if (bindings.l3AcceptanceRecordPath !== null) {
    expectedPaths.set(
      'owner-l3-acceptance',
      new Set([resolve(bindings.l3AcceptanceRecordPath)]),
    )
  }
  const agentReviewPath = resolve(workspace, 'agent-review.json')
  expectedPaths.set('agent-visual-review', new Set([agentReviewPath]))
  expectedPaths.set('independent-agent-review', new Set([agentReviewPath]))

  const satisfied: string[] = []
  for (const id of required) {
    const evidence = entries.get(id)
    if (!evidence) continue
    const artifactErrors = (
      await Promise.all(
        evidence.artifacts.map((artifact) =>
          secureEvidenceArtifact(artifact, allowedRoots),
        ),
      )
    ).filter((error): error is string => error !== null)
    const semanticPaths = expectedPaths.get(id)
    if (
      semanticPaths !== undefined &&
      !evidence.artifacts.some(({ path }) => semanticPaths.has(resolve(path)))
    ) {
      artifactErrors.push(
        `Risk evidence ${id} does not include its canonical control artifact.`,
      )
    }
    if (artifactErrors.length === 0) {
      satisfied.push(id)
    } else {
      errors.push(...artifactErrors)
    }
  }
  const missing = required.filter((id) => !satisfied.includes(id))
  if (missing.length > 0) {
    errors.push(`Risk evidence is incomplete: ${missing.join(', ')}.`)
  }
  const uniqueErrors = [...new Set(errors)].sort(compareStrings)
  return {
    pass: uniqueErrors.length === 0,
    manifestPath: absoluteManifestPath,
    manifestSha256,
    required,
    satisfied: satisfied.sort(compareStrings),
    missing,
    errors: uniqueErrors,
  }
}

/** Verifies completion of the evidence demanded by the current persisted route. */
export async function verifyAssetRiskEvidenceManifest(
  inspectionPath: string,
  routePath: string,
  manifestPath = resolve(dirname(inspectionPath), 'risk-evidence-manifest.json'),
): Promise<AssetRiskEvidenceCompletion> {
  const absoluteInspectionPath = resolve(inspectionPath)
  const absoluteRoutePath = resolve(routePath)
  const inspection = await loadAssetInspection(absoluteInspectionPath)
  const currentRoute = await routeAssetRiskWithVerifiedRecords(inspection)
  const routeDigest = await fileDigest(absoluteRoutePath).catch(() => null)
  try {
    const storedRoute = JSON.parse(
      await readFile(absoluteRoutePath, 'utf8'),
    ) as unknown
    if (!isDeepStrictEqual(storedRoute, currentRoute)) {
      return {
        pass: false,
        manifestPath: resolve(manifestPath),
        manifestSha256: null,
        required: currentRoute.requiredEvidence,
        satisfied: [],
        missing: currentRoute.requiredEvidence,
        errors: ['asset-risk-route.json is stale or does not match the active inspection and control records'],
      }
    }
  } catch (error) {
    return {
      pass: false,
      manifestPath: resolve(manifestPath),
      manifestSha256: null,
      required: currentRoute.requiredEvidence,
      satisfied: [],
      missing: currentRoute.requiredEvidence,
      errors: [
        `asset-risk-route.json is missing or invalid: ${error instanceof Error ? error.message : String(error)}`,
      ],
    }
  }
  return verifyRiskEvidenceManifestAgainstRoute(
    absoluteInspectionPath,
    absoluteRoutePath,
    routeDigest?.sha256 ?? null,
    currentRoute,
    manifestPath,
  )
}

/**
 * Writes a canonical evidence checklist. Known control records are bound
 * automatically; work-product evidence remains an explicit empty slot.
 */
export async function prepareAssetRiskEvidenceManifest(
  inspectionPath: string,
  routePath: string,
  outputPath = resolve(dirname(inspectionPath), 'risk-evidence-manifest.json'),
): Promise<AssetRiskEvidenceManifest> {
  const absoluteInspectionPath = resolve(inspectionPath)
  const absoluteRoutePath = resolve(routePath)
  const workspace = dirname(absoluteInspectionPath)
  const absoluteOutputPath = resolve(outputPath)
  if (absoluteOutputPath !== resolve(workspace, 'risk-evidence-manifest.json')) {
    throw new Error('risk evidence scaffold must use the canonical run path')
  }
  if ((await lstat(absoluteOutputPath).catch(() => null)) !== null) {
    throw new Error('risk evidence manifest already exists; refusing overwrite')
  }
  const verification = await verifyPersistedAssetRiskRoute(
    absoluteInspectionPath,
    absoluteRoutePath,
  )
  if (!verification.pass) {
    throw new Error(
      `risk evidence scaffold requires a current startable route: ${verification.errors.join('; ')}`,
    )
  }
  const bindings = verification.currentRoute.controlBindings
  const knownPaths = new Map<string, string[]>()
  if (bindings.reviewContractPath !== null) {
    knownPaths.set('review-contract', [resolve(bindings.reviewContractPath)])
  }
  if (bindings.stageLockPath !== null) {
    const stageLockPath = resolve(bindings.stageLockPath)
    knownPaths.set('stage-lock-record', [stageLockPath])
    knownPaths.set('isolated-workspace-record', [stageLockPath])
    const stageLock = await loadStageLockRecord(stageLockPath)
    knownPaths.set('baseline-asset-digest', [resolve(stageLock.sourceRecord.path)])
    knownPaths.set(
      'source-rights-record',
      stageLock.rightsEvidence.map(({ path }) => resolve(path)),
    )
  }
  knownPaths.set('source-package-inventory', [absoluteInspectionPath])
  if (bindings.l3AcceptanceRecordPath !== null) {
    knownPaths.set('owner-l3-acceptance', [
      resolve(bindings.l3AcceptanceRecordPath),
    ])
  }
  const agentReviewPath = resolve(workspace, 'agent-review.json')
  const agentReviewEntry = await lstat(agentReviewPath).catch(() => null)
  if (agentReviewEntry?.isFile() && !agentReviewEntry.isSymbolicLink()) {
    knownPaths.set('agent-visual-review', [agentReviewPath])
    knownPaths.set('independent-agent-review', [agentReviewPath])
  }
  const evidence = await Promise.all(
    verification.currentRoute.requiredEvidence.map(async (id) => ({
      id,
      artifacts: await Promise.all(
        (knownPaths.get(id) ?? []).map(async (path) => ({
          path,
          ...(await fileDigest(path)),
        })),
      ),
    })),
  )
  const manifest: AssetRiskEvidenceManifest = {
    schemaVersion: 1,
    kind: 'animal-risk-evidence-manifest',
    animalId: verification.currentRoute.animalId,
    inspectionPath: absoluteInspectionPath,
    inspectionSha256: (await fileDigest(absoluteInspectionPath)).sha256,
    routePath: absoluteRoutePath,
    routeSha256: (await fileDigest(absoluteRoutePath)).sha256,
    evidence,
  }
  await writeJson(absoluteOutputPath, manifest)
  return manifest
}

/** Recomputes the route from the active inspection and rejects stale output. */
export async function verifyPersistedAssetRiskRoute(
  inspectionPath: string,
  routePath: string,
): Promise<PersistedAssetRiskRouteVerification> {
  const absoluteInspectionPath = resolve(inspectionPath)
  const absoluteRoutePath = resolve(routePath)
  const inspection = await loadAssetInspection(absoluteInspectionPath)
  const currentRoute = await routeAssetRiskWithVerifiedRecords(inspection)
  const errors: string[] = []
  let routeSha256: string | null = null
  try {
    const routeBytes = await readFile(absoluteRoutePath)
    routeSha256 = (await fileDigest(absoluteRoutePath)).sha256
    const storedRoute = JSON.parse(routeBytes.toString('utf8')) as unknown
    if (!isDeepStrictEqual(storedRoute, currentRoute)) {
      errors.push('asset-risk-route.json is stale or does not match the active inspection and control records')
    }
  } catch (error) {
    errors.push(
      `asset-risk-route.json is missing or invalid: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  const evidenceCompletion = await verifyRiskEvidenceManifestAgainstRoute(
    absoluteInspectionPath,
    absoluteRoutePath,
    routeSha256,
    currentRoute,
  )
  if (!currentRoute.canStart || currentRoute.classification === 'blocked') {
    errors.push(...currentRoute.blockingReasons)
  }
  return {
    pass: errors.length === 0,
    errors: [...new Set(errors)].sort(compareStrings),
    inspection,
    currentRoute,
    routePath: absoluteRoutePath,
    routeSha256,
    evidenceCompletion,
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value as JsonObject)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  )
}

export function stringifyAssetInspection(value: unknown): string {
  return `${JSON.stringify(canonicalize(parseAssetInspection(value)), null, 2)}\n`
}

export async function loadAssetInspection(path: string): Promise<AssetInspection> {
  const absolutePath = resolve(path)
  const source = JSON.parse(await readFile(absolutePath, 'utf8')) as unknown
  return parseAssetInspection(source)
}

export function stringifyAssetRiskRouting(value: unknown): string {
  return `${JSON.stringify(canonicalize(routeAssetRisk(value)), null, 2)}\n`
}
