import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  writeFile,
} from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'

import { verifyProductionBaseline } from './baseline'
import { loadOwnerApprovalRecord } from './approval'
import {
  approvalBundlesEqual,
  assertSecureRepositoryFile,
  assertSecureRepositoryOutputPath,
  collectApprovalBundle,
} from './approval-bundle'
import { verifyCurrentBrowserCapture } from './agent-review'
import { fileDigest, regularFile, sha256, writeJson } from './io'
import { verifyModelLockForProfile } from './model-lock'
import {
  loadProfile,
  localizedNarrationAssets,
  ownerApprovalRecorded,
} from './profile'
import { approvalReadinessErrors, evaluateCurrentQa } from './qa'
import { verifyPersistedAssetRiskRoute } from './risk-routing'
import {
  buildPublicationBundle,
  type PublicationBundle,
} from './publication'
import type {
  AnimalOnboardingProfile,
  PromotionEvidenceFile,
  PromotionFile,
  PromotionManifest,
  QaReport,
} from './types'

const canonicalFiles = [
  ['model', 'model.outputPath', 'model/model.glb'],
  [
    'background-landscape',
    'assets.backgroundLandscapePath',
    'backgrounds/landscape.webp',
  ],
  [
    'background-portrait',
    'assets.backgroundPortraitPath',
    'backgrounds/portrait.webp',
  ],
  ['poster', 'assets.posterPath', 'images/poster.webp'],
  [
    'poster-portrait',
    'assets.posterPortraitPath',
    'images/poster-portrait.webp',
  ],
  ['thumbnail', 'assets.thumbnailPath', 'images/thumbnail.webp'],
] as const

const requiredRuntimeRoles = [
  'model',
  'background-landscape',
  'background-portrait',
  'poster',
  'poster-portrait',
  'thumbnail',
  'narration-zh-CN',
  'narration-en',
] as const

const requiredEvidenceRoles = [
  'qa-report',
  'normalization-log',
  'normalized-blend',
  'landmarks',
  'glb-validator',
  'review-contract',
  'stage-lock',
  'asset-inspection',
  'asset-risk-route',
  'browser-capture-plan',
  'browser-capture-evidence',
  'browser-capture-validation',
  'agent-visual-review',
  'agent-visual-summary',
  'owner-model-review',
  'owner-model-lock',
  'background-generation',
  'derivative-images',
  'narration-script-zh-CN',
  'narration-metrics-zh-CN',
  'narration-script-en',
  'narration-metrics-en',
  'review-content-definition',
  'review-content-definition-en',
  'review-package-definition',
] as const

const collectionPath = 'src/content/collections/main.ts'
const creditsPath = 'src/content/credits.generated.ts'
const noticesPath = 'THIRD_PARTY_NOTICES.md'

export type PromotionCode = 0 | 1 | 3 | 4
type TargetState = 'add' | 'identical' | 'recoverable' | 'conflict'

interface PromotionInput {
  readonly profile: AnimalOnboardingProfile
  readonly manifest: PromotionManifest
}

export interface PromotionCheck {
  readonly pass: boolean
  readonly code: PromotionCode
  readonly messages: readonly string[]
}

export interface PromotionBatchPlan extends PromotionCheck {
  readonly atomic: true
  readonly installPerformed: false
  readonly collection: string
  readonly collectionBefore: readonly string[]
  readonly collectionAfter: readonly string[]
  readonly totalBytes: number
  readonly results: ReadonlyArray<{
    readonly animalId: string
    readonly code: PromotionCode
    readonly messages: readonly string[]
    readonly targetState: TargetState
    readonly proposedCollectionIndex: number
    readonly runtimeFiles: number
    readonly generatedFiles: number
    readonly totalBytes: number
    readonly licenseId: string
    readonly approvedBy?: string
    readonly approvedOn?: string
  }>
  readonly trackedFiles: readonly string[]
}

export interface PromotionBatchResult extends Omit<PromotionBatchPlan, 'installPerformed'> {
  readonly installPerformed: true
  readonly generatedAt: string
  readonly installedAnimalIds: readonly string[]
  readonly skippedAnimalIds: readonly string[]
}

function sourceFor(
  profile: AnimalOnboardingProfile,
  selector: (typeof canonicalFiles)[number][1],
): string | undefined {
  switch (selector) {
    case 'model.outputPath':
      return profile.model.outputPath
    case 'assets.backgroundLandscapePath':
      return profile.assets.backgroundLandscapePath
    case 'assets.backgroundPortraitPath':
      return profile.assets.backgroundPortraitPath
    case 'assets.posterPath':
      return profile.assets.posterPath
    case 'assets.posterPortraitPath':
      return profile.assets.posterPortraitPath
    case 'assets.thumbnailPath':
      return profile.assets.thumbnailPath
  }
}

interface ExactPathBinding {
  readonly sourcePath: string
  readonly targetPath: string
}

function expectedRuntimeBindings(
  profile: AnimalOnboardingProfile,
): ReadonlyMap<string, ExactPathBinding> {
  const productionDirectory = `src/content/animals/${profile.id}`
  const bindings = new Map<string, ExactPathBinding>()
  for (const [role, selector, target] of canonicalFiles) {
    const sourcePath = sourceFor(profile, selector)
    if (sourcePath) {
      bindings.set(role, {
        sourcePath,
        targetPath: `${productionDirectory}/${target}`,
      })
    }
  }
  const narrations = localizedNarrationAssets(profile.assets)
  for (const locale of ['zh-CN', 'en'] as const) {
    const narration = narrations[locale]
    if (narration) {
      bindings.set(`narration-${locale}`, {
        sourcePath: narration.path,
        targetPath: `${productionDirectory}/audio/narration.${locale}.mp3`,
      })
    }
  }
  return bindings
}

function expectedEvidenceBindings(
  profile: AnimalOnboardingProfile,
  manifest: PromotionManifest,
): ReadonlyMap<string, string> {
  const run = profile.runDirectory
  const narrations = localizedNarrationAssets(profile.assets)
  const bindings = new Map<string, string>([
    ['qa-report', `${run}/qa.json`],
    ['normalization-log', profile.model.normalizationLogPath],
    ['normalized-blend', profile.model.normalizedBlendPath],
    ['landmarks', profile.model.landmarksPath],
    ['glb-validator', `${run}/glb-validator.json`],
    ['review-contract', `${run}/review-contract.json`],
    ['stage-lock', `${run}/stage-lock.json`],
    ['l3-acceptance', `${run}/l3-acceptance.json`],
    ['asset-inspection', `${run}/asset-inspection.json`],
    ['asset-risk-route', `${run}/asset-risk-route.json`],
    ['browser-capture-plan', `${run}/browser-capture-plan.json`],
    ['browser-capture-evidence', `${run}/browser-capture-evidence.json`],
    ['browser-capture-validation', `${run}/browser-capture-validation.json`],
    ['agent-visual-review', `${run}/agent-review.json`],
    ['agent-visual-summary', `${run}/agent-review.md`],
    ['owner-model-review', `${run}/owner-model-review.md`],
    ['owner-model-lock', `${run}/model-lock.json`],
    ['derivative-images', `${run}/derivative-images.json`],
    ['motion-render-start', `${run}/motion-renders/00-loop-start.png`],
    ['motion-render-positive', `${run}/motion-renders/02-positive-extreme.png`],
    ['motion-render-negative', `${run}/motion-renders/06-negative-extreme.png`],
    ['mouth-render-open', `${run}/mouth-renders/00-mouth-open.png`],
    ['mouth-render-close', `${run}/mouth-renders/04-mouth-close.png`],
    ['mouth-render-loop', `${run}/mouth-renders/08-mouth-loop.png`],
    ['browser-mouth-open', `${run}/screenshots/desktop-mouth-open.png`],
    ['browser-mouth-close', `${run}/screenshots/desktop-mouth-close.png`],
    ['browser-motion-start', `${run}/screenshots/desktop-motion-start.png`],
    ['browser-motion-quarter', `${run}/screenshots/desktop-motion-quarter.png`],
    ['background-generation', profile.assets.backgroundEvidencePath],
    ['review-content-definition', `src/review/animals/${profile.id}/content.zh-CN.ts`],
    ['review-content-definition-en', `src/review/animals/${profile.id}/content.en.ts`],
    ['review-package-definition', `src/review/animals/${profile.id}/package.ts`],
    ['owner-approval-record', `${run}/approval-record.json`],
    ['approval-qa-snapshot', `${run}/approval-qa.json`],
  ])
  if (profile.source.sourceArchivePath) {
    bindings.set('source-archive', profile.source.sourceArchivePath)
  }
  profile.source.evidencePaths.forEach((path, index) => {
    bindings.set(`source-evidence-${index + 1}`, path)
  })
  for (const locale of ['zh-CN', 'en'] as const) {
    const narration = narrations[locale]
    if (!narration) continue
    bindings.set(`narration-script-${locale}`, narration.scriptPath)
    bindings.set(
      `narration-metrics-${locale}`,
      narration.metricsPath ?? `${run}/narration.${locale}.metrics.json`,
    )
  }
  if (manifest.publication) {
    bindings.set(
      'background-landscape-source',
      manifest.publication.backgrounds.landscape.sourcePath,
    )
    bindings.set(
      'background-portrait-source',
      manifest.publication.backgrounds.portrait.sourcePath,
    )
  }
  return bindings
}

