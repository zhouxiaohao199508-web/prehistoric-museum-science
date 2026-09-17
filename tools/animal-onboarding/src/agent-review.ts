import { readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

import {
  maximumFullLoopSampleCount,
  requiredFullLoopSampleTimesSeconds,
  verifyBrowserCaptureValidationForProfile,
  type BrowserCaptureValidationReport,
  type VerifiedBrowserCaptureArtifact,
} from './browser-capture'
import { fileDigest, regularFile, sha256, writeJson, writeText } from './io'
import { modelContractSha256 } from './model-contract'
import { loadProfile } from './profile'
import {
  loadReviewContract,
  type ReviewAuthority,
  type ReviewContract,
  type ReviewEvidenceRequirement,
} from './review-contract'
import { verifyPersistedAssetRiskRoute } from './risk-routing'
import type { AnimalOnboardingProfile } from './types'

export const AGENT_REVIEW_CHECKS = [
  'anatomy-and-silhouette',
  'appendage-count-and-symmetry',
  'face-teeth-tongue-integrity',
  'full-loop-motion',
  'initial-camera-semantics',
  'responsive-framing',
  'ground-contact',
  'material-and-lighting',
  'child-comfort',
] as const

export const MACHINE_REVIEW_AUTHORITY = 'animal-onboarding-machine-gates'

export type AgentReviewCheckId = (typeof AGENT_REVIEW_CHECKS)[number]
export type ReviewStatus = 'pending' | 'pass' | 'fail' | 'not-applicable'
export type ContractSubjectType =
  | 'target-issue'
  | 'invariant'
  | 'state-sequence'

export interface AgentReviewCheck {
  readonly id: AgentReviewCheckId
  readonly status: ReviewStatus
  readonly finding: string
  readonly evidencePaths: readonly string[]
}

export interface MotionSample {
  readonly timeSeconds: number
  readonly evidencePath: string
}

export interface ContractEvidenceBinding {
  readonly requirementId: string
  readonly evidencePaths: readonly string[]
}

export interface ContractProof {
  readonly subjectType: ContractSubjectType
  readonly subjectId: string
  readonly requiredAuthority: ReviewAuthority
  readonly status: 'pending' | 'pass' | 'fail'
  readonly verifiedBy: string
  readonly finding: string
  readonly evidence: readonly ContractEvidenceBinding[]
}

export interface AgentVisualReview {
  readonly schemaVersion: 1
  readonly animalId: string
  readonly reviewer: string
  readonly reviewerTaskId: string
  readonly reviewedAt: string
  readonly modelContractSha256: string
  readonly modelSha256: string
  readonly reviewContractPath: string
  readonly reviewContractSha256: string
  readonly browserCaptureSha256: string
  readonly browserCaptureValidationSha256: string
  readonly overallStatus: 'pending' | 'pass' | 'fail'
  readonly checks: readonly AgentReviewCheck[]
  readonly contractProofs: readonly ContractProof[]
  readonly motionSamples: readonly MotionSample[]
  readonly blockers: readonly string[]
}

export interface CurrentBrowserCaptureValidation {
  readonly pass: boolean
  readonly errors: readonly string[]
  readonly planPath: string
  readonly planSha256: string | null
  readonly evidencePath: string
  readonly evidenceSha256: string | null
  readonly validationPath: string
  readonly validationSha256: string | null
  readonly report: BrowserCaptureValidationReport | null
}

export interface AgentReviewEvidenceDigest {
  readonly sha256: string
  readonly files: readonly {
    readonly path: string
    readonly bytes: number
    readonly sha256: string
  }[]
}

type JsonObject = Record<string, unknown>

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactObject(
  value: unknown,
  label: string,
  keys: readonly string[],
): JsonObject {
  if (!isRecord(value)) throw new Error(`${label} must be an object`)
  const expected = new Set(keys)
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) throw new Error(`${label}.${key} is not allowed`)
  }
  for (const key of keys) {
    if (!(key in value)) throw new Error(`${label}.${key} is required`)
  }
  return value
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`)
  return value
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value.map((entry, index) =>
    stringValue(entry, `${label}[${index}]`),
  )
}

function strictWorkspaceChild(path: string, workspacePath: string): boolean {
  const child = relative(resolve(workspacePath), resolve(path))
  return (
    child.length > 0 &&
    child !== '..' &&
    !child.startsWith(`..${sep}`) &&
    !isAbsolute(child)
  )
}

function pendingChecks(): AgentReviewCheck[] {
  return AGENT_REVIEW_CHECKS.map((id) => ({
    id,
    status: 'pending',
    finding: '',
    evidencePaths: [],
  }))
}

function contractSubjects(contract: ReviewContract): Array<{
  readonly subjectType: ContractSubjectType
  readonly subjectId: string
  readonly requiredAuthority: ReviewAuthority
  readonly evidenceIds: readonly string[]
}> {
  return [
    ...contract.targetIssues.map((item) => ({
      subjectType: 'target-issue' as const,
      subjectId: item.id,
      requiredAuthority: item.verification,
      evidenceIds: item.requiredEvidence,
    })),
    ...contract.invariants.map((item) => ({
      subjectType: 'invariant' as const,
      subjectId: item.id,
      requiredAuthority: item.verification,
      evidenceIds: [...item.baselineEvidence, ...item.candidateEvidence].sort(),
    })),
    ...contract.stateSequences.map((item) => ({
      subjectType: 'state-sequence' as const,
      subjectId: item.id,
      requiredAuthority: item.verification,
      evidenceIds: item.requiredEvidence,
    })),
  ].sort((left, right) =>
    `${left.subjectType}:${left.subjectId}`.localeCompare(
      `${right.subjectType}:${right.subjectId}`,
    ),
  )
}

function pendingContractProofs(contract: ReviewContract): ContractProof[] {
  return contractSubjects(contract).map((subject) => ({
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
    requiredAuthority: subject.requiredAuthority,
    status: 'pending',
    verifiedBy: '',
    finding: '',
    evidence: subject.evidenceIds.map((requirementId) => ({
      requirementId,
      evidencePaths: [],
    })),
  }))
}

async function activeReviewContract(
  profile: AnimalOnboardingProfile,
): Promise<{
  readonly contract: ReviewContract
  readonly path: string
  readonly sha256: string
}> {
  const runDirectory = resolve(profile.runDirectory)
  const risk = await verifyPersistedAssetRiskRoute(
    resolve(runDirectory, 'asset-inspection.json'),
    resolve(runDirectory, 'asset-risk-route.json'),
  )
  if (!risk.pass) {
    throw new Error(`active risk route is blocked or stale: ${risk.errors.join('; ')}`)
  }
  const path = risk.currentRoute.controlBindings.reviewContractPath
  const expectedSha256 = risk.currentRoute.controlBindings.reviewContractSha256
  if (!path || !expectedSha256) {
    throw new Error('active risk route does not bind a review contract')
  }
  if (!strictWorkspaceChild(path, runDirectory)) {
    throw new Error('active review contract must be inside the profile run directory')
  }
  const [contract, digest] = await Promise.all([
    loadReviewContract(path),
    fileDigest(path),
  ])
  if (contract.animalId !== profile.id || digest.sha256 !== expectedSha256) {
    throw new Error('active review contract does not match the profile and risk route')
  }
  return { contract, path: resolve(path), sha256: digest.sha256 }
}

export async function verifyCurrentBrowserCapture(
  profile: AnimalOnboardingProfile,
  browserCapturePath: string,
): Promise<CurrentBrowserCaptureValidation> {
  const errors: string[] = []
  const runDirectory = resolve(profile.runDirectory)
  const evidencePath = resolve(browserCapturePath)
  const planPath = resolve(evidencePath, '..', 'browser-capture-plan.json')
  const validationPath = resolve(
    evidencePath,
    '..',
    'browser-capture-validation.json',
  )
  let planSha256: string | null = null
  let evidenceSha256: string | null = null
  let validationSha256: string | null = null
  let report: BrowserCaptureValidationReport | null = null
  try {
    const verified = await verifyBrowserCaptureValidationForProfile({
      animalId: profile.id,
      runDirectory,
      modelOutputPath: profile.model.outputPath,
      validationPath,
    })
    if (verified.sourcePlanPath !== planPath) {
      errors.push('browser capture validation must bind the canonical sibling plan')
    }
    if (verified.sourceMetadataPath !== evidencePath) {
      errors.push('browser capture validation must bind the requested evidence file')
    }
    report = verified.report
    const [planDigest, evidenceDigest, validationDigest] = await Promise.all([
      fileDigest(verified.sourcePlanPath),
      fileDigest(verified.sourceMetadataPath),
      fileDigest(verified.validationPath),
    ])
    planSha256 = planDigest.sha256
    evidenceSha256 = evidenceDigest.sha256
    validationSha256 = validationDigest.sha256
    if (
      !verified.report.pass ||
      !verified.report.candidate.pass ||
      !verified.report.globalBaseline.pass
    ) {
      errors.push(
        'current collector-attested headed capture integrity validation does not pass',
      )
    }
    if (verified.report.animalId !== profile.id) {
      errors.push('browser capture validation belongs to a different animal')
    }
  } catch (error) {
    errors.push(
      `browser capture plan, evidence or validation is missing or invalid: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  return {
    pass: errors.length === 0,
    errors,
    planPath,
    planSha256,
    evidencePath,
    evidenceSha256,
    validationPath,
    validationSha256,
    report,
  }
}

