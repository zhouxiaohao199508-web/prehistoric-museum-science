import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  groundContactShadowEvidence,
  initialHeadSideEvidence,
  motionVisibilityEvidencePass,
  qwenNarrationEvidencePass,
} from './evidence-metrics'
import { inspectGlbFile } from './glb'
import {
  exceededMetrics,
  MODEL_BUDGET_POLICY,
  requestedModelCeilings,
} from './budget-policy'
import {
  exists,
  fileDigest,
  regularFile,
  sha256,
  writeJson,
} from './io'
import { localizedNarrationAssets } from './profile'
import {
  idleDurationMatchesContract,
  IDLE_DURATION_FLOAT_TOLERANCE_SECONDS,
  IDLE_DURATION_SECONDS,
  verifySourceBaseline,
} from './model-contract'
import { verifyPersistedAssetRiskRoute } from './risk-routing'
import type { PersistedAssetRiskRouteVerification } from './risk-routing'
import {
  verifyBrowserCaptureValidationForProfile,
} from './browser-capture'
import type {
  AnimalOnboardingProfile,
  GateResult,
  GlbInspection,
} from './types'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}
}

function finiteVector(value: unknown): readonly number[] | null {
  return Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
    ? value
    : null
}

function point(value: unknown): readonly number[] | null {
  return finiteVector(asRecord(value).position)
}

export function processingStrategyRiskErrors(
  profile: AnimalOnboardingProfile,
  verification: PersistedAssetRiskRouteVerification,
): string[] {
  const strategy = profile.model.normalizationStrategy
  if (strategy === 'replace-with-project-morph') return []

  const errors: string[] = []
  const route = verification.currentRoute
  const operations = new Set(verification.inspection.plannedOperations)
  const l3 = route.controlBindings
  if (
    !verification.pass ||
    route.classification !== 'L3' ||
    route.underlyingRiskLevel !== 'L3' ||
    !route.canStart ||
    l3.l3AcceptedBy === null ||
    l3.l3AcceptedOn === null ||
    l3.l3AcceptanceRecordPath === null ||
    l3.l3AcceptanceRecordSha256 === null ||
    l3.l3AcceptedReviewContractSha256 === null
  ) {
    errors.push(
      `${strategy} requires a current, record-verified L3 route and owner acceptance`,
    )
  }
  if (strategy === 'preserve-source-rig-retime') {
    for (const operation of ['source-rig-animation', 'animation-retime'] as const) {
      if (!operations.has(operation)) {
        errors.push(
          `preserve-source-rig-retime requires planned operation ${operation}`,
        )
      }
    }
  } else {
    const customOperations = [
      'new-rig',
      'full-rebind',
      'anatomy-reconstruction',
      'complex-transparency-rebuild',
      'mouth-reconstruction',
    ] as const
    if (!customOperations.some((operation) => operations.has(operation))) {
      errors.push(
        `custom-rebuild requires at least one matching L3 rebuild operation: ${customOperations.join(', ')}`,
      )
    }
  }
  return errors
}

function byteAt(buffer: Buffer, offset: number): number {
  const value = buffer[offset]
  if (value === undefined) throw new Error(`Unexpected end of WebP at ${offset}`)
  return value
}

function inspectWebp(buffer: Buffer): {
  readonly width: number
  readonly height: number
} {
  if (
    buffer.byteLength < 30 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    throw new Error('Not a WebP file')
  }
  const chunkType = buffer.toString('ascii', 12, 16)
  const offset = 20
  if (chunkType === 'VP8X') {
    return {
      width:
        1 +
        byteAt(buffer, offset + 4) +
        byteAt(buffer, offset + 5) * 256 +
        byteAt(buffer, offset + 6) * 65_536,
      height:
        1 +
        byteAt(buffer, offset + 7) +
        byteAt(buffer, offset + 8) * 256 +
        byteAt(buffer, offset + 9) * 65_536,
    }
  }
  if (chunkType === 'VP8 ') {
    return {
      width: buffer.readUInt16LE(offset + 6) & 0x3fff,
      height: buffer.readUInt16LE(offset + 8) & 0x3fff,
    }
  }
  if (chunkType === 'VP8L') {
    const byte1 = byteAt(buffer, offset + 1)
    const byte2 = byteAt(buffer, offset + 2)
    const byte3 = byteAt(buffer, offset + 3)
    const byte4 = byteAt(buffer, offset + 4)
    return {
      width: 1 + byte1 + ((byte2 & 0x3f) << 8),
      height: 1 + (byte2 >> 6) + (byte3 << 2) + ((byte4 & 0x0f) << 10),
    }
  }
  throw new Error(`Unsupported WebP chunk ${chunkType}`)
}

function gate(
  id: string,
  kind: GateResult['kind'],
  status: GateResult['status'],
  summary: string,
  extra: Pick<GateResult, 'evidence' | 'measured'> = {},
): GateResult {
  return { id, kind, status, summary, ...extra }
}

async function validatorResults(
  modelPath: string,
  evidencePath: string,
): Promise<GateResult[]> {
  const script = fileURLToPath(new URL('./validate-glb.mjs', import.meta.url))
  return new Promise((complete) => {
    const child = spawn(process.execPath, [script, modelPath], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    let errorOutput = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      output += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      errorOutput += chunk
    })
    const handleClose = async (code: number | null): Promise<void> => {
      try {
        const parsed = JSON.parse(output) as {
          validation?: {
            errors?: number
            warnings?: number
            infos?: number
            hints?: number
          }
        }
        await writeJson(evidencePath, {
          schemaVersion: 1,
          generatedAt: new Date().toISOString(),
          modelPath,
          validatorOutput: parsed,
        })
        const errors = parsed.validation?.errors ?? 1
        const warnings = parsed.validation?.warnings ?? 0
        complete([
          gate(
            'glb-validator',
            'automated',
            errors === 0 ? 'pass' : 'fail',
            errors === 0
              ? 'Khronos glTF validator reports zero errors.'
              : `Khronos glTF validator reports ${errors} error(s).`,
            {
              evidence: [modelPath, evidencePath],
              measured: {
                errors,
                warnings,
                infos: parsed.validation?.infos ?? 0,
                hints: parsed.validation?.hints ?? 0,
              },
            },
          ),
          gate(
            'glb-validator-warnings',
            'warning',
            warnings === 0 ? 'pass' : 'pending',
            warnings === 0
              ? 'Khronos glTF validator reports zero warnings.'
              : `Khronos glTF validator reports ${warnings} warning(s); review the retained validator evidence.`,
            {
              evidence: [modelPath, evidencePath],
              measured: { warnings },
            },
          ),
        ])
      } catch {
        complete([
          gate(
            'glb-validator',
            'automated',
            'fail',
            `Validator could not inspect GLB (exit ${code ?? 'unknown'}): ${errorOutput.trim()}`,
            { evidence: [modelPath, evidencePath] },
          ),
        ])
      }
    }
    child.once('close', (code) => {
      void handleClose(code)
    })
  })
}

