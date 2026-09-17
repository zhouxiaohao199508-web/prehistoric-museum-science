import { readFile } from 'node:fs/promises'
import { isAbsolute, posix, resolve } from 'node:path'

import { fileDigest, sha256, writeJson } from './io'
import {
  approvalBundlesEqual,
  assertSecureRepositoryFile,
  assertSecureRepositoryOutputPath,
  canonicalApprovalBundleSha256,
  collectApprovalBundle,
  type ApprovalBundleDigest,
} from './approval-bundle'
import { loadProfile, localizedNarrationAssets } from './profile'
import { approvalReadinessErrors, evaluateCurrentQa } from './qa'
import type { QaReport } from './types'

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/
const sha256Pattern = /^[a-f0-9]{64}$/

function isRealIsoDate(value: string): boolean {
  if (!isoDatePattern.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

export interface ApprovalRecord {
  readonly schemaVersion: 2
  readonly animalId: string
  readonly decision: 'approved-for-production'
  readonly approvedBy: string
  readonly approvedOn: string
  readonly recordedAt: string
  readonly basis: string
  readonly categories: {
    readonly scientific: true
    readonly visual: true
    readonly motion: true
    readonly audioListening: true
    readonly audioListeningByLocale: {
      readonly 'zh-CN': true
      readonly en: true
    }
    readonly publicDistribution: true
    readonly production: true
    readonly mouthMotion: 'approved' | 'not-applicable'
  }
  readonly qaAtDecision: {
    readonly path: string
    readonly bytes: number
    readonly sha256: string
    readonly automatedPass: true
    readonly localDraftReady: true
  }
  readonly profileBeforeSha256: string
  readonly approvedProfileSha256: string
  readonly approvalBundle: ApprovalBundleDigest
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function exactObject(
  value: unknown,
  label: string,
  keys: readonly string[],
): Record<string, unknown> {
  const result = object(value, label)
  const actual = Object.keys(result).sort()
  const expected = [...keys].sort()
  if (actual.join('\0') !== expected.join('\0')) {
    throw new Error(`${label} must contain exactly: ${expected.join(', ')}`)
  }
  return result
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

function sha256String(value: unknown, label: string): string {
  const result = nonEmptyString(value, label)
  if (!sha256Pattern.test(result)) throw new Error(`${label} must be SHA-256`)
  return result
}

export async function loadOwnerApprovalRecord(
  path: string,
): Promise<ApprovalRecord> {
  const securePath = await assertSecureRepositoryFile(
    path,
    'owner approval record',
  )
  const parsed: unknown = JSON.parse(await readFile(securePath, 'utf8'))
  const root = exactObject(parsed, 'approvalRecord', [
    'schemaVersion',
    'animalId',
    'decision',
    'approvedBy',
    'approvedOn',
    'recordedAt',
    'basis',
    'categories',
    'qaAtDecision',
    'profileBeforeSha256',
    'approvedProfileSha256',
    'approvalBundle',
  ])
  if (root.schemaVersion !== 2 || root.decision !== 'approved-for-production') {
    throw new Error('approvalRecord schemaVersion or decision is invalid')
  }
  nonEmptyString(root.animalId, 'approvalRecord.animalId')
  nonEmptyString(root.approvedBy, 'approvalRecord.approvedBy')
  const approvedOn = nonEmptyString(
    root.approvedOn,
    'approvalRecord.approvedOn',
  )
  if (!isRealIsoDate(approvedOn)) {
    throw new Error('approvalRecord.approvedOn must be YYYY-MM-DD')
  }
  const recordedAt = nonEmptyString(
    root.recordedAt,
    'approvalRecord.recordedAt',
  )
  if (!Number.isFinite(Date.parse(recordedAt))) {
    throw new Error('approvalRecord.recordedAt must be an ISO timestamp')
  }
  nonEmptyString(root.basis, 'approvalRecord.basis')
  sha256String(root.profileBeforeSha256, 'approvalRecord.profileBeforeSha256')
  sha256String(
    root.approvedProfileSha256,
    'approvalRecord.approvedProfileSha256',
  )
  const categories = exactObject(root.categories, 'approvalRecord.categories', [
    'scientific',
    'visual',
    'motion',
    'audioListening',
    'audioListeningByLocale',
    'publicDistribution',
    'production',
    'mouthMotion',
  ])
  for (const key of [
    'scientific',
    'visual',
    'motion',
    'audioListening',
    'publicDistribution',
    'production',
  ]) {
    if (categories[key] !== true) {
      throw new Error(`approvalRecord.categories.${key} must be true`)
    }
  }
  if (
    categories.mouthMotion !== 'approved' &&
    categories.mouthMotion !== 'not-applicable'
  ) {
    throw new Error('approvalRecord.categories.mouthMotion is invalid')
  }
  const locales = exactObject(
    categories.audioListeningByLocale,
    'approvalRecord.categories.audioListeningByLocale',
    ['zh-CN', 'en'],
  )
  if (locales['zh-CN'] !== true || locales.en !== true) {
    throw new Error('approvalRecord locale listening decisions must be true')
  }
  const qa = exactObject(root.qaAtDecision, 'approvalRecord.qaAtDecision', [
    'path',
    'bytes',
    'sha256',
    'automatedPass',
    'localDraftReady',
  ])
  nonEmptyString(qa.path, 'approvalRecord.qaAtDecision.path')
  if (!Number.isInteger(qa.bytes) || Number(qa.bytes) <= 0) {
    throw new Error('approvalRecord.qaAtDecision.bytes must be positive')
  }
  sha256String(qa.sha256, 'approvalRecord.qaAtDecision.sha256')
  if (qa.automatedPass !== true || qa.localDraftReady !== true) {
    throw new Error('approvalRecord QA decisions must be true')
  }
  const bundle = exactObject(
    root.approvalBundle,
    'approvalRecord.approvalBundle',
    ['algorithm', 'sha256', 'files'],
  )
  if (bundle.algorithm !== 'sha256') {
    throw new Error('approvalRecord.approvalBundle.algorithm must be sha256')
  }
  sha256String(bundle.sha256, 'approvalRecord.approvalBundle.sha256')
  if (!Array.isArray(bundle.files) || bundle.files.length === 0) {
    throw new Error('approvalRecord.approvalBundle.files must be non-empty')
  }
  let previousPath = ''
  for (const [index, value] of bundle.files.entries()) {
    const file = exactObject(
      value,
      `approvalRecord.approvalBundle.files[${index}]`,
      ['path', 'bytes', 'sha256'],
    )
    const path = nonEmptyString(
      file.path,
      `approvalRecord.approvalBundle.files[${index}].path`,
    )
    if (
      isAbsolute(path) ||
      path.includes('\\') ||
      path.split('/').includes('..') ||
      posix.normalize(path) !== path ||
      path <= previousPath
    ) {
      throw new Error(
        'approvalRecord.approvalBundle.files must use unique sorted portable repository paths',
      )
    }
    if (!Number.isInteger(file.bytes) || Number(file.bytes) <= 0) {
      throw new Error(
        `approvalRecord.approvalBundle.files[${index}].bytes must be positive`,
      )
    }
    sha256String(
      file.sha256,
      `approvalRecord.approvalBundle.files[${index}].sha256`,
    )
    previousPath = path
  }
  if (
    canonicalApprovalBundleSha256(
      bundle.files as ApprovalBundleDigest['files'],
    ) !== bundle.sha256
  ) {
    throw new Error('approvalRecord.approvalBundle.sha256 is not canonical')
  }
  return parsed as ApprovalRecord
}

export async function recordOwnerApproval(
  profilePath: string,
  approvedBy: string,
  approvedOn: string,
): Promise<ApprovalRecord> {
  if (approvedBy.trim().length === 0) {
    throw new Error('Approval requires a non-empty approver.')
  }
  if (!isRealIsoDate(approvedOn)) {
    throw new Error('Approval date must be YYYY-MM-DD.')
  }
  const absoluteProfilePath = await assertSecureRepositoryFile(
    profilePath,
    'approval profile',
  )
  const profile = await loadProfile(absoluteProfilePath)
  const originalBytes = await readFile(absoluteProfilePath)
  const currentProfileSha256 = sha256(originalBytes)
  const qa = await evaluateCurrentQa(absoluteProfilePath, true)
  const readinessErrors = approvalReadinessErrors(profile, qa, {
    requireHumanPass: false,
  })
  if (readinessErrors.length > 0) {
    throw new Error(
      `${profile.id}: owner approval requires complete recomputed QA: ${readinessErrors.join('; ')}`,
    )
  }
  const approvalBundle = await collectApprovalBundle(profile, qa)
  const approvalRecordPath = resolve(
    profile.runDirectory,
    'approval-record.json',
  )
  await assertSecureRepositoryOutputPath(
    approvalRecordPath,
    'approval record output',
  )
  const existingRecord = await loadOwnerApprovalRecord(approvalRecordPath).catch(
    () => null,
  )
  if (
    existingRecord?.schemaVersion === 2 &&
    existingRecord.animalId === profile.id &&
    existingRecord.decision === 'approved-for-production' &&
    existingRecord.approvedBy === approvedBy.trim() &&
    existingRecord.approvedOn === approvedOn &&
    existingRecord.approvedProfileSha256 === currentProfileSha256
  ) {
    const expectedDecisionQaPath = resolve(
      profile.runDirectory,
      'approval-qa.json',
    )
    if (
      resolve(existingRecord.qaAtDecision.path) !== expectedDecisionQaPath
    ) {
      throw new Error(`${profile.id}: existing approval record binds a non-canonical QA snapshot.`)
    }
    await assertSecureRepositoryFile(
      expectedDecisionQaPath,
      'approval QA snapshot',
    )
    const decisionQaBytes = await readFile(
      expectedDecisionQaPath,
    )
    const decisionQa = JSON.parse(decisionQaBytes.toString('utf8')) as QaReport
    if (
      decisionQa.schemaVersion !== 1 ||
      decisionQa.animalId !== profile.id ||
      existingRecord.profileBeforeSha256 !== decisionQa.profileSha256 ||
      existingRecord.qaAtDecision.bytes !== decisionQaBytes.length ||
      existingRecord.qaAtDecision.sha256 !== sha256(decisionQaBytes) ||
      !approvalBundlesEqual(existingRecord.approvalBundle, approvalBundle)
    ) {
      throw new Error(`${profile.id}: existing approval record has stale QA bindings.`)
    }
    return existingRecord
  }
  if (qa.profileSha256 !== currentProfileSha256) {
    throw new Error(`${profile.id}: recomputed QA profile binding changed during approval.`)
  }
  const configuredNarrations = localizedNarrationAssets(profile.assets)
  if (!configuredNarrations['zh-CN'] || !configuredNarrations.en) {
    throw new Error(
      `${profile.id}: owner production approval requires complete zh-CN and en narration candidates.`,
    )
  }
  const parsed = object(JSON.parse(originalBytes.toString('utf8')), 'profile')
  const science = object(parsed.science, 'profile.science')
  science.humanReviewStatus = 'approved'
  const model = object(parsed.model, 'profile.model')
  const mouthMotion = object(model.mouthMotion, 'profile.model.mouthMotion')
  const mouthMotionMode = mouthMotion.mode
  if (mouthMotionMode !== 'disabled') mouthMotion.humanReviewStatus = 'approved'
  const assets = object(parsed.assets, 'profile.assets')
  const narration = object(assets.narration, 'profile.assets.narration')
  for (const locale of ['zh-CN', 'en'] as const) {
    const localized = object(
      narration[locale],
      `profile.assets.narration.${locale}`,
    )
    localized.humanReviewStatus = 'approved'
  }
  parsed.approvals = {
    scientific: true,
    visual: true,
    motion: true,
    audio: true,
    audioByLocale: {
      'zh-CN': true,
      en: true,
    },
    production: true,
    approvedBy: approvedBy.trim(),
    approvedOn,
  }
  const approvalQaPath = resolve(profile.runDirectory, 'approval-qa.json')
  await assertSecureRepositoryOutputPath(
    approvalQaPath,
    'approval QA snapshot output',
  )
  await writeJson(absoluteProfilePath, parsed)
  const approvedProfileDigest = await fileDigest(absoluteProfilePath)
  await writeJson(approvalQaPath, qa)
  const qaDigest = await fileDigest(approvalQaPath)
  const record: ApprovalRecord = {
    schemaVersion: 2,
    animalId: profile.id,
    decision: 'approved-for-production',
    approvedBy: approvedBy.trim(),
    approvedOn,
    recordedAt: new Date().toISOString(),
    basis: 'Explicit project-owner approval supplied in the active Codex task.',
    categories: {
      scientific: true,
      visual: true,
      motion: true,
      audioListening: true,
      audioListeningByLocale: {
        'zh-CN': true,
        en: true,
      },
      publicDistribution: true,
      production: true,
      mouthMotion:
        mouthMotionMode === 'disabled' ? 'not-applicable' : 'approved',
    },
    qaAtDecision: {
      path: `${profile.runDirectory}/approval-qa.json`,
      bytes: qaDigest.bytes,
      sha256: qaDigest.sha256,
      automatedPass: true,
      localDraftReady: true,
    },
    profileBeforeSha256: sha256(originalBytes),
    approvedProfileSha256: approvedProfileDigest.sha256,
    approvalBundle,
  }
  await writeJson(approvalRecordPath, record)
  return record
}