export async function createAgentReviewTemplate(
  profilePath: string,
  browserCapturePath: string,
  outputPath: string,
): Promise<AgentVisualReview> {
  const profile = await loadProfile(profilePath)
  const [model, browserCapture, activeContract, captureValidation] =
    await Promise.all([
      fileDigest(resolve(profile.model.outputPath)),
      fileDigest(resolve(browserCapturePath)),
      activeReviewContract(profile),
      verifyCurrentBrowserCapture(profile, browserCapturePath),
    ])
  if (!captureValidation.pass || captureValidation.validationSha256 === null) {
    throw new Error(
      `agent review requires current passing browser capture validation: ${captureValidation.errors.join('; ')}`,
    )
  }
  const template: AgentVisualReview = {
    schemaVersion: 1,
    animalId: profile.id,
    reviewer: '',
    reviewerTaskId: '',
    reviewedAt: '',
    modelContractSha256: modelContractSha256(profile),
    modelSha256: model.sha256,
    reviewContractPath: activeContract.path,
    reviewContractSha256: activeContract.sha256,
    browserCaptureSha256: browserCapture.sha256,
    browserCaptureValidationSha256: captureValidation.validationSha256,
    overallStatus: 'pending',
    checks: pendingChecks(),
    contractProofs: pendingContractProofs(activeContract.contract),
    motionSamples: [],
    blockers: [],
  }
  await writeJson(resolve(outputPath), template)
  return template
}