export function promotionBindingErrors(
  profile: AnimalOnboardingProfile,
  manifest: PromotionManifest,
): string[] {
  const errors: string[] = []
  const expectedRuntime = expectedRuntimeBindings(profile)
  const runtimeCounts = new Map<string, number>()
  for (const file of manifest.files) {
    runtimeCounts.set(file.role, (runtimeCounts.get(file.role) ?? 0) + 1)
    const expected = expectedRuntime.get(file.role)
    if (!expected) {
      errors.push(`Unsupported runtime role ${file.role}.`)
      continue
    }
    if (resolve(file.reviewSourcePath) !== resolve(expected.sourcePath)) {
      errors.push(
        `Runtime role ${file.role} does not use its profile-configured source path.`,
      )
    }
    if (file.productionTargetPath !== expected.targetPath) {
      errors.push(
        `Runtime role ${file.role} does not use canonical target ${expected.targetPath}.`,
      )
    }
  }
  for (const role of requiredRuntimeRoles) {
    if (runtimeCounts.get(role) !== 1 || !expectedRuntime.has(role)) {
      errors.push(`Promotion requires exactly one configured runtime binding for ${role}.`)
    }
  }
  if (manifest.files.length !== expectedRuntime.size) {
    errors.push('Runtime file set differs from the exact profile role set.')
  }

  const expectedEvidence = expectedEvidenceBindings(profile, manifest)
  const evidenceCounts = new Map<string, number>()
  for (const file of manifest.evidenceFiles) {
    evidenceCounts.set(file.role, (evidenceCounts.get(file.role) ?? 0) + 1)
    const expectedPath = expectedEvidence.get(file.role)
    if (!expectedPath) {
      errors.push(`Unsupported evidence role ${file.role}.`)
      continue
    }
    if (resolve(file.path) !== resolve(expectedPath)) {
      errors.push(
        `Evidence role ${file.role} does not use its canonical path ${expectedPath}.`,
      )
    }
  }
  for (const role of requiredEvidenceRoles) {
    if (evidenceCounts.get(role) !== 1) {
      errors.push(`Promotion requires exactly one evidence file for role ${role}.`)
    }
  }
  for (const role of [
    'motion-render-start',
    'motion-render-positive',
    'motion-render-negative',
    ...(profile.model.mouthMotion.mode === 'disabled'
      ? []
      : ['mouth-render-open', 'mouth-render-close', 'mouth-render-loop']),
  ]) {
    if (evidenceCounts.get(role) !== 1) {
      errors.push(`Promotion requires exactly one evidence file for role ${role}.`)
    }
  }
  profile.source.evidencePaths.forEach((_path, index) => {
    const role = `source-evidence-${index + 1}`
    if (evidenceCounts.get(role) !== 1) {
      errors.push(`Promotion requires exactly one evidence file for role ${role}.`)
    }
  })
  if (profile.source.sourceArchivePath && evidenceCounts.get('source-archive') !== 1) {
    errors.push('Promotion requires exactly one source-archive evidence file.')
  }
  if (ownerApprovalRecorded(profile.approvals)) {
    for (const role of ['owner-approval-record', 'approval-qa-snapshot']) {
      if (evidenceCounts.get(role) !== 1) {
        errors.push(`Promotion requires exactly one evidence file for role ${role}.`)
      }
    }
  }
  if (manifest.publication) {
    for (const role of [
      'background-landscape-source',
      'background-portrait-source',
    ]) {
      if (evidenceCounts.get(role) !== 1) {
        errors.push(`Promotion requires exactly one evidence file for role ${role}.`)
      }
    }
  }
  for (const role of expectedEvidence.keys()) {
    if ((evidenceCounts.get(role) ?? 0) > 1) {
      errors.push(`Promotion evidence role ${role} must not be duplicated.`)
    }
  }
  return errors
}

async function currentBackgroundBindingErrors(
  profile: AnimalOnboardingProfile,
  manifest: PromotionManifest,
): Promise<string[]> {
  if (!manifest.publication) return []
  try {
    const value = JSON.parse(
      await readFile(resolve(profile.assets.backgroundEvidencePath), 'utf8'),
    ) as {
      landscape?: { sourcePath?: unknown }
      portrait?: { sourcePath?: unknown }
    }
    const landscape = value.landscape?.sourcePath
    const portrait = value.portrait?.sourcePath
    if (typeof landscape !== 'string' || typeof portrait !== 'string') {
      throw new Error('background evidence has no canonical landscape/portrait sources')
    }
    const pairs = [
      [
        'background-landscape-source',
        landscape,
        manifest.publication.backgrounds.landscape.sourcePath,
      ],
      [
        'background-portrait-source',
        portrait,
        manifest.publication.backgrounds.portrait.sourcePath,
      ],
    ] as const
    const errors: string[] = []
    for (const [role, currentPath, publicationPath] of pairs) {
      const evidence = manifest.evidenceFiles.find((file) => file.role === role)
      if (
        resolve(publicationPath) !== resolve(currentPath) ||
        !evidence ||
        resolve(evidence.path) !== resolve(currentPath)
      ) {
        errors.push(
          `${role} must match the source path in current background evidence.`,
        )
      }
    }
    return errors
  } catch (error) {
    return [
      `Cannot bind current background sources: ${error instanceof Error ? error.message : String(error)}`,
    ]
  }
}

export function bilingualPublicationContractErrors(
  manifest: PromotionManifest,
): string[] {
  const errors: string[] = []
  const runtimeRoles = manifest.files.map(({ role }) => role)
  if (runtimeRoles.includes('narration')) {
    errors.push(
      'Publication must not include the legacy locale-less narration role.',
    )
  }
  for (const role of requiredRuntimeRoles) {
    if (runtimeRoles.filter((value) => value === role).length !== 1) {
      errors.push(`Promotion requires exactly one runtime file for role ${role}.`)
    }
  }
  const generatedTargets = manifest.generatedFiles.map(
    ({ productionTargetPath }) => productionTargetPath,
  )
  for (const locale of ['zh-CN', 'en'] as const) {
    if (
      !generatedTargets.some((path) =>
        path.endsWith(`/content.${locale}.ts`),
      )
    ) {
      errors.push(
        `Publication requires generated content.${locale}.ts for locale ${locale}.`,
      )
    }
    if (!manifest.publication?.narration?.[locale]) {
      errors.push(`Publication metadata is missing narration for locale ${locale}.`)
    }
    if (!manifest.publication?.editorialReview?.[locale]) {
      errors.push(`Publication metadata is missing editorial review for locale ${locale}.`)
    }
  }
  for (const file of [
    'package.ts',
    'provenance.ts',
    'animal.ts',
    'model-license.txt',
    'model-source.txt',
    'background-generation.txt',
    'derived-images.txt',
    'narration-rights.txt',
  ]) {
    if (!generatedTargets.some((path) => path.endsWith(`/${file}`))) {
      errors.push(`Publication requires generated ${file}.`)
    }
  }
  return errors
}

