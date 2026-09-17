import {
  lstat,
  mkdir,
  readFile,
  realpath,
  rmdir,
  stat,
} from 'node:fs/promises'
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path'

import { MODEL_BUDGET_POLICY } from './budget-policy'
import { fileDigest, sha256, writeJson, writeText } from './io'
import {
  parseReviewContract,
  stringifyReviewContract,
  type ReviewContract,
} from './review-contract'
import {
  parseAssetInspection,
  type AssetInspection,
} from './risk-routing'
import type { BrowserCapturePlanInput } from './browser-capture'

const animalIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const runsRootPath = '.handoff/animal-onboarding-runs'

export interface InitializeAnimalRunOptions {
  readonly animalId: string
  readonly sourcePath: string
  readonly runDirectory?: string
  /** Primarily useful to callers and tests; the CLI uses process.cwd(). */
  readonly repositoryRoot?: string
}

export interface InitializedAnimalRun {
  readonly animalId: string
  readonly runDirectory: string
  readonly candidateDirectory: string
  readonly source: {
    readonly path: string
    readonly bytes: number
    readonly sha256: string
  }
  readonly files: Readonly<Record<
    | 'sourceRecord'
    | 'reviewContract'
    | 'assetInspection'
    | 'capturePlanInput'
    | 'profile',
    string
  >>
}

function portablePath(path: string): string {
  return path.split(sep).join('/')
}

function isStrictChild(path: string, parent: string): boolean {
  const child = relative(parent, path)
  return (
    child.length > 0 &&
    child !== '..' &&
    !child.startsWith(`..${sep}`) &&
    !isAbsolute(child)
  )
}

async function ensureSafeDirectoryRoot(
  repositoryRoot: string,
  relativePath: string,
  label: string,
): Promise<string> {
  let current = repositoryRoot
  for (const part of relativePath.split('/')) {
    current = resolve(current, part)
    const entry = await lstat(current).catch(() => null)
    if (entry !== null && (!entry.isDirectory() || entry.isSymbolicLink())) {
      throw new Error(`${label} must not contain symlinks or files`)
    }
    if (entry === null) await mkdir(current)
  }
  const [realRepositoryRoot, realCurrent] = await Promise.all([
    realpath(repositoryRoot),
    realpath(current),
  ])
  if (!isStrictChild(realCurrent, realRepositoryRoot)) {
    throw new Error(`${label} must not resolve outside the repository`)
  }
  return current
}

function primaryFormat(
  sourcePath: string,
): AssetInspection['sourcePackage']['primaryFormat'] {
  const extension = extname(sourcePath).toLowerCase()
  if (extension === '.glb') return 'glb'
  if (extension === '.gltf') return 'gltf'
  if (extension === '.blend') return 'blend'
  if (extension === '.fbx') return 'fbx'
  if (extension === '.obj') return 'obj'
  return 'other'
}

function relativeRunPath(repositoryRoot: string, runDirectory: string): string {
  const result = relative(repositoryRoot, runDirectory)
  if (
    result.length === 0 ||
    result === '..' ||
    result.startsWith(`..${sep}`) ||
    isAbsolute(result)
  ) {
    throw new Error('run directory must remain inside the repository')
  }
  return portablePath(result)
}