function validateLandmarks(
  value: unknown,
  profile: AnimalOnboardingProfile,
  path: string,
): GateResult {
  const root = asRecord(value)
  const bounds = asRecord(root.bounds)
  const minimum = finiteVector(bounds.min)
  const maximum = finiteVector(bounds.max)
  const head = point(root.head)
  const tailBase = point(root.tailBase)
  const tailTip = point(root.tailTip)
  const eyes = Array.isArray(root.eyes) ? root.eyes.map(point) : []
  const contacts = Array.isArray(root.contacts)
    ? root.contacts.map(point)
    : []
  const flippers = Array.isArray(root.flippers)
    ? root.flippers.map(point)
    : []
  const baseComplete =
    minimum !== null &&
    maximum !== null &&
    head !== null &&
    tailBase !== null &&
    tailTip !== null &&
    eyes.length >= 2 &&
    eyes.every((entry) => entry !== null)
  const tailDirectionPass =
    head !== null &&
    tailBase !== null &&
    tailTip !== null &&
    (profile.model.tailAxisSign > 0
      ? tailTip[0] > tailBase[0] && tailBase[0] > head[0]
      : tailTip[0] < tailBase[0] && tailBase[0] < head[0])
  const landContactsPass =
    profile.model.habitat !== 'land' ||
    (contacts.length >= 2 &&
      contacts.every(
        (entry) => entry !== null && Math.abs(entry[2]) <= 0.03,
      ))
  const marineFlippersPass =
    profile.model.motionProfile !== 'marine-tail' ||
    (flippers.length >= 2 && flippers.every((entry) => entry !== null))
  const pass =
    baseComplete &&
    tailDirectionPass &&
    landContactsPass &&
    marineFlippersPass
  return gate(
    'landmarks',
    'automated',
    pass ? 'pass' : 'fail',
    pass
      ? 'Bounds, head, eyes, tail direction and habitat contacts/appendages are measurable.'
      : 'Landmark geometry is incomplete, points the tail the wrong way, or violates habitat contact requirements.',
    {
      evidence: [path],
      measured: {
        eyeCount: eyes.length,
        contactCount: contacts.length,
        flipperCount: flippers.length,
        tailDirectionPass,
        landContactsPass,
        marineFlippersPass,
      },
    },
  )
}

