import { lstat, readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

import { parseAgentVisualReview } from './agent-review'
import { fileDigest, sha256 } from './io'
import { localizedNarrationAssets } from './profile'
import type { AnimalOnboardingProfile, QaReport } from './types'

export interface ApprovalBundleFile {
  readonly path: string
  readonly bytes: number
  readonly sha256: string
}

export interface ApprovalBundleDigest {
  readonly algorithm: 'sha256'
  readonly sha256: string
  readonly files: readonly ApprovalBundleFile[]
}

function pathInside(root: string, path: string): boolean {
  const child = relative(root, path)
  return (
    child === '' ||
    (child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child))
  )
}

export async function assertSecureRepositoryFile(
  path: string,
  label = 'repository file',
): Promise<string> {
  const absolute = resolve(path)
  const lexicalRepositoryRoot = resolve('.')
  if (!pathInside(lexicalRepositoryRoot, absolute)) {
    throw new Error(`${label} escapes the repository: ${absolute}`)
  }
  let current = lexicalRepositoryRoot
  for (const component of relative(lexicalRepositoryRoot, absolute).split(sep)) {
    if (!component) continue
    current = resolve(current, component)
    const componentEntry = await lstat(current).catch(() => null)
    if (componentEntry?.isSymbolicLink()) {
      throw new Error(`${label} must not traverse a symbolic link: ${current}`)
    }
  }
  const entry = await lstat(absolute).catch(() => null)
  if (!entry?.isFile() || entry.isSymbolicLink() || entry.size <= 0) {
    throw new Error(`${label} must be a non-symlink regular file: ${absolute}`)
  }
  const repositoryRoot = await realpath(resolve('.'))
  const canonical = await realpath(absolute)
  if (!pathInside(repositoryRoot, canonical)) {
    throw new Error(`${label} escapes the repository: ${absolute}`)
  }
  return absolute
}

export async function assertSecureRepositoryOutputPath(
  path: string,
  label = 'repository output',
): Promise<string> {
  const absolute = resolve(path)
  const repositoryRoot = resolve('.')
  if (!pathInside(repositoryRoot, absolute) || absolute === repositoryRoot) {
    throw new Error(`${label} escapes the repository: ${absolute}`)
  }
  let current = repositoryRoot
  const components = relative(repositoryRoot, absolute).split(sep)
  for (const [index, component] of components.entries()) {
    if (!component) continue
    current = resolve(current, component)
    const entry = await lstat(current).catch(() => null)
    if (entry === null) continue
    if (entry.isSymbolicLink()) {
      throw new Error(`${label} must not traverse a symbolic link: ${current}`)
    }
    const final = index === components.length - 1
    if ((!final && !entry.isDirectory()) || (final && !entry.isFile())) {
      throw new Error(`${label} has an unsupported path entry: ${current}`)
    }
  }
  return absolute
}

async function secureFileDigest(path: string): Promise<ApprovalBundleFile> {
  const absolute = await assertSecureRepositoryFile(path, 'approval bundle file')
  const [repositoryRoot, canonical] = await Promise.all([
    realpath(resolve('.')),
    realpath(absolute),
  ])
  const portablePath = relative(repositoryRoot, canonical).split(sep).join('/')
  return { path: portablePath, ...(await fileDigest(absolute)) }
}

function agentReviewEvidencePaths(value: unknown): string[] {
  const review = parseAgentVisualReview(value)
  return [
    ...review.checks.flatMap(({ evidencePaths }) => evidencePaths),
    ...review.contractProofs.flatMap(({ evidence }) =>
      evidence.flatMap(({ evidencePaths }) => evidencePaths),
    ),
    ...review.motionSamples.map(({ evidencePath }) => evidencePath),
  ]
}

