import {
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { fileDigest } from '../src/io'
import { loadProfile } from '../src/profile'
import {
  loadReviewContract,
  stringifyReviewContract,
} from '../src/review-contract'
import { parseAssetInspection, routeAssetRisk } from '../src/risk-routing'
import { initializeAnimalRun } from '../src/run-init'
import { createStageLock } from '../src/stage-lock'

async function repository(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'animal-run-init-'))
}

describe('animal run initialization', () => {
  it('writes a hash-bound starter package whose semantic defaults stay blocked', async () => {
    const root = await repository()
    const sourcePath = join(root, 'incoming', 'spinosaurus.glb')
    await mkdir(join(root, 'incoming'))
    await writeFile(sourcePath, Buffer.from('deterministic-glb-fixture'))

    const result = await initializeAnimalRun({
      animalId: 'spinosaurus',
      sourcePath,
      repositoryRoot: root,
    })

    expect(result.runDirectory).toBe(
      join(root, '.handoff/animal-onboarding-runs/spinosaurus'),
    )
    expect(result.candidateDirectory).toBe(
      join(root, 'assets/candidates/spinosaurus'),
    )
    expect((await lstat(result.candidateDirectory)).isDirectory()).toBe(true)
    expect(Object.keys(result.files).sort()).toEqual([
      'assetInspection',
      'capturePlanInput',
      'profile',
      'reviewContract',
      'sourceRecord',
    ])

    const digest = await fileDigest(sourcePath)
    const sourceRecord = JSON.parse(
      await readFile(result.files.sourceRecord, 'utf8'),
    ) as {
      source: { path: string; bytes: number; sha256: string }
      blockingPlaceholders: Array<{ id: string; resolved: boolean }>
    }
    expect(sourceRecord.source).toEqual({
      path: sourcePath,
      bytes: digest.bytes,
      sha256: digest.sha256,
    })
    expect(sourceRecord.blockingPlaceholders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'source-rights', resolved: false }),
        expect.objectContaining({
          id: 'scientific-identity',
          resolved: false,
        }),
        expect.objectContaining({ id: 'presentation', resolved: false }),
        expect.objectContaining({
          id: 'requirements-contract',
          resolved: false,
        }),
      ]),
    )

    const contract = await loadReviewContract(result.files.reviewContract)
    expect(contract.animalId).toBe('spinosaurus')
    expect(contract.baselineAssetSha256).toBe(digest.sha256)
    expect(
      contract.targetIssues.find(
        ({ id }) => id === 'initial-presentation-blocked',
      )?.verification,
    ).toBe('owner-approval')
    expect(
      contract.evidenceRequirements.find(
        ({ id }) => id === 'candidate-full-loop',
      )?.perspectives,
    ).toEqual(['initial', 'opposite', 'rear'])
    expect(
      contract.evidenceRequirements.find(
        ({ id }) => id === 'candidate-multiview',
      )?.perspectives,
    ).toEqual(['initial', 'opposite', 'rear'])

    const inspection = parseAssetInspection(
      JSON.parse(await readFile(result.files.assetInspection, 'utf8')),
    )
    expect(inspection.sourcePackage).toMatchObject({
      modelPresent: true,
      directSourceVerified: false,
      modificationAllowed: false,
      redistributionAllowed: false,
      primaryFormat: 'glb',
    })
    expect(inspection.executionControls.reviewContractSha256).toBe(
      (await fileDigest(result.files.reviewContract)).sha256,
    )
    const route = routeAssetRisk(inspection)
    expect(route.canStart).toBe(false)
    expect(route.blockingReasons).toEqual(
      expect.arrayContaining([
        'The direct source has not been verified.',
        'The recorded source rights do not allow modification.',
        'The recorded source rights do not allow redistribution.',
        'Scientific identity must be resolved before asset work starts.',
      ]),
    )

    await expect(loadProfile(result.files.profile)).rejects.toThrow(
      /unresolved semantic selection/,
    )
    const starterProfile = JSON.parse(
      await readFile(result.files.profile, 'utf8'),
    ) as unknown as Record<string, unknown> & {
      model: Record<string, unknown>
      presentation: Record<string, unknown>
    }
    expect(starterProfile.model).toMatchObject({
      normalizationStrategy: 'BLOCKED_UNSELECTED_NORMALIZATION_STRATEGY',
      habitat: 'BLOCKED_UNSELECTED_HABITAT',
      motionProfile: 'BLOCKED_UNSELECTED_MOTION_PROFILE',
      tailAxisSign: 'BLOCKED_UNSELECTED_TAIL_AXIS_SIGN',
    })
    expect(starterProfile.presentation).toMatchObject({
      initialHeadSide: 'BLOCKED_UNSELECTED_INITIAL_HEAD_SIDE',
      shadow: 'BLOCKED_UNSELECTED_SHADOW_POLICY',
    })
    starterProfile.model = {
      ...starterProfile.model,
      normalizationStrategy: 'replace-with-project-morph',
      animationStrategy: {
        mode: 'replace-with-project-morph',
        sourceArmature: 'absent',
        sourceAnimation: 'absent',
        destructiveReplacementAccepted: false,
        reason: 'The inspected source has no rig or animation.',
      },
      habitat: 'land',
      motionProfile: 'land-breathe-tail',
      tailAxisSign: 1,
    }
    starterProfile.presentation = {
      ...starterProfile.presentation,
      initialYawDegrees: -35,
      initialHeadSide: 'left',
      shadow: 'ground',
      shadowOpacity: 0.4,
      shadowScale: 0.5,
    }
    await writeFile(result.files.profile, JSON.stringify(starterProfile))
    const profile = await loadProfile(result.files.profile)
    expect(profile.id).toBe('spinosaurus')
    expect(profile.runDirectory).toBe(
      '.handoff/animal-onboarding-runs/spinosaurus',
    )
    expect(profile.source.sourceModelPath).toBe(sourcePath)
    expect(profile.source.directSourceVerified).toBe(false)
    expect(profile.science.humanReviewStatus).toBe('pending')
    expect(profile.approvals.production).toBe(false)
    expect(profile.model).toMatchObject({
      outputPath: 'assets/candidates/spinosaurus/output/model.glb',
      maxBytes: 20 * 1024 * 1024,
      maxTriangles: 120_000,
      maxDrawCalls: 24,
      maxMaterials: 16,
      maxBones: 160,
    })

    const captureInput = JSON.parse(
      await readFile(result.files.capturePlanInput, 'utf8'),
    ) as {
      animalId: string
      finalGlbPath: string
      reviewUrl: string
      animation: { sampleTimesSeconds: number[] }
    }
    expect(captureInput).toMatchObject({
      animalId: 'spinosaurus',
      finalGlbPath: 'assets/candidates/spinosaurus/output/model.glb',
      reviewUrl:
        'https://blocked.invalid/spinosaurus/set-headed-review-url',
    })
    expect(captureInput.animation.sampleTimesSeconds).toEqual([0, 2, 4, 6, 8])
  })

  it('refuses to overwrite an existing animal run', async () => {
    const root = await repository()
    const sourcePath = join(root, 'source.glb')
    await writeFile(sourcePath, Buffer.from('source'))
    const options = {
      animalId: 'baryonyx',
      sourcePath,
      repositoryRoot: root,
    } as const
    const first = await initializeAnimalRun(options)
    const before = await readFile(first.files.sourceRecord, 'utf8')

    await expect(initializeAnimalRun(options)).rejects.toThrow(
      'refusing overwrite',
    )
    expect(await readFile(first.files.sourceRecord, 'utf8')).toBe(before)
  })

  it('turns the run-init blockers into a real requirements-lock gate', async () => {
    const root = await repository()
    const sourcePath = join(root, 'source.glb')
    await writeFile(sourcePath, Buffer.from('requirements-source'))
    const initialized = await initializeAnimalRun({
      animalId: 'baryonyx',
      sourcePath,
      repositoryRoot: root,
    })
    const lockPath = join(initialized.runDirectory, 'stage-lock.json')
    await expect(
      createStageLock(
        'baryonyx',
        initialized.runDirectory,
        initialized.files.reviewContract,
        lockPath,
      ),
    ).rejects.toThrow(/unresolved source-record placeholders/)

    const sourceRecord = JSON.parse(
      await readFile(initialized.files.sourceRecord, 'utf8'),
    ) as {
      blockingPlaceholders: Array<{ resolved: boolean }>
    }
    for (const placeholder of sourceRecord.blockingPlaceholders) {
      placeholder.resolved = true
    }
    await writeFile(initialized.files.sourceRecord, JSON.stringify(sourceRecord))
    await expect(
      createStageLock(
        'baryonyx',
        initialized.runDirectory,
        initialized.files.reviewContract,
        lockPath,
      ),
    ).rejects.toThrow(/task-specific sections replace the starter template/)

    const starterContract = await loadReviewContract(
      initialized.files.reviewContract,
    )
    const taskContract = {
      ...starterContract,
      targetIssues: [
        ...starterContract.targetIssues.map((issue) => ({
          ...issue,
          currentProblem: `${issue.currentProblem} Baryonyx-specific inspection has been recorded.`,
        })),
        {
          id: 'baryonyx-snout-contour',
          category: 'anatomy',
          severity: 'must-fix',
          verification: 'agent-visual-pass',
          currentProblem: 'The long snout contour needs animal-specific review.',
          expectedOutcome: 'The reviewed candidate retains the recorded snout contour.',
          requiredEvidence: ['baryonyx-snout-candidate'],
        },
      ],
      invariants: [
        ...starterContract.invariants.map((invariant) => ({
          ...invariant,
          statement: `${invariant.statement} Baryonyx-specific anatomy scope is recorded.`,
        })),
        {
          id: 'baryonyx-tooth-row-intact',
          category: 'anatomy',
          statement: 'The inspected Baryonyx tooth row remains attached and unchanged.',
          verification: 'agent-visual-pass',
          baselineEvidence: ['baryonyx-tooth-baseline'],
          candidateEvidence: ['baryonyx-tooth-candidate'],
        },
      ],
      evidenceRequirements: [
        ...starterContract.evidenceRequirements.map((requirement) => ({
          ...requirement,
          description: `${requirement.description} Baryonyx-specific closure.`,
        })),
        {
          id: 'baryonyx-snout-candidate',
          category: 'anatomy',
          kind: 'still',
          stage: 'candidate',
          description: 'Candidate close view of the Baryonyx snout contour.',
          requiredFor: 'agent-visual-pass',
          perspectives: ['initial'],
          sampleTimesSeconds: [0],
          fullCycle: false,
        },
        {
          id: 'baryonyx-tooth-baseline',
          category: 'anatomy',
          kind: 'still',
          stage: 'baseline',
          description: 'Baseline close view of the inspected Baryonyx tooth row.',
          requiredFor: 'agent-visual-pass',
          perspectives: ['initial'],
          sampleTimesSeconds: [0],
          fullCycle: false,
        },
        {
          id: 'baryonyx-tooth-candidate',
          category: 'anatomy',
          kind: 'still',
          stage: 'candidate',
          description: 'Candidate close view of the Baryonyx tooth row.',
          requiredFor: 'agent-visual-pass',
          perspectives: ['initial'],
          sampleTimesSeconds: [0],
          fullCycle: false,
        },
      ],
    }
    await writeFile(
      initialized.files.reviewContract,
      stringifyReviewContract(taskContract),
    )
    await expect(
      createStageLock(
        'baryonyx',
        initialized.runDirectory,
        initialized.files.reviewContract,
        lockPath,
      ),
    ).rejects.toThrow(/profile\.source\.(?:title|directSourceVerified)/)

    const sourceDigest = await fileDigest(sourcePath)
    const rights = {
      title: 'Verified Baryonyx source',
      author: 'Fixture Author',
      pageUrl: 'https://example.com/baryonyx',
      licenseId: 'CC0-1.0',
      licenseName: 'CC0 1.0 Universal',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      accessedOn: '2026-08-31',
      directSourceVerified: true,
      downloadAllowed: true,
      modificationAllowed: true,
      redistributionAllowed: true,
    }
    const rightsEvidencePath = join(
      initialized.runDirectory,
      'source-rights-evidence.json',
    )
    await writeFile(
      rightsEvidencePath,
      JSON.stringify({
        schemaVersion: 1,
        kind: 'source-rights-evidence',
        animalId: 'baryonyx',
        source: { ...rights, modelSha256: sourceDigest.sha256 },
      }),
    )
    const profile = JSON.parse(
      await readFile(initialized.files.profile, 'utf8'),
    ) as Record<string, Record<string, unknown>>
    Object.assign(profile.source, rights, { evidencePaths: [rightsEvidencePath] })
    Object.assign(profile.science, {
      displayName: '重爪龙',
      classificationLabel: 'Baryonychinae',
      identityScope: 'Baryonyx walkeri source representation',
      confidence: 'medium',
      sourceUrls: ['https://example.com/baryonyx/science'],
      uncertaintyNotes: ['Source representation remains subject to visual proof.'],
      humanReviewStatus: 'pending',
    })
    Object.assign(profile.presentation, {
      initialYawDegrees: -35,
      initialHeadSide: 'left',
      shadow: 'ground',
      shadowOpacity: 0.4,
      shadowScale: 0.6,
    })
    await writeFile(initialized.files.profile, JSON.stringify(profile))
    const captureInput = JSON.parse(
      await readFile(initialized.files.capturePlanInput, 'utf8'),
    ) as Record<string, unknown>
    captureInput.reviewUrl = 'http://127.0.0.1:4173/'
    await writeFile(
      initialized.files.capturePlanInput,
      JSON.stringify(captureInput),
    )
    await expect(
      createStageLock(
        'baryonyx',
        initialized.runDirectory,
        initialized.files.reviewContract,
        lockPath,
      ),
    ).resolves.toMatchObject({
      record: {
        animalId: 'baryonyx',
        sourceRecord: { path: initialized.files.sourceRecord },
        sourceAsset: { path: sourcePath },
      },
    })
  })

  it('refuses an existing candidate workspace before creating the run', async () => {
    const root = await repository()
    const sourcePath = join(root, 'source.glb')
    const candidateDirectory = join(root, 'assets/candidates/baryonyx')
    const runDirectory = join(
      root,
      '.handoff/animal-onboarding-runs/baryonyx',
    )
    await writeFile(sourcePath, Buffer.from('source'))
    await mkdir(candidateDirectory, { recursive: true })
    await writeFile(join(candidateDirectory, 'keep.txt'), 'owner data')

    await expect(
      initializeAnimalRun({
        animalId: 'baryonyx',
        sourcePath,
        repositoryRoot: root,
      }),
    ).rejects.toThrow('candidate directory already exists; refusing overwrite')
    expect(await readFile(join(candidateDirectory, 'keep.txt'), 'utf8')).toBe(
      'owner data',
    )
    await expect(lstat(runDirectory)).rejects.toThrow()
  })

  it('requires a non-empty regular source file', async () => {
    const root = await repository()
    const directorySource = join(root, 'source-directory')
    const emptySource = join(root, 'empty.glb')
    await mkdir(directorySource)
    await writeFile(emptySource, '')

    await expect(
      initializeAnimalRun({
        animalId: 'archaeopteryx',
        sourcePath: directorySource,
        repositoryRoot: root,
      }),
    ).rejects.toThrow('non-empty regular file')
    await expect(
      initializeAnimalRun({
        animalId: 'archaeopteryx',
        sourcePath: emptySource,
        repositoryRoot: root,
      }),
    ).rejects.toThrow('non-empty regular file')
  })

  it('contains custom paths and binds the basename to the animal id', async () => {
    const root = await repository()
    const sourcePath = join(root, 'source.glb')
    await writeFile(sourcePath, Buffer.from('source'))

    await expect(
      initializeAnimalRun({
        animalId: 'Anomalocaris',
        sourcePath,
        repositoryRoot: root,
      }),
    ).rejects.toThrow('lowercase kebab-case')
    await expect(
      initializeAnimalRun({
        animalId: 'anomalocaris',
        sourcePath,
        runDirectory: '../anomalocaris',
        repositoryRoot: root,
      }),
    ).rejects.toThrow('must remain under')
    await expect(
      initializeAnimalRun({
        animalId: 'anomalocaris',
        sourcePath,
        runDirectory:
          '.handoff/animal-onboarding-runs/review-batch/wrong-animal',
        repositoryRoot: root,
      }),
    ).rejects.toThrow('basename must exactly match')

    const nested = await initializeAnimalRun({
      animalId: 'anomalocaris',
      sourcePath,
      runDirectory:
        '.handoff/animal-onboarding-runs/review-batch/anomalocaris',
      repositoryRoot: root,
    })
    expect(nested.runDirectory).toBe(
      join(
        root,
        '.handoff/animal-onboarding-runs/review-batch/anomalocaris',
      ),
    )
    const profile = JSON.parse(
      await readFile(nested.files.profile, 'utf8'),
    ) as { runDirectory: string }
    expect(profile.runDirectory).toBe(
      '.handoff/animal-onboarding-runs/review-batch/anomalocaris',
    )
  })

  it('does not follow a symlinked run parent outside the repository', async () => {
    const root = await repository()
    const external = await repository()
    const sourcePath = join(root, 'source.glb')
    const runsRoot = join(root, '.handoff/animal-onboarding-runs')
    await writeFile(sourcePath, Buffer.from('source'))
    await mkdir(runsRoot, { recursive: true })
    await symlink(external, join(runsRoot, 'linked-parent'))

    await expect(
      initializeAnimalRun({
        animalId: 'carnotaurus',
        sourcePath,
        runDirectory:
          '.handoff/animal-onboarding-runs/linked-parent/carnotaurus',
        repositoryRoot: root,
      }),
    ).rejects.toThrow('must not contain symlinks or files')
    await expect(lstat(join(external, 'carnotaurus'))).rejects.toThrow()
  })

  it('refuses a symlinked candidate workspace or candidate root', async () => {
    const root = await repository()
    const external = await repository()
    const sourcePath = join(root, 'source.glb')
    const candidatesRoot = join(root, 'assets/candidates')
    await writeFile(sourcePath, Buffer.from('source'))
    await mkdir(candidatesRoot, { recursive: true })
    await symlink(external, join(candidatesRoot, 'oviraptor'))

    await expect(
      initializeAnimalRun({
        animalId: 'oviraptor',
        sourcePath,
        repositoryRoot: root,
      }),
    ).rejects.toThrow('candidate directory already exists; refusing overwrite')

    const secondRoot = await repository()
    const secondSourcePath = join(secondRoot, 'source.glb')
    const externalCandidates = await repository()
    await writeFile(secondSourcePath, Buffer.from('source'))
    await mkdir(join(secondRoot, 'assets'))
    await symlink(externalCandidates, join(secondRoot, 'assets/candidates'))
    await expect(
      initializeAnimalRun({
        animalId: 'oviraptor',
        sourcePath: secondSourcePath,
        repositoryRoot: secondRoot,
      }),
    ).rejects.toThrow('assets/candidates must not contain symlinks or files')
    await expect(lstat(join(externalCandidates, 'oviraptor'))).rejects.toThrow()
  })
})
