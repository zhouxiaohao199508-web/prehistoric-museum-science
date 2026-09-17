import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { evaluateGates } from './gates'
import {
  assertSecureRepositoryFile,
  assertSecureRepositoryOutputPath,
} from './approval-bundle'
import { sha256, writeJson, writeText } from './io'
import { loadProfile, ownerApprovalRecorded } from './profile'
import { reportHtml, reportMarkdown } from './report'
import type {
  AnimalOnboardingProfile,
  GateResult,
  QaReport,
} from './types'

type JsonObject = Record<string, unknown>

function objectWithExactKeys(
  value: unknown,
  label: string,
  required: readonly string[],
  optional: readonly string[] = [],
): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  const source = value as JsonObject
  const allowed = new Set([...required, ...optional])
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) throw new Error(`${label}.${key} is not allowed`)
  }
  for (const key of required) {
    if (!(key in source)) throw new Error(`${label}.${key} is required`)
  }
  return source
}

function qaObject(value: unknown, label: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as JsonObject
}

function qaString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

function qaBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`)
  return value
}

function qaCount(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`)
  }
  return value as number
}

function parseQaGate(value: unknown, index: number): GateResult {
  const label = `qa.gates[${index}]`
  const source = objectWithExactKeys(
    value,
    label,
    ['id', 'kind', 'status', 'summary'],
    ['evidence', 'measured'],
  )
  const kind = qaString(source.kind, `${label}.kind`)
  if (!['automated', 'warning', 'human-only'].includes(kind)) {
    throw new Error(`${label}.kind is invalid`)
  }
  const status = qaString(source.status, `${label}.status`)
  if (!['pass', 'fail', 'pending', 'not-applicable'].includes(status)) {
    throw new Error(`${label}.status is invalid`)
  }
  let evidence: readonly string[] | undefined
  if (source.evidence !== undefined) {
    if (
      !Array.isArray(source.evidence) ||
      source.evidence.some(
        (entry) => typeof entry !== 'string' || entry.trim().length === 0,
      )
    ) {
      throw new Error(`${label}.evidence must be an array of non-empty strings`)
    }
    evidence = source.evidence as string[]
  }
  let measured: Readonly<Record<string, string | number | boolean>> | undefined
  if (source.measured !== undefined) {
    const entries = qaObject(source.measured, `${label}.measured`)
    for (const [key, entry] of Object.entries(entries)) {
      if (
        !['string', 'number', 'boolean'].includes(typeof entry) ||
        (typeof entry === 'number' && !Number.isFinite(entry))
      ) {
        throw new Error(
          `${label}.measured.${key} must be a finite number, string or boolean`,
        )
      }
    }
    measured = entries as Record<string, string | number | boolean>
  }
  return {
    id: qaString(source.id, `${label}.id`),
    kind: kind as GateResult['kind'],
    status: status as GateResult['status'],
    summary: qaString(source.summary, `${label}.summary`),
    ...(evidence === undefined ? {} : { evidence }),
    ...(measured === undefined ? {} : { measured }),
  }
}

/** Strictly parses a persisted QA report. Four-field pass-shaped JSON is invalid. */
export function parseQaReport(value: unknown): QaReport {
  const source = objectWithExactKeys(value, 'qa', [
    'schemaVersion',
    'animalId',
    'generatedAt',
    'profilePath',
    'profileSha256',
    'automatedPass',
    'localDraftReady',
    'ownerApproved',
    'counts',
    'gates',
    'artifacts',
  ])
  if (source.schemaVersion !== 1) throw new Error('qa.schemaVersion must be 1')
  const generatedAt = qaString(source.generatedAt, 'qa.generatedAt')
  if (
    Number.isNaN(Date.parse(generatedAt)) ||
    new Date(generatedAt).toISOString() !== generatedAt
  ) {
    throw new Error('qa.generatedAt must be an ISO-8601 UTC timestamp')
  }
  const profileSha256 = qaString(source.profileSha256, 'qa.profileSha256')
  if (!/^[a-f0-9]{64}$/.test(profileSha256)) {
    throw new Error('qa.profileSha256 must be a lowercase SHA-256 digest')
  }
  if (!Array.isArray(source.gates)) throw new Error('qa.gates must be an array')
  const gates = source.gates.map(parseQaGate)
  const counts = objectWithExactKeys(source.counts, 'qa.counts', [
    'hardFailures',
    'warnings',
    'pendingHumanOnly',
  ])
  const artifacts = qaObject(source.artifacts, 'qa.artifacts')
  for (const [key, entry] of Object.entries(artifacts)) {
    qaString(entry, `qa.artifacts.${key}`)
  }
  return {
    schemaVersion: 1,
    animalId: qaString(source.animalId, 'qa.animalId'),
    generatedAt,
    profilePath: qaString(source.profilePath, 'qa.profilePath'),
    profileSha256,
    automatedPass: qaBoolean(source.automatedPass, 'qa.automatedPass'),
    localDraftReady: qaBoolean(
      source.localDraftReady,
      'qa.localDraftReady',
    ),
    ownerApproved: qaBoolean(source.ownerApproved, 'qa.ownerApproved'),
    counts: {
      hardFailures: qaCount(counts.hardFailures, 'qa.counts.hardFailures'),
      warnings: qaCount(counts.warnings, 'qa.counts.warnings'),
      pendingHumanOnly: qaCount(
        counts.pendingHumanOnly,
        'qa.counts.pendingHumanOnly',
      ),
    },
    gates,
    artifacts: artifacts as Record<string, string>,
  }
}