async function normalizationGates(
  profile: AnimalOnboardingProfile,
): Promise<GateResult[]> {
  const logPath = resolve(profile.model.normalizationLogPath)
  const blendPath = resolve(profile.model.normalizedBlendPath)
  if (!(await regularFile(logPath)) || !(await regularFile(blendPath))) {
    return [
      gate(
        'blender-normalization-evidence',
        'automated',
        'fail',
        'Normalized .blend or Blender modification log is missing.',
        {
          evidence: [
            profile.model.normalizedBlendPath,
            profile.model.normalizationLogPath,
          ],
        },
      ),
    ]
  }
  try {
    const value = asRecord(JSON.parse(await readFile(logPath, 'utf8')))
    const input = asRecord(value.input)
    const processingStrategy = asRecord(value.processingStrategy)
    const detectedSource = asRecord(processingStrategy.detectedSource)
    const normalization = asRecord(value.normalization)
    const motion = asRecord(value.motion)
    const motionEvidence = asRecord(value.motionEvidence)
    const mouthMotion = asRecord(motion.mouthMotion)
    const mouthEvidence = asRecord(value.mouthEvidence)
    const output = asRecord(value.output)
    const blend = asRecord(value.blend)
    const boundsMinimum = finiteVector(normalization.boundsMin)
    const boundsMaximum = finiteVector(normalization.boundsMax)
    const outputDigest = await fileDigest(resolve(profile.model.outputPath))
    const blendDigest = await fileDigest(blendPath)
    const sourceDigest = await fileDigest(resolve(profile.source.sourceModelPath))
    const riskVerification = await verifyPersistedAssetRiskRoute(
      resolve(profile.runDirectory, 'asset-inspection.json'),
      resolve(profile.runDirectory, 'asset-risk-route.json'),
    )
    const strategyRiskErrors = processingStrategyRiskErrors(
      profile,
      riskVerification,
    )
    const loggedInputPath =
      typeof input.path === 'string' ? resolve(input.path) : null
    const loggedLandmarksPath =
      typeof value.landmarks === 'string' ? resolve(value.landmarks) : null
    const inputBindingPass =
      resolve(profile.model.inputPath) ===
        resolve(profile.source.sourceModelPath) &&
      loggedInputPath === resolve(profile.source.sourceModelPath) &&
      input.bytes === sourceDigest.bytes &&
      input.sha256 === sourceDigest.sha256
    const logIdentityPass =
      value.schemaVersion === 1 &&
      value.animalId === profile.id &&
      loggedLandmarksPath === resolve(profile.model.landmarksPath)
    const processingStrategyPass =
      processingStrategy.normalization ===
        profile.model.normalizationStrategy &&
      processingStrategy.animation === profile.model.animationStrategy.mode &&
      processingStrategy.declaredSourceArmature ===
        profile.model.animationStrategy.sourceArmature &&
      processingStrategy.declaredSourceAnimation ===
        profile.model.animationStrategy.sourceAnimation &&
      processingStrategy.destructiveReplacementAccepted ===
        profile.model.animationStrategy.destructiveReplacementAccepted &&
      processingStrategy.reason === profile.model.animationStrategy.reason &&
      detectedSource.armaturePresent ===
        (profile.model.animationStrategy.sourceArmature === 'present') &&
      detectedSource.animationPresent ===
        (profile.model.animationStrategy.sourceAnimation === 'present') &&
      strategyRiskErrors.length === 0
    const neutralRenders = Array.isArray(value.neutralRenders)
      ? value.neutralRenders.filter(
          (entry): entry is string => typeof entry === 'string',
        )
      : []
    const missingNeutralRenders = []
    for (const path of neutralRenders) {
      if (!(await regularFile(resolve(path)))) missingNeutralRenders.push(path)
    }
    const motionRenders = Array.isArray(motionEvidence.paths)
      ? motionEvidence.paths.filter(
          (entry): entry is string => typeof entry === 'string',
        )
      : []
    const missingMotionRenders = []
    for (const path of motionRenders) {
      if (!(await regularFile(resolve(path)))) missingMotionRenders.push(path)
    }
    const mouthRenders = Array.isArray(mouthEvidence.paths)
      ? mouthEvidence.paths.filter(
          (entry): entry is string => typeof entry === 'string',
        )
      : []
    const missingMouthRenders = []
    for (const path of mouthRenders) {
      if (!(await regularFile(resolve(path)))) missingMouthRenders.push(path)
    }
    const centered =
      boundsMinimum !== null &&
      boundsMaximum !== null &&
      Math.abs((boundsMinimum[0] + boundsMaximum[0]) / 2) <= 0.001 &&
      Math.abs((boundsMinimum[1] + boundsMaximum[1]) / 2) <= 0.001
    const habitatAligned =
      boundsMinimum !== null &&
      boundsMaximum !== null &&
      (profile.model.habitat === 'land'
        ? Math.abs(boundsMinimum[2]) <= 0.001 &&
          normalization.grounded === true
        : Math.abs((boundsMinimum[2] + boundsMaximum[2]) / 2) <=
            0.001 && normalization.grounded === false)
    const motionPass =
      motion.profile === profile.model.motionProfile &&
      motion.clip === profile.model.expectedClip &&
      motion.durationSeconds === 8 &&
      motion.fps === 24 &&
      motion.rootTranslation === 0 &&
      motion.firstFrameMatchesLast === true &&
      motion.tailAxisSign === profile.model.tailAxisSign &&
      asRecord(motion.landmarkInputs).tailBaseX !== undefined
    const motionVisibilityPass = motionVisibilityEvidencePass({
      motionProfile: profile.model.motionProfile,
      firstFrameMatchesLast: motion.firstFrameMatchesLast === true,
      rootTranslation:
        typeof motion.rootTranslation === 'number'
          ? motion.rootTranslation
          : Number.POSITIVE_INFINITY,
      maximumVertexDisplacementFraction:
        typeof motion.maximumVertexDisplacementFraction === 'number'
          ? motion.maximumVertexDisplacementFraction
          : 0,
      changedPixelFractionOfModel:
        typeof motionEvidence.changedPixelFractionOfModel === 'number'
          ? motionEvidence.changedPixelFractionOfModel
          : 0,
      motionRenderCount: motionRenders.length,
    })
    const mouthProfile = profile.model.mouthMotion
    const mouthDisabled = mouthProfile.mode === 'disabled'
    const affectedBounds = asRecord(mouthMotion.affectedBounds)
    const affectedMinimum = finiteVector(affectedBounds.min)
    const affectedMaximum = finiteVector(affectedBounds.max)
    const length =
      boundsMinimum !== null && boundsMaximum !== null
        ? Math.max(boundsMaximum[0] - boundsMinimum[0], 1e-9)
        : 0
    const affectedCenterX =
      affectedMinimum !== null && affectedMaximum !== null
        ? (affectedMinimum[0] + affectedMaximum[0]) / 2
        : Number.NaN
    const mouthInHeadZone =
      mouthDisabled ||
      (boundsMinimum !== null &&
        boundsMaximum !== null &&
        Number.isFinite(affectedCenterX) &&
        (profile.model.tailAxisSign < 0
          ? affectedCenterX >= boundsMinimum[0] + length * 0.62
          : affectedCenterX <= boundsMinimum[0] + length * 0.38))
    const mouthRenderPass =
      mouthDisabled ||
      (mouthRenders.length === 3 &&
        missingMouthRenders.length === 0 &&
        mouthEvidence.openFrame === 0 &&
        mouthEvidence.maximumCloseFrame === 96 &&
        mouthEvidence.loopFrame === 192 &&
        typeof mouthEvidence.loopChangedPixels === 'number' &&
        mouthEvidence.loopChangedPixels <= 4 &&
        typeof mouthEvidence.changedPixels === 'number' &&
        mouthEvidence.changedPixels >= 24 &&
        typeof mouthEvidence.changedPixelFractionOfModel === 'number' &&
        mouthEvidence.changedPixelFractionOfModel >= 0.01)
    let mouthStructurePass = mouthDisabled
      ? mouthMotion.mode === 'disabled' && mouthRenders.length === 0
      : mouthMotion.mode === mouthProfile.mode &&
        mouthMotion.sourcePose === 'open' &&
        mouthMotion.maximumCloseFrame === 96 &&
        mouthMotion.firstFrameMatchesLast === true &&
        mouthMotion.closeDegrees === mouthProfile.closeDegrees &&
        typeof mouthMotion.selectedVertices === 'number' &&
        mouthMotion.selectedVertices > 0 &&
        typeof mouthMotion.affectedVertexFraction === 'number' &&
        mouthMotion.affectedVertexFraction > 0 &&
        mouthMotion.affectedVertexFraction <=
          mouthProfile.maximumAffectedVertexFraction &&
        typeof mouthMotion.maximumVertexDisplacementFraction === 'number' &&
        mouthMotion.maximumVertexDisplacementFraction > 0
    if (mouthProfile.mode === 'source-rig') {
      const tongueWeights = asRecord(mouthMotion.tongueWeightedVertices)
      mouthStructurePass =
        mouthStructurePass &&
        mouthMotion.jawBone === mouthProfile.jawBone &&
        typeof mouthMotion.jawWeightedVertices === 'number' &&
        mouthMotion.jawWeightedVertices >=
          mouthProfile.minimumJawWeightedVertices &&
        mouthProfile.tongueBones.every(
          (bone) =>
            typeof tongueWeights[bone] === 'number' &&
            tongueWeights[bone] >= mouthProfile.minimumTongueWeightedVertices,
        )
    } else if (mouthProfile.mode === 'curated-components') {
      const selector = mouthProfile.componentSelector
      mouthStructurePass =
        mouthStructurePass &&
        mouthMotion.componentCount === selector.expectedComponentCount &&
        typeof mouthMotion.selectedVertices === 'number' &&
        Math.abs(
          mouthMotion.selectedVertices - selector.expectedVertexCount,
        ) <= selector.expectedVertexTolerance
    }
    const mouthMotionPass =
      mouthStructurePass && mouthRenderPass && mouthInHeadZone
    const digestsPass =
      output.bytes === outputDigest.bytes &&
      output.sha256 === outputDigest.sha256 &&
      blend.bytes === blendDigest.bytes &&
      blend.sha256 === blendDigest.sha256
    const pass =
      logIdentityPass &&
      inputBindingPass &&
      processingStrategyPass &&
      centered &&
      habitatAligned &&
      motionPass &&
      motionVisibilityPass &&
      mouthMotionPass &&
      digestsPass &&
      neutralRenders.length === 5 &&
      missingNeutralRenders.length === 0 &&
      motionRenders.length === 3 &&
      missingMotionRenders.length === 0
    return [
      gate(
        'blender-normalization-evidence',
        'automated',
        pass ? 'pass' : 'fail',
        pass
          ? 'Blender log proves a rights-bound source input, route-authorized processing strategy, canonical geometry, visibly changing landmark-driven closed-loop motion, fixed-camera motion renders, five neutral renders and matching output hashes.'
          : `Blender normalization source/strategy binding, visible body/mouth-motion evidence, neutral renders or recorded output hashes do not match${strategyRiskErrors.length > 0 ? `: ${strategyRiskErrors.join('; ')}` : '.'}`,
        {
          evidence: [
            profile.model.normalizedBlendPath,
            profile.model.normalizationLogPath,
            ...neutralRenders,
            ...motionRenders,
            ...mouthRenders,
          ],
          measured: {
            logIdentityPass,
            inputBindingPass,
            processingStrategy: profile.model.normalizationStrategy,
            processingStrategyPass,
            strategyRouteLevel:
              riskVerification.currentRoute.underlyingRiskLevel,
            strategyRiskErrorCount: strategyRiskErrors.length,
            centered,
            habitatAligned,
            motionPass,
            motionVisibilityPass,
            maximumVertexDisplacementFraction:
              typeof motion.maximumVertexDisplacementFraction === 'number'
                ? motion.maximumVertexDisplacementFraction
                : 0,
            changedPixelFractionOfModel:
              typeof motionEvidence.changedPixelFractionOfModel === 'number'
                ? motionEvidence.changedPixelFractionOfModel
                : 0,
            motionRenderCount: motionRenders.length,
            mouthMode: mouthProfile.mode,
            mouthStructurePass,
            mouthRenderPass,
            mouthInHeadZone,
            mouthChangedPixelFractionOfModel:
              typeof mouthEvidence.changedPixelFractionOfModel === 'number'
                ? mouthEvidence.changedPixelFractionOfModel
                : 0,
            mouthRenderCount: mouthRenders.length,
            digestsPass,
            neutralRenderCount: neutralRenders.length,
            missingNeutralRenders: missingNeutralRenders.length,
            missingMotionRenders: missingMotionRenders.length,
            missingMouthRenders: missingMouthRenders.length,
          },
        },
      ),
    ]
  } catch (error) {
    return [
      gate(
        'blender-normalization-evidence',
        'automated',
        'fail',
        `Blender normalization evidence is unreadable: ${error instanceof Error ? error.message : String(error)}`,
        {
          evidence: [
            profile.model.normalizedBlendPath,
            profile.model.normalizationLogPath,
          ],
        },
      ),
    ]
  }
}