function initialReviewContract(
  animalId: string,
  sourceSha256: string,
): ReviewContract {
  return parseReviewContract({
    schemaVersion: 1,
    contractId: `${animalId}-onboarding`,
    animalId,
    baselineAssetSha256: sourceSha256,
    purpose: `Prepare the exact ${animalId} source revision while keeping identity, anatomy and initial presentation subject to explicit review.`,
    targetIssues: [
      {
        id: 'scientific-identity-unverified',
        category: 'scientific-identity',
        severity: 'must-fix',
        verification: 'owner-approval',
        currentProblem: 'The represented taxon and anatomy have not been accepted.',
        expectedOutcome: 'The owner accepts the recorded scientific identity scope and uncertainty.',
        requiredEvidence: ['candidate-scientific-identity'],
      },
      {
        id: 'full-loop-review-required',
        category: 'motion',
        severity: 'must-fix',
        verification: 'agent-visual-pass',
        currentProblem: 'The source has no accepted complete-loop runtime evidence.',
        expectedOutcome: 'Idle is visible, continuous and free of clipping or detached parts across the exact eight-second loop.',
        requiredEvidence: ['candidate-full-loop'],
      },
      {
        id: 'initial-presentation-blocked',
        category: 'presentation',
        severity: 'must-fix',
        verification: 'owner-approval',
        currentProblem: 'Initial camera, head side, framing and safe-area values are starter placeholders.',
        expectedOutcome: 'The owner accepts the initial view and responsive framing for this animal.',
        requiredEvidence: ['candidate-presentation'],
      },
    ],
    invariants: [
      {
        id: 'anatomy-remains-intact',
        category: 'anatomy',
        statement: 'Limb and appendage count, left/right identity and facial attachments remain intact.',
        verification: 'agent-visual-pass',
        baselineEvidence: ['baseline-multiview'],
        candidateEvidence: ['candidate-multiview'],
      },
    ],
    stateSequences: [
      {
        id: 'initial-and-closest-view',
        category: 'interaction',
        verification: 'machine-pass',
        given: {
          state: 'viewer-opened',
          assertions: ['The declared initial camera state is active.'],
        },
        when: {
          action: 'Zoom to the closest allowed distance.',
          conditions: ['The final GLB is loaded and its digest is verified.'],
        },
        then: {
          state: 'closest-view-reached',
          assertions: ['The model remains framed without changing the declared initial state.'],
        },
        requiredEvidence: ['runtime-camera-states'],
      },
    ],
    evidenceRequirements: [
      {
        id: 'baseline-multiview',
        category: 'anatomy',
        kind: 'still',
        stage: 'baseline',
        description: 'Source front, left and right structure views.',
        requiredFor: 'agent-visual-pass',
        perspectives: ['front', 'left', 'right'],
        sampleTimesSeconds: [0],
        fullCycle: false,
      },
      {
        id: 'candidate-scientific-identity',
        category: 'scientific-identity',
        kind: 'human-review',
        stage: 'candidate',
        description: 'Owner review of the represented taxon, anatomy scope and uncertainty.',
        requiredFor: 'owner-approval',
        perspectives: ['source-record'],
        sampleTimesSeconds: [0],
        fullCycle: false,
      },
      {
        id: 'candidate-full-loop',
        category: 'motion',
        kind: 'frame-sequence',
        stage: 'runtime',
        description: 'Paused runtime frames spanning the exact Idle loop.',
        requiredFor: 'agent-visual-pass',
        perspectives: ['initial', 'opposite', 'rear'],
        sampleTimesSeconds: [0, 2, 4, 6, 8],
        fullCycle: true,
      },
      {
        id: 'candidate-multiview',
        category: 'anatomy',
        kind: 'frame-sequence',
        stage: 'candidate',
        description: 'Candidate structure views from the declared initial, opposite and rear camera angles.',
        requiredFor: 'agent-visual-pass',
        perspectives: ['initial', 'opposite', 'rear'],
        sampleTimesSeconds: [0, 4],
        fullCycle: false,
      },
      {
        id: 'candidate-presentation',
        category: 'presentation',
        kind: 'human-review',
        stage: 'runtime',
        description: 'Owner review of initial camera semantics and responsive framing.',
        requiredFor: 'owner-approval',
        perspectives: ['desktop', 'phone-landscape', 'phone-portrait'],
        sampleTimesSeconds: [0],
        fullCycle: false,
      },
      {
        id: 'runtime-camera-states',
        category: 'interaction',
        kind: 'runtime-state',
        stage: 'runtime',
        description: 'Recorded initial and closest camera states.',
        requiredFor: 'machine-pass',
        perspectives: ['closest', 'initial'],
        sampleTimesSeconds: [],
        fullCycle: false,
      },
    ],
  })
}

