import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export const REVIEW_ISSUE_CATEGORIES = [
  'anatomy',
  'topology',
  'rigging',
  'deformation',
  'motion',
  'materials',
  'transparency',
  'presentation',
  'interaction',
  'performance',
  'scientific-identity',
  'child-comfort',
] as const

export type ReviewIssueCategory = (typeof REVIEW_ISSUE_CATEGORIES)[number]

export const REVIEW_EVIDENCE_KINDS = [
  'source-record',
  'structure-inventory',
  'rig-report',
  'topology-report',
  'metric',
  'still',
  'frame-sequence',
  'full-loop-video',
  'runtime-state',
  'human-review',
] as const

export type ReviewEvidenceKind = (typeof REVIEW_EVIDENCE_KINDS)[number]
export type ReviewEvidenceStage = 'baseline' | 'candidate' | 'runtime'
export type ReviewAuthority =
  | 'machine-pass'
  | 'agent-visual-pass'
  | 'owner-approval'

export interface ReviewEvidenceRequirement {
  readonly id: string
  readonly category: ReviewIssueCategory
  readonly kind: ReviewEvidenceKind
  readonly stage: ReviewEvidenceStage
  readonly description: string
  readonly requiredFor: ReviewAuthority
  readonly perspectives: readonly string[]
  readonly sampleTimesSeconds: readonly number[]
  readonly fullCycle: boolean
}

export interface ReviewTargetIssue {
  readonly id: string
  readonly category: ReviewIssueCategory
  readonly severity: 'must-fix' | 'should-fix'
  readonly verification: ReviewAuthority
  readonly currentProblem: string
  readonly expectedOutcome: string
  readonly requiredEvidence: readonly string[]
}

export interface ReviewInvariant {
  readonly id: string
  readonly category: ReviewIssueCategory
  readonly statement: string
  readonly verification: ReviewAuthority
  readonly baselineEvidence: readonly string[]
  readonly candidateEvidence: readonly string[]
}

export interface ReviewStateSnapshot {
  readonly state: string
  readonly assertions: readonly string[]
}

export interface ReviewStateAction {
  readonly action: string
  readonly conditions: readonly string[]
}

export interface ReviewStateSequence {
  readonly id: string
  readonly category: ReviewIssueCategory
  readonly verification: ReviewAuthority
  readonly given: ReviewStateSnapshot
  readonly when: ReviewStateAction
  readonly then: ReviewStateSnapshot
  readonly requiredEvidence: readonly string[]
}

export interface ReviewContract {
  readonly schemaVersion: 1
  readonly contractId: string
  readonly animalId: string
  readonly baselineAssetSha256: string
  readonly purpose: string
  readonly targetIssues: readonly ReviewTargetIssue[]
  readonly invariants: readonly ReviewInvariant[]
  readonly stateSequences: readonly ReviewStateSequence[]
  readonly evidenceRequirements: readonly ReviewEvidenceRequirement[]
}

type JsonObject = Record<string, unknown>

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const sha256Pattern = /^[a-f0-9]{64}$/

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
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
  const expected = new Set(keys)
  for (const key of Object.keys(result)) {
    if (!expected.has(key)) {
      throw new Error(`${label}.${key} is not allowed`)
    }
  }
  for (const key of keys) {
    if (!(key in result)) {
      throw new Error(`${label}.${key} is required`)
    }
  }
  return result
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

function identifier(value: unknown, label: string): string {
  const result = nonEmptyString(value, label)
  if (!idPattern.test(result)) {
    throw new Error(`${label} must be a lowercase kebab-case identifier`)
  }
  return result
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${label} must be one of ${allowed.join(', ')}`)
  }
  return value as T
}

function stringArray(
  value: unknown,
  label: string,
  options: { readonly allowEmpty?: boolean; readonly identifiers?: boolean } = {},
): string[] {
  if (!Array.isArray(value) || (!options.allowEmpty && value.length === 0)) {
    throw new Error(`${label} must be ${options.allowEmpty ? 'a' : 'a non-empty'} string array`)
  }
  const result = value.map((entry, index) =>
    options.identifiers
      ? identifier(entry, `${label}[${index}]`)
      : nonEmptyString(entry, `${label}[${index}]`),
  )
  if (new Set(result).size !== result.length) {
    throw new Error(`${label} must not contain duplicates`)
  }
  return result.sort(compareStrings)
}

function secondsArray(value: unknown, label: string): number[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`)
  }
  const result = value.map((entry, index) => {
    if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0) {
      throw new Error(`${label}[${index}] must be a non-negative finite number`)
    }
    return entry
  })
  if (new Set(result).size !== result.length) {
    throw new Error(`${label} must not contain duplicates`)
  }
  return result.sort((left, right) => left - right)
}