async function headedBrowserCaptureGate(
  profile: AnimalOnboardingProfile,
): Promise<GateResult[]> {
  const path = resolve(
    profile.runDirectory,
    'browser-capture-validation.json',
  )
  if (!(await regularFile(path))) {
    return [
      gate(
        'headed-browser-capture',
        'automated',
        'fail',
        'Validated headed-browser evidence is missing.',
        { evidence: [path] },
      ),
    ]
  }
  try {
    const verified = await verifyBrowserCaptureValidationForProfile({
      animalId: profile.id,
      runDirectory: profile.runDirectory,
      modelOutputPath: profile.model.outputPath,
      validationPath: path,
    })
    const report = verified.report
    const artifacts = report.candidate.artifacts
    const pass =
      report.animalId === profile.id &&
      report.pass &&
      report.candidate.pass &&
      report.candidate.expectedCaptureCount > 0 &&
      report.candidate.verifiedCaptureCount ===
        report.candidate.expectedCaptureCount &&
      report.globalBaseline.provided &&
      report.globalBaseline.pass
    return [
      gate(
        'headed-browser-capture',
        'automated',
        pass ? 'pass' : 'fail',
        pass
          ? 'Headed Browser/Chrome evidence is complete, hash-bound to the final GLB and includes the required global baseline.'
          : 'Headed-browser evidence is incomplete, stale, failed, or not bound to the current candidate.',
        {
          evidence: [
            path,
            verified.sourcePlanPath,
            verified.sourceMetadataPath,
            ...(report.globalBaseline.report?.path
              ? [report.globalBaseline.report.path]
              : []),
            ...artifacts.map(({ absolutePath }) => absolutePath),
          ],
          measured: {
            expectedCaptures: report.candidate.expectedCaptureCount,
            verifiedCaptures: report.candidate.verifiedCaptureCount,
            candidatePass: report.candidate.pass,
            globalBaselinePass: report.globalBaseline.pass,
            globalBaselineProvided: report.globalBaseline.provided,
            validationMatchesRecomputedEvidence: true,
            capturePlanMatchesCurrentProfileModel: true,
          },
        },
      ),
    ]
  } catch (error) {
    return [
      gate(
        'headed-browser-capture',
        'automated',
        'fail',
        `Headed-browser validation report is unreadable: ${error instanceof Error ? error.message : String(error)}`,
        { evidence: [path] },
      ),
    ]
  }
}