function strongerCode(left: PromotionCode, right: PromotionCode): PromotionCode {
  const rank: Readonly<Record<PromotionCode, number>> = {
    0: 0,
    3: 1,
    1: 2,
    4: 3,
  }
  return rank[right] > rank[left] ? right : left
}

function pathInside(directory: string, path: string): boolean {
  const root = resolve(directory)
  const target = resolve(path)
  return target === root || target.startsWith(`${root}${sep}`)
}

async function secureRegularFile(path: string): Promise<boolean> {
  const absolute = resolve(path)
  const lexicalRepositoryRoot = resolve('.')
  if (!pathInside(lexicalRepositoryRoot, absolute)) return false
  let current = lexicalRepositoryRoot
  for (const component of relative(lexicalRepositoryRoot, absolute).split(sep)) {
    if (!component) continue
    current = resolve(current, component)
    const componentEntry = await lstat(current).catch(() => null)
    if (componentEntry?.isSymbolicLink()) return false
  }
  const entry = await lstat(absolute).catch(() => null)
  if (!entry?.isFile() || entry.isSymbolicLink() || entry.size <= 0) return false
  const [repositoryRoot, canonical] = await Promise.all([
    realpath(resolve('.')),
    realpath(absolute),
  ])
  return pathInside(repositoryRoot, canonical)
}

async function assertSecureDirectoryWithin(
  root: string,
  directory: string,
  label: string,
): Promise<void> {
  const absoluteRoot = resolve(root)
  const absoluteDirectory = resolve(directory)
  if (!pathInside(absoluteRoot, absoluteDirectory)) {
    throw new Error(`${label} escapes its lexical root.`)
  }
  const rootEntry = await lstat(absoluteRoot)
  if (rootEntry.isSymbolicLink() || !rootEntry.isDirectory()) {
    throw new Error(`${label} root must be a non-symlink directory.`)
  }
  let current = absoluteRoot
  for (const component of relative(absoluteRoot, absoluteDirectory).split(sep)) {
    if (!component) continue
    current = resolve(current, component)
    const entry = await lstat(current)
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      throw new Error(`${label} traverses a symlink or non-directory: ${current}`)
    }
  }
  const [canonicalRoot, canonicalDirectory] = await Promise.all([
    realpath(absoluteRoot),
    realpath(absoluteDirectory),
  ])
  if (!pathInside(canonicalRoot, canonicalDirectory)) {
    throw new Error(`${label} escapes its real root.`)
  }
}

export function parseCollectionAnimalIds(source: string): string[] {
  const block = source.match(/animalIds:\s*\[([\s\S]*?)\]/)?.[1]
  if (block === undefined) {
    throw new Error('Cannot locate animalIds in the main collection source.')
  }
  return [...block.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1])
}

export function renderCollectionAnimalIds(
  source: string,
  animalIds: readonly string[],
): string {
  const collectionPattern = /animalIds:\s*\[[\s\S]*?\]/
  if (!collectionPattern.test(source)) {
    throw new Error('Cannot update animalIds in the main collection source.')
  }
  const rendered = `animalIds: [\n${animalIds
    .map((id) => `    '${id}',`)
    .join('\n')}\n  ]`
  return source.replace(collectionPattern, rendered)
}

async function readCollection(): Promise<{
  readonly source: string
  readonly animalIds: readonly string[]
}> {
  const source = await readFile(resolve(collectionPath), 'utf8')
  return { source, animalIds: parseCollectionAnimalIds(source) }
}

function expectedTargets(manifest: PromotionManifest): Map<string, {
  readonly bytes: number
  readonly sha256: string
}> {
  const result = new Map<string, { readonly bytes: number; readonly sha256: string }>()
  for (const file of [...manifest.files, ...manifest.generatedFiles]) {
    if (!pathInside(manifest.productionDirectory, file.productionTargetPath)) {
      throw new Error(
        `${manifest.animalId}: target escapes production directory: ${file.productionTargetPath}`,
      )
    }
    if (result.has(file.productionTargetPath)) {
      throw new Error(
        `${manifest.animalId}: duplicate production target ${file.productionTargetPath}`,
      )
    }
    result.set(file.productionTargetPath, {
      bytes: file.bytes,
      sha256: file.sha256,
    })
  }
  return result
}

export async function collectRelativeFiles(root: string): Promise<string[]> {
  const absoluteRoot = resolve(root)
  const entry = await lstat(absoluteRoot).catch(() => null)
  if (entry?.isSymbolicLink()) {
    throw new Error(`Package root must not be a symbolic link: ${absoluteRoot}`)
  }
  if (!entry?.isDirectory()) return []
  const canonicalRoot = await realpath(absoluteRoot)
  const output: string[] = []
  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const child of entries) {
      const path = resolve(directory, child.name)
      if (child.isSymbolicLink()) {
        throw new Error(`Package trees must not contain symbolic links: ${path}`)
      }
      if (!child.isDirectory() && !child.isFile()) {
        throw new Error(`Package trees contain an unsupported directory entry: ${path}`)
      }
      const canonicalPath = await realpath(path)
      if (!pathInside(canonicalRoot, canonicalPath)) {
        throw new Error(`Package entry escapes its real root: ${path}`)
      }
      if (child.isDirectory()) await walk(path)
      else output.push(relative(absoluteRoot, path))
    }
  }
  await walk(absoluteRoot)
  return output.sort()
}

async function inspectTarget(manifest: PromotionManifest): Promise<TargetState> {
  const root = resolve(manifest.productionDirectory)
  try {
    await assertSecureDirectoryWithin(
      '.',
      'src/content/animals',
      'Production packages root',
    )
  } catch {
    return 'conflict'
  }
  const entry = await lstat(root).catch(() => null)
  if (entry === null) return 'add'
  if (!entry.isDirectory() || entry.isSymbolicLink()) return 'conflict'
  try {
    await assertSecureDirectoryWithin('src/content/animals', root, 'Production package')
  } catch {
    return 'conflict'
  }
  const expected = expectedTargets(manifest)
  const expectedRelative = [...expected.keys()]
    .map((path) => relative(root, resolve(path)))
    .sort()
  const actualRelative = await collectRelativeFiles(root)
  const pendingRelative = '.animal.ts.pending'
  const withoutAnimal = expectedRelative.filter((path) => path !== 'animal.ts')
  const isComplete =
    JSON.stringify(actualRelative) === JSON.stringify(expectedRelative)
  const isRecoverable =
    JSON.stringify(actualRelative) ===
    JSON.stringify([...withoutAnimal, pendingRelative].sort())
  if (!isComplete && !isRecoverable) return 'conflict'
  for (const [target, digest] of expected) {
    const candidate =
      isRecoverable && target.endsWith('/animal.ts')
        ? resolve(root, pendingRelative)
        : resolve(target)
    const actual = await fileDigest(candidate).catch(() => null)
    if (
      actual === null ||
      actual.bytes !== digest.bytes ||
      actual.sha256 !== digest.sha256
    ) {
      return 'conflict'
    }
  }
  return isRecoverable ? 'recoverable' : 'identical'
}

async function evidenceFiles(
  paths: readonly (readonly [string, string])[],
): Promise<PromotionEvidenceFile[]> {
  const result: PromotionEvidenceFile[] = []
  const seen = new Set<string>()
  for (const [role, path] of paths) {
    if (seen.has(path) || !(await regularFile(resolve(path)))) continue
    seen.add(path)
    result.push({ role, path, ...(await fileDigest(resolve(path))) })
  }
  return result
}

