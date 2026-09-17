import { lstat, open, readFile, realpath } from 'node:fs/promises'
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path'

import { parseBrowserCapturePlanInput } from './browser-capture'
import { fileDigest, sha256, writeJson } from './io'
import {
  loadReviewContract,
  type ReviewContract,
} from './review-contract'

const animalIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const sha256Pattern = /^[a-f0-9]{64}$/
const datePattern = /^\d{4}-\d{2}-\d{2}$/

export interface StageLockRecord {
  readonly schemaVersion: 1
  readonly animalId: string
  readonly lockId: string
  readonly workspacePath: string
  readonly generatedAt: string
  readonly currentStage: 'requirements-locked'
  readonly sourceRecord: {
    readonly path: string
    readonly bytes: number
    readonly sha256: string
  }
  readonly sourceAsset: {
    readonly path: string
    readonly bytes: number
    readonly sha256: string
  }
  readonly reviewContract: {
    readonly path: string
    readonly bytes: number
    readonly sha256: string
  }
  readonly profile: {
    readonly path: string
    readonly requirementsBytes: number
    readonly requirementsSha256: string
  }
  readonly capturePlanInput: {
    readonly path: string
    readonly bytes: number
    readonly sha256: string
  }
  readonly rightsEvidence: readonly {
    readonly path: string
    readonly bytes: number
    readonly sha256: string
  }[]
  readonly downstreamInvalidationRule: string
}

export interface AnimalOnboardingSourceRecord {
  readonly schemaVersion: 1
  readonly kind: 'animal-onboarding-source-record'
  readonly animalId: string
  readonly source: {
    readonly path: string
    readonly bytes: number
    readonly sha256: string
  }
  readonly requirementsTemplate: {
    readonly reviewContractPath: string
    readonly reviewContractSha256: string
    readonly targetIssuesSha256: string
    readonly invariantsSha256: string
    readonly evidenceRequirementsSha256: string
  }
  readonly blockingPlaceholders: readonly {
    readonly id:
      | 'source-rights'
      | 'scientific-identity'
      | 'requirements-contract'
      | 'presentation'
    readonly resolved: boolean
    readonly fields: readonly string[]
  }[]
}

export interface L3AcceptanceDecisionRecord {
  readonly schemaVersion: 2
  readonly animalId: string
  readonly decision: 'accept-l3-investment'
  readonly acceptedBy: string
  readonly acceptedOn: string
  readonly workspacePath: string
  readonly stageLockId: string
  readonly stageLockPath: string
  readonly stageLockSha256: string
  readonly reviewContractPath: string
  readonly reviewContractSha256: string
  readonly inspectionPath: string
  readonly inspectionSha256: string
  readonly routeScope: {
    readonly classification: 'blocked'
    readonly underlyingRiskLevel: 'L3'
    readonly recommendedRoute: 'obtain-l3-acceptance'
    readonly reasons: readonly string[]
    readonly blockingReasons: readonly string[]
    readonly plannedOperations: readonly string[]
    readonly parallelRequested: boolean
  }
  readonly boundary: string
}

interface SourceRightsEvidenceRecord {
  readonly schemaVersion: 1
  readonly kind: 'source-rights-evidence'
  readonly animalId: string
  readonly source: {
    readonly title: string
    readonly author: string
    readonly pageUrl: string
    readonly licenseId: 'CC0-1.0' | 'CC-BY-4.0'
    readonly licenseName: string
    readonly licenseUrl: string
    readonly accessedOn: string
    readonly directSourceVerified: true
    readonly downloadAllowed: true
    readonly modificationAllowed: true
    readonly redistributionAllowed: true
    readonly modelSha256: string
  }
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
  const object = value as JsonObject
  const expected = new Set(keys)
  for (const key of Object.keys(object)) {
    if (!expected.has(key)) throw new Error(`${label}.${key} is not allowed`)
  }
  for (const key of keys) {
    if (!(key in object)) throw new Error(`${label}.${key} is required`)
  }
  return object
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

function animalIdentifier(value: unknown, label: string): string {
  const result = nonEmptyString(value, label)
  if (!animalIdPattern.test(result)) {
    throw new Error(`${label} must be lowercase kebab-case`)
  }
  return result
}

function absoluteNormalizedPath(value: unknown, label: string): string {
  const result = nonEmptyString(value, label)
  if (!isAbsolute(result) || resolve(result) !== result) {
    throw new Error(`${label} must be an absolute normalized path`)
  }
  return result
}

function sha256Value(value: unknown, label: string): string {
  const result = nonEmptyString(value, label)
  if (!sha256Pattern.test(result)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`)
  }
  return result
}

function realDate(value: unknown, label: string): string {
  const result = nonEmptyString(value, label)
  if (!datePattern.test(result)) throw new Error(`${label} must be YYYY-MM-DD`)
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

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return value as number
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty string array`)
  }
  const result = value.map((entry, index) =>
    nonEmptyString(entry, `${label}[${index}]`),
  )
  if (new Set(result).size !== result.length) {
    throw new Error(`${label} must not contain duplicates`)
  }
  return result.sort()
}

function strictChild(parent: string, child: string): boolean {
  const path = relative(resolve(parent), resolve(child))
  return (
    path.length > 0 &&
    path !== '..' &&
    !path.startsWith(`..${sep}`) &&
    !isAbsolute(path)
  )
}

function meaningfulString(value: unknown, label: string): string {
  const result = nonEmptyString(value, label)
  if (/BLOCKED(?:_|:)|blocked\.invalid/iu.test(result)) {
    throw new Error(`${label} still contains a blocking starter value`)
  }
  return result
}

function webUrl(value: unknown, label: string): string {
  const result = meaningfulString(value, label)
  let parsed: URL
  try {
    parsed = new URL(result)
  } catch {
    throw new Error(`${label} must be an absolute HTTP(S) URL`)
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error(`${label} must be an absolute HTTP(S) URL`)
  }
  return result
}

function trueValue(value: unknown, label: string): true {
  if (value !== true) throw new Error(`${label} must be true`)
  return true
}

function digestRecord(
  value: unknown,
  label: string,
  workspacePath?: string,
): { readonly path: string; readonly bytes: number; readonly sha256: string } {
  const source = exactObject(value, label, ['path', 'bytes', 'sha256'])
  const path = absoluteNormalizedPath(source.path, `${label}.path`)
  if (workspacePath !== undefined && !strictChild(workspacePath, path)) {
    throw new Error(`${label}.path must be inside the animal workspace`)
  }
  return {
    path,
    bytes: positiveInteger(source.bytes, `${label}.bytes`),
    sha256: sha256Value(source.sha256, `${label}.sha256`),
  }
}

