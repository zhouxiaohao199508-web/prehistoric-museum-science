import {
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { modelMetricGates, sourceRiskRouteGate } from '../src/gates'
import {
  IDLE_DURATION_FLOAT_TOLERANCE_SECONDS,
  idleDurationMatchesContract,
  verifySourceBaseline,
} from '../src/model-contract'
import { initializeAnimalRun } from '../src/run-init'
import { routeAssetRiskWithVerifiedRecords } from '../src/risk-routing'
import type {
  AnimalOnboardingProfile,
  GlbInspection,
} from '../src/types'

function runtimeProfile(animationRequired = true): AnimalOnboardingProfile {
  return {
    model: {
      animationRequired,
      expectedClip: 'Idle',
      mouthMotion: { mode: 'disabled', reason: 'test fixture' },
    },
  } as AnimalOnboardingProfile
}

function inspection(durationSeconds: number): GlbInspection {
  return {
    version: 2,
    declaredBytes: 1024,
    animationNames: ['Idle'],
    animationDurations: [durationSeconds],
    externalUris: [],
    triangles: 100,
    drawCalls: 1,
    materials: 1,
    bones: 1,
    meshes: 1,
    textures: 1,
  }
}

function runtimeIdleStatus(
  durationSeconds: number,
  animationRequired = true,
): string | undefined {
  return modelMetricGates(
    runtimeProfile(animationRequired),
    inspection(durationSeconds),
  ).find(
    ({ id }) => id === 'runtime-idle',
  )?.status
}

describe('exact runtime Idle contract', () => {
  it.each([7.5, 7.96, 8.04])(
    'rejects a material duration deviation at %s seconds',
    (durationSeconds) => {
      expect(idleDurationMatchesContract(durationSeconds)).toBe(false)
      expect(runtimeIdleStatus(durationSeconds)).toBe('fail')
    },
  )

  it.each([
    8,
    8 - IDLE_DURATION_FLOAT_TOLERANCE_SECONDS / 2,
    8 + IDLE_DURATION_FLOAT_TOLERANCE_SECONDS / 2,
  ])('accepts eight seconds with only encoding noise at %s', (durationSeconds) => {
    expect(idleDurationMatchesContract(durationSeconds)).toBe(true)
    expect(runtimeIdleStatus(durationSeconds)).toBe('pass')
  })

  it('rejects values beyond the explicit float-noise tolerance', () => {
    const duration = 8 + IDLE_DURATION_FLOAT_TOLERANCE_SECONDS * 2
    expect(idleDurationMatchesContract(duration)).toBe(false)
    expect(runtimeIdleStatus(duration)).toBe('fail')
  })

  it('cannot bypass an invalid exported Idle by toggling animationRequired', () => {
    expect(runtimeIdleStatus(7.5, false)).toBe('fail')
  })
})

describe('source baseline integrity', () => {
  it('rejects a normalizer input that bypasses the rights-verified source path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'source-input-binding-'))
    const sourcePath = join(root, 'incoming', 'microraptor.glb')
    const substitutedPath = join(root, 'incoming', 'substituted.glb')
    await mkdir(join(root, 'incoming'))
    await writeFile(sourcePath, 'rights-verified bytes')
    await writeFile(substitutedPath, 'rights-verified bytes')
    const initialized = await initializeAnimalRun({
      animalId: 'microraptor',
      sourcePath,
      repositoryRoot: root,
    })
    const profile = JSON.parse(
      await readFile(initialized.files.profile, 'utf8'),
    ) as AnimalOnboardingProfile
    const substituted = {
      ...profile,
      model: { ...profile.model, inputPath: substitutedPath },
    }

    const result = await verifySourceBaseline(
      substituted,
      initialized.files.reviewContract,
    )
    expect(result.pass).toBe(false)
    expect(result.errors.join('; ')).toMatch(/model input path is not/)
  })

  it('detects source replacement after initialization', async () => {
    const root = await mkdtemp(join(tmpdir(), 'source-baseline-'))
    const sourcePath = join(root, 'incoming', 'baryonyx.glb')
    await mkdir(join(root, 'incoming'))
    await writeFile(sourcePath, 'original source bytes')
    const initialized = await initializeAnimalRun({
      animalId: 'baryonyx',
      sourcePath,
      repositoryRoot: root,
    })
    const profile = JSON.parse(
      await readFile(initialized.files.profile, 'utf8'),
    ) as AnimalOnboardingProfile

    const before = await verifySourceBaseline(
      profile,
      initialized.files.reviewContract,
    )
    expect(before).toMatchObject({
      pass: true,
      sourceModelSha256: before.baselineAssetSha256,
    })

    await writeFile(sourcePath, 'changed source bytes')
    const after = await verifySourceBaseline(
      profile,
      initialized.files.reviewContract,
    )
    expect(after.pass).toBe(false)
    expect(after.errors).toContain(
      'source model SHA-256 no longer matches reviewContract.baselineAssetSha256',
    )

    const inspection = JSON.parse(
      await readFile(initialized.files.assetInspection, 'utf8'),
    ) as {
      executionControls: {
        animalWorkspacePath: string
        reviewContractPath: string
      }
      sourcePackage: { evidencePaths: string[] }
    }
    inspection.executionControls.animalWorkspacePath = initialized.runDirectory
    inspection.executionControls.reviewContractPath =
      initialized.files.reviewContract
    inspection.sourcePackage.evidencePaths = [initialized.files.sourceRecord]
    await writeFile(
      initialized.files.assetInspection,
      `${JSON.stringify(inspection, null, 2)}\n`,
    )
    const route = await routeAssetRiskWithVerifiedRecords(inspection)
    await writeFile(
      join(initialized.runDirectory, 'asset-risk-route.json'),
      `${JSON.stringify(route, null, 2)}\n`,
    )
    const sourceGate = await sourceRiskRouteGate({
      ...profile,
      runDirectory: initialized.runDirectory,
    })
    expect(sourceGate.status).toBe('fail')
    expect(sourceGate.summary).toMatch(/no longer matches/)
    expect(sourceGate.measured?.sourceBaselineMatches).toBe(false)
  })

  it('does not accept a symlink substituted for the initialized source path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'source-baseline-symlink-'))
    const sourcePath = join(root, 'incoming', 'archaeopteryx.glb')
    const replacementPath = join(root, 'replacement.glb')
    await mkdir(join(root, 'incoming'))
    await writeFile(sourcePath, 'original source bytes')
    await writeFile(replacementPath, 'original source bytes')
    const initialized = await initializeAnimalRun({
      animalId: 'archaeopteryx',
      sourcePath,
      repositoryRoot: root,
    })
    const profile = JSON.parse(
      await readFile(initialized.files.profile, 'utf8'),
    ) as AnimalOnboardingProfile

    await unlink(sourcePath)
    await symlink(replacementPath, sourcePath)
    const verification = await verifySourceBaseline(
      profile,
      initialized.files.reviewContract,
    )
    expect(verification.pass).toBe(false)
    expect(verification.errors.join('; ')).toMatch(/non-symlink/)
  })
})