export async function buildPromotionManifest(
  profile: AnimalOnboardingProfile,
  profilePath: string,
  qaReportPath: string,
): Promise<PromotionManifest> {
  await assertSecureRepositoryFile(profilePath, 'promotion profile')
  const qa = JSON.parse(await readFile(qaReportPath, 'utf8')) as QaReport
  const absoluteProfilePath = resolve(profilePath)
  if (
    qa.schemaVersion !== 1 ||
    qa.animalId !== profile.id ||
    resolve(qa.profilePath) !== absoluteProfilePath
  ) {
    throw new Error(`${profile.id}: QA report is not bound to this profile.`)
  }
  const profileDigest = await fileDigest(absoluteProfilePath)
  const qaDigest = await fileDigest(resolve(qaReportPath))
  const productionDirectory = `src/content/animals/${profile.id}`
  const files: PromotionFile[] = []
  for (const [role, selector, target] of canonicalFiles) {
    const reviewSourcePath = sourceFor(profile, selector)
    if (!reviewSourcePath) continue
    if (!(await regularFile(resolve(reviewSourcePath)))) continue
    files.push({
      role,
      reviewSourcePath,
      productionTargetPath: `${productionDirectory}/${target}`,
      ...(await fileDigest(resolve(reviewSourcePath))),
    })
  }
  const narrations = localizedNarrationAssets(profile.assets)
  for (const locale of ['zh-CN', 'en'] as const) {
    const narration = narrations[locale]
    if (!narration || !(await regularFile(resolve(narration.path)))) continue
    files.push({
      role: `narration-${locale}`,
      reviewSourcePath: narration.path,
      productionTargetPath: `${productionDirectory}/audio/narration.${locale}.mp3`,
      ...(await fileDigest(resolve(narration.path))),
    })
  }
  const sourceDigest = await fileDigest(resolve(profile.source.sourceModelPath))
  const publicationBundle = await buildPublicationBundle(profile, files)
  const approvalRecordPath = `${profile.runDirectory}/approval-record.json`
  const evidencePaths: Array<readonly [string, string]> = [
    ['qa-report', qaReportPath],
    ['normalization-log', profile.model.normalizationLogPath],
    ['normalized-blend', profile.model.normalizedBlendPath],
    ['landmarks', profile.model.landmarksPath],
    ['glb-validator', `${profile.runDirectory}/glb-validator.json`],
    ['review-contract', `${profile.runDirectory}/review-contract.json`],
    ['stage-lock', `${profile.runDirectory}/stage-lock.json`],
    ['l3-acceptance', `${profile.runDirectory}/l3-acceptance.json`],
    ['asset-inspection', `${profile.runDirectory}/asset-inspection.json`],
    ['asset-risk-route', `${profile.runDirectory}/asset-risk-route.json`],
    ['browser-capture-plan', `${profile.runDirectory}/browser-capture-plan.json`],
    ['browser-capture-evidence', `${profile.runDirectory}/browser-capture-evidence.json`],
    ['browser-capture-validation', `${profile.runDirectory}/browser-capture-validation.json`],
    ['agent-visual-review', `${profile.runDirectory}/agent-review.json`],
    ['agent-visual-summary', `${profile.runDirectory}/agent-review.md`],
    ['owner-model-review', `${profile.runDirectory}/owner-model-review.md`],
    ['owner-model-lock', `${profile.runDirectory}/model-lock.json`],
    ['derivative-images', `${profile.runDirectory}/derivative-images.json`],
    ['motion-render-start', `${profile.runDirectory}/motion-renders/00-loop-start.png`],
    [
      'motion-render-positive',
      `${profile.runDirectory}/motion-renders/02-positive-extreme.png`,
    ],
    [
      'motion-render-negative',
      `${profile.runDirectory}/motion-renders/06-negative-extreme.png`,
    ],
    ...(profile.model.mouthMotion.mode !== 'disabled'
      ? ([
          ['mouth-render-open', `${profile.runDirectory}/mouth-renders/00-mouth-open.png`],
          ['mouth-render-close', `${profile.runDirectory}/mouth-renders/04-mouth-close.png`],
          ['mouth-render-loop', `${profile.runDirectory}/mouth-renders/08-mouth-loop.png`],
          ['browser-mouth-open', `${profile.runDirectory}/screenshots/desktop-mouth-open.png`],
          ['browser-mouth-close', `${profile.runDirectory}/screenshots/desktop-mouth-close.png`],
        ] as const)
      : []),
    ['browser-motion-start', `${profile.runDirectory}/screenshots/desktop-motion-start.png`],
    ['browser-motion-quarter', `${profile.runDirectory}/screenshots/desktop-motion-quarter.png`],
    ['background-generation', profile.assets.backgroundEvidencePath],
    ...(profile.source.sourceArchivePath
      ? ([['source-archive', profile.source.sourceArchivePath]] as const)
      : []),
    ...(['zh-CN', 'en'] as const).flatMap((locale) => {
      const narration = narrations[locale]
      if (!narration) return []
      return [
        [`narration-script-${locale}`, narration.scriptPath],
        [
          `narration-metrics-${locale}`,
          narration.metricsPath ??
            `${profile.runDirectory}/narration.${locale}.metrics.json`,
        ],
      ] as const
    }),
    ...profile.source.evidencePaths.map(
      (path, index) => [`source-evidence-${index + 1}`, path] as const,
    ),
    ['review-content-definition', `src/review/animals/${profile.id}/content.zh-CN.ts`],
    ['review-content-definition-en', `src/review/animals/${profile.id}/content.en.ts`],
    ['review-package-definition', `src/review/animals/${profile.id}/package.ts`],
    ...(publicationBundle
      ? ([
          ['background-landscape-source', publicationBundle.publication.backgrounds.landscape.sourcePath],
          ['background-portrait-source', publicationBundle.publication.backgrounds.portrait.sourcePath],
        ] as const)
      : []),
    ...(await regularFile(resolve(approvalRecordPath))
      ? ([
          ['owner-approval-record', approvalRecordPath],
          ['approval-qa-snapshot', `${profile.runDirectory}/approval-qa.json`],
        ] as const)
      : []),
  ]
  return {
    schemaVersion: 1,
    animalId: profile.id,
    status: 'draft',
    generatedAt: new Date().toISOString(),
    profilePath: absoluteProfilePath,
    profileSha256: profileDigest.sha256,
    qaReport: {
      path: resolve(qaReportPath),
      bytes: qaDigest.bytes,
      sha256: qaDigest.sha256,
      profileSha256: qa.profileSha256,
    },
    proposedCollectionIndex: profile.proposedCollectionIndex,
    productionDirectory,
    source: {
      ...profile.source,
      sourceModelBytes: sourceDigest.bytes,
      sourceModelSha256: sourceDigest.sha256,
    },
    files,
    generatedFiles: publicationBundle?.generatedFiles ?? [],
    evidenceFiles: await evidenceFiles(evidencePaths),
    derivation: {
      backgrounds:
        'ImageGen source images recorded by prompt, then deterministic Sharp resize/WebP encoding.',
      posterAndThumbnail:
        'Deterministic crops from passed desktop and phone-portrait review screenshots and measured model bounds.',
      narration:
        'Locale-bound Qwen3-TTS 0.6B CustomVoice outputs with declared voices, two byte-identical seeded raw runs and deterministic FFmpeg processing; each language requires explicit listening and public-distribution approval.',
    },
    gates: qa.gates,
    presentation: profile.presentation,
    motionProfile: profile.model.motionProfile,
    mouthMotion: profile.model.mouthMotion,
    landmarksPath: profile.model.landmarksPath,
    qaReportPath,
    ...(publicationBundle ? { publication: publicationBundle.publication } : {}),
    ...(await regularFile(resolve(approvalRecordPath))
      ? { approvalRecordPath }
      : {}),
    approvals: profile.approvals,
    automatedPass: qa.automatedPass,
    ownerApproved: qa.ownerApproved,
  }
}