function profileRequirementsRecord(
  value: unknown,
  label: string,
  workspacePath: string,
): StageLockRecord['profile'] {
  const source = exactObject(value, label, [
    'path',
    'requirementsBytes',
    'requirementsSha256',
  ])
  const path = absoluteNormalizedPath(source.path, `${label}.path`)
  if (!strictChild(workspacePath, path)) {
    throw new Error(`${label}.path must be inside the animal workspace`)
  }
  return {
    path,
    requirementsBytes: positiveInteger(
      source.requirementsBytes,
      `${label}.requirementsBytes`,
    ),
    requirementsSha256: sha256Value(
      source.requirementsSha256,
      `${label}.requirementsSha256`,
    ),
  }
}

function parseSourceRightsEvidence(
  value: unknown,
  label: string,
): SourceRightsEvidenceRecord {
  const root = exactObject(value, label, [
    'schemaVersion',
    'kind',
    'animalId',
    'source',
  ])
  if (root.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must be 1`)
  if (root.kind !== 'source-rights-evidence') {
    throw new Error(`${label}.kind must be source-rights-evidence`)
  }
  const source = exactObject(root.source, `${label}.source`, [
    'title',
    'author',
    'pageUrl',
    'licenseId',
    'licenseName',
    'licenseUrl',
    'accessedOn',
    'directSourceVerified',
    'downloadAllowed',
    'modificationAllowed',
    'redistributionAllowed',
    'modelSha256',
  ])
  const licenseId = meaningfulString(source.licenseId, `${label}.source.licenseId`)
  if (licenseId !== 'CC0-1.0' && licenseId !== 'CC-BY-4.0') {
    throw new Error(`${label}.source.licenseId must be CC0-1.0 or CC-BY-4.0`)
  }
  return {
    schemaVersion: 1,
    kind: 'source-rights-evidence',
    animalId: animalIdentifier(root.animalId, `${label}.animalId`),
    source: {
      title: meaningfulString(source.title, `${label}.source.title`),
      author: meaningfulString(source.author, `${label}.source.author`),
      pageUrl: webUrl(source.pageUrl, `${label}.source.pageUrl`),
      licenseId,
      licenseName: meaningfulString(
        source.licenseName,
        `${label}.source.licenseName`,
      ),
      licenseUrl: webUrl(source.licenseUrl, `${label}.source.licenseUrl`),
      accessedOn: realDate(source.accessedOn, `${label}.source.accessedOn`),
      directSourceVerified: trueValue(
        source.directSourceVerified,
        `${label}.source.directSourceVerified`,
      ),
      downloadAllowed: trueValue(
        source.downloadAllowed,
        `${label}.source.downloadAllowed`,
      ),
      modificationAllowed: trueValue(
        source.modificationAllowed,
        `${label}.source.modificationAllowed`,
      ),
      redistributionAllowed: trueValue(
        source.redistributionAllowed,
        `${label}.source.redistributionAllowed`,
      ),
      modelSha256: sha256Value(
        source.modelSha256,
        `${label}.source.modelSha256`,
      ),
    },
  }
}

const placeholderFields = {
  'source-rights': [
    'source.accessedOn',
    'source.author',
    'source.directSourceVerified',
    'source.downloadAllowed',
    'source.licenseId',
    'source.licenseName',
    'source.licenseUrl',
    'source.modificationAllowed',
    'source.pageUrl',
    'source.redistributionAllowed',
    'source.title',
  ],
  'scientific-identity': ['reviewContract.invariants', 'science'],
  'requirements-contract': [
    'reviewContract.evidenceRequirements',
    'reviewContract.invariants',
    'reviewContract.targetIssues',
  ],
  presentation: [
    'capturePlanInput.cameraAngles',
    'capturePlanInput.reviewUrl',
    'presentation',
  ],
} as const

const starterTargetIssueIds = new Set([
  'scientific-identity-unverified',
  'full-loop-review-required',
  'initial-presentation-blocked',
])
const starterInvariantIds = new Set(['anatomy-remains-intact'])
const starterEvidenceRequirementIds = new Set([
  'baseline-multiview',
  'candidate-scientific-identity',
  'candidate-full-loop',
  'candidate-multiview',
  'candidate-presentation',
  'runtime-camera-states',
])

export function parseSourceRecord(value: unknown): AnimalOnboardingSourceRecord {
  const label = 'sourceRecord'
  const source = exactObject(value, label, [
    'schemaVersion',
    'kind',
    'animalId',
    'source',
    'requirementsTemplate',
    'blockingPlaceholders',
  ])
  if (source.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`)
  }
  if (source.kind !== 'animal-onboarding-source-record') {
    throw new Error(`${label}.kind must be animal-onboarding-source-record`)
  }
  const sourceAsset = exactObject(source.source, `${label}.source`, [
    'path',
    'bytes',
    'sha256',
  ])
  const requirementsTemplate = exactObject(
    source.requirementsTemplate,
    `${label}.requirementsTemplate`,
    [
      'reviewContractPath',
      'reviewContractSha256',
      'targetIssuesSha256',
      'invariantsSha256',
      'evidenceRequirementsSha256',
    ],
  )
  if (!Array.isArray(source.blockingPlaceholders)) {
    throw new Error(`${label}.blockingPlaceholders must be an array`)
  }
  const placeholders = source.blockingPlaceholders.map((entry, index) => {
    const itemLabel = `${label}.blockingPlaceholders[${index}]`
    const item = exactObject(entry, itemLabel, ['id', 'resolved', 'fields'])
    const id = nonEmptyString(item.id, `${itemLabel}.id`)
    if (!(id in placeholderFields)) {
      throw new Error(`${itemLabel}.id is not a run-init blocking placeholder`)
    }
    if (typeof item.resolved !== 'boolean') {
      throw new Error(`${itemLabel}.resolved must be a boolean`)
    }
    const fields = stringArray(item.fields, `${itemLabel}.fields`)
    const expectedFields = [...placeholderFields[id as keyof typeof placeholderFields]].sort()
    if (
      fields.length !== expectedFields.length ||
      fields.some((field, fieldIndex) => field !== expectedFields[fieldIndex])
    ) {
      throw new Error(`${itemLabel}.fields do not match the canonical ${id} placeholder`)
    }
    return {
      id: id as keyof typeof placeholderFields,
      resolved: item.resolved,
      fields,
    }
  })
  const ids = placeholders.map(({ id }) => id)
  if (
    new Set(ids).size !== Object.keys(placeholderFields).length ||
    Object.keys(placeholderFields).some((id) => !ids.includes(id as keyof typeof placeholderFields))
  ) {
    throw new Error(`${label}.blockingPlaceholders must contain every canonical placeholder exactly once`)
  }
  return {
    schemaVersion: 1,
    kind: 'animal-onboarding-source-record',
    animalId: animalIdentifier(source.animalId, `${label}.animalId`),
    source: {
      path: absoluteNormalizedPath(sourceAsset.path, `${label}.source.path`),
      bytes: positiveInteger(sourceAsset.bytes, `${label}.source.bytes`),
      sha256: sha256Value(sourceAsset.sha256, `${label}.source.sha256`),
    },
    requirementsTemplate: {
      reviewContractPath: absoluteNormalizedPath(
        requirementsTemplate.reviewContractPath,
        `${label}.requirementsTemplate.reviewContractPath`,
      ),
      reviewContractSha256: sha256Value(
        requirementsTemplate.reviewContractSha256,
        `${label}.requirementsTemplate.reviewContractSha256`,
      ),
      targetIssuesSha256: sha256Value(
        requirementsTemplate.targetIssuesSha256,
        `${label}.requirementsTemplate.targetIssuesSha256`,
      ),
      invariantsSha256: sha256Value(
        requirementsTemplate.invariantsSha256,
        `${label}.requirementsTemplate.invariantsSha256`,
      ),
      evidenceRequirementsSha256: sha256Value(
        requirementsTemplate.evidenceRequirementsSha256,
        `${label}.requirementsTemplate.evidenceRequirementsSha256`,
      ),
    },
    blockingPlaceholders: placeholders.sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  }
}