function evidenceRequirement(
  value: unknown,
  index: number,
): ReviewEvidenceRequirement {
  const label = `reviewContract.evidenceRequirements[${index}]`
  const source = objectWithExactKeys(value, label, [
    'id',
    'category',
    'kind',
    'stage',
    'description',
    'requiredFor',
    'perspectives',
    'sampleTimesSeconds',
    'fullCycle',
  ])
  const kind = enumValue(source.kind, REVIEW_EVIDENCE_KINDS, `${label}.kind`)
  const sampleTimesSeconds = secondsArray(
    source.sampleTimesSeconds,
    `${label}.sampleTimesSeconds`,
  )
  if (typeof source.fullCycle !== 'boolean') {
    throw new Error(`${label}.fullCycle must be a boolean`)
  }
  if (kind === 'full-loop-video' && !source.fullCycle) {
    throw new Error(`${label}.fullCycle must be true for full-loop-video evidence`)
  }
  if (kind === 'frame-sequence' && sampleTimesSeconds.length < 2) {
    throw new Error(`${label}.sampleTimesSeconds requires at least two samples for frame-sequence evidence`)
  }
  return {
    id: identifier(source.id, `${label}.id`),
    category: enumValue(
      source.category,
      REVIEW_ISSUE_CATEGORIES,
      `${label}.category`,
    ),
    kind,
    stage: enumValue(
      source.stage,
      ['baseline', 'candidate', 'runtime'] as const,
      `${label}.stage`,
    ),
    description: nonEmptyString(source.description, `${label}.description`),
    requiredFor: enumValue(
      source.requiredFor,
      ['machine-pass', 'agent-visual-pass', 'owner-approval'] as const,
      `${label}.requiredFor`,
    ),
    perspectives: stringArray(source.perspectives, `${label}.perspectives`, {
      allowEmpty: true,
    }),
    sampleTimesSeconds,
    fullCycle: source.fullCycle,
  }
}

function targetIssue(value: unknown, index: number): ReviewTargetIssue {
  const label = `reviewContract.targetIssues[${index}]`
  const source = objectWithExactKeys(value, label, [
    'id',
    'category',
    'severity',
    'verification',
    'currentProblem',
    'expectedOutcome',
    'requiredEvidence',
  ])
  return {
    id: identifier(source.id, `${label}.id`),
    category: enumValue(
      source.category,
      REVIEW_ISSUE_CATEGORIES,
      `${label}.category`,
    ),
    severity: enumValue(
      source.severity,
      ['must-fix', 'should-fix'] as const,
      `${label}.severity`,
    ),
    verification: enumValue(
      source.verification,
      ['machine-pass', 'agent-visual-pass', 'owner-approval'] as const,
      `${label}.verification`,
    ),
    currentProblem: nonEmptyString(
      source.currentProblem,
      `${label}.currentProblem`,
    ),
    expectedOutcome: nonEmptyString(
      source.expectedOutcome,
      `${label}.expectedOutcome`,
    ),
    requiredEvidence: stringArray(
      source.requiredEvidence,
      `${label}.requiredEvidence`,
      { identifiers: true },
    ),
  }
}