export function canonicalApprovalBundleSha256(
  files: readonly ApprovalBundleFile[],
): string {
  const canonical = [...files]
    .map(({ path, bytes, sha256: digest }) => ({
      path: path.split(sep).join('/'),
      bytes,
      sha256: digest,
    }))
    .sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    )
  return sha256(Buffer.from(JSON.stringify(canonical), 'utf8'))
}

/**
 * Rebuild the production-decision bundle from the live profile and the live
 * gate evidence. The approval record itself is intentionally excluded so the
 * digest is acyclic.
 */
export async function collectApprovalBundle(
  profile: AnimalOnboardingProfile,
  qa: QaReport,
): Promise<ApprovalBundleDigest> {
  const run = resolve(profile.runDirectory)
  const narrations = localizedNarrationAssets(profile.assets)
  const agentReviewPath = resolve(run, 'agent-review.json')
  const agentReview = JSON.parse(await readFile(agentReviewPath, 'utf8')) as unknown
  const requiredPaths = [
    profile.source.sourceModelPath,
    ...(profile.source.sourceArchivePath ? [profile.source.sourceArchivePath] : []),
    ...profile.source.evidencePaths,
    profile.model.outputPath,
    profile.model.normalizedBlendPath,
    profile.model.normalizationLogPath,
    profile.model.landmarksPath,
    profile.assets.backgroundLandscapePath,
    profile.assets.backgroundPortraitPath,
    profile.assets.backgroundEvidencePath,
    profile.assets.posterPath,
    ...(profile.assets.posterPortraitPath
      ? [profile.assets.posterPortraitPath]
      : []),
    profile.assets.thumbnailPath,
    ...(['zh-CN', 'en'] as const).flatMap((locale) => {
      const narration = narrations[locale]
      return narration
        ? [
            narration.path,
            narration.scriptPath,
            narration.metricsPath ?? `${profile.runDirectory}/narration.${locale}.metrics.json`,
          ]
        : []
    }),
    resolve(run, 'review-contract.json'),
    resolve(run, 'stage-lock.json'),
    resolve(run, 'asset-inspection.json'),
    resolve(run, 'asset-risk-route.json'),
    resolve(run, 'browser-capture-plan.json'),
    resolve(run, 'browser-capture-evidence.json'),
    resolve(run, 'browser-capture-validation.json'),
    agentReviewPath,
    resolve(run, 'agent-review.md'),
    resolve(run, 'owner-model-review.md'),
    resolve(run, 'model-lock.json'),
    resolve(run, 'derivative-images.json'),
    resolve(`src/review/animals/${profile.id}/content.zh-CN.ts`),
    resolve(`src/review/animals/${profile.id}/content.en.ts`),
    resolve(`src/review/animals/${profile.id}/package.ts`),
    ...qa.gates.flatMap(({ evidence }) => evidence ?? []),
    ...agentReviewEvidencePaths(agentReview),
  ]
  const l3AcceptancePath = resolve(run, 'l3-acceptance.json')
  const l3Entry = await lstat(l3AcceptancePath).catch(() => null)
  if (l3Entry !== null) requiredPaths.push(l3AcceptancePath)

  // The validator report is regenerated with a run timestamp during every
  // current QA evaluation. Its result is recomputed at promotion, so hashing
  // that mutable cache would invalidate an otherwise unchanged decision.
  const mutableQaArtifacts = new Set([resolve(run, 'glb-validator.json')])
  const unique = [
    ...new Set(
      requiredPaths
        .map((path) => resolve(path))
        .filter((path) => !mutableQaArtifacts.has(path)),
    ),
  ].sort()
  const files = await Promise.all(unique.map(secureFileDigest))
  return {
    algorithm: 'sha256',
    sha256: canonicalApprovalBundleSha256(files),
    files,
  }
}

export function approvalBundlesEqual(
  left: ApprovalBundleDigest,
  right: ApprovalBundleDigest,
): boolean {
  return (
    left.algorithm === right.algorithm &&
    left.sha256 === right.sha256 &&
    JSON.stringify(left.files) === JSON.stringify(right.files)
  )
}