function sectionSha256(value: unknown): string {
  return sha256(Buffer.from(JSON.stringify(value), 'utf8'))
}

async function assertNonSymlinkFile(path: string, label: string): Promise<void> {
  const entry = await lstat(path).catch(() => null)
  if (!entry?.isFile() || entry.isSymbolicLink()) {
    throw new Error(`${label} must be a non-symlink regular file`)
  }
}

async function assertStrictWorkspaceFile(
  workspacePath: string,
  path: string,
  label: string,
): Promise<void> {
  if (!strictChild(workspacePath, path)) {
    throw new Error(`${label} must be inside the animal workspace`)
  }
  await assertNonSymlinkFile(path, label)
  const [realWorkspace, realFile] = await Promise.all([
    realpath(workspacePath),
    realpath(path),
  ])
  if (!strictChild(realWorkspace, realFile)) {
    throw new Error(`${label} must resolve inside the animal workspace`)
  }
}

function profileObject(value: unknown, label: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as JsonObject
}

function repositoryRootForWorkspace(workspacePath: string): string {
  const runsRoot = dirname(workspacePath)
  const handoffRoot = dirname(runsRoot)
  if (
    basename(runsRoot) === 'animal-onboarding-runs' &&
    basename(handoffRoot) === '.handoff'
  ) {
    return dirname(handoffRoot)
  }
  return workspacePath
}

function resolveWorkspaceReference(workspacePath: string, value: string): string {
  return isAbsolute(value)
    ? resolve(value)
    : resolve(repositoryRootForWorkspace(workspacePath), value)
}

