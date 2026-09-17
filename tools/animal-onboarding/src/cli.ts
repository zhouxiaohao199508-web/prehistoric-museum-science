#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  captureGolden,
  regressGolden,
  verifyProductionBaseline,
} from './baseline'
import {
  ingestBrowserCaptureEvidenceFiles,
  parseBrowserCapturePlanInput,
  writeBrowserCapturePlan,
} from './browser-capture'
import {
  createAgentReviewTemplate,
  validateAgentVisualReview,
} from './agent-review'
import { runDoctor } from './doctor'
import {
  convertBackgrounds,
  deriveReviewImages,
} from './derive-assets.mjs'
import { recordOwnerApproval } from './approval'
import { assertSecureRepositoryOutputPath } from './approval-bundle'
import { fileDigest, regularFile, writeJson, writeText } from './io'
import {
  loadProfile,
  scoreCandidate,
} from './profile'
import {
  buildPromotionManifest,
  planPromotionBatch,
  promoteBatch,
  verifyPromotionDryRun,
  verifyPromotionInstalled,
} from './promotion'
import { runQa } from './qa'
import {
  loadReviewContract,
  stringifyReviewContract,
} from './review-contract'
import {
  parseAssetInspection,
  prepareAssetRiskEvidenceManifest,
  routeAssetRiskWithVerifiedRecords,
  verifyAssetRiskEvidenceManifest,
} from './risk-routing'
import {
  prepareOwnerModelReview,
  recordModelLock,
  verifyModelLock,
} from './model-lock'
import { createStageLock, recordL3Acceptance } from './stage-lock'
import { initializeAnimalRun } from './run-init'
import type { CandidateIntake, PromotionManifest } from './types'

const args = process.argv.slice(2)
const command = args[0] ?? 'help'
const goldenPath = resolve(
  '.handoff/animal-onboarding-runs/golden-baseline.json',
)
const goldenReportPath = resolve(
  '.handoff/animal-onboarding-runs/golden-baseline-report.json',
)

function printHelp(): void {
  console.log(`animal-onboarding

Commands:
  doctor [--out <doctor.json>]
  run init <animal-id> --source <source-model-path> [--run <run-directory>]
  baseline verify
  intake score <intake.json> [--out <ranking.json>]
  contract validate <review-contract.json> [--out <normalized.json>]
  stage-lock create <animal-id> <review-contract.json> --workspace <run-directory> --out <stage-lock.json>
  l3-acceptance record <animal-id> <review-contract.json> --workspace <run-directory> --out <record.json> --by <owner> --on <YYYY-MM-DD> [--stage-lock <stage-lock.json>]
  risk route <asset-inspection.json> [--out <asset-risk-route.json>]
  risk evidence prepare <asset-inspection.json> <asset-risk-route.json> [--out <risk-evidence-manifest.json>]
  risk evidence verify <asset-inspection.json> <asset-risk-route.json> [--manifest <risk-evidence-manifest.json>]
  capture plan <capture-plan-input.json> [--out <capture-plan.json>]
  capture ingest <capture-plan.json> <capture-evidence.json> [--out <validation.json>]
  derive backgrounds <profile.json>
  derive images <profile.json> --desktop <capture.png> --portrait <capture.png> --bounds <x,y,width,height>
  qa <profile.json> [--model-only]
  review agent init <profile.json> <capture-evidence.json> --out <agent-review.json>
  review agent validate <profile.json> <capture-evidence.json> <agent-review.json>
  review owner prepare <profile.json> <capture-evidence.json> <agent-review.json>
  model-lock record <profile.json> <capture-evidence.json> <agent-review.json> --by <owner> --on <YYYY-MM-DD>
  model-lock verify <profile.json>
  review prepare <profile.json>
  approval record <profile.json...> --by <owner> --on <YYYY-MM-DD>
  promote <profile.json> [--dry-run]
  promote verify <profile.json>
  promote-batch <profile.json...> [--dry-run] [--collection main] [--out <result.json>]
  golden capture
  golden regress
`)
}