function initialCapturePlanInput(
  animalId: string,
  candidateModelPath: string,
): BrowserCapturePlanInput {
  return {
    animalId,
    finalGlbPath: candidateModelPath,
    reviewUrl: `https://blocked.invalid/${animalId}/set-headed-review-url`,
    captureMode: 'review-efficient',
    primaryViewportId: 'desktop',
    primaryCameraAngleId: 'initial',
    auxiliaryCameraAngleIds: ['opposite', 'rear'],
    viewports: [
      { id: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
      {
        id: 'tablet-portrait',
        width: 768,
        height: 1024,
        deviceScaleFactor: 1,
      },
      {
        id: 'phone-portrait',
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
      },
      {
        id: 'phone-compact',
        width: 360,
        height: 640,
        deviceScaleFactor: 1,
      },
      {
        id: 'phone-landscape',
        width: 844,
        height: 390,
        deviceScaleFactor: 1,
      },
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
      actualTimeToleranceSeconds: 0.02,
    },
    stateSequence: [
      {
        id: 'initial',
        kind: 'initial',
        actions: [{ command: 'reset-view' }],
        captureFullLoop: true,
      },
      {
        id: 'closest',
        kind: 'interaction',
        actions: [{ command: 'zoom', delta: -480 }],
      },
    ],
    globalBaseline: {
      id: 'production-golden',
      required: true,
      reportPath: `${runsRootPath}/golden-baseline-report.json`,
    },
  }
}

function initialProfile(
  animalId: string,
  sourcePath: string,
  runDirectory: string,
): Record<string, unknown> {
  const candidateRoot = `assets/candidates/${animalId}`
  const outputRoot = `${candidateRoot}/output`
  return {
    schemaVersion: 1,
    id: animalId,
    status: 'draft',
    source: {
      title: 'BLOCKED_VERIFY_SOURCE_TITLE',
      author: 'BLOCKED_VERIFY_SOURCE_AUTHOR',
      pageUrl: `https://blocked.invalid/${animalId}/verify-direct-source`,
      licenseId: 'BLOCKED-VERIFY-LICENSE',
      licenseName: 'BLOCKED_VERIFY_LICENSE_NAME',
      licenseUrl: `https://blocked.invalid/${animalId}/verify-license`,
      accessedOn: '0000-00-00',
      directSourceVerified: false,
      downloadAllowed: false,
      modificationAllowed: false,
      redistributionAllowed: false,
      sourceModelPath: sourcePath,
      evidencePaths: [`${runDirectory}/source-record.json`],
    },
    science: {
      displayName: 'BLOCKED_VERIFY_DISPLAY_NAME',
      classificationLabel: 'BLOCKED_VERIFY_CLASSIFICATION',
      identityScope: 'BLOCKED_VERIFY_SCIENTIFIC_IDENTITY',
      confidence: 'low',
      sourceUrls: [
        `https://blocked.invalid/${animalId}/verify-scientific-identity`,
      ],
      uncertaintyNotes: [
        'BLOCKED: confirm the represented taxon, anatomy and evidence sources before model work.',
      ],
      humanReviewStatus: 'pending',
    },
    model: {
      inputPath: sourcePath,
      outputPath: `${outputRoot}/model.glb`,
      normalizedBlendPath: `${candidateRoot}/working/normalized.blend`,
      normalizationLogPath: `${candidateRoot}/evidence/normalization.json`,
      landmarksPath: `${candidateRoot}/evidence/landmarks.json`,
      normalizationStrategy: 'BLOCKED_UNSELECTED_NORMALIZATION_STRATEGY',
      animationStrategy: {
        mode: 'BLOCKED_UNSELECTED_ANIMATION_STRATEGY',
        sourceArmature: 'BLOCKED_UNINSPECTED_SOURCE_ARMATURE',
        sourceAnimation: 'BLOCKED_UNINSPECTED_SOURCE_ANIMATION',
        destructiveReplacementAccepted: false,
        reason: 'BLOCKED: inspect the source rig and animation before selecting a processing strategy.',
      },
      habitat: 'BLOCKED_UNSELECTED_HABITAT',
      motionProfile: 'BLOCKED_UNSELECTED_MOTION_PROFILE',
      mouthMotion: {
        mode: 'disabled',
        reason: 'BLOCKED: inspect mouth topology and rig before enabling mouth motion.',
      },
      tailAxisSign: 'BLOCKED_UNSELECTED_TAIL_AXIS_SIGN',
      animationRequired: true,
      expectedClip: 'Idle',
      targetBytes: MODEL_BUDGET_POLICY.targets.bytes,
      maxBytes: MODEL_BUDGET_POLICY.reviewCeilings.bytes,
      maxTriangles: MODEL_BUDGET_POLICY.reviewCeilings.triangles,
      maxDrawCalls: MODEL_BUDGET_POLICY.reviewCeilings.drawCalls,
      maxMaterials: MODEL_BUDGET_POLICY.reviewCeilings.materials,
      maxBones: MODEL_BUDGET_POLICY.reviewCeilings.bones,
    },
    presentation: {
      initialYawDegrees: 'BLOCKED_UNSELECTED_INITIAL_YAW',
      initialHeadSide: 'BLOCKED_UNSELECTED_INITIAL_HEAD_SIDE',
      safeAreaPadding: 0.12,
      portraitSafeAreaPadding: 0.14,
      shadow: 'BLOCKED_UNSELECTED_SHADOW_POLICY',
      shadowOpacity: 'BLOCKED_UNSELECTED_SHADOW_OPACITY',
      shadowScale: 'BLOCKED_UNSELECTED_SHADOW_SCALE',
    },
    assets: {
      backgroundLandscapePath: `${outputRoot}/background-landscape.webp`,
      backgroundPortraitPath: `${outputRoot}/background-portrait.webp`,
      backgroundEvidencePath: `${runDirectory}/background-evidence.json`,
      posterPath: `${outputRoot}/poster.webp`,
      posterPortraitPath: `${outputRoot}/poster-portrait.webp`,
      thumbnailPath: `${outputRoot}/thumbnail.webp`,
      audioHumanReviewStatus: 'pending',
    },
    runDirectory,
    proposedCollectionIndex: -1,
    approvals: {
      scientific: false,
      visual: false,
      motion: false,
      audio: false,
      audioByLocale: { 'zh-CN': false, en: false },
      production: false,
    },
  }
}

export async function initializeAnimalRun(
  options: InitializeAnimalRunOptions,
): Promise<InitializedAnimalRun> {
  if (!animalIdPattern.test(options.animalId)) {
    throw new Error('animal-id must be a lowercase kebab-case identifier')
  }

  const repositoryRoot = resolve(options.repositoryRoot ?? process.cwd())
  const sourcePath = resolve(repositoryRoot, options.sourcePath)
  const sourceStat = await stat(sourcePath).catch(() => null)
  if (!sourceStat?.isFile() || sourceStat.size <= 0) {
    throw new Error('source must resolve to a non-empty regular file')
  }

  const runsRoot = resolve(repositoryRoot, runsRootPath)
  const runDirectory = resolve(
    repositoryRoot,
    options.runDirectory ?? `${runsRootPath}/${options.animalId}`,
  )
  if (!isStrictChild(runDirectory, runsRoot)) {
    throw new Error(`run directory must remain under ${runsRootPath}/`)
  }
  if (basename(runDirectory) !== options.animalId) {
    throw new Error('run directory basename must exactly match animal-id')
  }
  const existingRun = await lstat(runDirectory).catch(() => null)
  if (existingRun !== null) {
    throw new Error(`run directory already exists; refusing overwrite: ${runDirectory}`)
  }
  const candidatesRoot = resolve(repositoryRoot, 'assets/candidates')
  const candidateDirectory = resolve(candidatesRoot, options.animalId)
  if (
    !isStrictChild(candidateDirectory, candidatesRoot) ||
    basename(candidateDirectory) !== options.animalId
  ) {
    throw new Error('candidate directory must be an exact animal-id workspace')
  }
  const existingCandidate = await lstat(candidateDirectory).catch(() => null)
  if (existingCandidate !== null) {
    throw new Error(
      `candidate directory already exists; refusing overwrite: ${candidateDirectory}`,
    )
  }

  const portableRunDirectory = relativeRunPath(repositoryRoot, runDirectory)
  const sourceDigest = await fileDigest(sourcePath)
  const candidateModelPath = `assets/candidates/${options.animalId}/output/model.glb`
  const contract = initialReviewContract(options.animalId, sourceDigest.sha256)
  const contractText = stringifyReviewContract(contract)
  const reviewContractSha256 = sha256(Buffer.from(contractText, 'utf8'))
  const sourceRecordPath = `${portableRunDirectory}/source-record.json`
  const reviewContractPath = `${portableRunDirectory}/review-contract.json`

  const sourceRecord = {
    schemaVersion: 1,
    kind: 'animal-onboarding-source-record',
    animalId: options.animalId,
    source: {
      path: sourcePath,
      bytes: sourceDigest.bytes,
      sha256: sourceDigest.sha256,
    },
    requirementsTemplate: {
      reviewContractPath: resolve(runDirectory, 'review-contract.json'),
      reviewContractSha256,
      targetIssuesSha256: sha256(
        Buffer.from(JSON.stringify(contract.targetIssues), 'utf8'),
      ),
      invariantsSha256: sha256(
        Buffer.from(JSON.stringify(contract.invariants), 'utf8'),
      ),
      evidenceRequirementsSha256: sha256(
        Buffer.from(JSON.stringify(contract.evidenceRequirements), 'utf8'),
      ),
    },
    blockingPlaceholders: [
      {
        id: 'source-rights',
        resolved: false,
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
        resolved: false,
        fields: ['science', 'reviewContract.invariants'],
      },
      {
        id: 'requirements-contract',
        resolved: false,
        fields: [
          'reviewContract.targetIssues',
          'reviewContract.invariants',
          'reviewContract.evidenceRequirements',
        ],
      },
      {
        id: 'presentation',
        resolved: false,
        fields: [
          'presentation',
          'capturePlanInput.reviewUrl',
          'capturePlanInput.cameraAngles',
        ],
      },
    ],
  }

  const inspection = parseAssetInspection({
    schemaVersion: 1,
    animalId: options.animalId,
    inspectionId: `${options.animalId}-source-v1`,
    sourcePackage: {
      modelPresent: true,
      directSourceVerified: false,
      modificationAllowed: false,
      redistributionAllowed: false,
      primaryFormat: primaryFormat(sourcePath),
      runtimeReadyGlb: false,
      editableSource: false,
      texturesComplete: false,
      topology: 'unknown',
      semanticParts: 'unknown',
      rig: 'unverified',
      skinWeights: 'unverified',
      animations: 'unverified',
      transparency: 'unknown',
      evidencePaths: [sourceRecordPath],
    },
    plannedOperations: ['axis-scale-normalization', 'presentation-tuning'],
    knownIssues: [
      {
        id: 'scientific-identity-unverified',
        category: 'scientific-identity',
        severity: 'must-fix',
        scope: 'unknown',
        description: 'BLOCKED: confirm the represented animal identity and anatomy.',
        reviewContractBinding: {
          subjectType: 'target-issue',
          subjectId: 'scientific-identity-unverified',
          evidenceRequirementIds: ['candidate-scientific-identity'],
        },
      },
      {
        id: 'presentation-unverified',
        category: 'presentation',
        severity: 'must-fix',
        scope: 'unknown',
        description: 'BLOCKED: replace starter camera and framing values with reviewed values.',
        reviewContractBinding: {
          subjectType: 'target-issue',
          subjectId: 'initial-presentation-blocked',
          evidenceRequirementIds: ['candidate-presentation'],
        },
      },
    ],
    executionControls: {
      l3Acceptance: {
        status: 'not-accepted',
        acceptedBy: null,
        acceptedOn: null,
        recordPath: null,
        recordSha256: null,
        acceptedReviewContractSha256: null,
      },
      parallelRequested: false,
      animalWorkspacePath: portableRunDirectory,
      stageLockId: null,
      stageLockPath: null,
      stageLockSha256: null,
      reviewContractPath,
      reviewContractSha256,
    },
  })
  const capturePlanInput = initialCapturePlanInput(
    options.animalId,
    candidateModelPath,
  )
  const profile = initialProfile(
    options.animalId,
    sourcePath,
    portableRunDirectory,
  )

  await ensureSafeDirectoryRoot(repositoryRoot, runsRootPath, runsRootPath)
  await ensureSafeDirectoryRoot(
    repositoryRoot,
    'assets/candidates',
    'assets/candidates',
  )

  const parentParts = relative(runsRoot, dirname(runDirectory))
    .split(sep)
    .filter((part) => part.length > 0)
  let currentParent = runsRoot
  for (const part of parentParts) {
    currentParent = resolve(currentParent, part)
    const entry = await lstat(currentParent).catch(() => null)
    if (entry !== null && (!entry.isDirectory() || entry.isSymbolicLink())) {
      throw new Error('run directory parent must not contain symlinks or files')
    }
    if (entry === null) await mkdir(currentParent)
  }
  await mkdir(candidateDirectory)
  try {
    await mkdir(runDirectory)
  } catch (error) {
    await rmdir(candidateDirectory).catch(() => undefined)
    throw error
  }
  const files = {
    sourceRecord: resolve(runDirectory, 'source-record.json'),
    reviewContract: resolve(runDirectory, 'review-contract.json'),
    assetInspection: resolve(runDirectory, 'asset-inspection.json'),
    capturePlanInput: resolve(runDirectory, 'capture-plan-input.json'),
    profile: resolve(runDirectory, 'profile.json'),
  } as const
  await Promise.all([
    writeJson(files.sourceRecord, sourceRecord),
    writeText(files.reviewContract, contractText),
    writeJson(files.assetInspection, inspection),
    writeJson(files.capturePlanInput, capturePlanInput),
    writeJson(files.profile, profile),
  ])

  // Verify that the bytes on disk still match the contract digest bound above.
  const writtenContract = await readFile(files.reviewContract)
  if (sha256(writtenContract) !== reviewContractSha256) {
    throw new Error('review contract digest changed while initializing the run')
  }
  const finalSourceDigest = await fileDigest(sourcePath)
  if (
    finalSourceDigest.bytes !== sourceDigest.bytes ||
    finalSourceDigest.sha256 !== sourceDigest.sha256
  ) {
    throw new Error('source changed while initializing the run')
  }

  return {
    animalId: options.animalId,
    runDirectory,
    candidateDirectory,
    source: {
      path: sourcePath,
      bytes: sourceDigest.bytes,
      sha256: sourceDigest.sha256,
    },
    files,
  }
}