async function validateResolvedCoverage(
  animalId: string,
  workspacePath: string,
  sourceRecord: AnimalOnboardingSourceRecord,
  contract: ReviewContract,
): Promise<{
  readonly profileRequirementsDigest: {
    readonly bytes: number
    readonly sha256: string
  }
  readonly capturePlanInputDigest: Awaited<ReturnType<typeof fileDigest>>
  readonly rightsEvidence: readonly {
    readonly path: string
    readonly bytes: number
    readonly sha256: string
  }[]
}> {
  const workspace = resolve(workspacePath)
  const profilePath = resolve(workspace, 'profile.json')
  const capturePlanInputPath = resolve(workspace, 'capture-plan-input.json')
  await Promise.all([
    assertStrictWorkspaceFile(workspace, profilePath, 'canonical profile.json'),
    assertStrictWorkspaceFile(
      workspace,
      capturePlanInputPath,
      'canonical capture-plan-input.json',
    ),
  ])

  const profile = profileObject(
    JSON.parse(await readFile(profilePath, 'utf8')) as unknown,
    'profile',
  )
  if (profile.schemaVersion !== 1 || profile.status !== 'draft') {
    throw new Error('profile.schemaVersion must be 1 and status must be draft')
  }
  if (animalIdentifier(profile.id, 'profile.id') !== animalId) {
    throw new Error('profile.id does not match the requirements lock')
  }
  const runDirectory = resolveWorkspaceReference(
    workspace,
    nonEmptyString(profile.runDirectory, 'profile.runDirectory'),
  )
  if (runDirectory !== workspace) {
    throw new Error('profile.runDirectory must resolve to the animal workspace')
  }

  const source = profileObject(profile.source, 'profile.source')
  const sourceModelPath = resolveWorkspaceReference(
    workspace,
    nonEmptyString(source.sourceModelPath, 'profile.source.sourceModelPath'),
  )
  if (sourceModelPath !== sourceRecord.source.path) {
    throw new Error('profile.source.sourceModelPath does not match source-record.json')
  }
  const rights = {
    title: meaningfulString(source.title, 'profile.source.title'),
    author: meaningfulString(source.author, 'profile.source.author'),
    pageUrl: webUrl(source.pageUrl, 'profile.source.pageUrl'),
    licenseId: meaningfulString(source.licenseId, 'profile.source.licenseId'),
    licenseName: meaningfulString(source.licenseName, 'profile.source.licenseName'),
    licenseUrl: webUrl(source.licenseUrl, 'profile.source.licenseUrl'),
    accessedOn: realDate(source.accessedOn, 'profile.source.accessedOn'),
    directSourceVerified: trueValue(
      source.directSourceVerified,
      'profile.source.directSourceVerified',
    ),
    downloadAllowed: trueValue(
      source.downloadAllowed,
      'profile.source.downloadAllowed',
    ),
    modificationAllowed: trueValue(
      source.modificationAllowed,
      'profile.source.modificationAllowed',
    ),
    redistributionAllowed: trueValue(
      source.redistributionAllowed,
      'profile.source.redistributionAllowed',
    ),
  }
  if (rights.licenseId !== 'CC0-1.0' && rights.licenseId !== 'CC-BY-4.0') {
    throw new Error('profile.source.licenseId must be CC0-1.0 or CC-BY-4.0')
  }
  if (!Array.isArray(source.evidencePaths) || source.evidencePaths.length === 0) {
    throw new Error('profile.source.evidencePaths must be a non-empty array')
  }
  const evidencePaths = source.evidencePaths.map((entry, index) =>
    resolveWorkspaceReference(
      workspace,
      nonEmptyString(entry, `profile.source.evidencePaths[${index}]`),
    ),
  )
  if (new Set(evidencePaths).size !== evidencePaths.length) {
    throw new Error('profile.source.evidencePaths must not contain duplicates')
  }
  const rightsEvidence = await Promise.all(
    evidencePaths.map(async (path, index) => {
      const label = `profile.source.evidencePaths[${index}]`
      await assertStrictWorkspaceFile(workspace, path, label)
      const evidence = parseSourceRightsEvidence(
        JSON.parse(await readFile(path, 'utf8')) as unknown,
        `sourceRightsEvidence[${index}]`,
      )
      if (evidence.animalId !== animalId) {
        throw new Error(`${label} belongs to a different animal`)
      }
      const expected = {
        ...rights,
        modelSha256: sourceRecord.source.sha256,
      }
      if (JSON.stringify(evidence.source) !== JSON.stringify(expected)) {
        throw new Error(`${label} does not exactly attest the active profile rights and source digest`)
      }
      return { path, ...(await fileDigest(path)) }
    }),
  )

  const science = profileObject(profile.science, 'profile.science')
  for (const key of ['displayName', 'classificationLabel', 'identityScope'] as const) {
    meaningfulString(science[key], `profile.science.${key}`)
  }
  if (!['high', 'medium', 'low'].includes(String(science.confidence))) {
    throw new Error('profile.science.confidence must be high, medium or low')
  }
  if (!['pending', 'approved'].includes(String(science.humanReviewStatus))) {
    throw new Error('profile.science.humanReviewStatus must be pending or approved')
  }
  if (!Array.isArray(science.sourceUrls) || science.sourceUrls.length === 0) {
    throw new Error('profile.science.sourceUrls must be a non-empty array')
  }
  science.sourceUrls.forEach((url, index) =>
    webUrl(url, `profile.science.sourceUrls[${index}]`),
  )
  if (!Array.isArray(science.uncertaintyNotes)) {
    throw new Error('profile.science.uncertaintyNotes must be an array')
  }
  science.uncertaintyNotes.forEach((note, index) =>
    meaningfulString(note, `profile.science.uncertaintyNotes[${index}]`),
  )
  if (contract.invariants.length === 0) {
    throw new Error('scientific-identity resolution requires at least one review-contract invariant')
  }

  const presentation = profileObject(profile.presentation, 'profile.presentation')
  if (
    typeof presentation.initialYawDegrees !== 'number' ||
    !Number.isFinite(presentation.initialYawDegrees)
  ) {
    throw new Error('profile.presentation.initialYawDegrees must be finite')
  }
  if (!['left', 'right'].includes(String(presentation.initialHeadSide))) {
    throw new Error('profile.presentation.initialHeadSide must be left or right')
  }
  if (!['ground', 'none'].includes(String(presentation.shadow))) {
    throw new Error('profile.presentation.shadow must be ground or none')
  }
  const safeAreaPadding = presentation.safeAreaPadding
  if (
    typeof safeAreaPadding !== 'number' ||
    !Number.isFinite(safeAreaPadding) ||
    safeAreaPadding < 0 ||
    safeAreaPadding >= 0.5
  ) {
    throw new Error('profile.presentation.safeAreaPadding must be between 0 and 0.5')
  }
  if (presentation.portraitSafeAreaPadding !== undefined) {
    const value = presentation.portraitSafeAreaPadding
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0 ||
      value >= 0.5
    ) {
      throw new Error(
        'profile.presentation.portraitSafeAreaPadding must be between 0 and 0.5',
      )
    }
  }
  for (const key of [
    'shadowOpacity',
    'shadowScale',
    'shadowDepthScale',
    'shadowHorizontalOffset',
    'toneMappingExposure',
  ] as const) {
    if (presentation[key] === undefined) continue
    if (typeof presentation[key] !== 'number' || !Number.isFinite(presentation[key])) {
      throw new Error(`profile.presentation.${key} must be finite when configured`)
    }
  }

  const capturePlanInput = parseBrowserCapturePlanInput(
    JSON.parse(await readFile(capturePlanInputPath, 'utf8')) as unknown,
  )
  if (capturePlanInput.animalId !== animalId) {
    throw new Error('capture-plan-input.json belongs to a different animal')
  }
  const reviewUrl = webUrl(capturePlanInput.reviewUrl, 'capturePlanInput.reviewUrl')
  if (new URL(reviewUrl).hostname === 'blocked.invalid') {
    throw new Error('capturePlanInput.reviewUrl is still blocked')
  }
  const model = profileObject(profile.model, 'profile.model')
  if (
    resolveWorkspaceReference(workspace, capturePlanInput.finalGlbPath) !==
    resolveWorkspaceReference(
      workspace,
      nonEmptyString(model.outputPath, 'profile.model.outputPath'),
    )
  ) {
    throw new Error('capturePlanInput.finalGlbPath must match profile.model.outputPath')
  }
  if (
    capturePlanInput.animation.clipName !== 'Idle' ||
    capturePlanInput.animation.durationSeconds !== 8
  ) {
    throw new Error('capturePlanInput.animation must declare the exact eight-second Idle')
  }
  const angleIds = capturePlanInput.cameraAngles.map(({ id }) => id)
  if (new Set(angleIds).size !== angleIds.length || angleIds.length < 3) {
    throw new Error('capturePlanInput.cameraAngles must contain at least three unique angles')
  }
  const primaryAngleId = capturePlanInput.primaryCameraAngleId
  if (!primaryAngleId) {
    throw new Error('capturePlanInput.primaryCameraAngleId is required')
  }
  const primaryAngle = capturePlanInput.cameraAngles.find(({ id }) => id === primaryAngleId)
  if (!primaryAngle) {
    throw new Error('capturePlanInput.primaryCameraAngleId is not declared in cameraAngles')
  }
  if (Math.abs(primaryAngle.yawDegrees - Number(presentation.initialYawDegrees)) > 1e-9) {
    throw new Error('capturePlanInput primary yaw must match profile.presentation.initialYawDegrees')
  }
  const auxiliary = capturePlanInput.auxiliaryCameraAngleIds ?? []
  if (auxiliary.length < 2 || auxiliary.some((id) => !angleIds.includes(id))) {
    throw new Error('capturePlanInput must declare at least two valid auxiliary camera angles')
  }

  const profileRequirementsBytes = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      animalId,
      runDirectory: workspace,
      source: {
        ...rights,
        sourceModelPath,
        evidencePaths,
      },
      science: {
        displayName: science.displayName,
        classificationLabel: science.classificationLabel,
        identityScope: science.identityScope,
        confidence: science.confidence,
        sourceUrls: science.sourceUrls,
        uncertaintyNotes: science.uncertaintyNotes,
        humanReviewStatus: science.humanReviewStatus,
      },
      modelOutputPath: resolveWorkspaceReference(
        workspace,
        nonEmptyString(model.outputPath, 'profile.model.outputPath'),
      ),
      presentation: Object.fromEntries(
        [
          'initialYawDegrees',
          'initialHeadSide',
          'safeAreaPadding',
          'portraitSafeAreaPadding',
          'shadow',
          'shadowOpacity',
          'shadowScale',
          'shadowDepthScale',
          'shadowHorizontalOffset',
          'toneMappingExposure',
        ]
          .filter((key) => presentation[key] !== undefined)
          .map((key) => [key, presentation[key]]),
      ),
    }),
    'utf8',
  )
  const capturePlanInputDigest = await fileDigest(capturePlanInputPath)
  return {
    profileRequirementsDigest: {
      bytes: profileRequirementsBytes.length,
      sha256: sha256(profileRequirementsBytes),
    },
    capturePlanInputDigest,
    rightsEvidence,
  }
}