export function parseAgentVisualReview(value: unknown): AgentVisualReview {
  const source = exactObject(value, 'agentReview', [
    'schemaVersion',
    'animalId',
    'reviewer',
    'reviewerTaskId',
    'reviewedAt',
    'modelContractSha256',
    'modelSha256',
    'reviewContractPath',
    'reviewContractSha256',
    'browserCaptureSha256',
    'browserCaptureValidationSha256',
    'overallStatus',
    'checks',
    'contractProofs',
    'motionSamples',
    'blockers',
  ])
  if (source.schemaVersion !== 1) {
    throw new Error('agentReview.schemaVersion must be 1')
  }
  if (!Array.isArray(source.checks) || !Array.isArray(source.contractProofs)) {
    throw new Error('agentReview checks and contractProofs must be arrays')
  }
  if (!Array.isArray(source.motionSamples) || !Array.isArray(source.blockers)) {
    throw new Error('agentReview motionSamples and blockers must be arrays')
  }
  const checks = source.checks.map((entry, index): AgentReviewCheck => {
    const check = exactObject(entry, `agentReview.checks[${index}]`, [
      'id',
      'status',
      'finding',
      'evidencePaths',
    ])
    if (!AGENT_REVIEW_CHECKS.includes(check.id as AgentReviewCheckId)) {
      throw new Error(`unsupported agent review check: ${String(check.id)}`)
    }
    if (!['pending', 'pass', 'fail', 'not-applicable'].includes(String(check.status))) {
      throw new Error(`invalid status for agent review check: ${String(check.id)}`)
    }
    return {
      id: check.id as AgentReviewCheckId,
      status: check.status as ReviewStatus,
      finding: stringValue(check.finding, `agentReview.checks[${index}].finding`),
      evidencePaths: stringArray(
        check.evidencePaths,
        `agentReview.checks[${index}].evidencePaths`,
      ),
    }
  })
  const contractProofs = source.contractProofs.map(
    (entry, index): ContractProof => {
      const proof = exactObject(
        entry,
        `agentReview.contractProofs[${index}]`,
        [
          'subjectType',
          'subjectId',
          'requiredAuthority',
          'status',
          'verifiedBy',
          'finding',
          'evidence',
        ],
      )
      if (!['target-issue', 'invariant', 'state-sequence'].includes(String(proof.subjectType))) {
        throw new Error(`invalid contract proof subject type at index ${index}`)
      }
      if (!['machine-pass', 'agent-visual-pass', 'owner-approval'].includes(String(proof.requiredAuthority))) {
        throw new Error(`invalid contract proof authority at index ${index}`)
      }
      if (!['pending', 'pass', 'fail'].includes(String(proof.status))) {
        throw new Error(`invalid contract proof status at index ${index}`)
      }
      if (!Array.isArray(proof.evidence)) {
        throw new Error(`agentReview.contractProofs[${index}].evidence must be an array`)
      }
      return {
        subjectType: proof.subjectType as ContractSubjectType,
        subjectId: stringValue(proof.subjectId, `agentReview.contractProofs[${index}].subjectId`),
        requiredAuthority: proof.requiredAuthority as ReviewAuthority,
        status: proof.status as ContractProof['status'],
        verifiedBy: stringValue(proof.verifiedBy, `agentReview.contractProofs[${index}].verifiedBy`),
        finding: stringValue(proof.finding, `agentReview.contractProofs[${index}].finding`),
        evidence: proof.evidence.map((binding, bindingIndex) => {
          const parsed = exactObject(
            binding,
            `agentReview.contractProofs[${index}].evidence[${bindingIndex}]`,
            ['requirementId', 'evidencePaths'],
          )
          return {
            requirementId: stringValue(
              parsed.requirementId,
              `agentReview.contractProofs[${index}].evidence[${bindingIndex}].requirementId`,
            ),
            evidencePaths: stringArray(
              parsed.evidencePaths,
              `agentReview.contractProofs[${index}].evidence[${bindingIndex}].evidencePaths`,
            ),
          }
        }),
      }
    },
  )
  const motionSamples = source.motionSamples.map((entry, index): MotionSample => {
    const sample = exactObject(entry, `agentReview.motionSamples[${index}]`, [
      'timeSeconds',
      'evidencePath',
    ])
    if (typeof sample.timeSeconds !== 'number' || !Number.isFinite(sample.timeSeconds)) {
      throw new Error(`agentReview.motionSamples[${index}].timeSeconds must be finite`)
    }
    return {
      timeSeconds: sample.timeSeconds,
      evidencePath: stringValue(
        sample.evidencePath,
        `agentReview.motionSamples[${index}].evidencePath`,
      ),
    }
  })
  const overallStatus = String(source.overallStatus)
  if (!['pending', 'pass', 'fail'].includes(overallStatus)) {
    throw new Error('agentReview.overallStatus is invalid')
  }
  return {
    schemaVersion: 1,
    animalId: stringValue(source.animalId, 'agentReview.animalId'),
    reviewer: stringValue(source.reviewer, 'agentReview.reviewer'),
    reviewerTaskId: stringValue(
      source.reviewerTaskId,
      'agentReview.reviewerTaskId',
    ),
    reviewedAt: stringValue(source.reviewedAt, 'agentReview.reviewedAt'),
    modelContractSha256: stringValue(source.modelContractSha256, 'agentReview.modelContractSha256'),
    modelSha256: stringValue(source.modelSha256, 'agentReview.modelSha256'),
    reviewContractPath: stringValue(source.reviewContractPath, 'agentReview.reviewContractPath'),
    reviewContractSha256: stringValue(source.reviewContractSha256, 'agentReview.reviewContractSha256'),
    browserCaptureSha256: stringValue(source.browserCaptureSha256, 'agentReview.browserCaptureSha256'),
    browserCaptureValidationSha256: stringValue(
      source.browserCaptureValidationSha256,
      'agentReview.browserCaptureValidationSha256',
    ),
    overallStatus: overallStatus as AgentVisualReview['overallStatus'],
    checks,
    contractProofs,
    motionSamples,
    blockers: stringArray(source.blockers, 'agentReview.blockers'),
  }
}