function invariant(value: unknown, index: number): ReviewInvariant {
  const label = `reviewContract.invariants[${index}]`
  const source = objectWithExactKeys(value, label, [
    'id',
    'category',
    'statement',
    'verification',
    'baselineEvidence',
    'candidateEvidence',
  ])
  return {
    id: identifier(source.id, `${label}.id`),
    category: enumValue(
      source.category,
      REVIEW_ISSUE_CATEGORIES,
      `${label}.category`,
    ),
    statement: nonEmptyString(source.statement, `${label}.statement`),
    verification: enumValue(
      source.verification,
      ['machine-pass', 'agent-visual-pass', 'owner-approval'] as const,
      `${label}.verification`,
    ),
    baselineEvidence: stringArray(
      source.baselineEvidence,
      `${label}.baselineEvidence`,
      { identifiers: true },
    ),
    candidateEvidence: stringArray(
      source.candidateEvidence,
      `${label}.candidateEvidence`,
      { identifiers: true },
    ),
  }
}

function stateSnapshot(value: unknown, label: string): ReviewStateSnapshot {
  const source = objectWithExactKeys(value, label, ['state', 'assertions'])
  return {
    state: identifier(source.state, `${label}.state`),
    assertions: stringArray(source.assertions, `${label}.assertions`),
  }
}

function stateAction(value: unknown, label: string): ReviewStateAction {
  const source = objectWithExactKeys(value, label, ['action', 'conditions'])
  return {
    action: nonEmptyString(source.action, `${label}.action`),
    conditions: stringArray(source.conditions, `${label}.conditions`, {
      allowEmpty: true,
    }),
  }
}

function stateSequence(value: unknown, index: number): ReviewStateSequence {
  const label = `reviewContract.stateSequences[${index}]`
  const source = objectWithExactKeys(value, label, [
    'id',
    'category',
    'verification',
    'given',
    'when',
    'then',
    'requiredEvidence',
  ])
  return {
    id: identifier(source.id, `${label}.id`),
    category: enumValue(
      source.category,
      REVIEW_ISSUE_CATEGORIES,
      `${label}.category`,
    ),
    verification: enumValue(
      source.verification,
      ['machine-pass', 'agent-visual-pass', 'owner-approval'] as const,
      `${label}.verification`,
    ),
    given: stateSnapshot(source.given, `${label}.given`),
    when: stateAction(source.when, `${label}.when`),
    then: stateSnapshot(source.then, `${label}.then`),
    requiredEvidence: stringArray(
      source.requiredEvidence,
      `${label}.requiredEvidence`,
      { identifiers: true },
    ),
  }
}