async function validateRequirementsInputs(
  animalId: string,
  workspacePath: string,
  sourceRecordPath: string,
  reviewContractPath: string,
): Promise<{
  readonly sourceRecord: AnimalOnboardingSourceRecord
  readonly sourceRecordDigest: Awaited<ReturnType<typeof fileDigest>>
  readonly sourceDigest: Awaited<ReturnType<typeof fileDigest>>
  readonly contract: ReviewContract
  readonly contractDigest: Awaited<ReturnType<typeof fileDigest>>
  readonly profileRequirementsDigest: {
    readonly bytes: number
    readonly sha256: string
  }
  readonly capturePlanInputDigest: Awaited<ReturnType<typeof fileDigest>>
  readonly rightsEvidence: readonly {
    readonly path: string
    readonly bytes: number
    readonly sha256: string
  }[]
}> {
  const workspace = resolve(workspacePath)
  const recordPath = resolve(sourceRecordPath)
  const contractPath = resolve(reviewContractPath)
  const workspaceEntry = await lstat(workspace).catch(() => null)
  if (!workspaceEntry?.isDirectory() || workspaceEntry.isSymbolicLink()) {
    throw new Error('animal workspace must be a non-symlink directory')
  }
  if (!strictChild(workspace, recordPath) || !strictChild(workspace, contractPath)) {
    throw new Error('source record and review contract must be inside the animal workspace')
  }
  if (basename(recordPath) !== 'source-record.json') {
    throw new Error('requirements lock requires the canonical source-record.json path')
  }
  await Promise.all([
    assertNonSymlinkFile(recordPath, 'source record'),
    assertNonSymlinkFile(contractPath, 'review contract'),
  ])
  const [realWorkspace, realRecord, realContract] = await Promise.all([
    realpath(workspace),
    realpath(recordPath),
    realpath(contractPath),
  ])
  if (!strictChild(realWorkspace, realRecord) || !strictChild(realWorkspace, realContract)) {
    throw new Error('source record and review contract must resolve inside the animal workspace')
  }
  const sourceRecord = parseSourceRecord(
    JSON.parse(await readFile(recordPath, 'utf8')) as unknown,
  )
  if (sourceRecord.animalId !== animalId) {
    throw new Error('source record animalId does not match the requirements lock')
  }
  if (sourceRecord.requirementsTemplate.reviewContractPath !== contractPath) {
    throw new Error('source record binds a different review-contract path')
  }
  const unresolved = sourceRecord.blockingPlaceholders
    .filter(({ resolved }) => !resolved)
    .map(({ id }) => id)
  if (unresolved.length > 0) {
    throw new Error(`requirements lock has unresolved source-record placeholders: ${unresolved.join(', ')}`)
  }
  await assertNonSymlinkFile(sourceRecord.source.path, 'recorded source asset')
  const [sourceDigest, sourceRecordDigest, contractDigest, contract] = await Promise.all([
    fileDigest(sourceRecord.source.path),
    fileDigest(recordPath),
    fileDigest(contractPath),
    loadReviewContract(contractPath),
  ])
  if (
    sourceDigest.bytes !== sourceRecord.source.bytes ||
    sourceDigest.sha256 !== sourceRecord.source.sha256
  ) {
    throw new Error('recorded source asset path, bytes or SHA-256 is stale')
  }
  if (contract.animalId !== animalId) {
    throw new Error('review contract animalId does not match the requirements lock')
  }
  if (contract.baselineAssetSha256 !== sourceRecord.source.sha256) {
    throw new Error('review contract baseline SHA-256 does not match the source record')
  }
  const requirementsPlaceholder = sourceRecord.blockingPlaceholders.find(
    ({ id }) => id === 'requirements-contract',
  )
  if (!requirementsPlaceholder?.resolved) {
    throw new Error('requirements-contract placeholder must be resolved')
  }
  const unchangedSections = [
    sectionSha256(contract.targetIssues) ===
      sourceRecord.requirementsTemplate.targetIssuesSha256
      ? 'targetIssues'
      : null,
    sectionSha256(contract.invariants) ===
      sourceRecord.requirementsTemplate.invariantsSha256
      ? 'invariants'
      : null,
    sectionSha256(contract.evidenceRequirements) ===
      sourceRecord.requirementsTemplate.evidenceRequirementsSha256
      ? 'evidenceRequirements'
      : null,
  ].filter((section): section is string => section !== null)
  if (unchangedSections.length > 0) {
    throw new Error(
      `requirements-contract cannot resolve until task-specific sections replace the starter template: ${unchangedSections.join(', ')}`,
    )
  }
  const taskTargetIssues = contract.targetIssues.filter(
    ({ id }) => !starterTargetIssueIds.has(id),
  )
  const taskInvariants = contract.invariants.filter(
    ({ id }) => !starterInvariantIds.has(id),
  )
  const taskSubjectEvidenceIds = new Set([
    ...taskTargetIssues.flatMap(({ requiredEvidence }) => requiredEvidence),
    ...taskInvariants.flatMap(({ baselineEvidence, candidateEvidence }) => [
      ...baselineEvidence,
      ...candidateEvidence,
    ]),
  ])
  const taskEvidenceRequirements = contract.evidenceRequirements.filter(
    ({ id }) =>
      !starterEvidenceRequirementIds.has(id) && taskSubjectEvidenceIds.has(id),
  )
  const missingTaskSections = [
    taskTargetIssues.length === 0 ? 'targetIssues' : null,
    taskInvariants.length === 0 ? 'invariants' : null,
    taskEvidenceRequirements.length === 0 ? 'evidenceRequirements' : null,
  ].filter((section): section is string => section !== null)
  if (missingTaskSections.length > 0) {
    throw new Error(
      `requirements-contract requires task-specific subject IDs and their evidence closure: ${missingTaskSections.join(', ')}`,
    )
  }
  const resolvedCoverage = await validateResolvedCoverage(
    animalId,
    workspace,
    sourceRecord,
    contract,
  )
  return {
    sourceRecord,
    sourceRecordDigest,
    sourceDigest,
    contract,
    contractDigest,
    ...resolvedCoverage,
  }
}