function requiredCompleteGateIds(
  profile: AnimalOnboardingProfile,
  requireReviewAssets: boolean,
): readonly string[] {
  return [
    'rights-and-direct-source',
    'source-evidence-files',
    'source-risk-route',
    'glb-self-contained',
    'model-budget',
    'model-target-budget',
    ...(profile.model.budgetException ? ['model-budget-exception'] : []),
    'runtime-idle',
    'glb-validator',
    'glb-validator-warnings',
    'blender-normalization-evidence',
    'landmarks',
    'habitat-shadow-policy',
    'land-contact-shadow-coverage',
    'initial-head-side',
    'presentation-safe-padding',
    ...(requireReviewAssets
      ? [
          'risk-evidence-completion',
          'owner-model-lock',
          'asset-background-landscape',
          'asset-background-portrait',
          'asset-poster',
          'asset-poster-portrait',
          'asset-thumbnail',
          'background-generation-evidence',
          'audio-format-budget-zh-CN',
          'audio-reproducibility-zh-CN',
          'audio-format-budget-en',
          'audio-reproducibility-en',
          'headed-browser-capture',
        ]
      : []),
    'human-scientific-identity',
    'human-visual-material',
    ...(profile.model.habitat === 'land'
      ? ['human-grounding-background']
      : []),
    'human-motion-naturalness',
    ...(profile.model.mouthMotion.mode === 'disabled'
      ? []
      : ['human-mouth-motion']),
    'human-audio-listen-zh-CN',
    'human-audio-listen-en',
    'human-production-promotion',
    ...(profile.science.confidence === 'high' ? [] : ['science-confidence']),
    ...(profile.assets.narration?.['zh-CN']?.humanReviewStatus === 'approved'
      ? []
      : ['audio-listen-warning-zh-CN']),
    ...(profile.assets.narration?.en?.humanReviewStatus === 'approved'
      ? []
      : ['audio-listen-warning-en']),
  ].sort()
}

export function completeQaGateSetErrors(
  profile: AnimalOnboardingProfile,
  gates: readonly GateResult[],
  requireReviewAssets = true,
): string[] {
  const ids = gates.map(({ id }) => id)
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))]
  const expected = requiredCompleteGateIds(profile, requireReviewAssets)
  const actual = [...new Set(ids)].sort()
  const missing = expected.filter((id) => !actual.includes(id))
  const unexpected = actual.filter((id) => !expected.includes(id))
  return [
    ...(duplicateIds.length > 0
      ? [`duplicate QA gate IDs: ${duplicateIds.join(', ')}`]
      : []),
    ...(missing.length > 0
      ? [`missing required QA gates: ${missing.join(', ')}`]
      : []),
    ...(unexpected.length > 0
      ? [`unexpected QA gates: ${unexpected.join(', ')}`]
      : []),
  ]
}

/** Checks the semantic integrity of a strict report, including its full mode-specific gate set. */
export function qaReportIntegrityErrors(
  profile: AnimalOnboardingProfile,
  report: QaReport,
  requireReviewAssets: boolean,
): string[] {
  const hardFailures = report.gates.filter(
    (gate) => gate.kind === 'automated' && gate.status === 'fail',
  ).length
  const warnings = report.gates.filter(
    (gate) => gate.kind === 'warning' && gate.status !== 'pass',
  ).length
  const pendingHumanOnly = report.gates.filter(
    (gate) => gate.kind === 'human-only' && gate.status !== 'pass',
  ).length
  const errors = completeQaGateSetErrors(
    profile,
    report.gates,
    requireReviewAssets,
  )
  if (report.animalId !== profile.id) errors.push('QA animalId is stale')
  if (report.counts.hardFailures !== hardFailures) {
    errors.push('QA hard-failure count does not match its gates')
  }
  if (report.counts.warnings !== warnings) {
    errors.push('QA warning count does not match its gates')
  }
  if (report.counts.pendingHumanOnly !== pendingHumanOnly) {
    errors.push('QA pending-human count does not match its gates')
  }
  if (report.automatedPass !== (hardFailures === 0)) {
    errors.push('QA automatedPass does not match its automated gates')
  }
  if (report.localDraftReady !== (report.automatedPass && requireReviewAssets)) {
    errors.push('QA localDraftReady does not match its evaluation mode')
  }
  return errors
}

/** Stable digest of decision-bearing QA fields; generatedAt is intentionally excluded. */
export function qaDecisionSha256(report: QaReport): string {
  const decision = Object.fromEntries(
    Object.entries(report).filter(([key]) => key !== 'generatedAt'),
  )
  return sha256(Buffer.from(JSON.stringify(decision), 'utf8'))
}