function parseNonEmptyObjectArray<T>(
  value: unknown,
  label: string,
  parse: (entry: unknown, index: number) => T,
): T[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array`)
  }
  return value.map(parse)
}

function assertUniqueIds(
  values: readonly { readonly id: string }[],
  label: string,
): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value.id)) {
      throw new Error(`${label} contains duplicate id ${value.id}`)
    }
    seen.add(value.id)
  }
}

function assertEvidenceReferences(
  contract: ReviewContract,
  evidenceById: ReadonlyMap<string, ReviewEvidenceRequirement>,
): void {
  for (const issue of contract.targetIssues) {
    const label = `reviewContract.targetIssues.${issue.id}.requiredEvidence`
    for (const id of issue.requiredEvidence) {
      const evidence = evidenceById.get(id)
      if (!evidence) throw new Error(`${label} references unknown evidence ${id}`)
      if (evidence.category !== issue.category) {
        throw new Error(`${label} evidence ${id} must use category ${issue.category}`)
      }
      if (evidence.stage === 'baseline') {
        throw new Error(`${label} evidence ${id} must prove the candidate or runtime result`)
      }
      if (evidence.requiredFor !== issue.verification) {
        throw new Error(
          `${label} evidence ${id} must be required for ${issue.verification}`,
        )
      }
    }
  }
  for (const item of contract.invariants) {
    for (const [field, ids, expectedStage] of [
      ['baselineEvidence', item.baselineEvidence, 'baseline'],
      ['candidateEvidence', item.candidateEvidence, 'candidate'],
    ] as const) {
      const label = `reviewContract.invariants.${item.id}.${field}`
      for (const id of ids) {
        const evidence = evidenceById.get(id)
        if (!evidence) throw new Error(`${label} references unknown evidence ${id}`)
        if (evidence.category !== item.category) {
          throw new Error(`${label} evidence ${id} must use category ${item.category}`)
        }
        if (
          (expectedStage === 'baseline' && evidence.stage !== 'baseline') ||
          (expectedStage === 'candidate' && evidence.stage === 'baseline')
        ) {
          throw new Error(
            `${label} evidence ${id} has invalid ${evidence.stage} stage`,
          )
        }
        if (evidence.requiredFor !== item.verification) {
          throw new Error(
            `${label} evidence ${id} must be required for ${item.verification}`,
          )
        }
      }
    }
  }
  for (const sequence of contract.stateSequences) {
    const label = `reviewContract.stateSequences.${sequence.id}.requiredEvidence`
    for (const id of sequence.requiredEvidence) {
      const evidence = evidenceById.get(id)
      if (!evidence) throw new Error(`${label} references unknown evidence ${id}`)
      if (evidence.category !== sequence.category) {
        throw new Error(`${label} evidence ${id} must use category ${sequence.category}`)
      }
      if (evidence.stage !== 'runtime') {
        throw new Error(`${label} evidence ${id} must use runtime stage`)
      }
      if (evidence.requiredFor !== sequence.verification) {
        throw new Error(
          `${label} evidence ${id} must be required for ${sequence.verification}`,
        )
      }
    }
  }
}

export function parseReviewContract(value: unknown): ReviewContract {
  const source = objectWithExactKeys(value, 'reviewContract', [
    'schemaVersion',
    'contractId',
    'animalId',
    'baselineAssetSha256',
    'purpose',
    'targetIssues',
    'invariants',
    'stateSequences',
    'evidenceRequirements',
  ])
  if (source.schemaVersion !== 1) {
    throw new Error('reviewContract.schemaVersion must be 1')
  }
  const baselineAssetSha256 = nonEmptyString(
    source.baselineAssetSha256,
    'reviewContract.baselineAssetSha256',
  )
  if (!sha256Pattern.test(baselineAssetSha256)) {
    throw new Error(
      'reviewContract.baselineAssetSha256 must be a lowercase SHA-256 digest',
    )
  }
  const targetIssues = parseNonEmptyObjectArray(
    source.targetIssues,
    'reviewContract.targetIssues',
    targetIssue,
  ).sort((left, right) => compareStrings(left.id, right.id))
  const invariants = parseNonEmptyObjectArray(
    source.invariants,
    'reviewContract.invariants',
    invariant,
  ).sort((left, right) => compareStrings(left.id, right.id))
  const stateSequences = parseNonEmptyObjectArray(
    source.stateSequences,
    'reviewContract.stateSequences',
    stateSequence,
  ).sort((left, right) => compareStrings(left.id, right.id))
  const evidenceRequirements = parseNonEmptyObjectArray(
    source.evidenceRequirements,
    'reviewContract.evidenceRequirements',
    evidenceRequirement,
  ).sort((left, right) => compareStrings(left.id, right.id))
  assertUniqueIds(targetIssues, 'reviewContract.targetIssues')
  assertUniqueIds(invariants, 'reviewContract.invariants')
  assertUniqueIds(stateSequences, 'reviewContract.stateSequences')
  assertUniqueIds(evidenceRequirements, 'reviewContract.evidenceRequirements')

  const result: ReviewContract = {
    schemaVersion: 1,
    contractId: identifier(source.contractId, 'reviewContract.contractId'),
    animalId: identifier(source.animalId, 'reviewContract.animalId'),
    baselineAssetSha256,
    purpose: nonEmptyString(source.purpose, 'reviewContract.purpose'),
    targetIssues,
    invariants,
    stateSequences,
    evidenceRequirements,
  }
  assertEvidenceReferences(
    result,
    new Map(
      evidenceRequirements.map((requirement) => [requirement.id, requirement]),
    ),
  )
  return result
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

/**
 * Strictly validates and serializes a contract. Object keys, set-like arrays,
 * and id-addressable collections are normalized so repeated runs are byte-stable.
 */
export function stringifyReviewContract(value: unknown): string {
  return `${JSON.stringify(canonicalize(parseReviewContract(value)), null, 2)}\n`
}

export async function loadReviewContract(path: string): Promise<ReviewContract> {
  const absolutePath = resolve(path)
  const source = JSON.parse(await readFile(absolutePath, 'utf8')) as unknown
  return parseReviewContract(source)
}