export function parseStageLockRecord(value: unknown): StageLockRecord {
  const label = 'stageLock'
  const source = exactObject(value, label, [
    'schemaVersion',
    'animalId',
    'lockId',
    'workspacePath',
    'generatedAt',
    'currentStage',
    'sourceRecord',
    'sourceAsset',
    'reviewContract',
    'profile',
    'capturePlanInput',
    'rightsEvidence',
    'downstreamInvalidationRule',
  ])
  if (source.schemaVersion !== 1) {
    throw new Error(`${label}.schemaVersion must be 1`)
  }
  const animalId = animalIdentifier(source.animalId, `${label}.animalId`)
  const lockId = animalIdentifier(source.lockId, `${label}.lockId`)
  if (lockId !== `${animalId}-model-stage`) {
    throw new Error(`${label}.lockId must be the canonical animal model-stage ID`)
  }
  const workspacePath = absoluteNormalizedPath(
    source.workspacePath,
    `${label}.workspacePath`,
  )
  if (basename(workspacePath) !== animalId) {
    throw new Error(`${label}.workspacePath basename must equal animalId`)
  }
  const generatedAt = nonEmptyString(source.generatedAt, `${label}.generatedAt`)
  if (!/^\d{4}-\d{2}-\d{2}T/.test(generatedAt) || !Number.isFinite(Date.parse(generatedAt))) {
    throw new Error(`${label}.generatedAt must be an ISO timestamp`)
  }
  if (source.currentStage !== 'requirements-locked') {
    throw new Error(`${label}.currentStage must be requirements-locked`)
  }
  const sourceRecord = digestRecord(
    source.sourceRecord,
    `${label}.sourceRecord`,
    workspacePath,
  )
  const sourceAsset = digestRecord(source.sourceAsset, `${label}.sourceAsset`)
  const contract = digestRecord(
    source.reviewContract,
    `${label}.reviewContract`,
    workspacePath,
  )
  const profile = profileRequirementsRecord(
    source.profile,
    `${label}.profile`,
    workspacePath,
  )
  const capturePlanInput = digestRecord(
    source.capturePlanInput,
    `${label}.capturePlanInput`,
    workspacePath,
  )
  if (profile.path !== resolve(workspacePath, 'profile.json')) {
    throw new Error(`${label}.profile.path must be the canonical profile.json path`)
  }
  if (capturePlanInput.path !== resolve(workspacePath, 'capture-plan-input.json')) {
    throw new Error(
      `${label}.capturePlanInput.path must be the canonical capture-plan-input.json path`,
    )
  }
  if (!Array.isArray(source.rightsEvidence) || source.rightsEvidence.length === 0) {
    throw new Error(`${label}.rightsEvidence must be a non-empty array`)
  }
  const rightsEvidence = source.rightsEvidence.map((entry, index) =>
    digestRecord(entry, `${label}.rightsEvidence[${index}]`, workspacePath),
  )
  if (new Set(rightsEvidence.map(({ path }) => path)).size !== rightsEvidence.length) {
    throw new Error(`${label}.rightsEvidence must not contain duplicate paths`)
  }
  return {
    schemaVersion: 1,
    animalId,
    lockId,
    workspacePath,
    generatedAt,
    currentStage: 'requirements-locked',
    sourceRecord,
    sourceAsset,
    reviewContract: contract,
    profile,
    capturePlanInput,
    rightsEvidence,
    downstreamInvalidationRule: nonEmptyString(
      source.downstreamInvalidationRule,
      `${label}.downstreamInvalidationRule`,
    ),
  }
}

export function parseL3AcceptanceDecisionRecord(
  value: unknown,
): L3AcceptanceDecisionRecord {
  const label = 'l3Acceptance'
  const source = exactObject(value, label, [
    'schemaVersion',
    'animalId',
    'decision',
    'acceptedBy',
    'acceptedOn',
    'workspacePath',
    'stageLockId',
    'stageLockPath',
    'stageLockSha256',
    'reviewContractPath',
    'reviewContractSha256',
    'inspectionPath',
    'inspectionSha256',
    'routeScope',
    'boundary',
  ])
  if (source.schemaVersion !== 2) {
    throw new Error(`${label}.schemaVersion must be 2`)
  }
  if (source.decision !== 'accept-l3-investment') {
    throw new Error(`${label}.decision must be accept-l3-investment`)
  }
  const animalId = animalIdentifier(source.animalId, `${label}.animalId`)
  const workspacePath = absoluteNormalizedPath(
    source.workspacePath,
    `${label}.workspacePath`,
  )
  if (basename(workspacePath) !== animalId) {
    throw new Error(`${label}.workspacePath basename must equal animalId`)
  }
  const stageLockId = animalIdentifier(source.stageLockId, `${label}.stageLockId`)
  if (stageLockId !== `${animalId}-model-stage`) {
    throw new Error(`${label}.stageLockId must be the canonical animal model-stage ID`)
  }
  const stageLockPath = absoluteNormalizedPath(
    source.stageLockPath,
    `${label}.stageLockPath`,
  )
  const reviewContractPath = absoluteNormalizedPath(
    source.reviewContractPath,
    `${label}.reviewContractPath`,
  )
  const inspectionPath = absoluteNormalizedPath(
    source.inspectionPath,
    `${label}.inspectionPath`,
  )
  if (
    !strictChild(workspacePath, stageLockPath) ||
    !strictChild(workspacePath, reviewContractPath) ||
    !strictChild(workspacePath, inspectionPath)
  ) {
    throw new Error(`${label} evidence paths must be inside the animal workspace`)
  }
  if (inspectionPath !== resolve(workspacePath, 'asset-inspection.json')) {
    throw new Error(`${label}.inspectionPath must be the canonical asset-inspection.json path`)
  }
  const routeScope = exactObject(source.routeScope, `${label}.routeScope`, [
    'classification',
    'underlyingRiskLevel',
    'recommendedRoute',
    'reasons',
    'blockingReasons',
    'plannedOperations',
    'parallelRequested',
  ])
  if (routeScope.classification !== 'blocked') {
    throw new Error(`${label}.routeScope.classification must be blocked`)
  }
  if (routeScope.underlyingRiskLevel !== 'L3') {
    throw new Error(`${label}.routeScope.underlyingRiskLevel must be L3`)
  }
  if (routeScope.recommendedRoute !== 'obtain-l3-acceptance') {
    throw new Error(
      `${label}.routeScope.recommendedRoute must be obtain-l3-acceptance`,
    )
  }
  if (typeof routeScope.parallelRequested !== 'boolean') {
    throw new Error(`${label}.routeScope.parallelRequested must be a boolean`)
  }
  return {
    schemaVersion: 2,
    animalId,
    decision: 'accept-l3-investment',
    acceptedBy: nonEmptyString(source.acceptedBy, `${label}.acceptedBy`),
    acceptedOn: realDate(source.acceptedOn, `${label}.acceptedOn`),
    workspacePath,
    stageLockId,
    stageLockPath,
    stageLockSha256: sha256Value(source.stageLockSha256, `${label}.stageLockSha256`),
    reviewContractPath,
    reviewContractSha256: sha256Value(
      source.reviewContractSha256,
      `${label}.reviewContractSha256`,
    ),
    inspectionPath,
    inspectionSha256: sha256Value(
      source.inspectionSha256,
      `${label}.inspectionSha256`,
    ),
    routeScope: {
      classification: 'blocked',
      underlyingRiskLevel: 'L3',
      recommendedRoute: 'obtain-l3-acceptance',
      reasons: stringArray(routeScope.reasons, `${label}.routeScope.reasons`),
      blockingReasons: stringArray(
        routeScope.blockingReasons,
        `${label}.routeScope.blockingReasons`,
      ),
      plannedOperations: stringArray(
        routeScope.plannedOperations,
        `${label}.routeScope.plannedOperations`,
      ),
      parallelRequested: routeScope.parallelRequested,
    },
    boundary: nonEmptyString(source.boundary, `${label}.boundary`),
  }
}