export async function verifyPromotionDryRun(
  manifest: PromotionManifest,
): Promise<PromotionCheck> {
  const messages: string[] = []
  let code: PromotionCode = 0
  let currentProfile: AnimalOnboardingProfile | undefined
  let currentQa: QaReport | undefined
  const baseline = await verifyProductionBaseline()
  if (!baseline.pass) {
    code = 4
    messages.push(...baseline.errors.map((error) => `Production baseline: ${error}`))
  }
  if (manifest.status !== 'draft') {
    code = strongerCode(code, 1)
    messages.push('Promotion manifest is not a draft input.')
  }
  try {
    const secureProfilePath = await assertSecureRepositoryFile(
      manifest.profilePath,
      'promotion profile',
    )
    currentProfile = await loadProfile(secureProfilePath)
    if (currentProfile.id !== manifest.animalId) {
      throw new Error('current profile belongs to a different animal')
    }
    const bindingErrors = [
      ...promotionBindingErrors(currentProfile, manifest),
      ...(await currentBackgroundBindingErrors(currentProfile, manifest)),
    ]
    if (bindingErrors.length > 0) {
      throw new Error(bindingErrors.join('; '))
    }
    currentQa = await evaluateCurrentQa(secureProfilePath, true)
    const readinessErrors = approvalReadinessErrors(currentProfile, currentQa, {
      requireHumanPass: true,
    })
    if (readinessErrors.length > 0) {
      throw new Error(readinessErrors.join('; '))
    }
    const [capture, modelLock] = await Promise.all([
      verifyCurrentBrowserCapture(
        currentProfile,
        resolve(currentProfile.runDirectory, 'browser-capture-evidence.json'),
      ),
      verifyModelLockForProfile(currentProfile),
    ])
    if (!capture.pass) {
      throw new Error(`current browser capture failed: ${capture.errors.join('; ')}`)
    }
    if (!modelLock.pass) {
      throw new Error(`current model lock failed: ${modelLock.errors.join('; ')}`)
    }
  } catch (error) {
    code = strongerCode(code, 1)
    messages.push(
      `Current complete QA failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  let boundQa: QaReport | undefined
  if (
    typeof manifest.profilePath !== 'string' ||
    typeof manifest.profileSha256 !== 'string' ||
    typeof manifest.qaReport?.path !== 'string' ||
    typeof manifest.qaReport.sha256 !== 'string'
  ) {
    code = strongerCode(code, 1)
    messages.push('Promotion manifest is missing profile/QA hash bindings.')
  } else {
    const currentProfile = await fileDigest(resolve(manifest.profilePath)).catch(
      () => null,
    )
    if (
      currentProfile === null ||
      currentProfile.sha256 !== manifest.profileSha256
    ) {
      code = strongerCode(code, 1)
      messages.push('Current profile does not match the promotion manifest.')
    }
    const qaPath = resolve(manifest.qaReport.path)
    const currentQaDigest = await fileDigest(qaPath).catch(() => null)
    if (
      currentQaDigest === null ||
      currentQaDigest.bytes !== manifest.qaReport.bytes ||
      currentQaDigest.sha256 !== manifest.qaReport.sha256
    ) {
      code = strongerCode(code, 1)
      messages.push('Current QA report does not match the promotion manifest.')
    } else {
      try {
        boundQa = JSON.parse(await readFile(qaPath, 'utf8')) as QaReport
        if (
          boundQa.schemaVersion !== 1 ||
          boundQa.animalId !== manifest.animalId ||
          resolve(boundQa.profilePath) !== resolve(manifest.profilePath) ||
          boundQa.profileSha256 !== manifest.qaReport.profileSha256 ||
          boundQa.profileSha256 !== manifest.profileSha256 ||
          !boundQa.automatedPass ||
          !boundQa.localDraftReady
        ) {
          throw new Error('QA identity, profile binding or pass state is invalid.')
        }
        if (currentQa) {
          const decisions = (report: QaReport): string =>
            JSON.stringify(
              report.gates
                .map(({ id, kind, status }) => ({ id, kind, status }))
                .sort((left, right) => left.id.localeCompare(right.id)),
            )
          if (decisions(boundQa) !== decisions(currentQa)) {
            throw new Error('Persisted QA gate decisions differ from current recomputed gates.')
          }
        }
      } catch (error) {
        code = strongerCode(code, 1)
        messages.push(
          `Invalid bound QA report: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }
  if (manifest.productionDirectory !== `src/content/animals/${manifest.animalId}`) {
    code = strongerCode(code, 4)
    messages.push('Production directory does not match the stable animal ID.')
  }
  const productionEntry = await lstat(resolve(manifest.productionDirectory)).catch(
    () => null,
  )
  if (productionEntry?.isSymbolicLink()) {
    code = strongerCode(code, 4)
    messages.push('Production package root must not be a symbolic link.')
  }
  if (!manifest.automatedPass) {
    code = strongerCode(code, 1)
    messages.push('Automated QA has hard failures.')
  }
  if (
    manifest.gates.some(
      (gate) => gate.kind === 'automated' && gate.status === 'fail',
    )
  ) {
    code = strongerCode(code, 1)
    messages.push('Promotion manifest contains a failed automated gate.')
  }
  if (currentQa) {
    const signature = (gates: QaReport['gates']): string =>
      JSON.stringify(
        gates
          .map(({ id, kind, status }) => ({ id, kind, status }))
          .sort((left, right) => left.id.localeCompare(right.id)),
      )
    if (signature(manifest.gates) !== signature(currentQa.gates)) {
      code = strongerCode(code, 1)
      messages.push('Promotion manifest gates differ from current recomputed QA.')
    }
  }
  const publicationErrors = bilingualPublicationContractErrors(manifest)
  if (publicationErrors.length > 0) {
    code = strongerCode(code, 1)
    messages.push(...publicationErrors)
  }
  const roleCounts = new Map<string, number>()
  for (const evidence of manifest.evidenceFiles) {
    roleCounts.set(evidence.role, (roleCounts.get(evidence.role) ?? 0) + 1)
  }
  // Exact role-to-path requirements are checked against the live profile above.
  if (
    !manifest.evidenceFiles.some(({ role }) =>
      role.startsWith('source-evidence-'),
    )
  ) {
    code = strongerCode(code, 1)
    messages.push('Promotion requires at least one hashed source evidence file.')
  }
  try {
    expectedTargets(manifest)
  } catch (error) {
    code = strongerCode(code, 4)
    messages.push(error instanceof Error ? error.message : String(error))
  }
  for (const file of manifest.files) {
    const path = resolve(file.reviewSourcePath)
    if (!(await secureRegularFile(path))) {
      code = strongerCode(code, 1)
      messages.push(`Missing, linked or out-of-repository review source: ${file.reviewSourcePath}`)
      continue
    }
    const actual = await fileDigest(path)
    if (actual.bytes !== file.bytes || actual.sha256 !== file.sha256) {
      code = strongerCode(code, 1)
      messages.push(`Hash mismatch: ${file.reviewSourcePath}`)
    }
    const targetEntry = await lstat(resolve(file.productionTargetPath)).catch(
      () => null,
    )
    if (targetEntry?.isSymbolicLink()) {
      code = strongerCode(code, 4)
      messages.push(`Production target must not be a symbolic link: ${file.productionTargetPath}`)
    } else if (await secureRegularFile(resolve(file.productionTargetPath))) {
      const target = await fileDigest(resolve(file.productionTargetPath))
      if (target.bytes !== file.bytes || target.sha256 !== file.sha256) {
        code = strongerCode(code, 4)
        messages.push(
          `Production target exists with different content: ${file.productionTargetPath}`,
        )
      }
    }
  }
  for (const file of manifest.generatedFiles) {
    const targetEntry = await lstat(resolve(file.productionTargetPath)).catch(
      () => null,
    )
    if (targetEntry?.isSymbolicLink()) {
      code = strongerCode(code, 4)
      messages.push(`Generated target must not be a symbolic link: ${file.productionTargetPath}`)
    } else if (await secureRegularFile(resolve(file.productionTargetPath))) {
      const target = await fileDigest(resolve(file.productionTargetPath))
      if (target.bytes !== file.bytes || target.sha256 !== file.sha256) {
        code = strongerCode(code, 4)
        messages.push(
          `Generated production target exists with different content: ${file.productionTargetPath}`,
        )
      }
    }
  }
  for (const evidence of manifest.evidenceFiles) {
    const path = resolve(evidence.path)
    if (!(await secureRegularFile(path))) {
      code = strongerCode(code, 1)
      messages.push(`Missing, linked or out-of-repository evidence: ${evidence.path}`)
      continue
    }
    const actual = await fileDigest(path)
    if (actual.bytes !== evidence.bytes || actual.sha256 !== evidence.sha256) {
      code = strongerCode(code, 1)
      messages.push(`Evidence hash mismatch: ${evidence.path}`)
    }
  }
  const inspectionEvidence = manifest.evidenceFiles.find(
    ({ role }) => role === 'asset-inspection',
  )
  const routeEvidence = manifest.evidenceFiles.find(
    ({ role }) => role === 'asset-risk-route',
  )
  if (inspectionEvidence && routeEvidence) {
    try {
      const verification = await verifyPersistedAssetRiskRoute(
        inspectionEvidence.path,
        routeEvidence.path,
      )
      if (
        !verification.pass ||
        verification.currentRoute.animalId !== manifest.animalId
      ) {
        throw new Error(
          verification.errors.join('; ') || 'risk route animal does not match',
        )
      }
      if (
        verification.currentRoute.underlyingRiskLevel === 'L3' &&
        roleCounts.get('l3-acceptance') !== 1
      ) {
        throw new Error('L3 promotion requires one hashed L3 acceptance record')
      }
    } catch (error) {
      code = strongerCode(code, 1)
      messages.push(
        `Invalid current risk route: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  const publication = manifest.publication
  if (publication) {
    for (const locale of ['zh-CN', 'en'] as const) {
      const editorial = publication.editorialReview?.[locale]
      if (!editorial) continue
      if (editorial.pendingMarkers.length > 0) {
        code = strongerCode(code, 1)
        messages.push(
          `Approved ${locale} production copy still contains pending markers: ${editorial.pendingMarkers.join(', ')}`,
        )
      }
    }
    if (publication.scientificReviewStatus !== 'approved') {
      code = strongerCode(code, 3)
      messages.push('Scientific review status is not approved.')
    }
    if (publication.mouthReviewStatus === 'pending') {
      code = strongerCode(code, 3)
      messages.push('Enabled mouth motion has not completed human review.')
    }
    for (const locale of ['zh-CN', 'en'] as const) {
      const narration = publication.narration?.[locale]
      if (!narration) continue
      if (
        narration.humanListeningReview !== 'approved' ||
        narration.publicDistributionDecision !== 'approved'
      ) {
        code = strongerCode(code, 3)
        messages.push(
          `${locale} narration listening or public distribution is not approved.`,
        )
      }
    }
  }
  const allApprovals = ownerApprovalRecorded(manifest.approvals)
  if (!allApprovals || !manifest.ownerApproved) {
    code = strongerCode(code, 3)
    messages.push('BLOCKED: explicit owner production approval is not recorded.')
  } else {
    const approvalEvidence = manifest.evidenceFiles.find(
      ({ role }) => role === 'owner-approval-record',
    )
    const approvalQaEvidence = manifest.evidenceFiles.find(
      ({ role }) => role === 'approval-qa-snapshot',
    )
    if (!manifest.approvalRecordPath || !approvalEvidence || !approvalQaEvidence) {
      code = strongerCode(code, 3)
      messages.push(
        'Explicit owner approval requires hashed approval and decision-QA records.',
      )
    } else {
      try {
        const approval = await loadOwnerApprovalRecord(
          manifest.approvalRecordPath,
        )
        const decisionQaPath = resolve(approval.qaAtDecision.path)
        const expectedDecisionQaPath = resolve(
          currentProfile?.runDirectory ?? '',
          'approval-qa.json',
        )
        if (decisionQaPath !== expectedDecisionQaPath) {
          throw new Error('approval record binds a non-canonical QA snapshot path')
        }
        await assertSecureRepositoryFile(
          decisionQaPath,
          'approval QA snapshot',
        )
        const decisionQaBytes = await readFile(decisionQaPath)
        const decisionQa = JSON.parse(
          decisionQaBytes.toString('utf8'),
        ) as QaReport
        const approvalRecordDigest = await fileDigest(
          resolve(manifest.approvalRecordPath),
        )
        const currentApprovalBundle =
          currentProfile && currentQa
            ? await collectApprovalBundle(currentProfile, currentQa)
            : null
        if (
          approval.animalId !== manifest.animalId ||
          approval.approvedBy !== manifest.approvals.approvedBy ||
          approval.approvedOn !== manifest.approvals.approvedOn ||
          approval.approvedProfileSha256 !== manifest.profileSha256 ||
          approval.profileBeforeSha256 !== decisionQa.profileSha256 ||
          decisionQa.schemaVersion !== 1 ||
          decisionQa.animalId !== manifest.animalId ||
          !decisionQa.automatedPass ||
          !decisionQa.localDraftReady ||
          approval.qaAtDecision.bytes !== decisionQaBytes.length ||
          approval.qaAtDecision.sha256 !== sha256(decisionQaBytes) ||
          resolve(approvalEvidence.path) !==
            resolve(manifest.approvalRecordPath) ||
          approvalEvidence.bytes !== approvalRecordDigest.bytes ||
          approvalEvidence.sha256 !== approvalRecordDigest.sha256 ||
          resolve(approvalQaEvidence.path) !== decisionQaPath ||
          approvalQaEvidence.bytes !== approval.qaAtDecision.bytes ||
          approvalQaEvidence.sha256 !== approval.qaAtDecision.sha256 ||
          boundQa?.ownerApproved !== true ||
          currentApprovalBundle === null ||
          !approvalBundlesEqual(
            approval.approvalBundle,
            currentApprovalBundle,
          )
        ) {
          throw new Error('approval/profile/QA/bundle bindings do not match')
        }
      } catch (error) {
        code = strongerCode(code, 3)
        messages.push(
          `Invalid owner approval record: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
    if (
      manifest.gates.some(
        (gate) => gate.kind === 'human-only' && gate.status !== 'pass',
      )
    ) {
      code = strongerCode(code, 3)
      messages.push('One or more human-only QA gates are not recorded as passed.')
    }
  }
  if (code !== 0) return { pass: false, code, messages }
  return {
    pass: true,
    code: 0,
    messages: [
      'All deterministic inputs, generated package hashes, licenses and explicit owner approvals are valid.',
    ],
  }
}

function planCollectionAfter(
  current: readonly string[],
  manifests: readonly PromotionManifest[],
): { readonly ids: readonly string[]; readonly errors: readonly string[] } {
  const ids = [...current]
  const errors: string[] = []
  const sorted = [...manifests].sort(
    (left, right) => left.proposedCollectionIndex - right.proposedCollectionIndex,
  )
  const inputIds = sorted.map(({ animalId }) => animalId)
  if (new Set(inputIds).size !== inputIds.length) {
    errors.push('Promotion batch contains duplicate animal IDs.')
  }
  for (const manifest of sorted) {
    const existingIndex = ids.indexOf(manifest.animalId)
    if (existingIndex >= 0) {
      if (existingIndex !== manifest.proposedCollectionIndex) {
        errors.push(
          `${manifest.animalId}: already in collection at ${existingIndex}, manifest proposes ${manifest.proposedCollectionIndex}.`,
        )
      }
      continue
    }
    if (manifest.proposedCollectionIndex !== ids.length) {
      errors.push(
        `${manifest.animalId}: onboarding promotions append at index ${ids.length}, manifest proposes ${manifest.proposedCollectionIndex}.`,
      )
      continue
    }
    ids.push(manifest.animalId)
  }
  return { ids, errors }
}

function trackedFiles(manifests: readonly PromotionManifest[]): string[] {
  return [
    ...manifests.flatMap((manifest) => [
      ...manifest.files.map(({ productionTargetPath }) => productionTargetPath),
      ...manifest.generatedFiles.map(({ productionTargetPath }) => productionTargetPath),
    ]),
    collectionPath,
    creditsPath,
    noticesPath,
  ].sort()
}

export async function planPromotionBatch(
  inputs: readonly PromotionInput[],
  collection = 'main',
): Promise<PromotionBatchPlan> {
  const messages: string[] = []
  let code: PromotionCode = 0
  if (collection !== 'main') {
    code = 1
    messages.push(`Unsupported collection: ${collection}.`)
  }
  if (inputs.length === 0) {
    code = 1
    messages.push('Promotion batch is empty.')
  }
  const current = await readCollection()
  const ordered = [...inputs].sort(
    (left, right) =>
      left.manifest.proposedCollectionIndex -
      right.manifest.proposedCollectionIndex,
  )
  const results = []
  for (const { profile, manifest } of ordered) {
    if (profile.id !== manifest.animalId) {
      code = strongerCode(code, 4)
      messages.push(`${profile.id}: profile and manifest animal IDs differ.`)
    }
    const check = await verifyPromotionDryRun(manifest)
    const targetState = await inspectTarget(manifest)
    let resultCode = check.code
    const resultMessages = [...check.messages]
    if (targetState === 'conflict') {
      resultCode = strongerCode(resultCode, 4)
      resultMessages.push('Production target directory is partial or differs from the manifest.')
    }
    code = strongerCode(code, resultCode)
    results.push({
      animalId: manifest.animalId,
      code: resultCode,
      messages: resultMessages,
      targetState,
      proposedCollectionIndex: manifest.proposedCollectionIndex,
      runtimeFiles: manifest.files.length,
      generatedFiles: manifest.generatedFiles.length,
      totalBytes: [...manifest.files, ...manifest.generatedFiles].reduce(
        (total, file) => total + file.bytes,
        0,
      ),
      licenseId: manifest.source.licenseId,
      approvedBy: manifest.approvals.approvedBy,
      approvedOn: manifest.approvals.approvedOn,
    })
  }
  const collectionPlan = planCollectionAfter(
    current.animalIds,
    ordered.map(({ manifest }) => manifest),
  )
  if (collectionPlan.errors.length > 0) {
    code = strongerCode(code, 4)
    messages.push(...collectionPlan.errors)
  }
  const files = trackedFiles(ordered.map(({ manifest }) => manifest))
  return {
    pass: code === 0,
    code,
    messages:
      code === 0
        ? [
            `Validated ${ordered.length} fully approved package(s); install will use staging, animal.ts-last visibility and one final collection update.`,
          ]
        : messages,
    atomic: true,
    installPerformed: false,
    collection,
    collectionBefore: current.animalIds,
    collectionAfter: collectionPlan.ids,
    totalBytes: results.reduce((total, result) => total + result.totalBytes, 0),
    results,
    trackedFiles: files,
  }
}

function assertBundleMatchesManifest(
  manifest: PromotionManifest,
  bundle: PublicationBundle,
): void {
  const expected = [...manifest.generatedFiles].sort((left, right) =>
    left.productionTargetPath.localeCompare(right.productionTargetPath),
  )
  const actual = [...bundle.generatedFiles].sort((left, right) =>
    left.productionTargetPath.localeCompare(right.productionTargetPath),
  )
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(
      `${manifest.animalId}: generated production definitions differ from the reviewed manifest. Run review prepare again.`,
    )
  }
}

async function ensureStagedFile(
  destination: string,
  expected: { readonly bytes: number; readonly sha256: string },
  source: { readonly path: string } | { readonly content: Buffer },
): Promise<void> {
  const existing = await lstat(destination).catch(() => null)
  if (existing !== null) {
    if (!existing.isFile() || existing.isSymbolicLink()) {
      throw new Error(`Staging entry must be a regular non-symlink file: ${destination}`)
    }
    const actual = await fileDigest(destination)
    if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
      throw new Error(`Staging conflict: ${destination}`)
    }
    return
  }
  await mkdir(dirname(destination), { recursive: true })
  if ('path' in source) {
    if (!(await secureRegularFile(source.path))) {
      throw new Error(`Staging source must be a repository-contained regular file: ${source.path}`)
    }
    await copyFile(resolve(source.path), destination)
  }
  else await writeFile(destination, source.content)
  const actual = await fileDigest(destination)
  if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
    throw new Error(`Staged file hash differs after write: ${destination}`)
  }
}