function checkMap(review: AgentVisualReview): Map<string, AgentReviewCheck> {
  const map = new Map<string, AgentReviewCheck>()
  for (const check of review.checks) {
    if (map.has(check.id)) throw new Error(`duplicate agent review check: ${check.id}`)
    map.set(check.id, check)
  }
  for (const id of AGENT_REVIEW_CHECKS) {
    if (!map.has(id)) throw new Error(`missing agent review check: ${id}`)
  }
  if (map.size !== AGENT_REVIEW_CHECKS.length) {
    throw new Error('agent review contains unsupported checks')
  }
  return map
}

async function evidenceExists(paths: readonly string[]): Promise<boolean> {
  if (paths.length === 0) return false
  return (await Promise.all(paths.map((path) => regularFile(resolve(path))))).every(Boolean)
}

function allReviewEvidencePaths(review: AgentVisualReview): string[] {
  return [
    ...review.checks.flatMap((check) => check.evidencePaths),
    ...review.contractProofs.flatMap((proof) =>
      proof.evidence.flatMap((binding) => binding.evidencePaths),
    ),
    ...review.motionSamples.map((sample) => sample.evidencePath),
  ]
}

export async function digestEvidencePaths(
  paths: readonly string[],
): Promise<AgentReviewEvidenceDigest> {
  const normalizedPaths = [...new Set(paths.map((path) => resolve(path)))].sort()
  const files = await Promise.all(
    normalizedPaths.map(async (path) => ({ path, ...(await fileDigest(path)) })),
  )
  return {
    files,
    sha256: sha256(Buffer.from(JSON.stringify(files), 'utf8')),
  }
}

export async function digestAgentReviewEvidence(
  review: AgentVisualReview,
): Promise<AgentReviewEvidenceDigest> {
  return digestEvidencePaths(allReviewEvidencePaths(review))
}

function minimumEvidenceFiles(requirement: ReviewEvidenceRequirement): number {
  if (requirement.kind === 'frame-sequence') {
    return Math.max(
      2,
      Math.max(1, requirement.perspectives.length) *
        requirement.sampleTimesSeconds.length,
    )
  }
  if (requirement.kind === 'still') {
    return (
      Math.max(1, requirement.perspectives.length) *
      Math.max(1, requirement.sampleTimesSeconds.length)
    )
  }
  if (
    requirement.kind === 'runtime-state' ||
    requirement.kind === 'human-review'
  ) {
    return (
      Math.max(1, requirement.perspectives.length) *
      Math.max(1, requirement.sampleTimesSeconds.length)
    )
  }
  return 1
}

type CaptureSemanticDimension = 'camera' | 'viewport' | 'state'

interface CapturePerspectiveMatch {
  readonly matches: boolean
  readonly channel: string
}