async function assetGates(
  profile: AnimalOnboardingProfile,
): Promise<GateResult[]> {
  const assets = profile.assets
  const images = [
    ['background-landscape', assets.backgroundLandscapePath, 1672, 941],
    ['background-portrait', assets.backgroundPortraitPath, 941, 1672],
    ['poster', assets.posterPath, 960, 540],
    [
      'poster-portrait',
      assets.posterPortraitPath ?? '(missing posterPortraitPath)',
      390,
      844,
    ],
    ['thumbnail', assets.thumbnailPath, 320, 320],
  ] as const
  const results: GateResult[] = []
  for (const [id, path, expectedWidth, expectedHeight] of images) {
    let dimensions: { readonly width: number; readonly height: number } | null =
      null
    try {
      dimensions = inspectWebp(await readFile(resolve(path)))
    } catch {
      // The failing gate below preserves the exact expected asset path.
    }
    const pass =
      dimensions?.width === expectedWidth &&
      dimensions.height === expectedHeight
    results.push(
      gate(
        `asset-${id}`,
        'automated',
        pass ? 'pass' : 'fail',
        pass
          ? `${id} is a ${expectedWidth}×${expectedHeight} WebP.`
          : `${id} is missing, invalid, or not ${expectedWidth}×${expectedHeight}.`,
        {
          evidence: [path],
          measured: {
            width: dimensions?.width ?? 0,
            height: dimensions?.height ?? 0,
          },
        },
      ),
    )
  }

  const backgroundEvidencePath = resolve(assets.backgroundEvidencePath)
  if (await regularFile(backgroundEvidencePath)) {
    try {
      const evidence = asRecord(
        JSON.parse(await readFile(backgroundEvidencePath, 'utf8')),
      )
      const derivation = asRecord(evidence.derivation)
      const landscape = asRecord(derivation.landscape)
      const portrait = asRecord(derivation.portrait)
      const landscapeSource = asRecord(landscape.source)
      const portraitSource = asRecord(portrait.source)
      const landscapeRuntime = asRecord(landscape.runtime)
      const portraitRuntime = asRecord(portrait.runtime)
      const actualLandscape = await fileDigest(
        resolve(assets.backgroundLandscapePath),
      )
      const actualPortrait = await fileDigest(
        resolve(assets.backgroundPortraitPath),
      )
      const sourcePaths = [
        landscapeSource.path,
        portraitSource.path,
      ].filter((entry): entry is string => typeof entry === 'string')
      const sourcesExist =
        sourcePaths.length === 2 &&
        (
          await Promise.all(
            sourcePaths.map((path) => regularFile(resolve(path))),
          )
        ).every(Boolean)
      const promptsExist = ['landscape', 'portrait'].every((key) => {
        const prompt = asRecord(evidence[key]).promptSummary
        return typeof prompt === 'string' && prompt.trim().length >= 20
      })
      const hashesMatch =
        landscapeRuntime.bytes === actualLandscape.bytes &&
        landscapeRuntime.sha256 === actualLandscape.sha256 &&
        portraitRuntime.bytes === actualPortrait.bytes &&
        portraitRuntime.sha256 === actualPortrait.sha256
      const pass = sourcesExist && promptsExist && hashesMatch
      results.push(
        gate(
          'background-generation-evidence',
          'automated',
          pass ? 'pass' : 'fail',
          pass
            ? 'Background prompts, source images, deterministic runtime hashes and dimensions are recorded.'
            : 'Background prompt/source evidence or recorded runtime hashes are incomplete.',
          {
            evidence: [assets.backgroundEvidencePath, ...sourcePaths],
            measured: { sourcesExist, promptsExist, hashesMatch },
          },
        ),
      )
    } catch (error) {
      results.push(
        gate(
          'background-generation-evidence',
          'automated',
          'fail',
          `Background evidence is unreadable: ${error instanceof Error ? error.message : String(error)}`,
          { evidence: [assets.backgroundEvidencePath] },
        ),
      )
    }
  } else {
    results.push(
      gate(
        'background-generation-evidence',
        'automated',
        'fail',
        'Background generation evidence is missing.',
        { evidence: [assets.backgroundEvidencePath] },
      ),
    )
  }

  const narrations = localizedNarrationAssets(assets)
  for (const locale of ['zh-CN', 'en'] as const) {
    const narration = narrations[locale]
    const formatGateId = `audio-format-budget-${locale}`
    const reproducibilityGateId = `audio-reproducibility-${locale}`
    if (!narration) {
      results.push(
        gate(
          formatGateId,
          'automated',
          'not-applicable',
          `${locale} narration remains an incomplete draft input.`,
        ),
      )
      results.push(
        gate(
          reproducibilityGateId,
          'automated',
          'not-applicable',
          `No ${locale} narration is configured for this draft.`,
        ),
      )
      continue
    }
    const path = resolve(narration.path)
    if (!(await regularFile(path))) {
      results.push(
        gate(
          formatGateId,
          'automated',
          'fail',
          `Configured ${locale} narration is missing.`,
          { evidence: [narration.path] },
        ),
      )
      results.push(
        gate(
          reproducibilityGateId,
          'automated',
          'fail',
          `Configured ${locale} narration cannot be reproduced because the artifact is missing.`,
          { evidence: [narration.path] },
        ),
      )
      continue
    }
    const file = await readFile(path)
    const validHeader =
      file.subarray(0, 3).toString('ascii') === 'ID3' ||
      (file[0] === 0xff && ((file[1] ?? 0) >>> 5) === 0b111)
    results.push(
      gate(
        formatGateId,
        'automated',
        validHeader && file.length <= 300 * 1024 ? 'pass' : 'fail',
        validHeader && file.length <= 300 * 1024
          ? `${locale} narration has an MP3 header and is within 300 KiB.`
          : `${locale} narration is not a valid MP3 or exceeds 300 KiB.`,
        {
          evidence: [narration.path],
          measured: { bytes: file.length, validHeader },
        },
      ),
    )
    const metricsPath = resolve(
      narration.metricsPath ??
        (assets.narration
          ? `${profile.runDirectory}/narration.${locale}.metrics.json`
          : `${profile.runDirectory}/narration.metrics.json`),
    )
    try {
      const metrics = asRecord(JSON.parse(await readFile(metricsPath, 'utf8')))
      const artifact = asRecord(metrics.artifact)
      const acceptance = asRecord(metrics.automaticAcceptance)
      const engine = asRecord(metrics.engine)
      const script = (await readFile(resolve(narration.scriptPath), 'utf8')).trim()
      const digest = await fileDigest(path)
      const scriptSha256 = sha256(Buffer.from(script, 'utf8'))
      const pass =
        script.length > 0 &&
        qwenNarrationEvidencePass({
          metrics,
          script,
          scriptSha256,
          artifact: digest,
          expected: {
            locale,
            speaker: narration.speaker,
            language: narration.language,
          },
        })
      results.push(
        gate(
          reproducibilityGateId,
          'automated',
          pass ? 'pass' : 'fail',
          pass
            ? `${locale} narration uses its declared pinned Qwen3-TTS voice chain; script, two byte-identical raw runs, runtime hash, format and draft-only decisions agree.`
            : `${locale} narration is not reproducible from its declared pinned Qwen3-TTS voice chain, or its script/artifact metrics disagree.`,
          {
            evidence: [narration.path, narration.scriptPath, metricsPath],
            measured: {
              bytes: digest.bytes,
              durationSeconds:
                typeof artifact.durationSeconds === 'number'
                  ? artifact.durationSeconds
                  : 0,
              automaticAcceptance: acceptance.allPassed === true,
              engine:
                typeof engine.package === 'string'
                  ? engine.package
                  : typeof engine.tool === 'string'
                    ? engine.tool
                    : 'unknown',
              speaker:
                typeof engine.speaker === 'string'
                  ? engine.speaker
                  : typeof engine.voice === 'string'
                    ? engine.voice
                    : 'unknown',
            },
          },
        ),
      )
    } catch (error) {
      results.push(
        gate(
          reproducibilityGateId,
          'automated',
          'fail',
          `${locale} narration metrics are missing or unreadable: ${error instanceof Error ? error.message : String(error)}`,
          { evidence: [narration.path, metricsPath] },
        ),
      )
    }
  }
  return results
}

