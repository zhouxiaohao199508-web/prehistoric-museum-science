import {
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { fileDigest } from '../src/io'
import {
  prepareAssetRiskEvidenceManifest,
  routeAssetRiskWithVerifiedRecords,
  verifyAssetRiskEvidenceManifest,
} from '../src/risk-routing'
import {
  createStageLock,
  loadStageLockRecord,
  parseSourceRecord,
  recordL3Acceptance,
} from '../src/stage-lock'

async function contract(path: string): Promise<void> {
  const workspace = dirname(path)
  const sourcePath = join(workspace, 'source.glb')
  await writeFile(sourcePath, 'source-model')
  const sourceDigest = await fileDigest(sourcePath)
  await writeFile(
    path,
    JSON.stringify({
      schemaVersion: 1,
      contractId: 'test-animal-contract',
      animalId: 'test-animal',
      baselineAssetSha256: sourceDigest.sha256,
      purpose: 'Test one isolated animal.',
      targetIssues: [
        {
          id: 'visible-idle',
          category: 'motion',
          severity: 'must-fix',
          currentProblem: 'No accepted loop.',
          expectedOutcome: 'Accepted loop.',
          verification: 'agent-visual-pass',
          requiredEvidence: ['loop-evidence'],
        },
      ],
      invariants: [
        {
          id: 'limbs-intact',
          category: 'anatomy',
          statement: 'Limbs remain intact.',
          verification: 'agent-visual-pass',
          baselineEvidence: ['baseline-anatomy-evidence'],
          candidateEvidence: ['candidate-anatomy-evidence'],
        },
      ],
      stateSequences: [
        {
          id: 'open-viewer',
          category: 'interaction',
          given: { state: 'closed', assertions: ['Viewer is closed.'] },
          when: { action: 'Open viewer.', conditions: [] },
          then: { state: 'opened', assertions: ['Viewer is open.'] },
          verification: 'machine-pass',
          requiredEvidence: ['interaction-evidence'],
        },
      ],
      evidenceRequirements: [
        {
          id: 'loop-evidence',
          category: 'motion',
          kind: 'full-loop-video',
          stage: 'runtime',
          description: 'Complete loop.',
          requiredFor: 'agent-visual-pass',
          perspectives: ['side'],
          sampleTimesSeconds: [],
          fullCycle: true,
        },
        {
          id: 'baseline-anatomy-evidence',
          category: 'anatomy',
          kind: 'still',
          stage: 'baseline',
          description: 'Baseline anatomy view.',
          requiredFor: 'agent-visual-pass',
          perspectives: ['side'],
          sampleTimesSeconds: [0],
          fullCycle: false,
        },
        {
          id: 'candidate-anatomy-evidence',
          category: 'anatomy',
          kind: 'still',
          stage: 'candidate',
          description: 'Candidate anatomy view.',
          requiredFor: 'agent-visual-pass',
          perspectives: ['side'],
          sampleTimesSeconds: [0],
          fullCycle: false,
        },
        {
          id: 'interaction-evidence',
          category: 'interaction',
          kind: 'runtime-state',
          stage: 'runtime',
          description: 'Viewer open sequence.',
          requiredFor: 'machine-pass',
          perspectives: ['front'],
          sampleTimesSeconds: [0],
          fullCycle: false,
        },
      ],
    }),
  )
  await writeFile(
    join(workspace, 'source-record.json'),
    JSON.stringify({
      schemaVersion: 1,
      kind: 'animal-onboarding-source-record',
      animalId: 'test-animal',
      source: {
        path: sourcePath,
        ...sourceDigest,
      },
      requirementsTemplate: {
        reviewContractPath: path,
        reviewContractSha256: '0'.repeat(64),
        targetIssuesSha256: '1'.repeat(64),
        invariantsSha256: '2'.repeat(64),
        evidenceRequirementsSha256: '3'.repeat(64),
      },
      blockingPlaceholders: [
        {
          id: 'source-rights',
          resolved: true,
          fields: [
            'source.title',
            'source.author',
            'source.pageUrl',
            'source.licenseId',
            'source.licenseName',
            'source.licenseUrl',
            'source.accessedOn',
            'source.directSourceVerified',
            'source.downloadAllowed',
            'source.modificationAllowed',
            'source.redistributionAllowed',
          ],
        },
        {
          id: 'scientific-identity',
          resolved: true,
          fields: ['science', 'reviewContract.invariants'],
        },
        {
          id: 'requirements-contract',
          resolved: true,
          fields: [
            'reviewContract.targetIssues',
            'reviewContract.invariants',
            'reviewContract.evidenceRequirements',
          ],
        },
        {
          id: 'presentation',
          resolved: true,
          fields: [
            'presentation',
            'capturePlanInput.reviewUrl',
            'capturePlanInput.cameraAngles',
          ],
        },
      ],
    }),
  )
  const rights = {
    title: 'Verified test animal source',
    author: 'Fixture Author',
    pageUrl: 'https://example.com/test-animal',
    licenseId: 'CC0-1.0',
    licenseName: 'CC0 1.0 Universal',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    accessedOn: '2026-08-31',
    directSourceVerified: true,
    downloadAllowed: true,
    modificationAllowed: true,
    redistributionAllowed: true,
  }
  const rightsEvidencePath = join(workspace, 'source-rights-evidence.json')
  await writeFile(
    rightsEvidencePath,
    JSON.stringify({
      schemaVersion: 1,
      kind: 'source-rights-evidence',
      animalId: 'test-animal',
      source: { ...rights, modelSha256: sourceDigest.sha256 },
    }),
  )
  await writeFile(
    join(workspace, 'profile.json'),
    JSON.stringify({
      schemaVersion: 1,
      id: 'test-animal',
      status: 'draft',
      runDirectory: workspace,
      source: {
        ...rights,
        sourceModelPath: sourcePath,
        evidencePaths: [rightsEvidencePath],
      },
      science: {
        displayName: 'Test Animal',
        classificationLabel: 'Test clade',
        identityScope: 'Exact fixture identity',
        confidence: 'high',
        sourceUrls: ['https://example.com/test-animal/science'],
        uncertaintyNotes: ['Fixture-only scientific scope.'],
        humanReviewStatus: 'pending',
      },
      model: { outputPath: join(workspace, 'candidate-model.glb') },
      presentation: {
        initialYawDegrees: -35,
        initialHeadSide: 'left',
        safeAreaPadding: 0.12,
        shadow: 'ground',
      },
    }),
  )
  await writeFile(
    join(workspace, 'capture-plan-input.json'),
    JSON.stringify({
      animalId: 'test-animal',
      finalGlbPath: join(workspace, 'candidate-model.glb'),
      reviewUrl: 'http://127.0.0.1:4173/',
      captureMode: 'review-efficient',
      primaryViewportId: 'desktop',
      primaryCameraAngleId: 'initial',
      auxiliaryCameraAngleIds: ['opposite', 'rear'],
      viewports: [
        { id: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
      ],
      cameraAngles: [
        {
          id: 'initial',
          yawDegrees: -35,
          pitchDegrees: 8,
          distance: 4.5,
          target: [0, 0.5, 0],
        },
        {
          id: 'opposite',
          yawDegrees: 145,
          pitchDegrees: 8,
          distance: 4.5,
          target: [0, 0.5, 0],
        },
        {
          id: 'rear',
          yawDegrees: 215,
          pitchDegrees: 8,
          distance: 4.5,
          target: [0, 0.5, 0],
        },
      ],
      animation: {
        clipName: 'Idle',
        durationSeconds: 8,
        sampleTimesSeconds: [0, 2, 4, 6, 8],
      },
      globalBaseline: {
        id: 'production-golden',
        required: true,
        reportPath: join(workspace, 'golden-baseline-report.json'),
      },
    }),
  )
}

function inspection(
  workspace: string,
  lock: Awaited<ReturnType<typeof createStageLock>>,
  acceptance?: Awaited<ReturnType<typeof recordL3Acceptance>>,
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    animalId: 'test-animal',
    inspectionId: 'test-animal-source-v1',
    sourcePackage: {
      modelPresent: true,
      directSourceVerified: true,
      modificationAllowed: true,
      redistributionAllowed: true,
      primaryFormat: 'glb',
      runtimeReadyGlb: true,
      editableSource: true,
      texturesComplete: true,
      topology: 'verified-clean',
      semanticParts: 'complete',
      rig: 'verified',
      skinWeights: 'verified',
      animations: 'verified',
      transparency: 'none',
      evidencePaths: [`${workspace}/source.json`],
    },
    plannedOperations: ['new-rig'],
    knownIssues: [
      {
        id: 'visible-idle-known-issue',
        category: 'motion',
        severity: 'must-fix',
        scope: 'localized',
        description: 'The loop has not yet been accepted.',
        reviewContractBinding: {
          subjectType: 'target-issue',
          subjectId: 'visible-idle',
          evidenceRequirementIds: ['loop-evidence'],
        },
      },
    ],
    executionControls: {
      ...lock.inspectionBindings,
      l3Acceptance: acceptance?.inspectionAcceptance ?? {
        status: 'not-accepted',
        acceptedBy: null,
        acceptedOn: null,
        recordPath: null,
        recordSha256: null,
        acceptedReviewContractSha256: null,
      },
      parallelRequested: true,
    },
  }
}

async function acceptL3(
  workspace: string,
  contractPath: string,
  acceptancePath: string,
  lock: Awaited<ReturnType<typeof createStageLock>>,
): Promise<Awaited<ReturnType<typeof recordL3Acceptance>>> {
  await writeFile(
    join(workspace, 'asset-inspection.json'),
    JSON.stringify(inspection(workspace, lock)),
  )
  return recordL3Acceptance(
    'test-animal',
    workspace,
    contractPath,
    acceptancePath,
    'Leon',
    '2026-08-31',
  )
}

describe('per-animal stage lock', () => {
  it('creates hash bindings and a separate explicit L3 acceptance', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'animal-stage-lock-'))
    const workspace = join(parent, 'test-animal')
    await mkdir(workspace)
    const contractPath = join(workspace, 'review-contract.json')
    const lockPath = join(workspace, 'stage-lock.json')
    const acceptancePath = join(workspace, 'l3-acceptance.json')
    await contract(contractPath)

    const lock = await createStageLock(
      'test-animal',
      workspace,
      contractPath,
      lockPath,
      '2026-08-31T00:00:00.000Z',
    )
    expect(lock.inspectionBindings).toMatchObject({
      stageLockId: 'test-animal-model-stage',
      stageLockPath: lockPath,
      reviewContractPath: contractPath,
    })

    const acceptance = await acceptL3(
      workspace,
      contractPath,
      acceptancePath,
      lock,
    )
    expect(acceptance.inspectionAcceptance).toMatchObject({
      status: 'accepted',
      acceptedBy: 'Leon',
      acceptedOn: '2026-08-31',
      recordPath: acceptancePath,
    })
    const acceptanceRecord = JSON.parse(
      await readFile(acceptancePath, 'utf8'),
    ) as unknown
    expect(
      typeof acceptanceRecord === 'object' &&
        acceptanceRecord !== null &&
        'boundary' in acceptanceRecord &&
        typeof acceptanceRecord.boundary === 'string'
        ? acceptanceRecord.boundary
        : '',
    ).toMatch(/does not approve/)
  })

  it('rejects a lock path outside the animal workspace', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'animal-stage-lock-'))
    const workspace = join(parent, 'test-animal')
    await mkdir(workspace)
    const contractPath = join(workspace, 'review-contract.json')
    await contract(contractPath)
    await expect(
      createStageLock(
        'test-animal',
        workspace,
        contractPath,
        join(parent, 'other-lock.json'),
      ),
    ).rejects.toThrow(/inside the animal workspace/)
  })

  it('refuses unresolved, stale, mismatched or symlinked source requirements', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'animal-stage-lock-'))
    const workspace = join(parent, 'test-animal')
    await mkdir(workspace)
    const contractPath = join(workspace, 'review-contract.json')
    const sourceRecordPath = join(workspace, 'source-record.json')
    await contract(contractPath)
    const initial = JSON.parse(
      await readFile(sourceRecordPath, 'utf8'),
    ) as Record<string, unknown>
    expect(() =>
      parseSourceRecord({ ...initial, untrustedExtraField: true }),
    ).toThrow(/untrustedExtraField is not allowed/)
    const unresolved = structuredClone(initial)
    const placeholders = unresolved.blockingPlaceholders as Array<
      Record<string, unknown>
    >
    placeholders.find(({ id }) => id === 'presentation')!.resolved = false
    await writeFile(sourceRecordPath, JSON.stringify(unresolved))
    await expect(
      createStageLock(
        'test-animal',
        workspace,
        contractPath,
        join(workspace, 'stage-lock.json'),
      ),
    ).rejects.toThrow(/unresolved source-record placeholders.*presentation/)

    const mismatchedAnimal = structuredClone(initial)
    mismatchedAnimal.animalId = 'other-animal'
    await writeFile(sourceRecordPath, JSON.stringify(mismatchedAnimal))
    await expect(
      createStageLock(
        'test-animal',
        workspace,
        contractPath,
        join(workspace, 'stage-lock.json'),
      ),
    ).rejects.toThrow(/source record animalId does not match/)

    const staleSource = structuredClone(initial)
    const staleSourceFields = staleSource.source as Record<string, unknown>
    staleSourceFields.sha256 = 'f'.repeat(64)
    await writeFile(sourceRecordPath, JSON.stringify(staleSource))
    await expect(
      createStageLock(
        'test-animal',
        workspace,
        contractPath,
        join(workspace, 'stage-lock.json'),
      ),
    ).rejects.toThrow(/path, bytes or SHA-256 is stale/)

    const outsideRecord = join(parent, 'outside-source-record.json')
    await writeFile(outsideRecord, JSON.stringify(initial))
    await unlink(sourceRecordPath)
    await symlink(outsideRecord, sourceRecordPath)
    await expect(
      createStageLock(
        'test-animal',
        workspace,
        contractPath,
        join(workspace, 'stage-lock.json'),
      ),
    ).rejects.toThrow(/source record must be a non-symlink regular file/)
  })

  it('does not accept a resolved requirements placeholder while starter sections remain unchanged', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'animal-stage-lock-'))
    const workspace = join(parent, 'test-animal')
    await mkdir(workspace)
    const contractPath = join(workspace, 'review-contract.json')
    const sourceRecordPath = join(workspace, 'source-record.json')
    await contract(contractPath)
    const sourceRecord = JSON.parse(
      await readFile(sourceRecordPath, 'utf8'),
    ) as Record<string, unknown>
    const contractValue = JSON.parse(
      await readFile(contractPath, 'utf8'),
    ) as Record<string, unknown>
    const template = sourceRecord.requirementsTemplate as Record<string, unknown>
    const { createHash } = await import('node:crypto')
    const sectionDigest = (value: unknown) =>
      createHash('sha256').update(JSON.stringify(value)).digest('hex')
    template.targetIssuesSha256 = sectionDigest(contractValue.targetIssues)
    template.invariantsSha256 = sectionDigest(contractValue.invariants)
    template.evidenceRequirementsSha256 = sectionDigest(
      contractValue.evidenceRequirements,
    )
    await writeFile(sourceRecordPath, JSON.stringify(sourceRecord))
    await expect(
      createStageLock(
        'test-animal',
        workspace,
        contractPath,
        join(workspace, 'stage-lock.json'),
      ),
    ).rejects.toThrow(/task-specific sections replace the starter template/)
  })

  it('hash-binds profile, capture input and semantic in-run rights evidence', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'animal-stage-lock-'))
    const workspace = join(parent, 'test-animal')
    await mkdir(workspace)
    const contractPath = join(workspace, 'review-contract.json')
    const lockPath = join(workspace, 'stage-lock.json')
    await contract(contractPath)
    const lock = await createStageLock(
      'test-animal',
      workspace,
      contractPath,
      lockPath,
    )
    expect(lock.record).toMatchObject({
      profile: { path: join(workspace, 'profile.json') },
      capturePlanInput: { path: join(workspace, 'capture-plan-input.json') },
      rightsEvidence: [
        { path: join(workspace, 'source-rights-evidence.json') },
      ],
    })

    const profilePath = join(workspace, 'profile.json')
    const profile = JSON.parse(await readFile(profilePath, 'utf8')) as Record<
      string,
      unknown
    >
    profile.approvals = { production: false }
    await writeFile(profilePath, JSON.stringify(profile))
    await expect(loadStageLockRecord(lockPath)).resolves.toMatchObject({
      animalId: 'test-animal',
    })
    const presentation = profile.presentation as Record<string, unknown>
    presentation.initialHeadSide = 'right'
    await writeFile(profilePath, JSON.stringify(profile))
    await expect(loadStageLockRecord(lockPath)).rejects.toThrow(/stale profile/)
  })

  it('rejects missing, linked or semantically false rights evidence despite resolved flags', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'animal-stage-lock-'))
    const workspace = join(parent, 'test-animal')
    await mkdir(workspace)
    const contractPath = join(workspace, 'review-contract.json')
    const evidencePath = join(workspace, 'source-rights-evidence.json')
    await contract(contractPath)
    const initialEvidence = await readFile(evidencePath, 'utf8')

    await unlink(evidencePath)
    await expect(
      createStageLock(
        'test-animal',
        workspace,
        contractPath,
        join(workspace, 'stage-lock.json'),
      ),
    ).rejects.toThrow(/must be a non-symlink regular file/)

    const outside = join(parent, 'outside-rights.json')
    await writeFile(outside, initialEvidence)
    await symlink(outside, evidencePath)
    await expect(
      createStageLock(
        'test-animal',
        workspace,
        contractPath,
        join(workspace, 'stage-lock.json'),
      ),
    ).rejects.toThrow(/must be a non-symlink regular file/)

    await unlink(evidencePath)
    const falseEvidence = JSON.parse(initialEvidence) as Record<string, unknown>
    ;(falseEvidence.source as Record<string, unknown>).modificationAllowed = false
    await writeFile(evidencePath, JSON.stringify(falseEvidence))
    await expect(
      createStageLock(
        'test-animal',
        workspace,
        contractPath,
        join(workspace, 'stage-lock.json'),
      ),
    ).rejects.toThrow(/modificationAllowed must be true/)
  })

  it('strictly parses and cross-binds every L3 control record', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'animal-stage-lock-'))
    const workspace = join(parent, 'test-animal')
    await mkdir(workspace)
    const contractPath = join(workspace, 'review-contract.json')
    const lockPath = join(workspace, 'stage-lock.json')
    const acceptancePath = join(workspace, 'l3-acceptance.json')
    await contract(contractPath)
    await writeFile(join(workspace, 'source.json'), '{}')
    const lock = await createStageLock(
      'test-animal',
      workspace,
      contractPath,
      lockPath,
    )
    const acceptance = await acceptL3(
      workspace,
      contractPath,
      acceptancePath,
      lock,
    )
    await expect(
      routeAssetRiskWithVerifiedRecords(
        inspection(workspace, lock, acceptance),
      ),
    ).resolves.toMatchObject({
      canStart: true,
      classification: 'L3',
      parallelExecution: 'allowed',
    })
  })

  it('blocks a known issue that does not bind the exact contract evidence closure', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'animal-stage-lock-'))
    const workspace = join(parent, 'test-animal')
    await mkdir(workspace)
    const contractPath = join(workspace, 'review-contract.json')
    const lockPath = join(workspace, 'stage-lock.json')
    const acceptancePath = join(workspace, 'l3-acceptance.json')
    await contract(contractPath)
    const lock = await createStageLock(
      'test-animal',
      workspace,
      contractPath,
      lockPath,
    )
    const acceptance = await acceptL3(
      workspace,
      contractPath,
      acceptancePath,
      lock,
    )
    const value = inspection(workspace, lock, acceptance)
    const issues = value.knownIssues as Array<Record<string, unknown>>
    const binding = issues[0].reviewContractBinding as Record<string, unknown>
    binding.evidenceRequirementIds = ['interaction-evidence']
    const result = await routeAssetRiskWithVerifiedRecords(value)
    expect(result.canStart).toBe(false)
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/does not bind the exact evidence closure/),
      ]),
    )
  })

  it('requires every contract must-fix exactly once and forbids severity downgrade', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'animal-stage-lock-'))
    const workspace = join(parent, 'test-animal')
    await mkdir(workspace)
    const contractPath = join(workspace, 'review-contract.json')
    const lockPath = join(workspace, 'stage-lock.json')
    await contract(contractPath)
    const lock = await createStageLock(
      'test-animal',
      workspace,
      contractPath,
      lockPath,
    )
    const omitted = inspection(workspace, lock)
    omitted.knownIssues = []
    const omittedRoute = await routeAssetRiskWithVerifiedRecords(omitted)
    expect(omittedRoute.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/must-fix target visible-idle is not covered/),
      ]),
    )

    const downgraded = inspection(workspace, lock)
    ;(downgraded.knownIssues as Array<Record<string, unknown>>)[0].severity =
      'warning'
    const downgradedRoute = await routeAssetRiskWithVerifiedRecords(downgraded)
    expect(downgradedRoute.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/cannot be downgraded to warning/),
      ]),
    )

    const duplicated = inspection(workspace, lock)
    const issues = duplicated.knownIssues as Array<Record<string, unknown>>
    issues.push({ ...structuredClone(issues[0]), id: 'duplicate-visible-idle' })
    const duplicateRoute = await routeAssetRiskWithVerifiedRecords(duplicated)
    expect(duplicateRoute.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/must be covered exactly once; found 2/),
      ]),
    )
  })

  it('rejects arbitrary files even when the inspection names their real hashes', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'animal-stage-lock-'))
    const workspace = join(parent, 'test-animal')
    await mkdir(workspace)
    const contractPath = join(workspace, 'review-contract.json')
    const lockPath = join(workspace, 'stage-lock.json')
    const acceptancePath = join(workspace, 'l3-acceptance.json')
    await contract(contractPath)
    await writeFile(join(workspace, 'source.json'), '{}')
    const lock = await createStageLock(
      'test-animal',
      workspace,
      contractPath,
      lockPath,
    )
    const acceptance = await acceptL3(
      workspace,
      contractPath,
      acceptancePath,
      lock,
    )
    await writeFile(lockPath, '{"arbitrary":"same file hash is not authority"}')
    const value = inspection(workspace, lock, acceptance)
    const controls = value.executionControls as Record<string, unknown>
    controls.stageLockSha256 = (await fileDigest(lockPath)).sha256
    const result = await routeAssetRiskWithVerifiedRecords(value)
    expect(result).toMatchObject({ canStart: false, classification: 'blocked' })
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/not a valid stage-lock record/),
      ]),
    )
  })

  it('rejects an acceptance whose owner and lock bindings do not match inspection', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'animal-stage-lock-'))
    const workspace = join(parent, 'test-animal')
    await mkdir(workspace)
    const contractPath = join(workspace, 'review-contract.json')
    const lockPath = join(workspace, 'stage-lock.json')
    const acceptancePath = join(workspace, 'l3-acceptance.json')
    await contract(contractPath)
    await writeFile(join(workspace, 'source.json'), '{}')
    const lock = await createStageLock(
      'test-animal',
      workspace,
      contractPath,
      lockPath,
    )
    const acceptance = await acceptL3(
      workspace,
      contractPath,
      acceptancePath,
      lock,
    )
    const record = JSON.parse(await readFile(acceptancePath, 'utf8')) as Record<
      string,
      unknown
    >
    record.acceptedBy = 'Mallory'
    record.stageLockSha256 = 'f'.repeat(64)
    await writeFile(acceptancePath, JSON.stringify(record))
    const value = inspection(workspace, lock, acceptance)
    const controls = value.executionControls as Record<string, unknown>
    const l3 = controls.l3Acceptance as Record<string, unknown>
    l3.recordSha256 = (await fileDigest(acceptancePath)).sha256
    const result = await routeAssetRiskWithVerifiedRecords(value)
    expect(result.canStart).toBe(false)
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/different or stale stage lock/),
        expect.stringMatching(/owner or date/),
      ]),
    )
  })

  it('binds acceptance to the canonical pre-acceptance route scope', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'animal-stage-lock-'))
    const workspace = join(parent, 'test-animal')
    await mkdir(workspace)
    const contractPath = join(workspace, 'review-contract.json')
    const lockPath = join(workspace, 'stage-lock.json')
    const acceptancePath = join(workspace, 'l3-acceptance.json')
    await contract(contractPath)
    await writeFile(join(workspace, 'source.json'), '{}')
    const lock = await createStageLock(
      'test-animal',
      workspace,
      contractPath,
      lockPath,
    )
    const acceptance = await acceptL3(
      workspace,
      contractPath,
      acceptancePath,
      lock,
    )
    const acceptedInspection = inspection(workspace, lock, acceptance)
    await writeFile(
      join(workspace, 'asset-inspection.json'),
      JSON.stringify(acceptedInspection),
    )
    await expect(
      routeAssetRiskWithVerifiedRecords(acceptedInspection),
    ).resolves.toMatchObject({ canStart: true, underlyingRiskLevel: 'L3' })

    ;(acceptedInspection.plannedOperations as string[]).push(
      'anatomy-reconstruction',
    )
    const tampered = await routeAssetRiskWithVerifiedRecords(acceptedInspection)
    expect(tampered.canStart).toBe(false)
    expect(tampered.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/canonical pre-acceptance inspection revision/),
        expect.stringMatching(/route scope is stale/),
      ]),
    )
  })

  it('records acceptance only into a new safe target and refuses an already accepted inspection', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'animal-stage-lock-'))
    const workspace = join(parent, 'test-animal')
    await mkdir(workspace)
    const contractPath = join(workspace, 'review-contract.json')
    const lockPath = join(workspace, 'stage-lock.json')
    const acceptancePath = join(workspace, 'l3-acceptance.json')
    await contract(contractPath)
    const lock = await createStageLock(
      'test-animal',
      workspace,
      contractPath,
      lockPath,
    )
    const acceptance = await acceptL3(
      workspace,
      contractPath,
      acceptancePath,
      lock,
    )
    await expect(
      recordL3Acceptance(
        'test-animal',
        workspace,
        contractPath,
        acceptancePath,
        'Leon',
        '2026-08-31',
      ),
    ).rejects.toThrow(/already exists/)

    const linkedOutput = join(workspace, 'linked-acceptance.json')
    const outside = join(parent, 'outside-acceptance.json')
    await writeFile(outside, '{}')
    await symlink(outside, linkedOutput)
    await expect(
      recordL3Acceptance(
        'test-animal',
        workspace,
        contractPath,
        linkedOutput,
        'Leon',
        '2026-08-31',
      ),
    ).rejects.toThrow(/already exists/)

    await writeFile(
      join(workspace, 'asset-inspection.json'),
      JSON.stringify(inspection(workspace, lock, acceptance)),
    )
    await expect(
      recordL3Acceptance(
        'test-animal',
        workspace,
        contractPath,
        join(workspace, 'second-acceptance.json'),
        'Leon',
        '2026-08-31',
      ),
    ).rejects.toThrow(/not-accepted inspection/)
  })

  it('does not create an L3 decision for a route below L3', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'animal-stage-lock-'))
    const workspace = join(parent, 'test-animal')
    await mkdir(workspace)
    const contractPath = join(workspace, 'review-contract.json')
    const lockPath = join(workspace, 'stage-lock.json')
    await contract(contractPath)
    const lock = await createStageLock(
      'test-animal',
      workspace,
      contractPath,
      lockPath,
    )
    const l2Inspection = inspection(workspace, lock)
    l2Inspection.plannedOperations = ['reuse-as-is']
    await writeFile(
      join(workspace, 'asset-inspection.json'),
      JSON.stringify(l2Inspection),
    )
    await expect(
      recordL3Acceptance(
        'test-animal',
        workspace,
        contractPath,
        join(workspace, 'l3-acceptance.json'),
        'Leon',
        '2026-08-31',
      ),
    ).rejects.toThrow(/route is not L3/)
  })

  it('requires a hash-bound artifact for every current route evidence ID', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'animal-stage-lock-'))
    const workspace = join(parent, 'test-animal')
    await mkdir(workspace)
    const contractPath = join(workspace, 'review-contract.json')
    const lockPath = join(workspace, 'stage-lock.json')
    const acceptancePath = join(workspace, 'l3-acceptance.json')
    const inspectionPath = join(workspace, 'asset-inspection.json')
    const routePath = join(workspace, 'asset-risk-route.json')
    const manifestPath = join(workspace, 'risk-evidence-manifest.json')
    await contract(contractPath)
    await writeFile(join(workspace, 'source.json'), '{}')
    await writeFile(join(workspace, 'agent-review.json'), '{}')
    const lock = await createStageLock(
      'test-animal',
      workspace,
      contractPath,
      lockPath,
    )
    const acceptance = await acceptL3(
      workspace,
      contractPath,
      acceptancePath,
      lock,
    )
    const acceptedInspection = inspection(workspace, lock, acceptance)
    await writeFile(inspectionPath, JSON.stringify(acceptedInspection))
    const route = await routeAssetRiskWithVerifiedRecords(acceptedInspection)
    await writeFile(routePath, `${JSON.stringify(route, null, 2)}\n`)

    const scaffold = await prepareAssetRiskEvidenceManifest(
      inspectionPath,
      routePath,
    )
    expect(
      scaffold.evidence.find(({ id }) => id === 'review-contract')?.artifacts,
    ).toHaveLength(1)
    expect(
      scaffold.evidence.find(({ id }) => id === 'deformation-stress-evidence')
        ?.artifacts,
    ).toEqual([])
    await unlink(manifestPath)

    const canonical = new Map<string, string>([
      ['baseline-asset-digest', join(workspace, 'source-record.json')],
      ['review-contract', contractPath],
      ['source-package-inventory', inspectionPath],
      ['source-rights-record', join(workspace, 'source-rights-evidence.json')],
      ['stage-lock-record', lockPath],
      ['isolated-workspace-record', lockPath],
      ['owner-l3-acceptance', acceptancePath],
      ['agent-visual-review', join(workspace, 'agent-review.json')],
      ['independent-agent-review', join(workspace, 'agent-review.json')],
    ])
    const evidence: Array<Record<string, unknown>> = []
    for (const id of route.requiredEvidence) {
      let path = canonical.get(id)
      if (!path) {
        path = join(workspace, `risk-evidence-${id}.json`)
        await writeFile(path, JSON.stringify({ id, verified: true }))
      }
      evidence.push({ id, artifacts: [{ path, ...(await fileDigest(path)) }] })
    }
    await writeFile(
      manifestPath,
      JSON.stringify({
        schemaVersion: 1,
        kind: 'animal-risk-evidence-manifest',
        animalId: 'test-animal',
        inspectionPath,
        inspectionSha256: (await fileDigest(inspectionPath)).sha256,
        routePath,
        routeSha256: (await fileDigest(routePath)).sha256,
        evidence,
      }),
    )
    await expect(
      verifyAssetRiskEvidenceManifest(inspectionPath, routePath),
    ).resolves.toMatchObject({
      pass: true,
      missing: [],
      required: route.requiredEvidence,
      satisfied: route.requiredEvidence,
    })

    const manifest = JSON.parse(
      await readFile(manifestPath, 'utf8'),
    ) as { evidence: Array<{ id: string }> }
    manifest.evidence = manifest.evidence.filter(
      ({ id }) => id !== 'rig-and-weight-inventory',
    )
    await writeFile(manifestPath, JSON.stringify(manifest))
    const incomplete = await verifyAssetRiskEvidenceManifest(
      inspectionPath,
      routePath,
    )
    expect(incomplete.pass).toBe(false)
    expect(incomplete.missing).toContain('rig-and-weight-inventory')
  })
})