export async function loadStageLockRecord(path: string): Promise<StageLockRecord> {
  const absolutePath = resolve(path)
  await assertNonSymlinkFile(absolutePath, 'stage-lock record')
  const record = parseStageLockRecord(
    JSON.parse(await readFile(resolve(path), 'utf8')) as unknown,
  )
  const validated = await validateRequirementsInputs(
    record.animalId,
    record.workspacePath,
    record.sourceRecord.path,
    record.reviewContract.path,
  )
  if (
    validated.sourceRecordDigest.bytes !== record.sourceRecord.bytes ||
    validated.sourceRecordDigest.sha256 !== record.sourceRecord.sha256
  ) {
    throw new Error('stage-lock record binds a stale source record')
  }
  if (
    validated.sourceDigest.bytes !== record.sourceAsset.bytes ||
    validated.sourceDigest.sha256 !== record.sourceAsset.sha256 ||
    validated.sourceRecord.source.path !== record.sourceAsset.path
  ) {
    throw new Error('stage-lock record binds a stale or different source asset')
  }
  if (
    validated.contractDigest.bytes !== record.reviewContract.bytes ||
    validated.contractDigest.sha256 !== record.reviewContract.sha256
  ) {
    throw new Error('stage-lock record binds a stale review contract')
  }
  if (
    validated.profileRequirementsDigest.bytes !==
      record.profile.requirementsBytes ||
    validated.profileRequirementsDigest.sha256 !==
      record.profile.requirementsSha256
  ) {
    throw new Error('stage-lock record binds stale profile requirement fields')
  }
  if (
    validated.capturePlanInputDigest.bytes !== record.capturePlanInput.bytes ||
    validated.capturePlanInputDigest.sha256 !== record.capturePlanInput.sha256
  ) {
    throw new Error('stage-lock record binds a stale capture-plan input')
  }
  if (
    validated.rightsEvidence.length !== record.rightsEvidence.length ||
    validated.rightsEvidence.some((evidence, index) => {
      const bound = record.rightsEvidence[index]
      return (
        bound === undefined ||
        evidence.path !== bound.path ||
        evidence.bytes !== bound.bytes ||
        evidence.sha256 !== bound.sha256
      )
    })
  ) {
    throw new Error('stage-lock record binds stale or different source-rights evidence')
  }
  return record
}

export async function loadL3AcceptanceDecisionRecord(
  path: string,
): Promise<L3AcceptanceDecisionRecord> {
  const absolutePath = resolve(path)
  await assertNonSymlinkFile(absolutePath, 'L3 acceptance record')
  const record = parseL3AcceptanceDecisionRecord(
    JSON.parse(await readFile(absolutePath, 'utf8')) as unknown,
  )
  const [realWorkspace, realRecord] = await Promise.all([
    realpath(record.workspacePath),
    realpath(absolutePath),
  ])
  if (!strictChild(realWorkspace, realRecord)) {
    throw new Error('L3 acceptance record must resolve inside its animal workspace')
  }
  return record
}

export async function createStageLock(
  animalId: string,
  workspacePath: string,
  reviewContractPath: string,
  outputPath: string,
  generatedAt = new Date().toISOString(),
): Promise<{
  readonly record: StageLockRecord
  readonly inspectionBindings: Record<string, unknown>
}> {
  if (!animalIdPattern.test(animalId)) {
    throw new Error('stage-lock animal ID must be lowercase kebab-case')
  }
  const workspace = resolve(workspacePath)
  const output = resolve(outputPath)
  const contractPath = resolve(reviewContractPath)
  const sourceRecordPath = resolve(workspace, 'source-record.json')
  if (basename(workspace) !== animalId) {
    throw new Error('stage-lock workspace basename must equal the animal ID')
  }
  if (!strictChild(workspace, output) || !strictChild(workspace, contractPath)) {
    throw new Error('stage lock and review contract must be inside the animal workspace')
  }
  const existingOutput = await lstat(output).catch(() => null)
  if (existingOutput?.isSymbolicLink()) {
    throw new Error('stage-lock output must not be a symbolic link')
  }
  const requirements = await validateRequirementsInputs(
    animalId,
    workspace,
    sourceRecordPath,
    contractPath,
  )
  const contractDigest = requirements.contractDigest
  const record: StageLockRecord = {
    schemaVersion: 1,
    animalId,
    lockId: `${animalId}-model-stage`,
    workspacePath: workspace,
    generatedAt,
    currentStage: 'requirements-locked',
    sourceRecord: {
      path: sourceRecordPath,
      ...requirements.sourceRecordDigest,
    },
    sourceAsset: {
      path: requirements.sourceRecord.source.path,
      ...requirements.sourceDigest,
    },
    reviewContract: {
      path: contractPath,
      ...contractDigest,
    },
    profile: {
      path: resolve(workspace, 'profile.json'),
      requirementsBytes: requirements.profileRequirementsDigest.bytes,
      requirementsSha256: requirements.profileRequirementsDigest.sha256,
    },
    capturePlanInput: {
      path: resolve(workspace, 'capture-plan-input.json'),
      ...requirements.capturePlanInputDigest,
    },
    rightsEvidence: requirements.rightsEvidence,
    downstreamInvalidationRule:
      'Changing source, science scope, model, presentation, browser evidence or agent review reopens this animal only.',
  }
  await writeJson(output, record)
  const lockDigest = await fileDigest(output)
  return {
    record,
    inspectionBindings: {
      animalWorkspacePath: workspace,
      stageLockId: `${animalId}-model-stage`,
      stageLockPath: output,
      stageLockSha256: lockDigest.sha256,
      reviewContractPath: contractPath,
      reviewContractSha256: contractDigest.sha256,
    },
  }
}