async function modelLockGate(
  profile: AnimalOnboardingProfile,
): Promise<GateResult> {
  // Keep model-only QA reusable by model-lock verification without creating a
  // static gates -> model-lock -> QA -> gates dependency cycle.
  const { verifyModelLockForProfile } = await import('./model-lock')
  const result = await verifyModelLockForProfile(profile)
  return gate(
    'owner-model-lock',
    'automated',
    result.pass ? 'pass' : 'fail',
    result.pass
      ? 'The owner accepted this exact model contract and GLB for finishing.'
      : `Derivative review requires a current owner model lock: ${result.errors.join('; ')}.`,
    { evidence: [resolve(profile.runDirectory, 'model-lock.json')] },
  )
}

async function riskEvidenceCompletionGate(
  profile: AnimalOnboardingProfile,
): Promise<GateResult> {
  const inspectionPath = resolve(profile.runDirectory, 'asset-inspection.json')
  const routePath = resolve(profile.runDirectory, 'asset-risk-route.json')
  try {
    const verification = await verifyPersistedAssetRiskRoute(
      inspectionPath,
      routePath,
    )
    const completion = verification.evidenceCompletion
    return gate(
      'risk-evidence-completion',
      'automated',
      completion.pass ? 'pass' : 'fail',
      completion.pass
        ? `All ${completion.required.length} route-required evidence IDs are present and hash-verified.`
        : `Route-required evidence is incomplete or stale: ${[...completion.missing, ...completion.errors].join('; ')}.`,
      {
        evidence: [completion.manifestPath],
        measured: {
          required: completion.required.length,
          satisfied: completion.satisfied.length,
          missing: completion.missing.length,
          manifestSha256: completion.manifestSha256 ?? 'missing',
        },
      },
    )
  } catch (error) {
    return gate(
      'risk-evidence-completion',
      'automated',
      'fail',
      `Route-required evidence cannot be verified: ${error instanceof Error ? error.message : String(error)}`,
      { evidence: [resolve(profile.runDirectory, 'risk-evidence-manifest.json')] },
    )
  }
}

export async function sourceRiskRouteGate(
  profile: AnimalOnboardingProfile,
): Promise<GateResult> {
  const inspectionPath = resolve(
    profile.runDirectory,
    'asset-inspection.json',
  )
  const routePath = resolve(profile.runDirectory, 'asset-risk-route.json')
  try {
    const verification = await verifyPersistedAssetRiskRoute(
      inspectionPath,
      routePath,
    )
    const sourceBaseline = await verifySourceBaseline(
      profile,
      verification.currentRoute.controlBindings.reviewContractPath,
    )
    const errors = [...verification.errors, ...sourceBaseline.errors]
    const pass =
      verification.pass &&
      sourceBaseline.pass &&
      verification.currentRoute.animalId === profile.id &&
      verification.currentRoute.canStart &&
      verification.currentRoute.classification !== 'blocked'
    return gate(
      'source-risk-route',
      'automated',
      pass ? 'pass' : 'fail',
      pass
        ? `Current source controls permit the ${verification.currentRoute.underlyingRiskLevel} route.`
        : `Source/risk controls are blocked or stale: ${errors.join('; ') || 'animal mismatch'}.`,
      {
        evidence: [
          inspectionPath,
          routePath,
          sourceBaseline.sourceModelPath,
          ...(sourceBaseline.reviewContractPath
            ? [sourceBaseline.reviewContractPath]
            : []),
        ],
        measured: {
          riskLevel: verification.currentRoute.underlyingRiskLevel,
          canStart: verification.currentRoute.canStart,
          parallelAllowed:
            verification.currentRoute.parallelExecution === 'allowed',
          sourceBaselineMatches: sourceBaseline.pass,
          sourceModelSha256: sourceBaseline.sourceModelSha256 ?? 'unavailable',
          baselineAssetSha256:
            sourceBaseline.baselineAssetSha256 ?? 'unavailable',
        },
      },
    )
  } catch (error) {
    return gate(
      'source-risk-route',
      'automated',
      'fail',
      `Source/risk controls are missing or invalid: ${error instanceof Error ? error.message : String(error)}`,
      { evidence: [inspectionPath, routePath] },
    )
  }
}