function capturePerspectiveMatch(
  artifact: VerifiedBrowserCaptureArtifact,
  perspective: string,
  requirement: ReviewEvidenceRequirement,
): CapturePerspectiveMatch {
  const qualified = /^(camera|viewport|state):(.+)$/.exec(perspective)
  if (qualified) {
    const dimension = qualified[1] as CaptureSemanticDimension
    const id = qualified[2]
    const actual =
      dimension === 'camera'
        ? artifact.cameraAngleId
        : dimension === 'viewport'
          ? artifact.viewportId
          : artifact.stateId
    return {
      matches: actual === id,
      channel: `${dimension}:${actual}`,
    }
  }
  if (perspective === 'primary' || perspective === 'primary-camera') {
    return {
      matches: artifact.cameraAngleRole === 'primary',
      channel: `camera:${artifact.cameraAngleId}`,
    }
  }
  if (
    requirement.kind === 'runtime-state' ||
    requirement.kind === 'human-review'
  ) {
    if (artifact.stateId === perspective) {
      return { matches: true, channel: `state:${artifact.stateId}` }
    }
    if (artifact.cameraAngleId === perspective) {
      return { matches: true, channel: `camera:${artifact.cameraAngleId}` }
    }
    return {
      matches: artifact.viewportId === perspective,
      channel: `viewport:${artifact.viewportId}`,
    }
  }
  if (artifact.cameraAngleId === perspective) {
    return { matches: true, channel: `camera:${artifact.cameraAngleId}` }
  }
  return {
    matches: artifact.viewportId === perspective,
    channel: `viewport:${artifact.viewportId}`,
  }
}

function sampleTimeMatches(
  artifact: VerifiedBrowserCaptureArtifact,
  sampleTimeSeconds: number,
): boolean {
  const tolerance = artifact.actualTimeToleranceSeconds + 0.000001
  if (Math.abs(artifact.requestedTimeSeconds - sampleTimeSeconds) > tolerance) {
    return false
  }
  const actualDelta = Math.abs(artifact.actualTimeSeconds - sampleTimeSeconds)
  const wrappedDelta = Math.min(
    Math.abs(
      artifact.actualTimeSeconds + artifact.animationDurationSeconds -
        sampleTimeSeconds,
    ),
    Math.abs(
      artifact.actualTimeSeconds - artifact.animationDurationSeconds -
        sampleTimeSeconds,
    ),
  )
  return Math.min(actualDelta, wrappedDelta) <= tolerance
}

function hasDistinctAssignment<T>(
  choices: readonly (readonly T[])[],
  key: (choice: T) => string,
): boolean {
  const ordered = [...choices].sort((left, right) => left.length - right.length)
  const used = new Set<string>()
  function assign(index: number): boolean {
    if (index === ordered.length) return true
    for (const choice of ordered[index]) {
      const id = key(choice)
      if (used.has(id)) continue
      used.add(id)
      if (assign(index + 1)) return true
      used.delete(id)
    }
    return false
  }
  return assign(0)
}

function captureSemanticCoverageErrors(
  requirement: ReviewEvidenceRequirement,
  boundArtifacts: readonly VerifiedBrowserCaptureArtifact[],
): string[] {
  const errors: string[] = []
  if (requirement.kind === 'full-loop-video') {
    return [
      'requires verified continuous-video evidence; paused PNG frames cannot prove a full-loop video',
    ]
  }
  if (
    !['still', 'frame-sequence', 'runtime-state', 'human-review'].includes(
      requirement.kind,
    )
  ) {
    return errors
  }
  if (requirement.fullCycle) {
    const times = requirement.sampleTimesSeconds
    if (requirement.kind !== 'frame-sequence') {
      errors.push('declares fullCycle but is not a frame-sequence requirement')
    } else {
      if (
        times.length < requiredFullLoopSampleTimesSeconds.length ||
        times.length > maximumFullLoopSampleCount ||
        times[0] !== 0 ||
        times.at(-1) !== 8 ||
        requiredFullLoopSampleTimesSeconds.some(
          (required) => !times.includes(required),
        )
      ) {
        errors.push(
          'declares fullCycle but does not include the mandatory 0/2/4/6/8-second checkpoints across the exact eight-second loop',
        )
      }
      const maximumGap = Math.max(
        ...times.slice(1).map((time, index) => time - times[index]),
      )
      if (maximumGap > 2.000001) {
        errors.push(
          'declares fullCycle but leaves a gap larger than two seconds',
        )
      }
      if (
        requirement.category === 'transparency' &&
        maximumGap > 0.250001
      ) {
        errors.push(
          'transparency full-cycle evidence may not leave a sample gap larger than 0.25 seconds',
        )
      }
    }
  }
  if (
    requirement.category === 'transparency' &&
    requirement.fullCycle &&
    requirement.perspectives.length < 2
  ) {
    errors.push(
      'transparency full-cycle evidence must declare at least two perspectives',
    )
  }

  const perspectives =
    requirement.perspectives.length > 0
      ? requirement.perspectives
      : [null]
  const sampleTimes =
    requirement.sampleTimesSeconds.length > 0
      ? requirement.sampleTimesSeconds
      : [null]

  if (requirement.perspectives.length > 1) {
    const channelChoices = requirement.perspectives.map((perspective) =>
      boundArtifacts.flatMap((artifact) => {
        const match = capturePerspectiveMatch(
          artifact,
          perspective,
          requirement,
        )
        return match.matches ? [match.channel] : []
      }),
    )
    if (
      channelChoices.some((choices) => choices.length === 0) ||
      !hasDistinctAssignment(channelChoices, (choice) => choice)
    ) {
      errors.push(
        'does not bind distinct verified camera/viewport/state channels for every declared perspective',
      )
    }
  }

  const combinations = perspectives.flatMap((perspective) =>
    sampleTimes.map((sampleTimeSeconds) => ({
      perspective,
      sampleTimeSeconds,
    })),
  )
  const artifactChoices = combinations.map(({ perspective, sampleTimeSeconds }) =>
    boundArtifacts.filter((artifact) => {
      const perspectiveMatches =
        perspective === null ||
        capturePerspectiveMatch(artifact, perspective, requirement).matches
      const timeMatches =
        sampleTimeSeconds === null ||
        sampleTimeMatches(artifact, sampleTimeSeconds)
      return perspectiveMatches && timeMatches
    }),
  )
  if (
    artifactChoices.some((choices) => choices.length === 0) ||
    !hasDistinctAssignment(artifactChoices, (artifact) =>
      resolve(artifact.absolutePath),
    )
  ) {
    errors.push(
      'does not cover every declared perspective × sample-time combination with distinct current verified artifacts',
    )
  }
  return errors
}