export async function recordL3Acceptance(
  animalId: string,
  workspacePath: string,
  reviewContractPath: string,
  outputPath: string,
  acceptedBy: string,
  acceptedOn: string,
  stageLockPath = resolve(workspacePath, 'stage-lock.json'),
): Promise<{
  readonly record: L3AcceptanceDecisionRecord
  readonly inspectionAcceptance: Record<string, unknown>
}> {
  if (!acceptedBy.trim()) throw new Error('L3 acceptance requires an owner')
  realDate(acceptedOn, 'L3 acceptance date')
  const workspace = resolve(workspacePath)
  const contractPath = resolve(reviewContractPath)
  const output = resolve(outputPath)
  const lockPath = resolve(stageLockPath)
  const inspectionPath = resolve(workspace, 'asset-inspection.json')
  if (basename(workspace) !== animalId) {
    throw new Error('L3 workspace basename must equal the animal ID')
  }
  if (
    !strictChild(workspace, contractPath) ||
    !strictChild(workspace, output) ||
    !strictChild(workspace, lockPath) ||
    !strictChild(workspace, inspectionPath)
  ) {
    throw new Error('L3 acceptance, inspection, stage lock and review contract must be inside the animal workspace')
  }
  const existingOutput = await lstat(output).catch(() => null)
  if (existingOutput !== null) {
    throw new Error('L3 acceptance output already exists; refusing overwrite or symlink target')
  }
  const workspaceEntry = await lstat(workspace).catch(() => null)
  const outputParentEntry = await lstat(dirname(output)).catch(() => null)
  if (
    !workspaceEntry?.isDirectory() ||
    workspaceEntry.isSymbolicLink() ||
    !outputParentEntry?.isDirectory() ||
    outputParentEntry.isSymbolicLink()
  ) {
    throw new Error('L3 acceptance workspace and output parent must be existing non-symlink directories')
  }
  const [realWorkspace, realOutputParent] = await Promise.all([
    realpath(workspace),
    realpath(dirname(output)),
  ])
  if (
    realOutputParent !== realWorkspace &&
    !strictChild(realWorkspace, realOutputParent)
  ) {
    throw new Error('L3 acceptance output parent resolves outside the animal workspace')
  }
  await assertStrictWorkspaceFile(
    workspace,
    inspectionPath,
    'canonical asset-inspection.json',
  )
  const contract = await loadReviewContract(contractPath)
  if (contract.animalId !== animalId) {
    throw new Error('review contract animalId does not match L3 acceptance')
  }
  const contractDigest = await fileDigest(contractPath)
  const stageLock = await loadStageLockRecord(lockPath)
  const lockDigest = await fileDigest(lockPath)
  if (
    stageLock.animalId !== animalId ||
    stageLock.workspacePath !== workspace ||
    stageLock.reviewContract.path !== contractPath ||
    stageLock.reviewContract.sha256 !== contractDigest.sha256 ||
    stageLock.reviewContract.bytes !== contractDigest.bytes
  ) {
    throw new Error('stage lock does not bind this animal workspace and review contract')
  }
  const {
    loadAssetInspection,
    routeAssetRiskWithVerifiedRecords,
    stringifyAssetInspection,
  } = await import('./risk-routing')
  const preAcceptanceInspection = await loadAssetInspection(inspectionPath)
  if (preAcceptanceInspection.animalId !== animalId) {
    throw new Error('asset inspection belongs to a different animal')
  }
  if (preAcceptanceInspection.executionControls.l3Acceptance.status !== 'not-accepted') {
    throw new Error('L3 acceptance can only be recorded from a not-accepted inspection')
  }
  const preAcceptanceRoute = await routeAssetRiskWithVerifiedRecords(
    preAcceptanceInspection,
  )
  const expectedAcceptanceBlocker =
    'L3 work requires an explicit acceptance decision for this animal.'
  if (
    preAcceptanceRoute.classification !== 'blocked' ||
    preAcceptanceRoute.underlyingRiskLevel !== 'L3' ||
    preAcceptanceRoute.recommendedRoute !== 'obtain-l3-acceptance' ||
    preAcceptanceRoute.blockingReasons.length !== 1 ||
    preAcceptanceRoute.blockingReasons[0] !== expectedAcceptanceBlocker
  ) {
    throw new Error(
      `L3 acceptance requires a current blocked L3 route whose only blocker is owner acceptance: ${preAcceptanceRoute.blockingReasons.join('; ') || 'route is not L3'}`,
    )
  }
  if (
    preAcceptanceRoute.controlBindings.animalWorkspacePath === null ||
    resolve(preAcceptanceRoute.controlBindings.animalWorkspacePath) !== workspace ||
    preAcceptanceRoute.controlBindings.stageLockId !== stageLock.lockId ||
    resolve(preAcceptanceRoute.controlBindings.stageLockPath ?? '') !== lockPath ||
    preAcceptanceRoute.controlBindings.stageLockSha256 !== lockDigest.sha256 ||
    resolve(preAcceptanceRoute.controlBindings.reviewContractPath ?? '') !==
      contractPath ||
    preAcceptanceRoute.controlBindings.reviewContractSha256 !==
      contractDigest.sha256
  ) {
    throw new Error('pre-acceptance route does not bind the active workspace, stage lock and review contract')
  }
  const canonicalInspection = stringifyAssetInspection(preAcceptanceInspection)
  const inspectionSha256 = sha256(Buffer.from(canonicalInspection, 'utf8'))
  const record: L3AcceptanceDecisionRecord = {
    schemaVersion: 2,
    animalId,
    decision: 'accept-l3-investment',
    acceptedBy: acceptedBy.trim(),
    acceptedOn,
    workspacePath: workspace,
    stageLockId: stageLock.lockId,
    stageLockPath: lockPath,
    stageLockSha256: lockDigest.sha256,
    reviewContractPath: contractPath,
    reviewContractSha256: contractDigest.sha256,
    inspectionPath,
    inspectionSha256,
    routeScope: {
      classification: 'blocked',
      underlyingRiskLevel: 'L3',
      recommendedRoute: 'obtain-l3-acceptance',
      reasons: preAcceptanceRoute.reasons,
      blockingReasons: preAcceptanceRoute.blockingReasons,
      plannedOperations: preAcceptanceInspection.plannedOperations,
      parallelRequested:
        preAcceptanceInspection.executionControls.parallelRequested,
    },
    boundary:
      'This accepts the cost and uncertainty of L3 work; it does not approve the model or publication.',
  }
  const handle = await open(output, 'wx')
  try {
    await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`, 'utf8')
  } finally {
    await handle.close()
  }
  const acceptanceDigest = await fileDigest(output)
  return {
    record,
    inspectionAcceptance: {
      status: 'accepted',
      acceptedBy: acceptedBy.trim(),
      acceptedOn,
      recordPath: output,
      recordSha256: acceptanceDigest.sha256,
      acceptedReviewContractSha256: contractDigest.sha256,
    },
  }
}