export function modelMetricGates(
  profile: AnimalOnboardingProfile,
  inspection: GlbInspection,
): GateResult[] {
  const model = profile.model
  const measured = {
    bytes: inspection.declaredBytes,
    triangles: inspection.triangles,
    drawCalls: inspection.drawCalls,
    materials: inspection.materials,
    bones: inspection.bones,
  }
  const maximums = requestedModelCeilings(model)
  const targetMisses = exceededMetrics(measured, MODEL_BUDGET_POLICY.targets)
  const ceilingMisses = exceededMetrics(measured, maximums)
  const withinBudget = ceilingMisses.length === 0
  const exactIdle =
    inspection.animationNames.length === 1 &&
    inspection.animationNames[0] === model.expectedClip &&
    idleDurationMatchesContract(inspection.animationDurations[0] ?? 0)
  const reviewedStatic =
    !model.animationRequired && inspection.animationNames.length === 0
  const animationPass = exactIdle || reviewedStatic
  return [
    gate(
      'glb-self-contained',
      'automated',
      inspection.externalUris.length === 0 ? 'pass' : 'fail',
      inspection.externalUris.length === 0
        ? 'Runtime GLB is self-contained.'
        : `Runtime GLB has ${inspection.externalUris.length} external URI(s).`,
      {
        measured: { externalUris: inspection.externalUris.length },
      },
    ),
    gate(
      'model-budget',
      'automated',
      withinBudget ? 'pass' : 'fail',
      withinBudget
        ? 'Geometry, draw calls, materials, bones and bytes are within the recorded review ceilings.'
        : `Model metrics exceed their recorded ceilings: ${ceilingMisses.join(', ')}.`,
      {
        measured: {
          ...measured,
          maximumBytes: maximums.bytes,
          maximumTriangles: maximums.triangles,
          maximumDrawCalls: maximums.drawCalls,
          maximumMaterials: maximums.materials,
          maximumBones: maximums.bones,
        },
      },
    ),
    gate(
      'model-target-budget',
      'warning',
      targetMisses.length === 0 ? 'pass' : 'pending',
      targetMisses.length === 0
        ? 'The model meets every optimisation target.'
        : `The model is admissible but exceeds optimisation targets for: ${targetMisses.join(', ')}.`,
      {
        measured: {
          ...measured,
          targetBytes: MODEL_BUDGET_POLICY.targets.bytes,
          targetTriangles: MODEL_BUDGET_POLICY.targets.triangles,
          targetDrawCalls: MODEL_BUDGET_POLICY.targets.drawCalls,
          targetMaterials: MODEL_BUDGET_POLICY.targets.materials,
          targetBones: MODEL_BUDGET_POLICY.targets.bones,
        },
      },
    ),
    ...(model.budgetException
      ? [
          gate(
            'model-budget-exception',
            'warning',
            'pass',
            `Explicit budget exception recorded for ${model.budgetException.metrics.join(', ')} by ${model.budgetException.acceptedBy} on ${model.budgetException.acceptedOn}.`,
            {
              measured: {
                acceptedBy: model.budgetException.acceptedBy,
                acceptedOn: model.budgetException.acceptedOn,
                reason: model.budgetException.reason,
              },
            },
          ),
        ]
      : []),
    gate(
      'runtime-idle',
      'automated',
      animationPass ? 'pass' : 'fail',
      exactIdle
        ? `Runtime contains exactly one ${IDLE_DURATION_SECONDS}-second Idle.`
        : reviewedStatic
          ? 'Runtime is explicitly configured and exported as a static exhibit.'
          : `Expected one ${IDLE_DURATION_SECONDS}-second Idle (floating-point tolerance ${IDLE_DURATION_FLOAT_TOLERANCE_SECONDS}s); found ${inspection.animationNames.join(', ') || 'none'}.`,
      {
        measured: {
          animationRequired: model.animationRequired,
          clips: inspection.animationNames.length,
          duration: inspection.animationDurations[0] ?? 0,
        },
      },
    ),
  ]
}