function option(name: string): string | undefined {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function positionals(
  start: number,
  valueOptions: readonly string[],
  flags: readonly string[],
): string[] {
  const result: string[] = []
  for (let index = start; index < args.length; index += 1) {
    const entry = args[index]
    if (flags.includes(entry)) continue
    if (valueOptions.includes(entry)) {
      index += 1
      continue
    }
    result.push(entry)
  }
  return result
}

async function promotionInput(profilePath: string): Promise<{
  readonly profile: Awaited<ReturnType<typeof loadProfile>>
  readonly manifest: PromotionManifest
}> {
  const profile = await loadProfile(profilePath)
  const manifest = JSON.parse(
    await readFile(
      resolve(profile.runDirectory, 'promotion-manifest.json'),
      'utf8',
    ),
  ) as PromotionManifest
  return { profile, manifest }
}

async function main(): Promise<number> {
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp()
    return 0
  }
  if (command === 'baseline' && args[1] === 'verify') {
    const result = await verifyProductionBaseline()
    console.log(JSON.stringify(result, null, 2))
    return result.pass ? 0 : 4
  }
  if (command === 'doctor') {
    const report = await runDoctor()
    const outputPath = option('--out')
    if (outputPath) await writeJson(resolve(outputPath), report)
    console.log(JSON.stringify(report, null, 2))
    return report.exitCode
  }
  if (command === 'run' && args[1] === 'init') {
    const animalId = args[2]
    const sourcePath = option('--source')
    if (!animalId || !sourcePath) {
      throw new Error('run init requires animal-id and --source')
    }
    const result = await initializeAnimalRun({
      animalId,
      sourcePath,
      runDirectory: option('--run'),
    })
    console.log(JSON.stringify(result, null, 2))
    return 0
  }
  if (command === 'golden' && args[1] === 'capture') {
    await captureGolden(goldenPath)
    console.log(`Captured read-only golden baseline: ${goldenPath}`)
    return 0
  }
  if (command === 'golden' && args[1] === 'regress') {
    const result = await regressGolden(goldenPath)
    await writeJson(goldenReportPath, result)
    console.log(JSON.stringify(result, null, 2))
    return result.pass ? 0 : 4
  }
  if (command === 'intake' && args[1] === 'score') {
    const inputPath = args[2]
    if (!inputPath) throw new Error('intake score requires an input JSON path')
    const parsed = JSON.parse(await readFile(resolve(inputPath), 'utf8')) as
      | CandidateIntake[]
      | { candidates: CandidateIntake[] }
    const candidates = Array.isArray(parsed) ? parsed : parsed.candidates
    if (!Array.isArray(candidates) || candidates.length < 1) {
      throw new Error('intake JSON must contain candidates')
    }
    const results = candidates
      .map((candidate) => ({
        ...scoreCandidate(candidate),
        displayName: candidate.displayName,
        sourceUrl: candidate.sourceUrl,
        notes: candidate.notes ?? [],
      }))
      .sort((left, right) => right.score - left.score)
    const idCounts = new Map<string, number>()
    for (const { id } of results) {
      idCounts.set(id, (idCounts.get(id) ?? 0) + 1)
    }
    const duplicateIds = [...idCounts]
      .filter(([, count]) => count > 1)
      .map(([id]) => id)
    const uniqueCandidateCount = idCounts.size
    const outputPath = option('--out')
    const decisionReportPath = outputPath
      ? outputPath.replace(/\.json$/i, '') + '.md'
      : undefined
    const output = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      candidateCount: results.length,
      uniqueCandidateCount,
      minimumUniqueCandidateCount: 8,
      duplicateIds,
      batchStructurePass:
        uniqueCandidateCount >= 8 && duplicateIds.length === 0,
      decisionReportPath,
      results,
    }
    if (outputPath) {
      await writeJson(resolve(outputPath), output)
      await writeText(
        resolve(decisionReportPath!),
        `# Candidate intake decisions

- Candidates: ${results.length}
- Unique candidates: ${uniqueCandidateCount}
- Minimum unique candidates: 8
- Duplicate IDs: ${duplicateIds.join(', ') || 'none'}

| Rank | Candidate | Score | Rights | Decision | Hard failure / evidence note |
| ---: | --- | ---: | --- | --- | --- |
${results
  .map(
    (result, index) =>
      `| ${index + 1} | ${result.displayName} (\`${result.id}\`) | ${result.score} | ${result.rightsPass ? 'pass' : 'fail'} | ${result.disposition} | ${[...result.hardFailureReasons, ...result.notes].join('; ').replaceAll('|', '\\|') || '—'} |`,
  )
  .join('\n')}

Scores rank candidates only. A rights/source/model hard failure cannot be
offset by points, and \`hold\`/\`reject\` candidates do not enter local review.
`,
      )
    }
    console.log(JSON.stringify(output, null, 2))
    return !output.batchStructurePass ||
      results.some(({ rightsPass }) => !rightsPass)
      ? 1
      : 0
  }
  if (command === 'contract' && args[1] === 'validate') {
    const inputPath = args[2]
    if (!inputPath) {
      throw new Error('contract validate requires a review-contract JSON path')
    }
    const contract = await loadReviewContract(inputPath)
    const outputPath = option('--out')
    if (outputPath) {
      await writeText(resolve(outputPath), stringifyReviewContract(contract))
    }
    console.log(JSON.stringify(contract, null, 2))
    return 0
  }
  if (command === 'stage-lock' && args[1] === 'create') {
    const animalId = args[2]
    const contractPath = args[3]
    const workspacePath = option('--workspace')
    const outputPath = option('--out')
    if (!animalId || !contractPath || !workspacePath || !outputPath) {
      throw new Error(
        'stage-lock create requires animal-id, review contract, --workspace and --out',
      )
    }
    const result = await createStageLock(
      animalId,
      workspacePath,
      contractPath,
      outputPath,
    )
    console.log(JSON.stringify(result, null, 2))
    return 0
  }
  if (command === 'l3-acceptance' && args[1] === 'record') {
    const animalId = args[2]
    const contractPath = args[3]
    const workspacePath = option('--workspace')
    const outputPath = option('--out')
    const acceptedBy = option('--by')
    const acceptedOn = option('--on')
    const stageLockPath = option('--stage-lock')
    if (
      !animalId ||
      !contractPath ||
      !workspacePath ||
      !outputPath ||
      !acceptedBy ||
      !acceptedOn
    ) {
      throw new Error(
        'l3-acceptance record requires animal-id, review contract, --workspace, --out, --by and --on',
      )
    }
    const result = await recordL3Acceptance(
      animalId,
      workspacePath,
      contractPath,
      outputPath,
      acceptedBy,
      acceptedOn,
      stageLockPath ?? resolve(workspacePath, 'stage-lock.json'),
    )
    console.log(JSON.stringify(result, null, 2))
    return 0
  }
  if (command === 'risk' && args[1] === 'route') {
    const inputPath = args[2]
    if (!inputPath) {
      throw new Error('risk route requires an asset-inspection JSON path')
    }
    const inspectionSource = JSON.parse(
      await readFile(resolve(inputPath), 'utf8'),
    ) as unknown
    const inspection = parseAssetInspection(inspectionSource)
    const route = await routeAssetRiskWithVerifiedRecords(inspection)
    const outputPath =
      option('--out') ?? resolve(inputPath, '..', 'asset-risk-route.json')
    await writeJson(resolve(outputPath), route)
    console.log(JSON.stringify(route, null, 2))
    return route.canStart ? 0 : 1
  }
  if (command === 'risk' && args[1] === 'evidence' && args[2] === 'prepare') {
    const inspectionPath = args[3]
    const routePath = args[4]
    if (!inspectionPath || !routePath) {
      throw new Error(
        'risk evidence prepare requires asset-inspection and asset-risk-route JSON paths',
      )
    }
    const manifest = await prepareAssetRiskEvidenceManifest(
      inspectionPath,
      routePath,
      option('--out') ?? resolve(inspectionPath, '..', 'risk-evidence-manifest.json'),
    )
    console.log(JSON.stringify(manifest, null, 2))
    return 0
  }
  if (command === 'risk' && args[1] === 'evidence' && args[2] === 'verify') {
    const inspectionPath = args[3]
    const routePath = args[4]
    if (!inspectionPath || !routePath) {
      throw new Error(
        'risk evidence verify requires asset-inspection and asset-risk-route JSON paths',
      )
    }
    const completion = await verifyAssetRiskEvidenceManifest(
      inspectionPath,
      routePath,
      option('--manifest') ??
        resolve(inspectionPath, '..', 'risk-evidence-manifest.json'),
    )
    console.log(JSON.stringify(completion, null, 2))
    return completion.pass ? 0 : 1
  }
  if (command === 'capture' && args[1] === 'plan') {
    const inputPath = args[2]
    if (!inputPath) {
      throw new Error('capture plan requires a capture-plan-input JSON path')
    }
    const golden = await regressGolden(goldenPath)
    await writeJson(goldenReportPath, golden)
    if (!golden.pass) {
      throw new Error(
        `capture plan requires a passing machine golden baseline: ${golden.errors.join('; ')}`,
      )
    }
    const input = parseBrowserCapturePlanInput(
      JSON.parse(await readFile(resolve(inputPath), 'utf8')) as unknown,
    )
    const outputPath =
      option('--out') ?? resolve(inputPath, '..', 'browser-capture-plan.json')
    const plan = await writeBrowserCapturePlan(resolve(outputPath), input)
    console.log(JSON.stringify(plan, null, 2))
    return 0
  }
  if (command === 'capture' && args[1] === 'ingest') {
    const planPath = args[2]
    const evidencePath = args[3]
    if (!planPath || !evidencePath) {
      throw new Error(
        'capture ingest requires a capture plan and headed-browser evidence JSON',
      )
    }
    const report = await ingestBrowserCaptureEvidenceFiles(
      planPath,
      evidencePath,
    )
    const outputPath =
      option('--out') ??
      resolve(evidencePath, '..', 'browser-capture-validation.json')
    await writeJson(resolve(outputPath), report)
    console.log(JSON.stringify(report, null, 2))
    return report.pass ? 0 : 1
  }
  if (command === 'derive' && args[1] === 'backgrounds') {
    const profilePath = args[2]
    if (!profilePath) {
      throw new Error('derive backgrounds requires a profile path')
    }
    const lock = await verifyModelLock(profilePath)
    if (!lock.pass) {
      throw new Error(`derive backgrounds requires a current model lock: ${lock.errors.join('; ')}`)
    }
    const profile = await loadProfile(profilePath)
    const result = await convertBackgrounds(profile)
    console.log(JSON.stringify(result, null, 2))
    return 0
  }
  if (command === 'derive' && args[1] === 'images') {
    const profilePath = args[2]
    const desktopPath = option('--desktop')
    const portraitPath = option('--portrait')
    const rawBounds = option('--bounds')
    if (!profilePath || !desktopPath || !portraitPath || !rawBounds) {
      throw new Error(
        'derive images requires profile, --desktop, --portrait and --bounds x,y,width,height',
      )
    }
    const lock = await verifyModelLock(profilePath)
    if (!lock.pass) {
      throw new Error(`derive images requires a current model lock: ${lock.errors.join('; ')}`)
    }
    const bounds = rawBounds.split(',').map(Number)
    if (
      bounds.length !== 4 ||
      bounds.some((value) => !Number.isFinite(value)) ||
      (bounds[2] ?? 0) <= 0 ||
      (bounds[3] ?? 0) <= 0
    ) {
      throw new Error('--bounds must be four finite values with positive width and height')
    }
    const profile = await loadProfile(profilePath)
    if (!profile.assets.posterPortraitPath) {
      throw new Error('derive images requires assets.posterPortraitPath')
    }
    await deriveReviewImages({
      profile: {
        assets: {
          posterPath: profile.assets.posterPath,
          posterPortraitPath: profile.assets.posterPortraitPath,
          thumbnailPath: profile.assets.thumbnailPath,
        },
      },
      screenshotPath: desktopPath,
      portraitScreenshotPath: portraitPath,
      modelBounds: {
        x: bounds[0],
        y: bounds[1],
        width: bounds[2],
        height: bounds[3],
      },
    })
    const result = {
      poster: await fileDigest(resolve(profile.assets.posterPath)),
      posterPortrait: await fileDigest(
        resolve(profile.assets.posterPortraitPath),
      ),
      thumbnail: await fileDigest(resolve(profile.assets.thumbnailPath)),
    }
    await writeJson(
      resolve(profile.runDirectory, 'derivative-images.json'),
      result,
    )
    console.log(JSON.stringify(result, null, 2))
    return 0
  }
  if (command === 'qa') {
    const profilePath = args[1]
    if (!profilePath) throw new Error('qa requires a profile path')
    if (args.includes('--autofix')) {
      throw new Error(
        'qa --autofix was removed because QA must not create downstream promotion artifacts; use review prepare after the preceding locks pass.',
      )
    }
    const report = await runQa(profilePath, !args.includes('--model-only'))
    console.log(JSON.stringify(report, null, 2))
    return report.automatedPass ? 0 : 1
  }
  if (command === 'review' && args[1] === 'agent' && args[2] === 'init') {
    const profilePath = args[3]
    const capturePath = args[4]
    const outputPath = option('--out')
    if (!profilePath || !capturePath || !outputPath) {
      throw new Error(
        'review agent init requires profile, capture evidence and --out',
      )
    }
    const template = await createAgentReviewTemplate(
      profilePath,
      capturePath,
      outputPath,
    )
    console.log(JSON.stringify(template, null, 2))
    return 0
  }
  if (
    command === 'review' &&
    args[1] === 'agent' &&
    args[2] === 'validate'
  ) {
    const profilePath = args[3]
    const capturePath = args[4]
    const reviewPath = args[5]
    if (!profilePath || !capturePath || !reviewPath) {
      throw new Error(
        'review agent validate requires profile, capture evidence and agent review',
      )
    }
    const result = await validateAgentVisualReview(
      profilePath,
      capturePath,
      reviewPath,
    )
    console.log(JSON.stringify(result, null, 2))
    return result.pass ? 0 : 1
  }
  if (
    command === 'review' &&
    args[1] === 'owner' &&
    args[2] === 'prepare'
  ) {
    const profilePath = args[3]
    const capturePath = args[4]
    const reviewPath = args[5]
    if (!profilePath || !capturePath || !reviewPath) {
      throw new Error(
        'review owner prepare requires profile, capture evidence and agent review',
      )
    }
    const result = await prepareOwnerModelReview(
      profilePath,
      capturePath,
      reviewPath,
    )
    console.log(
      JSON.stringify(
        {
          ready: result.ready,
          outputPath: result.outputPath,
          errors: result.errors,
          modelQa: {
            path: result.modelQa.path,
            sha256: result.modelQa.sha256,
            decisionSha256: result.modelQa.decisionSha256,
          },
        },
        null,
        2,
      ),
    )
    return result.ready ? 0 : 1
  }
  if (command === 'model-lock' && args[1] === 'record') {
    const profilePath = args[2]
    const capturePath = args[3]
    const reviewPath = args[4]
    const approvedBy = option('--by')
    const approvedOn = option('--on')
    if (
      !profilePath ||
      !capturePath ||
      !reviewPath ||
      !approvedBy ||
      !approvedOn
    ) {
      throw new Error(
        'model-lock record requires profile, capture evidence, agent review, --by and --on',
      )
    }
    const record = await recordModelLock(
      profilePath,
      capturePath,
      reviewPath,
      approvedBy,
      approvedOn,
    )
    console.log(JSON.stringify(record, null, 2))
    return 0
  }
  if (command === 'model-lock' && args[1] === 'verify') {
    const profilePath = args[2]
    if (!profilePath) throw new Error('model-lock verify requires a profile')
    const result = await verifyModelLock(profilePath)
    console.log(JSON.stringify(result, null, 2))
    return result.pass ? 0 : 1
  }
  if (command === 'review' && args[1] === 'prepare') {
    const profilePath = args[2]
    if (!profilePath) throw new Error('review prepare requires a profile path')
    const report = await runQa(profilePath, true)
    const profile = await loadProfile(profilePath)
    const manifest = await buildPromotionManifest(
      profile,
      profilePath,
      resolve(profile.runDirectory, 'qa.json'),
    )
    await writeJson(
      resolve(profile.runDirectory, 'promotion-manifest.json'),
      manifest,
    )
    console.log(
      JSON.stringify(
        {
          animalId: profile.id,
          automatedPass: report.automatedPass,
          localDraftReady: report.localDraftReady,
          ownerApproved: report.ownerApproved,
          manifest: `${profile.runDirectory}/promotion-manifest.json`,
        },
        null,
        2,
      ),
    )
    return report.localDraftReady ? 0 : 1
  }
  if (command === 'approval' && args[1] === 'record') {
    const profilePaths = positionals(2, ['--by', '--on'], [])
    const approvedBy = option('--by')
    const approvedOn = option('--on')
    if (profilePaths.length === 0 || !approvedBy || !approvedOn) {
      throw new Error(
        'approval record requires profile path(s), --by and --on',
      )
    }
    const records = []
    for (const profilePath of profilePaths) {
      records.push(
        await recordOwnerApproval(profilePath, approvedBy, approvedOn),
      )
    }
    console.log(JSON.stringify({ records }, null, 2))
    return 0
  }
  if (command === 'promote' && args[1] === 'verify') {
    const profilePath = args[2]
    if (!profilePath) throw new Error('promote verify requires a profile path')
    const profile = await loadProfile(profilePath)
    const manifestPath = resolve(
      profile.runDirectory,
      'promotion-manifest.json',
    )
    const manifest = JSON.parse(
      await readFile(manifestPath, 'utf8'),
    ) as PromotionManifest
    const result = await regularFile(
      resolve(manifest.productionDirectory, 'animal.ts'),
    )
      ? await verifyPromotionInstalled(manifest)
      : await verifyPromotionDryRun(manifest)
    console.log(JSON.stringify(result, null, 2))
    return result.code
  }
  if (command === 'promote') {
    const profilePath = args[1]
    if (!profilePath) throw new Error('promote requires a profile path')
    const input = await promotionInput(profilePath)
    const dryRun = args.includes('--dry-run')
    const resultPath = await assertSecureRepositoryOutputPath(
      resolve(
        input.profile.runDirectory,
        dryRun ? 'promotion-dry-run.json' : 'promotion-result.json',
      ),
      `${input.profile.id}: promotion command result`,
    )
    const plan = await planPromotionBatch([input], 'main')
    const output = dryRun
      ? plan
      : plan.pass
        ? await promoteBatch([input], 'main')
        : plan
    if (dryRun || !plan.pass) await writeJson(resultPath, output)
    console.log(JSON.stringify(output, null, 2))
    return output.code
  }
  if (command === 'promote-batch') {
    const dryRun = args.includes('--dry-run')
    const collection = option('--collection') ?? 'main'
    const outputPath =
      option('--out') ??
      `.handoff/animal-onboarding-runs/promotion-batch${dryRun ? '-dry-run' : ''}.json`
    const paths = positionals(
      1,
      ['--out', '--collection'],
      ['--dry-run'],
    )
    if (paths.length === 0) {
      throw new Error('promote-batch requires one or more profile paths')
    }
    const secureOutputPath = await assertSecureRepositoryOutputPath(
      resolve(outputPath),
      'promotion batch result',
    )
    const inputs = []
    for (const path of paths) {
      inputs.push(await promotionInput(path))
    }
    const plan = await planPromotionBatch(inputs, collection)
    const output = dryRun
      ? plan
      : plan.pass
        ? await promoteBatch(inputs, collection)
        : plan
    await writeJson(
      secureOutputPath,
      output,
    )
    console.log(JSON.stringify(output, null, 2))
    return output.code
  }
  throw new Error(`Unknown command: ${args.join(' ')}`)
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`animal-onboarding: ${message}`)
    process.exitCode = 2
  })