export async function contractProofErrors(
  contract: ReviewContract,
  review: AgentVisualReview,
  authorityEvidence: {
    readonly machineEvidencePaths?: readonly string[]
    readonly verifiedCaptureArtifacts?: readonly VerifiedBrowserCaptureArtifact[]
    /** @deprecated Semantic capture proofs require verifiedCaptureArtifacts. */
    readonly verifiedCaptureArtifactPaths?: readonly string[]
    readonly allowPendingOwner?: boolean
  } = {},
): Promise<string[]> {
  const errors: string[] = []
  const subjects = contractSubjects(contract)
  const requirements = new Map(
    contract.evidenceRequirements.map((item) => [item.id, item]),
  )
  const proofs = new Map<string, ContractProof>()
  const machineEvidencePaths = new Set(
    (authorityEvidence.machineEvidencePaths ?? []).map((path) => resolve(path)),
  )
  const verifiedCaptureArtifactPaths = new Set(
    [
      ...(authorityEvidence.verifiedCaptureArtifactPaths ?? []),
      ...(authorityEvidence.verifiedCaptureArtifacts ?? []).map(
        ({ absolutePath }) => absolutePath,
      ),
    ].map((path) => resolve(path)),
  )
  const verifiedCaptureArtifactsByPath = new Map(
    (authorityEvidence.verifiedCaptureArtifacts ?? []).map((artifact) => [
      resolve(artifact.absolutePath),
      artifact,
    ]),
  )
  for (const proof of review.contractProofs) {
    const key = `${proof.subjectType}:${proof.subjectId}`
    if (proofs.has(key)) {
      errors.push(`duplicate contract proof ${key}`)
    } else {
      proofs.set(key, proof)
    }
  }
  for (const subject of subjects) {
    const key = `${subject.subjectType}:${subject.subjectId}`
    const proof = proofs.get(key)
    if (!proof) {
      errors.push(`missing contract proof ${key}`)
      continue
    }
    if (proof.requiredAuthority !== subject.requiredAuthority) {
      errors.push(`${key} authority does not match the review contract`)
    }
    const pendingOwner =
      proof.requiredAuthority === 'owner-approval' &&
      proof.status === 'pending' &&
      authorityEvidence.allowPendingOwner === true
    if (proof.status !== 'pass' && !pendingOwner) {
      errors.push(`${key} has not passed`)
    }
    if (!proof.finding.trim() && !pendingOwner) {
      errors.push(`${key} needs a concrete finding`)
    }
    if (
      proof.requiredAuthority === 'machine-pass' &&
      proof.verifiedBy !== MACHINE_REVIEW_AUTHORITY
    ) {
      errors.push(`${key} must be verified by ${MACHINE_REVIEW_AUTHORITY}`)
    }
    if (
      proof.requiredAuthority === 'agent-visual-pass' &&
      proof.verifiedBy !== review.reviewer
    ) {
      errors.push(`${key} must be verified by the named agent reviewer`)
    }
    if (
      proof.requiredAuthority === 'owner-approval' &&
      proof.verifiedBy.trim().length === 0 &&
      !pendingOwner
    ) {
      errors.push(`${key} requires a named owner verifier`)
    }
    const bindings = new Map<string, ContractEvidenceBinding>()
    for (const binding of proof.evidence) {
      if (bindings.has(binding.requirementId)) {
        errors.push(`${key} duplicates evidence requirement ${binding.requirementId}`)
      } else {
        bindings.set(binding.requirementId, binding)
      }
    }
    if (
      [...bindings.keys()].sort().join(',') !==
      [...subject.evidenceIds].sort().join(',')
    ) {
      errors.push(`${key} does not bind the exact required evidence set`)
    }
    for (const requirementId of subject.evidenceIds) {
      const requirement = requirements.get(requirementId)
      const binding = bindings.get(requirementId)
      if (!requirement || !binding) continue
      if (requirement.requiredFor !== proof.requiredAuthority) {
        errors.push(`${key} evidence ${requirementId} has the wrong authority`)
      }
      if (binding.evidencePaths.length < minimumEvidenceFiles(requirement)) {
        errors.push(`${key} evidence ${requirementId} has insufficient artifacts`)
      } else if (!(await evidenceExists(binding.evidencePaths))) {
        errors.push(`${key} evidence ${requirementId} has missing artifact files`)
      }
      if (
        proof.requiredAuthority === 'machine-pass' &&
        binding.evidencePaths.some(
          (path) => !machineEvidencePaths.has(resolve(path)),
        )
      ) {
        errors.push(
          `${key} evidence ${requirementId} is not emitted by the current machine capture validation`,
        )
      }
      if (
        proof.requiredAuthority === 'machine-pass' &&
        !['still', 'frame-sequence', 'runtime-state'].includes(requirement.kind)
      ) {
        errors.push(
          `${key} evidence ${requirementId} uses ${requirement.kind}, which has no dedicated machine semantic verifier`,
        )
      }
      if (
        ['candidate', 'runtime'].includes(requirement.stage) &&
        [
          'still',
          'frame-sequence',
          'full-loop-video',
          'runtime-state',
          'human-review',
        ].includes(requirement.kind) &&
        binding.evidencePaths.some(
          (path) => !verifiedCaptureArtifactPaths.has(resolve(path)),
        )
      ) {
        errors.push(
          `${key} evidence ${requirementId} is not an integrity-validated collector-attested capture artifact`,
        )
      }
      if (
        ['candidate', 'runtime'].includes(requirement.stage) &&
        [
          'still',
          'frame-sequence',
          'full-loop-video',
          'runtime-state',
          'human-review',
        ].includes(requirement.kind)
      ) {
        const boundArtifacts = binding.evidencePaths.flatMap((path) => {
          const artifact = verifiedCaptureArtifactsByPath.get(resolve(path))
          return artifact ? [artifact] : []
        })
        for (const coverageError of captureSemanticCoverageErrors(
          requirement,
          boundArtifacts,
        )) {
          errors.push(`${key} evidence ${requirementId} ${coverageError}`)
        }
      }
    }
    proofs.delete(key)
  }
  for (const key of proofs.keys()) errors.push(`undeclared contract proof ${key}`)
  return errors
}