export function approvalReadinessErrors(
  profile: AnimalOnboardingProfile,
  report: QaReport,
  options: { readonly requireHumanPass: boolean },
): string[] {
  const errors = completeQaGateSetErrors(profile, report.gates)
  const failedAutomated = report.gates
    .filter((gate) => gate.kind === 'automated' && gate.status === 'fail')
    .map(({ id }) => id)
  if (failedAutomated.length > 0) {
    errors.push(`failed automated QA gates: ${failedAutomated.join(', ')}`)
  }
  if (!report.automatedPass || !report.localDraftReady) {
    errors.push('complete current QA is not production-review ready')
  }
  if (options.requireHumanPass) {
    const unapproved = report.gates
      .filter((gate) => gate.kind === 'human-only' && gate.status !== 'pass')
      .map(({ id }) => id)
    if (unapproved.length > 0) {
      errors.push(`human approval gates are not passed: ${unapproved.join(', ')}`)
    }
  }
  return errors
}

export async function evaluateCurrentQa(
  profilePath: string,
  requireReviewAssets: boolean,
  options: { readonly preserveGeneratedArtifacts?: boolean } = {},
): Promise<QaReport> {
  const absoluteProfilePath = await assertSecureRepositoryFile(
    profilePath,
    'QA profile',
  )
  const profile = await loadProfile(absoluteProfilePath)
  const profileBytes = await readFile(absoluteProfilePath)
  const validatorPath = await assertSecureRepositoryOutputPath(
    resolve(profile.runDirectory, 'glb-validator.json'),
    'GLB validator evidence output',
  )
  const previousValidator = options.preserveGeneratedArtifacts === false
    ? undefined
    : await readFile(validatorPath).catch(() => null)
  let gates: readonly GateResult[]
  try {
    gates = await evaluateGates(profile, { requireReviewAssets })
  } finally {
    if (options.preserveGeneratedArtifacts !== false) {
      if (previousValidator === null) {
        await unlink(validatorPath).catch(() => undefined)
      } else if (previousValidator !== undefined) {
        await writeFile(validatorPath, previousValidator)
      }
    }
  }
  const hardFailures = gates.filter(
    (gate) => gate.kind === 'automated' && gate.status === 'fail',
  ).length
  const warnings = gates.filter(
    (gate) => gate.kind === 'warning' && gate.status !== 'pass',
  ).length
  const pendingHumanOnly = gates.filter(
    (gate) => gate.kind === 'human-only' && gate.status !== 'pass',
  ).length
  const automatedPass = hardFailures === 0
  return {
    schemaVersion: 1,
    animalId: profile.id,
    generatedAt: new Date().toISOString(),
    profilePath: absoluteProfilePath,
    profileSha256: sha256(profileBytes),
    automatedPass,
    localDraftReady: automatedPass && requireReviewAssets,
    ownerApproved: ownerApprovalRecorded(profile.approvals),
    counts: { hardFailures, warnings, pendingHumanOnly },
    gates,
    artifacts: {
      qaJson: `${profile.runDirectory}/qa.json`,
      reportMarkdown: `${profile.runDirectory}/report.md`,
      reportHtml: `${profile.runDirectory}/report.html`,
      normalizationLog: profile.model.normalizationLogPath,
      landmarks: profile.model.landmarksPath,
      glbValidator: `${profile.runDirectory}/glb-validator.json`,
      browserCapturePlan: `${profile.runDirectory}/browser-capture-plan.json`,
      browserCaptureEvidence: `${profile.runDirectory}/browser-capture-evidence.json`,
      browserCaptureValidation: `${profile.runDirectory}/browser-capture-validation.json`,
      agentReview: `${profile.runDirectory}/agent-review.json`,
      ownerModelReview: `${profile.runDirectory}/owner-model-review.md`,
      modelLock: `${profile.runDirectory}/model-lock.json`,
      promotionManifest: `${profile.runDirectory}/promotion-manifest.json`,
    },
  }
}

export async function runQa(
  profilePath: string,
  requireReviewAssets: boolean,
): Promise<QaReport> {
  const secureProfilePath = await assertSecureRepositoryFile(
    profilePath,
    'QA profile',
  )
  const profile = await loadProfile(secureProfilePath)
  const runDirectory = resolve(profile.runDirectory)
  const outputPaths = {
    qa: await assertSecureRepositoryOutputPath(
      resolve(runDirectory, 'qa.json'),
      'QA JSON output',
    ),
    markdown: await assertSecureRepositoryOutputPath(
      resolve(runDirectory, 'report.md'),
      'QA Markdown output',
    ),
    html: await assertSecureRepositoryOutputPath(
      resolve(runDirectory, 'report.html'),
      'QA HTML output',
    ),
  }
  const report = await evaluateCurrentQa(secureProfilePath, requireReviewAssets, {
    preserveGeneratedArtifacts: false,
  })
  await mkdir(runDirectory, { recursive: true })
  await writeJson(outputPaths.qa, report)
  await writeText(outputPaths.markdown, reportMarkdown(report))
  await writeText(outputPaths.html, reportHtml(report))
  return report
}