async function prepareStaging(
  profile: AnimalOnboardingProfile,
  manifest: PromotionManifest,
  bundle: PublicationBundle,
): Promise<string> {
  const promotionStagingRoot = resolve(
    profile.runDirectory,
    'promotion-staging',
  )
  const stagingRootEntry = await lstat(promotionStagingRoot).catch(() => null)
  if (stagingRootEntry === null) {
    await mkdir(promotionStagingRoot)
  } else if (
    stagingRootEntry.isSymbolicLink() ||
    !stagingRootEntry.isDirectory()
  ) {
    throw new Error(
      `${manifest.animalId}: promotion-staging must be a non-symlink directory.`,
    )
  }
  await assertSecureDirectoryWithin(
    profile.runDirectory,
    promotionStagingRoot,
    `${manifest.animalId}: promotion-staging`,
  )
  const stage = resolve(promotionStagingRoot, 'package')
  const existingStage = await lstat(stage).catch(() => null)
  if (existingStage === null) {
    await mkdir(stage)
  }
  const stageEntry = await lstat(stage)
  if (!stageEntry.isDirectory() || stageEntry.isSymbolicLink()) {
    throw new Error(`${manifest.animalId}: staging root must be a non-symlink directory.`)
  }
  await assertSecureDirectoryWithin(
    profile.runDirectory,
    stage,
    `${manifest.animalId}: staging root`,
  )
  const expected = expectedTargets(manifest)
  const expectedRelative = [...expected.keys()]
    .map((path) => relative(resolve(manifest.productionDirectory), resolve(path)))
    .sort()
  const actualRelative = await collectRelativeFiles(stage)
  const unexpected = actualRelative.filter((path) => !expectedRelative.includes(path))
  if (unexpected.length > 0) {
    throw new Error(
      `${manifest.animalId}: staging contains unexpected file(s): ${unexpected.join(', ')}`,
    )
  }
  const runtimeByTarget = new Map(
    manifest.files.map((file) => [file.productionTargetPath, file]),
  )
  const orderedTargets = [...expected.keys()].sort((left, right) => {
    if (left.endsWith('/animal.ts')) return 1
    if (right.endsWith('/animal.ts')) return -1
    return left.localeCompare(right)
  })
  for (const target of orderedTargets) {
    const relativePath = relative(
      resolve(manifest.productionDirectory),
      resolve(target),
    )
    const destination = resolve(stage, relativePath)
    const digest = expected.get(target)!
    const runtime = runtimeByTarget.get(target)
    if (runtime) {
      await ensureStagedFile(destination, digest, {
        path: runtime.reviewSourcePath,
      })
    } else {
      const content = bundle.contents.get(target)
      if (!content) throw new Error(`${manifest.animalId}: no generated content for ${target}.`)
      await ensureStagedFile(destination, digest, { content })
    }
  }
  if (
    JSON.stringify(await collectRelativeFiles(stage)) !==
    JSON.stringify(expectedRelative)
  ) {
    throw new Error(`${manifest.animalId}: staged package is not complete.`)
  }
  const snapshotPath = await assertSecureRepositoryOutputPath(
    resolve(profile.runDirectory, 'promotion-staging/manifest.snapshot.json'),
    `${manifest.animalId}: staging manifest snapshot`,
  )
  await writeJson(snapshotPath, manifest)
  return stage
}