export async function evaluateGates(
  profile: AnimalOnboardingProfile,
  options: { readonly requireReviewAssets: boolean },
): Promise<GateResult[]> {
  const gates: GateResult[] = []
  const source = profile.source
  const rightsPass =
    source.directSourceVerified &&
    source.author.trim().length > 0 &&
    (source.licenseId === 'CC-BY-4.0' || source.licenseId === 'CC0-1.0') &&
    source.downloadAllowed &&
    source.modificationAllowed &&
    source.redistributionAllowed
  gates.push(
    gate(
      'rights-and-direct-source',
      'automated',
      rightsPass ? 'pass' : 'fail',
      rightsPass
        ? 'Direct source, author and redistributable license are recorded.'
        : 'Direct source or redistribution rights are incomplete.',
      { evidence: source.evidencePaths },
    ),
  )
  const missingEvidence: string[] = []
  for (const path of [
    source.sourceModelPath,
    ...(source.sourceArchivePath ? [source.sourceArchivePath] : []),
    ...source.evidencePaths,
  ]) {
    if (!(await exists(resolve(path)))) missingEvidence.push(path)
  }
  gates.push(
    gate(
      'source-evidence-files',
      'automated',
      missingEvidence.length === 0 ? 'pass' : 'fail',
      missingEvidence.length === 0
        ? 'Source model, archive and evidence files exist.'
        : `Missing source evidence: ${missingEvidence.join(', ')}`,
      {
        evidence: [
          source.sourceModelPath,
          ...(source.sourceArchivePath ? [source.sourceArchivePath] : []),
          ...source.evidencePaths,
        ],
      },
    ),
  )
  gates.push(await sourceRiskRouteGate(profile))

  const modelPath = resolve(profile.model.outputPath)
  if (await regularFile(modelPath)) {
    try {
      const inspection = await inspectGlbFile(modelPath)
      gates.push(...modelMetricGates(profile, inspection))
      gates.push(
        ...(await validatorResults(
          modelPath,
          resolve(profile.runDirectory, 'glb-validator.json'),
        )),
      )
    } catch (error) {
      gates.push(
        gate(
          'runtime-model',
          'automated',
          'fail',
          `Runtime GLB is unreadable: ${error instanceof Error ? error.message : String(error)}`,
          { evidence: [profile.model.outputPath] },
        ),
      )
    }
  } else {
    gates.push(
      gate(
        'runtime-model',
        'automated',
        'fail',
        'Normalized runtime model is missing.',
        { evidence: [profile.model.outputPath] },
      ),
    )
  }
  gates.push(...(await normalizationGates(profile)))

  let landmarkEvidence: unknown = null
  if (await regularFile(resolve(profile.model.landmarksPath))) {
    landmarkEvidence = JSON.parse(
      await readFile(resolve(profile.model.landmarksPath), 'utf8'),
    )
    gates.push(
      validateLandmarks(
        landmarkEvidence,
        profile,
        profile.model.landmarksPath,
      ),
    )
  } else {
    gates.push(
      gate(
        'landmarks',
        'automated',
        'fail',
        'landmarks.json is missing.',
        { evidence: [profile.model.landmarksPath] },
      ),
    )
  }

  const expectedShadow =
    profile.model.habitat === 'land' ? 'ground' : 'none'
  gates.push(
    gate(
      'habitat-shadow-policy',
      'automated',
      profile.presentation.shadow === expectedShadow ? 'pass' : 'fail',
      profile.presentation.shadow === expectedShadow
        ? `${profile.model.habitat} shadow policy is correct.`
        : `${profile.model.habitat} requires shadow=${expectedShadow}.`,
    ),
  )
  if (profile.model.habitat === 'land') {
    const grounding = groundContactShadowEvidence(
      landmarkEvidence,
      profile.presentation,
    )
    gates.push(
      gate(
        'land-contact-shadow-coverage',
        'automated',
        grounding.pass ? 'pass' : 'fail',
        grounding.pass
          ? 'The contact shadow is visible and covers the measured foot-contact cluster.'
          : 'The land shadow is too faint or does not cover the measured foot-contact cluster.',
        {
          evidence: [profile.model.landmarksPath],
          measured: {
            measuredContactCount: grounding.measuredContactCount,
            coveredContactCount: grounding.coveredContactCount,
            opacityPass: grounding.opacityPass,
            horizontalRadius: grounding.shadowRadii.horizontal,
            depthRadius: grounding.shadowRadii.depth,
          },
        },
      ),
    )
  } else {
    gates.push(
      gate(
        'land-contact-shadow-coverage',
        'automated',
        'not-applicable',
        'Non-land animals do not receive a ground contact shadow.',
      ),
    )
  }
  const initialHeadSide = initialHeadSideEvidence(
    landmarkEvidence,
    profile.presentation,
  )
  gates.push(
    gate(
      'initial-head-side',
      'automated',
      initialHeadSide.pass ? 'pass' : 'fail',
      initialHeadSide.pass
        ? `The initial presentation places the head clearly on audience-${initialHeadSide.expectedSide}.`
        : `The initial presentation must place the head clearly on audience-${initialHeadSide.expectedSide}; measured ${initialHeadSide.measuredSide}.`,
      {
        evidence: [profile.model.landmarksPath],
        measured: {
          initialYawDegrees: profile.presentation.initialYawDegrees,
          expectedSide: initialHeadSide.expectedSide,
          measuredSide: initialHeadSide.measuredSide,
          projectedHeadX: initialHeadSide.projectedHeadX,
          projectedTailX: initialHeadSide.projectedTailX,
          separationFraction: initialHeadSide.separationFraction,
          minimumSeparationFraction:
            initialHeadSide.minimumSeparationFraction,
        },
      },
    ),
  )
  const safePadding = profile.presentation.safeAreaPadding
  gates.push(
    gate(
      'presentation-safe-padding',
      'automated',
      safePadding >= 0.04 && safePadding <= 0.22 ? 'pass' : 'fail',
      safePadding >= 0.04 && safePadding <= 0.22
        ? 'Presentation safe-area padding is within the supported range.'
        : 'Presentation safe-area padding must be between 0.04 and 0.22.',
      { measured: { safeAreaPadding: safePadding } },
    ),
  )

  if (options.requireReviewAssets) {
    gates.push(await riskEvidenceCompletionGate(profile))
    gates.push(await modelLockGate(profile))
    gates.push(...(await assetGates(profile)))
    gates.push(...(await headedBrowserCaptureGate(profile)))
  }

  const humanGates: Array<
    readonly [string, boolean, string]
  > = [
    [
      'human-scientific-identity',
      profile.approvals.scientific,
      'Scientific identity, Chinese name and wording require human approval.',
    ],
    [
      'human-visual-material',
      profile.approvals.visual,
      'Anatomy, material, eyes and background harmony require human approval.',
    ],
    [
      'human-motion-naturalness',
      profile.approvals.motion,
      'Motion naturalness and child comfort require human approval.',
    ],
    [
      'human-audio-listen-zh-CN',
      profile.approvals.audioByLocale?.['zh-CN'] === true,
      'Complete Simplified Chinese narration listening review requires human approval.',
    ],
    [
      'human-audio-listen-en',
      profile.approvals.audioByLocale?.en === true,
      'Complete English narration listening review requires human approval.',
    ],
    [
      'human-production-promotion',
      profile.approvals.production,
      'Production promotion and public distribution require explicit owner approval.',
    ],
  ]
  if (profile.model.habitat === 'land') {
    humanGates.splice(2, 0, [
      'human-grounding-background',
      profile.approvals.visual,
      'Foot placement, visible contact shadow and background ground-plane continuity require headed multi-viewport evidence approval.',
    ])
  }
  if (profile.model.mouthMotion.mode !== 'disabled') {
    const audioIndex = humanGates.findIndex(
      ([id]) => id === 'human-audio-listen-zh-CN',
    )
    humanGates.splice(audioIndex, 0, [
      'human-mouth-motion',
      profile.approvals.motion,
      'Jaw relaxation, tooth clearance, tongue following, soft-tissue continuity and child comfort require close-up human approval.',
    ])
  }
  for (const [id, approved, summary] of humanGates) {
    gates.push(
      gate(
        id,
        'human-only',
        approved ? 'pass' : 'pending',
        approved ? `${summary} Recorded as approved.` : summary,
      ),
    )
  }
  if (profile.science.confidence !== 'high') {
    gates.push(
      gate(
        'science-confidence',
        'warning',
        'pending',
        `Scientific identity confidence is ${profile.science.confidence}; wording must preserve uncertainty.`,
        { evidence: profile.science.sourceUrls },
      ),
    )
  }
  const narrations = localizedNarrationAssets(profile.assets)
  for (const locale of ['zh-CN', 'en'] as const) {
    if (narrations[locale]?.humanReviewStatus !== 'approved') {
      gates.push(
        gate(
          `audio-listen-warning-${locale}`,
          'warning',
          'pending',
          `${locale} narration has not completed human listening review.`,
        ),
      )
    }
  }
  return gates
}