export async function validateAgentVisualReview(
  profilePath: string,
  browserCapturePath: string,
  reviewPath: string,
): Promise<{
  readonly pass: boolean
  readonly errors: readonly string[]
  readonly review: AgentVisualReview
  readonly summaryPath: string
}> {
  const profile = await loadProfile(profilePath)
  const review = parseAgentVisualReview(
    JSON.parse(await readFile(resolve(reviewPath), 'utf8')) as unknown,
  )
  const [model, browserCapture, activeContract, captureValidation] =
    await Promise.all([
      fileDigest(resolve(profile.model.outputPath)),
      fileDigest(resolve(browserCapturePath)),
      activeReviewContract(profile),
      verifyCurrentBrowserCapture(profile, browserCapturePath),
    ])
  const errors: string[] = [...captureValidation.errors]
  const verifiedCaptureArtifactPaths =
    captureValidation.report?.candidate.artifacts.map(
      (artifact) => artifact.absolutePath,
    ) ?? []
  const verifiedCaptureArtifacts =
    captureValidation.report?.candidate.artifacts ?? []
  if (review.animalId !== profile.id) errors.push('animalId does not match profile')
  if (!review.reviewer.trim()) errors.push('reviewer is missing')
  if (!review.reviewerTaskId.trim()) errors.push('reviewerTaskId is missing')
  const captureCollectorTaskId =
    captureValidation.report?.provenance.collectorTaskId ?? null
  const captureCollector = captureValidation.report?.provenance.collector ?? null
  if (
    captureCollectorTaskId !== null &&
    review.reviewerTaskId === captureCollectorTaskId
  ) {
    errors.push(
      'agent visual reviewer task must differ from the headed-capture collector task',
    )
  }
  if (captureCollector !== null && review.reviewer === captureCollector) {
    errors.push(
      'agent visual reviewer identity must differ from the headed-capture collector identity',
    )
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(review.reviewedAt) || !Number.isFinite(Date.parse(review.reviewedAt))) {
    errors.push('reviewedAt must be an ISO timestamp')
  }
  if (review.modelContractSha256 !== modelContractSha256(profile)) {
    errors.push('model contract hash is stale')
  }
  if (review.modelSha256 !== model.sha256) errors.push('model hash is stale')
  if (
    resolve(review.reviewContractPath) !== activeContract.path ||
    review.reviewContractSha256 !== activeContract.sha256
  ) {
    errors.push('review contract binding is stale')
  }
  if (review.browserCaptureSha256 !== browserCapture.sha256) {
    errors.push('browser capture hash is stale')
  }
  if (
    captureValidation.validationSha256 === null ||
    review.browserCaptureValidationSha256 !== captureValidation.validationSha256
  ) {
    errors.push('browser capture validation hash is stale')
  }

  const checks = checkMap(review)
  for (const id of AGENT_REVIEW_CHECKS) {
    const check = checks.get(id)!
    const mayBeNotApplicable =
      (id === 'ground-contact' && profile.model.habitat !== 'land') ||
      (id === 'face-teeth-tongue-integrity' &&
        profile.model.mouthMotion.mode === 'disabled') ||
      (id === 'full-loop-motion' && !profile.model.animationRequired)
    if (check.status === 'not-applicable' && !mayBeNotApplicable) {
      errors.push(`${id} cannot be not-applicable for this profile`)
    }
    if (check.status === 'pending') errors.push(`${id} is still pending`)
    if (check.status === 'fail') errors.push(`${id} failed`)
    if (
      check.status !== 'not-applicable' &&
      !(await evidenceExists(check.evidencePaths))
    ) {
      errors.push(`${id} has no complete file evidence`)
    }
    if (!check.finding.trim() && check.status !== 'not-applicable') {
      errors.push(`${id} needs a concrete finding`)
    }
    if (
      check.status !== 'not-applicable' &&
      check.evidencePaths.some(
        (path) => !verifiedCaptureArtifactPaths.includes(resolve(path)),
      )
    ) {
      errors.push(
        `${id} evidence is not an integrity-validated collector-attested capture artifact`,
      )
    }
  }

  errors.push(
    ...(await contractProofErrors(activeContract.contract, review, {
      machineEvidencePaths: [
        captureValidation.planPath,
        captureValidation.evidencePath,
        captureValidation.validationPath,
        ...(captureValidation.report?.candidate.artifacts.map(
          (artifact) => artifact.absolutePath,
        ) ?? []),
      ],
      verifiedCaptureArtifactPaths,
      verifiedCaptureArtifacts,
      allowPendingOwner: true,
    })),
  )
  if (profile.model.animationRequired) {
    const sampleTimes = [...review.motionSamples]
      .map((sample) => sample.timeSeconds)
      .sort((left, right) => left - right)
    if (sampleTimes.join(',') !== '0,2,4,6,8') {
      errors.push('full-loop review requires exact 0/2/4/6/8-second samples')
    }
    if (
      !(await evidenceExists(
        review.motionSamples.map((sample) => sample.evidencePath),
      ))
    ) {
      errors.push('one or more full-loop sample files are missing')
    }
    if (
      review.motionSamples.some(
        (sample) =>
          !verifiedCaptureArtifactPaths.includes(resolve(sample.evidencePath)),
      )
    ) {
      errors.push('one or more full-loop samples are not verified capture artifacts')
    }
  }
  if (review.overallStatus !== (errors.length === 0 ? 'pass' : 'fail')) {
    errors.push(
      errors.length === 0
        ? 'overallStatus must be pass when every check and contract proof passes'
        : 'overallStatus must be fail while the review has errors',
    )
  }
  if (review.overallStatus === 'pass' && review.blockers.length > 0) {
    errors.push('a passing agent review cannot retain blockers')
  }

  const pass = errors.length === 0
  const summaryPath = resolve(profile.runDirectory, 'agent-review.md')
  const rows = AGENT_REVIEW_CHECKS.map((id) => {
    const check = checks.get(id)!
    return `| ${id} | ${check.status} | ${check.finding || '—'} | ${check.evidencePaths.join('<br>') || '—'} |`
  }).join('\n')
  const proofRows = review.contractProofs
    .map(
      (proof) =>
        `| ${proof.subjectType}:${proof.subjectId} | ${proof.requiredAuthority} | ${proof.status} | ${proof.verifiedBy || '—'} | ${proof.finding || '—'} |`,
    )
    .join('\n')
  await writeText(
    summaryPath,
    `# Agent visual review: ${profile.id}\n\n` +
      `- Result: ${pass ? 'PASS' : 'FAIL'}\n` +
      `- Reviewer: ${review.reviewer || 'missing'}\n` +
      `- Reviewer task: ${review.reviewerTaskId || 'missing'}\n` +
      `- Capture collector: ${captureValidation.report?.provenance.collector ?? 'missing'} (${captureValidation.report?.provenance.collectorTaskId ?? 'missing task'})\n` +
      `- Capture provenance assurance: collector-attested; cryptographically verified: no\n` +
      `- Capture provenance boundary: ${captureValidation.report?.provenance.warning ?? 'missing'}\n` +
      `- Reviewed at: ${review.reviewedAt || 'missing'}\n` +
      `- Model SHA-256: \`${model.sha256}\`\n` +
      `- Review-contract SHA-256: \`${activeContract.sha256}\`\n` +
      `- Browser capture SHA-256: \`${browserCapture.sha256}\`\n` +
      `- Browser validation SHA-256: \`${captureValidation.validationSha256 ?? 'missing'}\`\n\n` +
      `| Check | Status | Finding | Evidence |\n| --- | --- | --- | --- |\n${rows}\n\n` +
      `| Contract proof | Authority | Status | Verified by | Finding |\n| --- | --- | --- | --- | --- |\n${proofRows}\n\n` +
      `## Blocking errors\n\n${errors.map((error) => `- ${error}`).join('\n') || '- None'}\n`,
  )
  return { pass, errors, review, summaryPath }
}