async function atomicWrite(path: string, content: string): Promise<void> {
  const destination = resolve(path)
  const temporary = `${destination}.promotion-${process.pid}-${Date.now()}.tmp`
  await writeFile(temporary, content, 'utf8')
  await rename(temporary, destination)
}

interface InstalledDirectory {
  readonly target: string
  readonly stage: string
  readonly origin: 'new' | 'recoverable'
}

async function rollbackDirectories(
  installed: readonly InstalledDirectory[],
): Promise<void> {
  for (const entry of [...installed].reverse()) {
    const animal = resolve(entry.target, 'animal.ts')
    const pending = resolve(entry.target, '.animal.ts.pending')
    if (await regularFile(animal)) await rename(animal, pending)
    if (entry.origin === 'new') {
      await mkdir(dirname(entry.stage), { recursive: true })
      await rename(entry.target, entry.stage)
      const restoredPending = resolve(entry.stage, '.animal.ts.pending')
      if (await regularFile(restoredPending)) {
        await rename(restoredPending, resolve(entry.stage, 'animal.ts'))
      }
    }
  }
}

export async function promoteBatch(
  inputs: readonly PromotionInput[],
  collection = 'main',
): Promise<PromotionBatchResult> {
  const plan = await planPromotionBatch(inputs, collection)
  if (!plan.pass) {
    throw new Error(
      `Promotion preflight failed with code ${plan.code}: ${[
        ...plan.messages,
        ...plan.results.flatMap(({ messages }) => messages),
      ].join(' ')}`,
    )
  }
  const resultOutputPaths = new Map<string, string>()
  for (const { profile } of inputs) {
    resultOutputPaths.set(
      profile.id,
      await assertSecureRepositoryOutputPath(
        resolve(profile.runDirectory, 'promotion-result.json'),
        `${profile.id}: promotion result`,
      ),
    )
  }
  const transactionPaths = {
    collection: await assertSecureRepositoryOutputPath(
      collectionPath,
      'main collection transaction file',
    ),
    credits: await assertSecureRepositoryOutputPath(
      creditsPath,
      'generated credits transaction file',
    ),
    notices: await assertSecureRepositoryOutputPath(
      noticesPath,
      'third-party notices transaction file',
    ),
  }
  const ordered = [...inputs].sort(
    (left, right) =>
      left.manifest.proposedCollectionIndex -
      right.manifest.proposedCollectionIndex,
  )
  const bundles = new Map<string, PublicationBundle>()
  for (const { profile, manifest } of ordered) {
    const bundle = await buildPublicationBundle(profile, manifest.files)
    if (!bundle) throw new Error(`${profile.id}: review package is missing.`)
    assertBundleMatchesManifest(manifest, bundle)
    bundles.set(profile.id, bundle)
  }
  const stages = new Map<string, string>()
  for (const { profile, manifest } of ordered) {
    const targetState = plan.results.find(
      ({ animalId }) => animalId === profile.id,
    )!.targetState
    if (targetState === 'add') {
      stages.set(
        profile.id,
        await prepareStaging(profile, manifest, bundles.get(profile.id)!),
      )
    }
  }
  const [oldCollection, oldCredits, oldNotices] = await Promise.all([
    readFile(transactionPaths.collection, 'utf8'),
    readFile(transactionPaths.credits, 'utf8'),
    readFile(transactionPaths.notices, 'utf8'),
  ])
  const installed: InstalledDirectory[] = []
  try {
    for (const { profile, manifest } of ordered) {
      const targetState = plan.results.find(
        ({ animalId }) => animalId === profile.id,
      )!.targetState
      if (targetState === 'identical') continue
      const target = resolve(manifest.productionDirectory)
      if (targetState === 'recoverable') {
        installed.push({
          target,
          stage: resolve(profile.runDirectory, 'promotion-staging/package'),
          origin: 'recoverable',
        })
        continue
      }
      await assertSecureDirectoryWithin(
        '.',
        'src/content/animals',
        'Production packages root',
      )
      const stage = stages.get(profile.id)!
      await rename(resolve(stage, 'animal.ts'), resolve(stage, '.animal.ts.pending'))
      await rename(stage, target)
      installed.push({ target, stage, origin: 'new' })
    }
    // The catalog entry is exposed only after every other file in every package
    // is already present. The collection itself is still unchanged here.
    for (const entry of installed) {
      await rename(
        resolve(entry.target, '.animal.ts.pending'),
        resolve(entry.target, 'animal.ts'),
      )
    }
    const nextCollection = renderCollectionAnimalIds(
      oldCollection,
      plan.collectionAfter,
    )
    await atomicWrite(transactionPaths.collection, nextCollection)
    const [contentData, credits, contentValidation] = await Promise.all([
      import('../../../scripts/content-data'),
      import('../../../scripts/credits'),
      import('../../../scripts/content-validation'),
    ])
    const { loadAnimalDefinitions } = contentData
    const { renderCreditsModule, renderThirdPartyNotices } = credits
    const { validateContent } = contentValidation
    const packages = await loadAnimalDefinitions()
    const issues = await validateContent(packages, {
      id: 'main',
      animalIds: plan.collectionAfter as [string, ...string[]],
      defaultAnimalId: plan.collectionAfter[0],
      loop: true,
    })
    const errors = issues.filter(({ severity }) => severity === 'error')
    if (errors.length > 0) {
      throw new Error(
        `Staged production content validation failed: ${errors
          .map(({ code: issueCode, message }) => `${issueCode}: ${message}`)
          .join('; ')}`,
      )
    }
    await Promise.all([
      atomicWrite(transactionPaths.credits, renderCreditsModule(packages)),
      atomicWrite(
        transactionPaths.notices,
        renderThirdPartyNotices(packages),
      ),
    ])
    const baseline = await verifyProductionBaseline()
    if (!baseline.pass) {
      throw new Error(`Post-install baseline failed: ${baseline.errors.join('; ')}`)
    }
    for (const { manifest } of ordered) {
      if ((await inspectTarget(manifest)) !== 'identical') {
        throw new Error(`${manifest.animalId}: installed package does not match manifest.`)
      }
    }
  } catch (error) {
    await Promise.all([
      atomicWrite(transactionPaths.collection, oldCollection),
      atomicWrite(transactionPaths.credits, oldCredits),
      atomicWrite(transactionPaths.notices, oldNotices),
    ])
    await rollbackDirectories(installed)
    throw error
  }
  const installedAnimalIds = installed.map(({ target }) => target.split(sep).at(-1)!)
  const skippedAnimalIds = plan.results
    .filter(({ targetState }) => targetState === 'identical')
    .map(({ animalId }) => animalId)
  const result: PromotionBatchResult = {
    ...plan,
    pass: true,
    code: 0,
    messages: [
      `Installed ${installedAnimalIds.length} package(s), updated the collection once, regenerated credits/notices and validated the complete transaction.`,
    ],
    installPerformed: true,
    generatedAt: new Date().toISOString(),
    installedAnimalIds,
    skippedAnimalIds,
  }
  await Promise.all(
    ordered.map(async ({ profile }) => {
      const outputPath = resultOutputPaths.get(profile.id)!
      await writeJson(outputPath, {
        ...result,
        animalId: profile.id,
      })
    }),
  )
  return result
}

export async function verifyPromotionInstalled(
  manifest: PromotionManifest,
): Promise<PromotionCheck> {
  const dryRun = await verifyPromotionDryRun(manifest)
  if (!dryRun.pass) return dryRun
  const messages: string[] = []
  if ((await inspectTarget(manifest)) !== 'identical') {
    messages.push('Installed production package is missing or differs from its manifest.')
  }
  const { animalIds } = await readCollection()
  if (animalIds[manifest.proposedCollectionIndex] !== manifest.animalId) {
    messages.push(
      `main collection does not contain ${manifest.animalId} at index ${manifest.proposedCollectionIndex}.`,
    )
  }
  return messages.length === 0
    ? {
        pass: true,
        code: 0,
        messages: ['Installed package, manifest hashes, approvals and collection position are valid.'],
      }
    : { pass: false, code: 4, messages }
}
